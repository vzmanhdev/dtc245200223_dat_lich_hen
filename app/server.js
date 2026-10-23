import express from 'express';
import { adminManagementRoutes } from './management.js';
import { customerRoutes, requireCustomer } from './customer-auth.js';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import helmet from 'helmet';
import { rateLimit, ipKeyGenerator } from 'express-rate-limit';
import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pino from 'pino';
import client from 'prom-client';
import { pool } from './db.js';
import { rotatingLog } from './rotating-log.js';
import { validateBooking, passwordMatches, tokenHash, canTransition, statusNames, formatDate, formatTime } from './domain.js';

if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) throw new Error('SESSION_SECRET is required (at least 32 characters).');
const root = path.dirname(fileURLToPath(import.meta.url));
const logDir = process.env.LOG_DIR || path.resolve('logs');
mkdirSync(logDir, { recursive: true });
const logger = pino({ level: 'info', timestamp: pino.stdTimeFunctions.isoTime }, pino.multistream([
  { stream: process.stdout }, { stream: rotatingLog(path.join(logDir,'app.log')) }
]));
const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.set('view engine','ejs');
app.set('views',path.join(root,'views'));
app.locals.csrf='';
app.locals.user=null;
app.locals.customer=null;
app.use(helmet({ strictTransportSecurity: false, contentSecurityPolicy: { directives: { upgradeInsecureRequests: null } } }));
app.use(express.json({ limit:'16kb' }));
app.use(express.urlencoded({ extended:false, limit:'16kb' }));

