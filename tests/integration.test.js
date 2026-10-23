import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const base=process.env.TEST_BASE_URL || `http://127.0.0.1:${process.env.WEB_PORT || 8080}`;
async function browser() {
  const response=await fetch(base+'/api/csrf');
  assert.equal(response.status,200);
  const {csrf}=await response.json();
  const cookie=response.headers.getSetCookie().map(v=>v.split(';')[0]).join('; ');
  return {csrf,cookie};
}
async function post(url,body,session) {
  return fetch(base+url,{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json',Cookie:session.cookie,'X-CSRF-Token':session.csrf},body:JSON.stringify(body)});
}
async function register() {
 const initial=await browser(),email=`customer-${randomUUID()}@example.com`,password='Customer-'+randomUUID();
 const response=await fetch(base+'/register',{method:'POST',redirect:'manual',headers:{'Content-Type':'application/x-www-form-urlencoded',Cookie:initial.cookie},body:new URLSearchParams({_csrf:initial.csrf,email,password,confirmPassword:password,fullName:'Khách kiểm thử tài khoản',phone:'0900000000'})});
 assert.equal(response.status,302,await response.text());
 const cookie=response.headers.getSetCookie().map(v=>v.split(';')[0]).join('; ');
 assert.notEqual(cookie,initial.cookie,'Session must rotate at registration');
 const {csrf}=await(await fetch(base+'/api/csrf',{headers:{Cookie:cookie}})).json();
 return {cookie,csrf,email,password};
}
function body(slotId,key=randomUUID().replaceAll('-','')) {return {fullName:'Khách kiểm thử tự động',phone:'0900000000',email:'test@example.com',slotId,idempotencyKey:key};}
async function available() {
  const services=await (await fetch(base+'/api/services')).json();
  const list=[];
  for(let day=1;day<=13 && list.length<3;day++) {
    const date=new Date(Date.now()+day*86400000).toLocaleDateString('en-CA',{timeZone:'Asia/Ho_Chi_Minh'});
    for(const s of services) {
      const slots=await(await fetch(`${base}/api/slots?serviceId=${s.id}&date=${date}`)).json();
      list.push(...slots);
      if(list.length>=3)break;
    }
  }
  assert.ok(list.length>=2,'Need at least two future slots; rerun migration to seed next 14 days.');
  return list;
}
test('real PostgreSQL booking, concurrent collision, idempotency, private lookup, authorization and admin transition',async()=>{
  const slots=await available(),guest=await register(),other=await register();const tokens=[];
  try {
    const a=body(slots[0].id),b=body(slots[0].id);
    const results=await Promise.all([post('/api/appointments',a,guest),post('/api/appointments',b,other)]);
    assert.deepEqual(results.map(r=>r.status).sort(),[201,409]);
    const winner=results.findIndex(r=>r.status===201),saved=await results[winner].json();tokens.push(saved.token);
    const owner=winner===0?guest:other,winningBody=winner===0?a:b;
    const replay=await post('/api/appointments',winningBody,owner);assert.equal(replay.status,200);assert.equal((await replay.json()).replayed,true);
    assert.equal((await post('/api/appointments',{...winningBody,slotId:slots[1].id},owner)).status,409);
    assert.equal((await post('/api/appointments/lookup',{token:saved.token},owner)).status,200);
    assert.equal((await post('/api/appointments/lookup',{token:'x'.repeat(43)},owner)).status,404);
    assert.equal((await post('/api/appointments/cancel',{token:saved.token},owner)).status,200);
    const replacement=await post('/api/appointments',body(slots[0].id),guest);assert.equal(replacement.status,201);
    const booked=await replacement.json();tokens.push(booked.token);
    const lookup=await post('/api/appointments/lookup',{token:booked.token},guest);const appt=await lookup.json();
    assert.equal((await post(`/api/admin/appointments/${appt.id}/status`,{status:'confirmed'},guest)).status,401);
    const login=await browser();
    const loginResponse=await fetch(base+'/login',{method:'POST',redirect:'manual',headers:{'Content-Type':'application/x-www-form-urlencoded',Cookie:login.cookie},body:new URLSearchParams({_csrf:login.csrf,email:process.env.ADMIN_USERNAME,password:process.env.ADMIN_PASSWORD})});
    assert.equal(loginResponse.status,302);
    const adminCookie=loginResponse.headers.getSetCookie().map(v=>v.split(';')[0]).join('; ');
    const adminCsrf=await(await fetch(base+'/api/csrf',{headers:{Cookie:adminCookie}})).json();const admin={cookie:adminCookie,csrf:adminCsrf.csrf};
    const adminPage=await fetch(base+'/admin',{headers:{Cookie:adminCookie}});assert.equal(adminPage.status,200);assert.ok((await adminPage.text()).includes(booked.bookingCode));
    const filtered=await fetch(base+'/admin?status=pending',{headers:{Cookie:adminCookie}});assert.equal(filtered.status,200);
    assert.equal((await post(`/api/admin/appointments/${appt.id}/status`,{status:'confirmed'},admin)).status,200);
    assert.equal((await post(`/api/admin/appointments/${appt.id}/status`,{status:'completed'},admin)).status,409);
    assert.equal((await post('/api/appointments',body(0),guest)).status,422);
    const unicodeCsrf=await fetch(base+'/api/appointments',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json',Cookie:guest.cookie,'X-CSRF-Token':'é'.repeat(64)},body:JSON.stringify(body(slots[1].id))});assert.equal(unicodeCsrf.status,403);
    const noCsrf=await fetch(base+'/api/appointments',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json',Cookie:guest.cookie},body:JSON.stringify(body(slots[1].id))});assert.equal(noCsrf.status,403);
    const logout=await fetch(base+'/logout',{method:'POST',redirect:'manual',headers:{'Content-Type':'application/x-www-form-urlencoded',Cookie:admin.cookie},body:new URLSearchParams({_csrf:admin.csrf})});assert.equal(logout.status,302);
    assert.equal((await post(`/api/admin/appointments/${appt.id}/status`,{status:'cancelled'},admin)).status,401);
    if(process.env.TEST_DIRECT_APP!=='true')for(const endpoint of ['/metrics','/health/ready','/stub_status'])assert.equal((await fetch(base+endpoint)).status,404);
    const page=await fetch(base);assert.equal(page.headers.get('x-content-type-options'),'nosniff');assert.equal(page.headers.get('x-frame-options'),'SAMEORIGIN');
  } finally {
    for(const token of tokens) await post('/api/appointments/cancel',{token},guest).catch(()=>{});
  }
});


test('customer accounts own their bookings; same time across consultants; logout and login',async()=>{
 // Let the gateway rate-limit bucket refill between the two request-heavy scenarios.
 if(process.env.TEST_DIRECT_APP!=='true')await new Promise(resolve=>setTimeout(resolve,15000));
 const anonymous=await browser();
 assert.equal((await post('/api/appointments',body(1),anonymous)).status,401);
 assert.equal((await fetch(base+'/account',{redirect:'manual'})).headers.get('location'),'/login');
 const first=await register(),second=await register();
 const tokens=[];
 try {
  const staff=await(await fetch(base+'/api/staff')).json();assert.ok(staff.length>=2);
  const slots=await available();
  const primary=slots.find(s=>slots.some(other=>other.start_at===s.start_at&&other.staff_id!==s.staff_id));
  if(primary)slots.unshift(primary);
  const paired=slots.find(s=>s.start_at===slots[0].start_at&&s.staff_id!==slots[0].staff_id);
  assert.ok(paired,'Different consultants should offer independent slots at the same time');
  const one=await post('/api/appointments',body(slots[0].id),first);assert.equal(one.status,201);
  const a=await one.json();tokens.push(a.token);assert.ok(a.staffName);
  const two=await post('/api/appointments',body(paired.id),second);assert.equal(two.status,201);
  const b=await two.json();tokens.push(b.token);
  const my=await(await fetch(base+'/api/my/appointments',{headers:{Cookie:first.cookie}})).json();
  assert.equal(my.length,1);assert.equal(my[0].booking_code,a.bookingCode);assert.equal(my[0].staff_name,a.staffName);
  const theirs=await(await fetch(base+'/api/my/appointments',{headers:{Cookie:second.cookie}})).json();
  assert.equal(theirs.length,1);assert.equal(theirs[0].booking_code,b.bookingCode);
  assert.equal((await post(`/api/my/appointments/${my[0].id}/cancel`,{},second)).status,404);
  assert.equal((await post('/api/appointments',body(slots[0].id),second)).status,409);
  const filtered=await(await fetch(`${base}/api/slots?serviceId=1&staffId=${staff[0].id}&date=${new Date(Date.now()+86400000).toLocaleDateString('en-CA',{timeZone:'Asia/Ho_Chi_Minh'})}`)).json();
  assert.ok(filtered.every(s=>String(s.staff_id)===String(staff[0].id)));
  const accountPage=await fetch(base+'/account',{headers:{Cookie:first.cookie}});assert.equal(accountPage.status,200);assert.ok((await accountPage.text()).includes(a.bookingCode));
  assert.equal((await post(`/api/my/appointments/${my[0].id}/cancel`,{},first)).status,200);
  const logout=await fetch(base+'/logout',{method:'POST',redirect:'manual',headers:{'Content-Type':'application/x-www-form-urlencoded',Cookie:first.cookie},body:new URLSearchParams({_csrf:first.csrf})});assert.equal(logout.status,302);
  assert.equal((await fetch(base+'/api/my/appointments',{headers:{Cookie:first.cookie,Accept:'application/json'}})).status,401);
  const sign=await browser();
  const wrong=await fetch(base+'/login',{method:'POST',redirect:'manual',headers:{'Content-Type':'application/x-www-form-urlencoded',Cookie:sign.cookie},body:new URLSearchParams({_csrf:sign.csrf,email:first.email,password:'incorrect-password'})});assert.equal(wrong.status,401);
  const login=await fetch(base+'/login',{method:'POST',redirect:'manual',headers:{'Content-Type':'application/x-www-form-urlencoded',Cookie:sign.cookie},body:new URLSearchParams({_csrf:sign.csrf,email:first.email,password:first.password})});assert.equal(login.status,302);
  const cookie=login.headers.getSetCookie().map(v=>v.split(';')[0]).join('; ');assert.notEqual(cookie,sign.cookie);
  const me=await(await fetch(base+'/api/me',{headers:{Cookie:cookie}})).json();assert.equal(me.customer.email,first.email);assert.equal(me.customer.password_hash,undefined);
  const oldCsrf=await post('/api/appointments',body(paired.id),{cookie,csrf:sign.csrf});assert.equal(oldCsrf.status,403);
  const invalid=await browser();
  const weak=await fetch(base+'/register',{method:'POST',redirect:'manual',headers:{'Content-Type':'application/x-www-form-urlencoded',Cookie:invalid.cookie},body:new URLSearchParams({_csrf:invalid.csrf,email:'weak@example.com',password:'short',confirmPassword:'short',fullName:'Khách kiểm thử',phone:'0900000000'})});assert.equal(weak.status,422);
 } finally {for(const token of tokens)await post('/api/appointments/cancel',{token},anonymous).catch(()=>{});}
});
