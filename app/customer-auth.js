import { randomBytes } from 'node:crypto';
import { passwordHash, passwordMatches, validateBooking } from './domain.js';

export function requireCustomer(req,res,next) {
 if(!res.locals.customer) return res.status(401).json({error:'Vui lòng đăng nhập tài khoản khách hàng để đặt lịch.'});
 next();
}
export function customerRoutes(app,{pool,csrf,loginLimit,bookingSelect,updateStatus}) {
 function signIn(req,res,next,id,role='customer',email='') {
  req.session.regenerate(error=>{
   if(error)return next(error);
   if(role==='admin')req.session.admin={id,username:email};else req.session.customerId=id;
   req.session.csrf=randomBytes(32).toString('hex');
   req.session.save(error=>error?next(error):res.redirect(role==='admin'?'/admin':'/account'));
  });
 }
 app.get('/login',(req,res)=>res.locals.user?res.redirect('/admin'):res.locals.customer?res.redirect('/account'):res.render('customer-auth',{mode:'login',error:null}));
 app.get('/register',(req,res)=>res.locals.user?res.redirect('/admin'):res.locals.customer?res.redirect('/account'):res.render('customer-auth',{mode:'register',error:null}));
 app.post('/register',loginLimit,csrf,async(req,res,next)=>{
  try {
   const email=String(req.body.email||'').trim().toLowerCase();
   const profile=validateBooking({...req.body,email,slotId:1,idempotencyKey:'register_customer_01'});
   if(!email || typeof req.body.password!=='string' || req.body.password.length<12 || req.body.password.length>128 || req.body.password!==req.body.confirmPassword)
    return res.status(422).render('customer-auth',{mode:'register',error:'Email bắt buộc. Mật khẩu cần 12–128 ký tự và phần nhập lại phải khớp.'});
   if((await pool.query('SELECT 1 FROM admin_users WHERE lower(username)=$1',[email])).rowCount)return res.status(409).render('customer-auth',{mode:'register',error:'Email này không thể đăng ký. Nếu đã có tài khoản, hãy đăng nhập.'});
   const row=await pool.query('INSERT INTO customer_accounts(email,full_name,phone,password_hash) VALUES($1,$2,$3,$4) RETURNING id',[email,profile.name,profile.phone,passwordHash(req.body.password)]);
   signIn(req,res,next,row.rows[0].id);
  }catch(e){
   if(e.code==='23505')return res.status(409).render('customer-auth',{mode:'register',error:'Không thể đăng ký email này. Nếu đã có tài khoản, hãy đăng nhập.'});
   if(e.status===422)return res.status(422).render('customer-auth',{mode:'register',error:e.message});
   next(e);
  }
 });
 app.post('/login',loginLimit,csrf,async(req,res,next)=>{
  try {
   const email=String(req.body.email||req.body.username||'').trim().toLowerCase().slice(0,200);
   const admin=await pool.query('SELECT id,password_hash FROM admin_users WHERE lower(username)=$1 AND active',[email]);
   const row=admin.rowCount?admin:await pool.query('SELECT id,password_hash FROM customer_accounts WHERE email=$1 AND active AND NOT EXISTS(SELECT 1 FROM admin_users WHERE lower(username)=$1)',[email]);
   // Perform a password hash check even for unknown users.
   const hash=row.rows[0]?.password_hash || '00000000000000000000000000000000:'+ '00'.repeat(64);
   if(!passwordMatches(req.body.password,hash) || !row.rowCount)return res.status(401).render('customer-auth',{mode:'login',error:'Email hoặc mật khẩu chưa đúng.'});
   signIn(req,res,next,row.rows[0].id,admin.rowCount?'admin':'customer',email);
  }catch(e){next(e);}
 });
 app.post('/logout',csrf,(req,res,next)=>req.session.destroy(error=>{if(error)return next(error);res.clearCookie('appointment.sid');res.redirect('/login');}));
 app.get('/api/me',(req,res)=>res.json({customer:res.locals.customer,admin:res.locals.user,role:res.locals.user?'admin':res.locals.customer?'customer':null}));
 app.post('/api/my/profile',requireCustomer,csrf,async(req,res,next)=>{try{const p=validateBooking({...req.body,email:res.locals.customer.email,slotId:1,idempotencyKey:'profile_update_01'});await pool.query('UPDATE customer_accounts SET full_name=$2,phone=$3 WHERE id=$1',[res.locals.customer.id,p.name,p.phone]);res.json({message:'Đã cập nhật thông tin cá nhân.'});}catch(e){next(e);}});
 app.get('/api/my/appointments',requireCustomer,async(req,res,next)=>{
  try {res.json((await pool.query(bookingSelect+' JOIN customers owner ON owner.id=a.customer_id WHERE owner.account_id=$1 ORDER BY t.start_at DESC LIMIT 200',[res.locals.customer.id])).rows);}catch(e){next(e);}
 });
 app.get('/account',async(req,res,next)=>{
  if(!res.locals.customer)return res.redirect('/login');
  try {
   const rows=await pool.query(bookingSelect+' JOIN customers owner ON owner.id=a.customer_id WHERE owner.account_id=$1 ORDER BY t.start_at DESC LIMIT 200',[res.locals.customer.id]);
   res.render('account',{appointments:rows.rows});
  }catch(e){next(e);}
 });
 app.post('/api/my/appointments/:id/cancel',requireCustomer,csrf,async(req,res,next)=>{
  try {
   if(!/^\d+$/.test(req.params.id))return res.status(404).json({error:'Không tìm thấy lịch hẹn.'});
   res.json(await updateStatus(req.params.id,'cancelled',null,null,res.locals.customer.id));
  }catch(e){next(e);}
 });
}