const registry = new client.Registry();
client.collectDefaultMetrics({ register:registry });
const requests = new client.Counter({ name:'http_requests_total', help:'Completed HTTP requests', labelNames:['method','route','status'], registers:[registry] });
const duration = new client.Histogram({ name:'http_request_duration_seconds', help:'HTTP response latency', labelNames:['method','route'], buckets:[.005,.01,.025,.05,.1,.25,.5,1,2,5], registers:[registry] });
app.use((req,res,next) => {
  req.requestId = randomUUID();
  res.setHeader('X-Request-ID',req.requestId);
  const start = process.hrtime.bigint();
  res.on('finish',() => {
    if (['/metrics','/health/live','/health/ready'].includes(req.path)) return;
    const route = req.route?.path || (req.path.startsWith('/assets/') ? '/assets/*' : 'unmatched');
    const seconds = Number(process.hrtime.bigint()-start)/1e9;
    requests.inc({method:req.method,route,status:String(res.statusCode)});
    duration.observe({method:req.method,route},seconds);
    logger.info({request_id:req.requestId,method:req.method,route,status:res.statusCode,duration_ms:Math.round(seconds*1000)},'request completed');
  });
  next();
});
app.get('/health/live',(req,res) => res.json({status:'ok'}));
app.get('/health/ready',async(req,res,next) => {
  try { const schema=await pool.query('SELECT version FROM schema_migrations WHERE version=3'); if(!schema.rowCount)throw new Error('Migration required'); res.json({status:'ready',database:'connected'}); }
  catch(e) { e.status=503; next(e); }
});
app.get('/metrics',async(req,res) => res.type(registry.contentType).send(await registry.metrics()));
app.use('/assets',express.static(path.join(root,'public'),{maxAge:'1h'}));
app.use(session({
  store:new (connectPgSimple(session))({pool,createTableIfMissing:false,pruneSessionInterval:300}),
  name:'appointment.sid', secret:process.env.SESSION_SECRET, resave:false, saveUninitialized:false,
  cookie:{httpOnly:true,sameSite:'strict',secure:false,maxAge:2*60*60*1000}
}));
app.use(async(req,res,next) => {
 try {
  res.locals.customer = req.session.customerId ? (await pool.query('SELECT id,email,full_name,phone FROM customer_accounts WHERE id=$1 AND active',[req.session.customerId])).rows[0] || null : null;
  res.locals.csrf = req.session.csrf ||= randomBytes(32).toString('hex');
  res.locals.user = req.session.admin ? (await pool.query('SELECT id,username FROM admin_users WHERE id=$1 AND active',[req.session.admin.id])).rows[0] || null : null;
  if(!res.locals.user)delete req.session.admin;
  if(!res.locals.customer)delete req.session.customerId;
  res.locals.statusNames=statusNames;
  res.locals.formatDate=formatDate;
  res.locals.formatTime=formatTime;
  next();
 }catch(e){next(e);}
});
const limited = rateLimit({windowMs:60_000,limit:30,keyGenerator:(req,res)=>res.locals.customer?'customer:'+res.locals.customer.id:ipKeyGenerator(req.ip),standardHeaders:'draft-8',legacyHeaders:false,message:{error:'Bạn thao tác quá nhanh. Vui lòng thử lại sau một phút.'}});
const loginLimit = rateLimit({windowMs:15*60_000,limit:15,standardHeaders:'draft-8',legacyHeaders:false,message:{error:'Quá nhiều lần đăng nhập. Vui lòng thử lại sau.'}});
function csrf(req,res,next) {
  const supplied = String(req.get('X-CSRF-Token') || req.body?._csrf || '');
  const expected = req.session.csrf || '';
  if (!/^[a-f0-9]{64}$/.test(supplied) || !expected || !timingSafeEqual(Buffer.from(supplied),Buffer.from(expected))) return res.status(403).json({error:'Phiên thao tác đã hết hạn. Vui lòng tải lại trang.'});
  next();
}
function admin(req,res,next) {
  if (!req.session.admin) return res.status(401).json({error:'Bạn cần đăng nhập quản trị.'});
  next();
}
const fail = (message,status=400) => Object.assign(new Error(message),{status});
const bookingSelect = `SELECT a.id,a.booking_code,a.status,a.service_name_snapshot AS service_name,a.created_at,t.start_at,t.end_at,COALESCE(a.staff_name_snapshot,member.full_name) AS staff_name,a.price_snapshot,t.staff_id FROM appointments a JOIN time_slots t ON t.id=a.slot_id JOIN staff member ON member.id=t.staff_id`;
app.get('/',async(req,res,next) => {
  try { const services = await pool.query('SELECT id,name,description,duration_minutes,price FROM services WHERE active ORDER BY id'); const staff=await pool.query('SELECT id,full_name,title,bio FROM staff WHERE active ORDER BY id'); res.render('index',{services:services.rows,staff:staff.rows}); } catch(e) { next(e); }
});
customerRoutes(app,{pool,csrf,loginLimit,bookingSelect,updateStatus});
app.get('/api/staff',async(req,res,next)=>{try{const serviceId=req.query.serviceId===undefined?null:Number(req.query.serviceId);if(serviceId!==null&&(!Number.isSafeInteger(serviceId)||serviceId<1))throw fail('Dịch vụ không hợp lệ.',422);res.json((await pool.query('SELECT id,full_name,title,bio FROM staff WHERE active AND ($1::integer IS NULL OR EXISTS(SELECT 1 FROM staff_services ss JOIN services s ON s.id=ss.service_id WHERE ss.staff_id=staff.id AND ss.service_id=$1 AND s.active)) ORDER BY id',[serviceId])).rows);}catch(e){next(e);}});
app.get('/api/csrf',(req,res) => res.json({csrf:req.session.csrf}));
app.get('/api/services',async(req,res,next) => {
  try { res.json((await pool.query('SELECT id,name,description,duration_minutes,price FROM services WHERE active ORDER BY id')).rows); } catch(e) { next(e); }
});
app.get('/api/slots',async(req,res,next) => {
  try {
    const id=Number(req.query.serviceId),date=String(req.query.date || ''),staffId=req.query.staffId===undefined?null:Number(req.query.staffId);
    if(staffId!==null&&(!Number.isSafeInteger(staffId)||staffId<1))throw fail('Chọn chuyên viên hợp lệ.',422);
    if (!Number.isSafeInteger(id) || id<1 || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date))) throw fail('Chọn dịch vụ và ngày hợp lệ.',422);
    const rows = await pool.query(`SELECT t.id,t.start_at,t.end_at,t.staff_id,member.full_name AS staff_name FROM time_slots t JOIN services s ON s.id=t.service_id JOIN staff member ON member.id=t.staff_id WHERE member.active AND EXISTS(SELECT 1 FROM staff_services ss WHERE ss.staff_id=t.staff_id AND ss.service_id=t.service_id) AND ($3::integer IS NULL OR t.staff_id=$3) AND t.service_id=$1 AND s.active AND t.is_open AND t.start_at>now() AND (t.start_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date=$2::date AND NOT EXISTS(SELECT 1 FROM appointments a WHERE a.slot_id=t.id AND a.status IN ('pending','confirmed','completed')) ORDER BY t.start_at,t.staff_id`,[id,date,staffId]);
    res.json(rows.rows);
  } catch(e) { if (e.code==='22008') e=fail('Ngày không hợp lệ.',422); next(e); }
});
app.post('/api/appointments',limited,csrf,requireCustomer,async(req,res,next) => {
  let db;
  try {
    const profile=res.locals.customer;
    const input=validateBooking({...req.body,fullName:profile.full_name,phone:profile.phone,email:profile.email});
    const hash=tokenHash(JSON.stringify([profile.id,input.name,input.phone,input.email,input.slotId]));
    db=await pool.connect(); await db.query('BEGIN');
    await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[input.key]);
    const previous=await db.query('SELECT id,booking_code,request_hash,status FROM appointments WHERE idempotency_key=$1',[input.key]);
    if (previous.rowCount) {
      if (previous.rows[0].request_hash!==hash) throw fail('Mã yêu cầu đã được dùng cho nội dung khác.',409);
      await db.query('COMMIT');
      return res.json({bookingCode:previous.rows[0].booking_code,status:previous.rows[0].status,replayed:true,message:'Lịch đã được tạo trước đó. Bạn có thể xem trong tài khoản.'});
    }
    const slot=await db.query(`SELECT t.*,s.name,s.price,s.duration_minutes,s.active,member.active AS staff_active,member.full_name AS staff_name FROM time_slots t JOIN services s ON s.id=t.service_id JOIN staff member ON member.id=t.staff_id WHERE t.id=$1 FOR UPDATE OF t,s,member`,[input.slotId]);
    const item=slot.rows[0];
    if (!item || !item.is_open || !item.active || !item.staff_active || (new Date(item.end_at)-new Date(item.start_at))!==item.duration_minutes*60000 || new Date(item.start_at)<=new Date()) throw fail('Khung giờ không còn mở. Vui lòng chọn giờ khác.',409);
    if(!(await db.query('SELECT 1 FROM staff_services WHERE staff_id=$1 AND service_id=$2',[item.staff_id,item.service_id])).rowCount)throw fail('Chuyên viên không còn phục vụ dịch vụ này.',409);
    if((req.body.staffId!==undefined&&Number(req.body.staffId)!==item.staff_id)||(req.body.serviceId!==undefined&&Number(req.body.serviceId)!==item.service_id))throw fail('Khung giờ không khớp dịch vụ hoặc nhân viên đã chọn.',422);
    const customer=await db.query('INSERT INTO customers(full_name,phone,email,account_id) VALUES($1,$2,$3,$4) RETURNING id',[input.name,input.phone,input.email,profile.id]);
    const token=randomBytes(32).toString('base64url'),code='MH-'+randomBytes(6).toString('hex').toUpperCase();
    const result=await db.query('INSERT INTO appointments(booking_code,token_hash,idempotency_key,request_hash,customer_id,slot_id,service_name_snapshot,staff_name_snapshot,price_snapshot) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id',[code,tokenHash(token),input.key,hash,customer.rows[0].id,input.slotId,item.name,item.staff_name,item.price]);
    await db.query(`INSERT INTO appointment_events(appointment_id,to_status,actor_type) VALUES($1,'pending','customer')`,[result.rows[0].id]);
    await db.query('COMMIT');
    res.status(201).json({bookingCode:code,token,status:'pending',serviceName:item.name,staffName:item.staff_name,startAt:item.start_at,endAt:item.end_at});
  } catch(e) {
    if(db) await db.query('ROLLBACK').catch(()=>{});
    if(e.code==='23505') e=fail('Khung giờ vừa có người đặt. Vui lòng chọn giờ khác.',409);
    next(e);
  } finally { db?.release(); }
});
app.post('/api/appointments/lookup',limited,csrf,async(req,res,next) => {
  try {
    const token=String(req.body.token || '');
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw fail('Không tìm thấy lịch hẹn.',404);
    const rows=await pool.query(bookingSelect+' WHERE a.token_hash=$1',[tokenHash(token)]);
    if (!rows.rowCount) throw fail('Không tìm thấy lịch hẹn.',404);
    res.json(rows.rows[0]);
  } catch(e) { next(e); }
});
async function updateStatus(id,to,actor,token,accountId=null) {
  const db=await pool.connect();
  try {
    await db.query('BEGIN');
    const row=await db.query(`SELECT a.id,a.status,a.token_hash,t.start_at,t.end_at FROM appointments a JOIN time_slots t ON t.id=a.slot_id WHERE ${token?'a.token_hash=$1':'a.id=$1'} AND ($2::bigint IS NULL OR EXISTS(SELECT 1 FROM customers c WHERE c.id=a.customer_id AND c.account_id=$2)) FOR UPDATE OF a`,[token?tokenHash(token):id,accountId]);
    const a=row.rows[0];
    if (!a) throw fail('Không tìm thấy lịch hẹn.',404);
    if (!canTransition(a.status,to,a.start_at,a.end_at)) throw fail('Không thể đổi trạng thái lịch này tại thời điểm hiện tại.',409);
    await db.query('UPDATE appointments SET status=$2,updated_at=now() WHERE id=$1',[a.id,to]);
    await db.query('INSERT INTO appointment_events(appointment_id,from_status,to_status,actor_type,actor_admin_id) VALUES($1,$2,$3,$4,$5)',[a.id,a.status,to,actor?'admin':'customer',actor?.id || null]);
    await db.query('COMMIT');
    return {status:to};
  } catch(e) { await db.query('ROLLBACK'); throw e; } finally { db.release(); }
}
app.post('/api/appointments/cancel',limited,csrf,async(req,res,next) => {
  try {
    const token=String(req.body.token || '');
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw fail('Không tìm thấy lịch hẹn.',404);
    res.json(await updateStatus(null,'cancelled',null,token));
  } catch(e) { next(e); }
});
app.get('/admin/login',(req,res)=>res.redirect('/login'));
app.post('/admin/login',(req,res)=>res.redirect(307,'/login'));
app.post('/admin/logout',(req,res)=>res.redirect(307,'/logout'));
adminManagementRoutes(app,{pool,admin,csrf,fail});
app.get('/admin',async(req,res,next) => {
  if(!req.session.admin)return res.redirect('/login');
  try {
    const status=String(req.query.status || ''),date=String(req.query.date || ''),q=String(req.query.q||'').trim().slice(0,100),staffId=String(req.query.staffId||'');
    if(staffId&&(!Number.isSafeInteger(Number(staffId))||Number(staffId)<1))throw fail('Nhân viên không hợp lệ.',422);
    if(status && !Object.hasOwn(statusNames,status))throw fail('Trạng thái không hợp lệ.',422);
    if(date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date))))throw fail('Ngày không hợp lệ.',422);
    const rows=await pool.query(bookingSelect+` JOIN customers c ON c.id=a.customer_id WHERE ($1::text='' OR a.status=$1) AND ($2::text='' OR to_char(t.start_at AT TIME ZONE 'Asia/Ho_Chi_Minh','YYYY-MM-DD')=$2) AND ($3::integer IS NULL OR t.staff_id=$3) AND ($4='' OR a.booking_code ILIKE '%'||$4||'%' OR c.full_name ILIKE '%'||$4||'%') ORDER BY CASE WHEN a.status='pending' THEN 0 WHEN a.status='confirmed' THEN 1 ELSE 2 END,t.start_at LIMIT 200`,[status,date,staffId?Number(staffId):null,q]);
    const details=rows.rowCount?await pool.query('SELECT a.id,c.full_name,c.phone,c.email FROM appointments a JOIN customers c ON c.id=a.customer_id WHERE a.id=ANY($1::bigint[])',[rows.rows.map(x=>x.id)]):{rows:[]};
    const people=new Map(details.rows.map(x=>[x.id,x]));
    const counts=await pool.query('SELECT status,count(*)::int AS count FROM appointments GROUP BY status');
    const stats=Object.fromEntries(counts.rows.map(x=>[x.status,x.count]));
    res.render('admin',{appointments:rows.rows.map(x=>({...x,...people.get(x.id)})),stats,status,date,q,staffId,staff:(await pool.query('SELECT id,full_name FROM staff ORDER BY id')).rows});
  } catch(e) { next(e); }
});
app.post('/api/admin/appointments/:id/status',admin,csrf,async(req,res,next) => {
  try {
    if(!/^\d+$/.test(req.params.id)||!['confirmed','cancelled','completed'].includes(req.body.status))throw fail('Yêu cầu không hợp lệ.',422);
    res.json(await updateStatus(req.params.id,req.body.status,req.session.admin));
  } catch(e) { next(e); }
});
app.use((req,res) => res.status(404).format({html:()=>res.render('error',{message:'Trang bạn tìm chưa có ở đây.',status:404}),default:()=>res.json({error:'Không tìm thấy đường dẫn.'})}));
app.use((error,req,res,next) => {
  const status=error.status || 500;
  if(status>=500)logger.error({request_id:req.requestId,code:error.code || 'INTERNAL_ERROR'},'request failed');
  const message=status>=500?'Hệ thống tạm chưa sẵn sàng. Vui lòng thử lại sau.':error.message;
  res.status(status).format({html:()=>res.render('error',{message,status}),default:()=>res.json({error:message,requestId:req.requestId})});
});
pool.on('error',error=>logger.error({code:error.code || 'DB_POOL_ERROR'},'database connection error'));
const server=app.listen(Number(process.env.PORT || 3000),process.env.BIND_HOST || '0.0.0.0',()=>logger.info({port:Number(process.env.PORT || 3000)},'appointment server started'));
server.requestTimeout=15000;
let shutting=false;
async function shutdown() {
  if(shutting)return;shutting=true;
  const timer=setTimeout(()=>process.exit(1),10000);timer.unref();
  server.close(async()=>{await pool.end();logger.flush();process.exit(0);});
}
process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown);
