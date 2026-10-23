import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
const base=process.env.TEST_BASE_URL||`http://127.0.0.1:${process.env.WEB_PORT||8080}`;
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let lastRequest=0;
async function fetch(...args){await wait(Math.max(0,lastRequest+220-Date.now()));lastRequest=Date.now();return globalThis.fetch(...args);}
async function session(cookie=''){const r=await fetch(base+'/api/csrf',{headers:{Cookie:cookie}});assert.equal(r.status,200);return {cookie:cookie||r.headers.getSetCookie().map(v=>v.split(';')[0]).join('; '),csrf:(await r.json()).csrf};}
async function post(path,body,s){return fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json',Cookie:s.cookie,'X-CSRF-Token':s.csrf},body:JSON.stringify(body)});}
async function save(path,body,s,status=200){const r=await post(path,body,s),data=await r.json();assert.equal(r.status,status,`${path}: ${JSON.stringify(data)}`);return data;}
async function json(path,s){const r=await fetch(base+path,{headers:{Cookie:s?.cookie||'',Accept:'application/json'}});assert.equal(r.status,200,path);return r.json();}
async function signIn(email,password){const initial=await session();const r=await fetch(base+'/login',{method:'POST',redirect:'manual',headers:{'Content-Type':'application/x-www-form-urlencoded',Cookie:initial.cookie},body:new URLSearchParams({_csrf:initial.csrf,email,password})});assert.equal(r.status,302,await r.text());return {...await session(r.headers.getSetCookie().map(v=>v.split(';')[0]).join('; ')),target:r.headers.get('location')};}
async function customer(){const s=await session(),email=`management-${randomUUID()}@example.com`,password='Customer-'+randomUUID();const r=await fetch(base+'/register',{method:'POST',redirect:'manual',headers:{'Content-Type':'application/x-www-form-urlencoded',Cookie:s.cookie},body:new URLSearchParams({_csrf:s.csrf,fullName:'Khách luồng quản trị',phone:'0900000000',email,password,confirmPassword:password,role:'admin'})});assert.equal(r.status,302);return {...await session(r.headers.getSetCookie().map(v=>v.split(';')[0]).join('; ')),email,password};}
test('one login; service/staff/availability/customer administration and complete booking lifecycle',async()=>{
 // Keep production gateway limits enabled while running request-heavy scenarios.
 if(process.env.TEST_DIRECT_APP!=='true')await wait(16000);
 const admin=await signIn(process.env.ADMIN_USERNAME,process.env.ADMIN_PASSWORD);assert.equal(admin.target,'/admin');
 assert.equal((await json('/api/me',admin)).role,'admin');
 const alias=await fetch(base+'/admin/login',{redirect:'manual'});assert.equal(alias.headers.get('location'),'/login');
 const guest=await session();assert.equal((await post('/api/admin/services',{},guest)).status,401);
 const reserved=await fetch(base+'/register',{method:'POST',redirect:'manual',headers:{'Content-Type':'application/x-www-form-urlencoded',Cookie:guest.cookie},body:new URLSearchParams({_csrf:guest.csrf,email:process.env.ADMIN_USERNAME,password:'Reserved-account-123',confirmPassword:'Reserved-account-123',fullName:'Không được chiếm email admin',phone:'0900000000'})});assert.equal(reserved.status,409);
 const client=await customer();assert.equal((await json('/api/me',client)).role,'customer');assert.equal((await post('/api/admin/staff',{},client)).status,401);
 const suffix=randomUUID().slice(0,8);let service,member,booked;const slotIds=[];
 const serviceBody={name:`[Kiểm thử] Tư vấn ${suffix}`,description:'Dịch vụ tạo từ quản trị để kiểm chứng nghiệp vụ.',durationMinutes:60,price:250000,active:true};
 try {
  assert.equal((await post('/api/admin/services',serviceBody,{...admin,csrf:'0'.repeat(64)})).status,403);
  await save('/api/admin/services',{...serviceBody,durationMinutes:17},admin,422);
  service=(await save('/api/admin/services',serviceBody,admin)).item;
  await save('/api/admin/staff',{fullName:'Không có phân công',title:'Tư vấn',bio:'Nhân viên chưa được phân công.',active:true,serviceIds:[]},admin,422);
  const staffBody={fullName:`[Kiểm thử] Nhân viên ${suffix}`,title:'Chuyên viên tư vấn',bio:'Nhân viên phục vụ kiểm thử đầy đủ luồng đặt hẹn.',active:true,serviceIds:[service.id]};
  member=(await save('/api/admin/staff',staffBody,admin)).item;
  const filtered=await json('/api/staff?serviceId='+service.id);assert.deepEqual(filtered.map(m=>m.id),[member.id]);
  const date=new Date(Date.now()+5*86400000+7*3600000).toISOString().slice(0,10);
  const slotBody={serviceId:service.id,staffId:member.id,startAt:date+'T09:00',mode:'single'};
  const first=await save('/api/admin/slots',slotBody,admin);let slot=first.items[0];slotIds.push(slot.id);
  assert.equal((new Date(slot.end_at)-new Date(slot.start_at))/60000,60);
  await save('/api/admin/slots',{...slotBody,startAt:date+'T09:30'},admin,409);
  await save('/api/admin/slots/'+slot.id,{...slotBody,startAt:date+'T10:00'},admin);
  await save('/api/admin/slots/'+slot.id,slotBody,admin);
  const batch=await save('/api/admin/slots',{...slotBody,startAt:date+'T13:00',untilAt:date+'T15:00',mode:'batch'},admin);assert.equal(batch.items.length,2);slotIds.push(...batch.items.map(x=>x.id));
  await save('/api/admin/slots',{...slotBody,startAt:date+'T13:30',untilAt:date+'T15:30',mode:'batch'},admin,409);
  await save('/api/admin/slots/'+slot.id+'/open',{isOpen:false},admin);
  const replacement=(await save('/api/admin/slots',slotBody,admin)).items[0];slotIds.push(replacement.id);
  await save('/api/admin/slots/'+slot.id+'/open',{isOpen:true},admin,409);
  await save('/api/admin/slots/'+replacement.id+'/open',{isOpen:false},admin);
  await save('/api/admin/slots/'+slot.id+'/open',{isOpen:true},admin);
  let options=await json(`/api/slots?serviceId=${service.id}&staffId=${member.id}&date=${date}`);assert.ok(options.some(x=>x.id===slot.id));
  await save('/api/appointments',{slotId:slot.id,staffId:member.id+1000,idempotencyKey:randomUUID()},client,422);
  booked=await save('/api/appointments',{slotId:slot.id,staffId:member.id,serviceId:service.id,idempotencyKey:randomUUID()},client,201);
  const mine=await json('/api/my/appointments',client);assert.equal(mine.length,1);assert.equal(mine[0].service_name,serviceBody.name);assert.equal(mine[0].price_snapshot,250000);
  await save('/api/admin/services/'+service.id+'/archive',{},admin,409);
  await save('/api/admin/staff/'+member.id+'/archive',{},admin,409);
  await save('/api/admin/staff/'+member.id,{...staffBody,serviceIds:[1]},admin,409);
  await save('/api/admin/slots/'+slot.id+'/open',{isOpen:false},admin,409);
  await save('/api/admin/slots/'+slot.id,slotBody,admin,409);
  await save('/api/admin/services/'+service.id,{...serviceBody,name:serviceBody.name+' <script>',price:300000},admin);
  await save('/api/admin/staff/'+member.id,{...staffBody,fullName:staffBody.fullName+' mới'},admin);
  const stable=(await json('/api/my/appointments',client))[0];assert.equal(stable.staff_name,staffBody.fullName);assert.equal(stable.service_name,serviceBody.name);assert.equal(stable.price_snapshot,250000);
  const protectedPage=await fetch(base+'/admin/services',{headers:{Cookie:admin.cookie}});const source=await protectedPage.text();assert.equal(protectedPage.status,200);assert.ok(source.includes('&lt;script&gt;'));assert.ok(!source.includes(serviceBody.name+' <script>'));
  await wait(10000); // Refill Nginx burst bucket without disabling protections.
  for(const path of ['/admin','/admin/services','/admin/staff','/admin/slots?date='+date,'/admin/customers'])assert.equal((await fetch(base+path,{headers:{Cookie:admin.cookie}})).status,200,path);
  await save('/api/admin/appointments/'+stable.id+'/status',{status:'confirmed'},admin);
  assert.equal((await json('/api/my/appointments',client))[0].status,'confirmed');
  const customers=await json('/api/admin/customers?q='+encodeURIComponent(client.email),admin);assert.equal(customers.length,1);const account=customers[0];assert.equal(account.booking_count,1);assert.equal(account.password_hash,undefined);
  await save('/api/admin/customers/'+account.id,{fullName:'Khách đã cập nhật',phone:'0911111111',active:false},admin);
  assert.equal((await fetch(base+'/api/my/appointments',{headers:{Cookie:client.cookie,Accept:'application/json'}})).status,401);
  await save('/api/admin/customers/'+account.id,{fullName:'Khách đã cập nhật',phone:'0911111111',active:true},admin);
  const signed=await signIn(client.email,client.password);assert.equal(signed.target,'/account');assert.equal((await json('/api/me',signed)).customer.full_name,'Khách đã cập nhật');
  await save('/api/my/profile',{fullName:'Khách hồ sơ cá nhân',phone:'0922222222'},signed);
  assert.equal((await json('/api/me',signed)).customer.full_name,'Khách hồ sơ cá nhân');
  await save('/api/my/appointments/'+stable.id+'/cancel',{},signed);
  assert.equal((await json('/api/my/appointments',signed))[0].status,'cancelled');
  options=await json(`/api/slots?serviceId=${service.id}&staffId=${member.id}&date=${date}`);assert.ok(options.some(x=>x.id===slot.id));
  for(const slotId of slotIds)await save('/api/admin/slots/'+slotId+'/open',{isOpen:false},admin);
  await save('/api/admin/services/'+service.id,{...serviceBody,durationMinutes:45},admin);
  await save('/api/admin/services/'+service.id+'/archive',{},admin);
  assert.ok(!(await json('/api/services')).some(x=>x.id===service.id));
  await save('/api/admin/staff/'+member.id+'/archive',{},admin);
  assert.ok(!(await json('/api/staff')).some(x=>x.id===member.id));
 }finally{
  if(booked)await post('/api/appointments/cancel',{token:booked.token},guest).catch(()=>{});
 }
});
