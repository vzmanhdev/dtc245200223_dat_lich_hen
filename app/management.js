export function adminManagementRoutes(app,{pool,admin,csrf,fail}) {
 const id=value=>{const n=Number(value);if(!Number.isSafeInteger(n)||n<1)throw fail('Mã dữ liệu không hợp lệ.',422);return n;};
 const text=(value,label,min,max)=>{const s=String(value||'').trim();if(s.length<min||s.length>max)throw fail(`${label} cần từ ${min} đến ${max} ký tự.`,422);return s;};
 const active=value=>value===true||value==='true'||value==='on';
 const localTime=value=>new Date(new Date(value).getTime()+7*3600000).toISOString().slice(0,16);
 const dateTime=value=>{const s=String(value||'');const d=new Date(s+'+07:00');if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s)||!Number.isFinite(d.getTime())||localTime(d)!==s||d<=new Date()||d>Date.now()+365*86400000)throw fail('Chọn thời gian hợp lệ trong tương lai, tối đa 365 ngày.',422);return d;};
 async function transaction(fn){const db=await pool.connect();try{await db.query('BEGIN');const data=await fn(db);await db.query('COMMIT');return data;}catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}}
 function mutation(path,fn){app.post(path,csrf,async(req,res,next)=>{try{res.json(await transaction(db=>fn(db,req)));}catch(e){if(e.code==='23P01'||e.code==='23505')e=fail('Dữ liệu bị trùng hoặc nhân viên đã có khung giờ chồng lấn.',409);if(e.code==='23503')e=fail('Dữ liệu liên quan không tồn tại hoặc đang được sử dụng.',409);next(e);}});}
 async function existing(db,table,key){const result=await db.query(`SELECT * FROM ${table} WHERE id=$1 FOR UPDATE`,[id(key)]);if(!result.rowCount)throw fail('Không tìm thấy dữ liệu.',404);return result.rows[0];}
 async function held(db,column,key){return (await db.query(`SELECT 1 FROM appointments a JOIN time_slots t ON t.id=a.slot_id WHERE ${column}=$1 AND a.status IN ('pending','confirmed') AND t.end_at>now() LIMIT 1`,[key])).rowCount>0;}
 function blocked(){throw fail('Đang có lịch hẹn sắp tới. Hãy xử lý các lịch liên quan trước khi ngừng hoạt động hoặc bỏ phân công.',409);}
 async function serviceInput(db,body,old){
  const name=text(body.name,'Tên dịch vụ',2,100),description=text(body.description,'Mô tả',5,2000),duration=Number(body.durationMinutes),price=Number(body.price);
  if(!Number.isInteger(duration)||duration<15||duration>240||duration%15||!Number.isSafeInteger(price)||price<0||price>100000000)throw fail('Thời lượng phải là bội số 15 (15–240 phút), giá từ 0 đến 100 triệu đồng.',422);
  const enabled=active(body.active);
  if(old){
   if(!enabled&&await held(db,'t.service_id',old.id))blocked();
   if(old.duration_minutes!==duration&&(await db.query('SELECT 1 FROM time_slots WHERE service_id=$1 AND is_open AND start_at>now() LIMIT 1',[old.id])).rowCount)throw fail('Cần đóng các khung giờ tương lai trước khi đổi thời lượng dịch vụ.',409);
  }
  return [name,description,duration,price,enabled];
 }
 app.use('/admin',(req,res,next)=>res.locals.user?next():res.redirect('/login'));
 app.use('/api/admin',admin);
 const serviceList=()=>pool.query('SELECT s.*, (SELECT count(*)::int FROM staff_services ss JOIN staff m ON m.id=ss.staff_id WHERE ss.service_id=s.id AND m.active) AS staff_count FROM services s ORDER BY s.active DESC,s.id');
 const staffList=()=>pool.query("SELECT m.*,COALESCE((SELECT array_agg(ss.service_id ORDER BY ss.service_id) FROM staff_services ss WHERE ss.staff_id=m.id),'{}') AS service_ids FROM staff m ORDER BY m.active DESC,m.id");
 app.get('/api/admin/services',async(req,res,next)=>{try{res.json((await serviceList()).rows);}catch(e){next(e);}});
 app.get('/api/admin/staff',async(req,res,next)=>{try{res.json((await staffList()).rows);}catch(e){next(e);}});
 app.get('/admin/services',async(req,res,next)=>{try{const rows=(await serviceList()).rows;const edit=req.query.edit?rows.find(r=>r.id===id(req.query.edit)):null;if(req.query.edit&&!edit)throw fail('Không tìm thấy dịch vụ.',404);res.render('manage-services',{rows,edit,section:'services'});}catch(e){next(e);}});
 app.get('/admin/staff',async(req,res,next)=>{try{const rows=(await staffList()).rows,services=(await serviceList()).rows;const edit=req.query.edit?rows.find(r=>r.id===id(req.query.edit)):null;if(req.query.edit&&!edit)throw fail('Không tìm thấy nhân viên.',404);res.render('manage-staff',{rows,services,edit,section:'staff'});}catch(e){next(e);}});
 mutation('/api/admin/services',async(db,req)=>({item:(await db.query('INSERT INTO services(name,description,duration_minutes,price,active) VALUES($1,$2,$3,$4,$5) RETURNING *',await serviceInput(db,req.body))).rows[0],message:'Đã thêm dịch vụ. Hãy phân công nhân viên và tạo khung giờ.'}));
 mutation('/api/admin/services/:id',async(db,req)=>{const old=await existing(db,'services',req.params.id);return {item:(await db.query('UPDATE services SET name=$1,description=$2,duration_minutes=$3,price=$4,active=$5 WHERE id=$6 RETURNING *',[...await serviceInput(db,req.body,old),old.id])).rows[0],message:'Đã cập nhật dịch vụ.'};});
 mutation('/api/admin/services/:id/archive',async(db,req)=>{const old=await existing(db,'services',req.params.id);if(await held(db,'t.service_id',old.id))blocked();await db.query('UPDATE services SET active=false WHERE id=$1',[old.id]);return {message:'Đã ngừng dịch vụ; lịch sử được giữ lại.'};});
 async function staffInput(db,body,old){
  const name=text(body.fullName,'Họ tên',2,100),title=text(body.title,'Chức danh',2,120),bio=text(body.bio,'Giới thiệu',5,2000),enabled=active(body.active);
  const values=Array.isArray(body.serviceIds)?body.serviceIds:body.serviceIds?[body.serviceIds]:[];const services=[...new Set(values.map(id))];
  if(services.length>100||(enabled&&!services.length))throw fail('Nhân viên hoạt động cần ít nhất một dịch vụ được phân công.',422);
  if((await db.query('SELECT id FROM services WHERE id=ANY($1::integer[]) ORDER BY id',[services])).rowCount!==services.length)throw fail('Dịch vụ phân công không hợp lệ.',422);
  if(old){
   if(!enabled&&await held(db,'t.staff_id',old.id))blocked();
   const remaining=await db.query("SELECT 1 FROM appointments a JOIN time_slots t ON t.id=a.slot_id WHERE t.staff_id=$1 AND NOT(t.service_id=ANY($2::integer[])) AND a.status IN ('pending','confirmed') AND t.end_at>now() LIMIT 1",[old.id,services]);
   if(remaining.rowCount)blocked();
  }
  return {values:[name,title,bio,enabled],services};
 }
 async function assignments(db,key,services){await db.query('DELETE FROM staff_services WHERE staff_id=$1',[key]);for(const service of services)await db.query('INSERT INTO staff_services VALUES($1,$2)',[key,service]);}
 mutation('/api/admin/staff',async(db,req)=>{const input=await staffInput(db,req.body);const item=(await db.query('INSERT INTO staff(full_name,title,bio,active) VALUES($1,$2,$3,$4) RETURNING *',input.values)).rows[0];await assignments(db,item.id,input.services);return {item,message:'Đã thêm nhân viên và phân công dịch vụ.'};});
 mutation('/api/admin/staff/:id',async(db,req)=>{const old=await existing(db,'staff',req.params.id);const input=await staffInput(db,req.body,old);const item=(await db.query('UPDATE staff SET full_name=$1,title=$2,bio=$3,active=$4 WHERE id=$5 RETURNING *',[...input.values,old.id])).rows[0];await assignments(db,old.id,input.services);return {item,message:'Đã cập nhật nhân viên.'};});
 mutation('/api/admin/staff/:id/archive',async(db,req)=>{const old=await existing(db,'staff',req.params.id);if(await held(db,'t.staff_id',old.id))blocked();await db.query('UPDATE staff SET active=false WHERE id=$1',[old.id]);return {message:'Đã ngừng nhận lịch của nhân viên.'};});
 async function slotInput(db,body){
  const service=await existing(db,'services',body.serviceId),member=await existing(db,'staff',body.staffId);
  if(!service.active||!member.active||!(await db.query('SELECT 1 FROM staff_services WHERE staff_id=$1 AND service_id=$2',[member.id,service.id])).rowCount)throw fail('Chọn dịch vụ và nhân viên đang hoạt động, đã được phân công.',422);
  const start=dateTime(body.startAt),end=new Date(start.getTime()+service.duration_minutes*60000);
  return {service,member,start,end};
 }
 mutation('/api/admin/slots',async(db,req)=>{
  const {service,member,start,end}=await slotInput(db,req.body);const batch=req.body.mode==='batch';const until=batch?dateTime(req.body.untilAt):end;const step=service.duration_minutes*60000;
  const count=(until-start)/step;
  if(!Number.isInteger(count)||count<1||count>32||localTime(until).slice(0,10)!==localTime(start).slice(0,10))throw fail('Khoảng tạo lịch phải cùng ngày, chia hết cho thời lượng dịch vụ và không quá 32 khung giờ.',422);
  const items=[];
  for(let i=0;i<count;i++){const from=new Date(start.getTime()+i*step),to=new Date(from.getTime()+step);items.push((await db.query('INSERT INTO time_slots(service_id,staff_id,start_at,end_at) VALUES($1,$2,$3,$4) RETURNING *',[service.id,member.id,from,to])).rows[0]);}
  return {items,message:`Đã mở ${items.length} khung giờ.`,redirect:'/admin/slots?date='+localTime(start).slice(0,10)+'&staffId='+member.id};
 });
 mutation('/api/admin/slots/:id',async(db,req)=>{
  const old=await existing(db,'time_slots',req.params.id);
  if((await db.query('SELECT 1 FROM appointments WHERE slot_id=$1 LIMIT 1',[old.id])).rowCount)throw fail('Khung giờ đã có lịch sử đặt hẹn; hãy đóng khung này và tạo khung mới để giữ lịch sử.',409);
  const {service,member,start,end}=await slotInput(db,req.body);
  const item=(await db.query('UPDATE time_slots SET service_id=$2,staff_id=$3,start_at=$4,end_at=$5 WHERE id=$1 RETURNING *',[old.id,service.id,member.id,start,end])).rows[0];
  return {item,message:'Đã cập nhật khung giờ.',redirect:'/admin/slots?date='+localTime(start).slice(0,10)+'&staffId='+member.id};
 });
 mutation('/api/admin/slots/:id/open',async(db,req)=>{
  const old=await existing(db,'time_slots',req.params.id),enabled=active(req.body.isOpen);
  if(await held(db,'t.id',old.id))throw fail('Khung giờ đang có khách đặt. Hãy xử lý lịch hẹn trước.',409);
  if(enabled){const {service}=await slotInput(db,{serviceId:old.service_id,staffId:old.staff_id,startAt:localTime(old.start_at)});if((new Date(old.end_at)-new Date(old.start_at))/60000!==service.duration_minutes)throw fail('Thời lượng dịch vụ đã đổi. Hãy tạo khung giờ mới.',409);}
  await db.query('UPDATE time_slots SET is_open=$2 WHERE id=$1',[old.id,enabled]);return {message:enabled?'Đã mở lại khung giờ.':'Đã đóng khung giờ.'};
 });
 async function slotRows(query){
  const date=String(query.date||new Date(Date.now()+7*3600000).toISOString().slice(0,10)),member=query.staffId?id(query.staffId):null;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date)))throw fail('Ngày lọc không hợp lệ.',422);
  const rows=await pool.query("SELECT t.*,s.name AS service_name,m.full_name AS staff_name,EXISTS(SELECT 1 FROM appointments a WHERE a.slot_id=t.id AND a.status IN ('pending','confirmed','completed')) AS booked,EXISTS(SELECT 1 FROM appointments a WHERE a.slot_id=t.id) AS has_history FROM time_slots t JOIN services s ON s.id=t.service_id JOIN staff m ON m.id=t.staff_id WHERE to_char(t.start_at AT TIME ZONE 'Asia/Ho_Chi_Minh','YYYY-MM-DD')=$1 AND ($2::integer IS NULL OR t.staff_id=$2) ORDER BY t.start_at,t.staff_id LIMIT 300",[date,member]);return {rows:rows.rows,date,staffId:query.staffId||''};
 }
 app.get('/api/admin/slots',async(req,res,next)=>{try{res.json((await slotRows(req.query)).rows);}catch(e){next(e);}});
 app.get('/admin/slots',async(req,res,next)=>{try{const data=await slotRows(req.query);const edit=req.query.edit?(await pool.query('SELECT * FROM time_slots WHERE id=$1',[id(req.query.edit)])).rows[0]:null;if(req.query.edit&&!edit)throw fail('Không tìm thấy khung giờ.',404);res.render('manage-slots',{...data,edit,services:(await serviceList()).rows,staff:(await staffList()).rows,localTime,section:'slots'});}catch(e){next(e);}});
 async function customers(query){const q=String(query.q||'').trim().slice(0,100);const result=await pool.query("SELECT c.id,c.full_name,c.phone,c.email,c.active,c.created_at,(SELECT count(*)::int FROM appointments a JOIN customers contact ON contact.id=a.customer_id WHERE contact.account_id=c.id) AS booking_count FROM customer_accounts c WHERE ($1='' OR c.full_name ILIKE '%'||$1||'%' OR c.email ILIKE '%'||$1||'%' OR c.phone ILIKE '%'||$1||'%') ORDER BY c.id DESC LIMIT 200",[q]);return {rows:result.rows,q};}
 app.get('/api/admin/customers',async(req,res,next)=>{try{res.json((await customers(req.query)).rows);}catch(e){next(e);}});
 app.get('/admin/customers',async(req,res,next)=>{try{const data=await customers(req.query);let edit=null,history=[];if(req.query.edit){edit=(await pool.query('SELECT id,full_name,phone,email,active FROM customer_accounts WHERE id=$1',[id(req.query.edit)])).rows[0];if(!edit)throw fail('Không tìm thấy khách hàng.',404);history=(await pool.query('SELECT a.booking_code,a.status,a.service_name_snapshot,t.start_at FROM appointments a JOIN customers c ON c.id=a.customer_id JOIN time_slots t ON t.id=a.slot_id WHERE c.account_id=$1 ORDER BY t.start_at DESC LIMIT 50',[edit.id])).rows;}
   const legacy=(await pool.query('SELECT c.full_name,c.phone,c.email,a.booking_code,a.status FROM customers c JOIN appointments a ON a.customer_id=c.id WHERE c.account_id IS NULL ORDER BY a.id DESC LIMIT 50')).rows;
   res.render('manage-customers',{...data,edit,history,legacy,section:'customers'});
  }catch(e){next(e);}});
 mutation('/api/admin/customers/:id',async(db,req)=>{const old=await existing(db,'customer_accounts',req.params.id);const name=text(req.body.fullName,'Họ tên',2,100),phone=text(req.body.phone,'Số điện thoại',9,20);if(!/^[+0-9 ()-]{9,20}$/.test(phone))throw fail('Số điện thoại không hợp lệ.',422);await db.query('UPDATE customer_accounts SET full_name=$2,phone=$3,active=$4 WHERE id=$1',[old.id,name,phone,active(req.body.active)]);return {message:'Đã cập nhật khách hàng. Thông tin liên hệ trong lịch cũ được giữ nguyên.'};});
}
