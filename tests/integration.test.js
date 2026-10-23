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
  const slots=await available(),guest=await browser(),other=await browser();const tokens=[];
  try {
    const a=body(slots[0].id),b=body(slots[0].id);
    const results=await Promise.all([post('/api/appointments',a,guest),post('/api/appointments',b,other)]);
    assert.deepEqual(results.map(r=>r.status).sort(),[201,409]);
    const winner=results.findIndex(r=>r.status===201),saved=await results[winner].json();tokens.push(saved.token);
    const owner=winner===0?guest:other,winningBody=winner===0?a:b;
    const replay=await post('/api/appointments',winningBody,owner);assert.equal(replay.status,200);assert.equal((await replay.json()).replayed,true);
    assert.equal((await post('/api/appointments',{...winningBody,fullName:'Tên khác'},owner)).status,409);
    assert.equal((await post('/api/appointments/lookup',{token:saved.token},owner)).status,200);
    assert.equal((await post('/api/appointments/lookup',{token:'x'.repeat(43)},owner)).status,404);
    assert.equal((await post('/api/appointments/cancel',{token:saved.token},owner)).status,200);
    const replacement=await post('/api/appointments',body(slots[0].id),guest);assert.equal(replacement.status,201);
    const booked=await replacement.json();tokens.push(booked.token);
    const lookup=await post('/api/appointments/lookup',{token:booked.token},guest);const appt=await lookup.json();
    assert.equal((await post(`/api/admin/appointments/${appt.id}/status`,{status:'confirmed'},guest)).status,401);
    const login=await browser();
    const loginResponse=await fetch(base+'/admin/login',{method:'POST',redirect:'manual',headers:{'Content-Type':'application/x-www-form-urlencoded',Cookie:login.cookie},body:new URLSearchParams({_csrf:login.csrf,username:process.env.ADMIN_USERNAME || 'manh',password:process.env.ADMIN_PASSWORD})});
    assert.equal(loginResponse.status,302);
    const adminCookie=loginResponse.headers.getSetCookie().map(v=>v.split(';')[0]).join('; ');
    const adminCsrf=await(await fetch(base+'/api/csrf',{headers:{Cookie:adminCookie}})).json();const admin={cookie:adminCookie,csrf:adminCsrf.csrf};
    const adminPage=await fetch(base+'/admin',{headers:{Cookie:adminCookie}});assert.equal(adminPage.status,200);assert.ok((await adminPage.text()).includes(booked.bookingCode));
    const filtered=await fetch(base+'/admin?status=pending',{headers:{Cookie:adminCookie}});assert.equal(filtered.status,200);
    assert.equal((await post(`/api/admin/appointments/${appt.id}/status`,{status:'confirmed'},admin)).status,200);
    assert.equal((await post(`/api/admin/appointments/${appt.id}/status`,{status:'completed'},admin)).status,409);
    assert.equal((await post('/api/appointments',{...body(slots[1].id),fullName:''},guest)).status,422);
    const unicodeCsrf=await fetch(base+'/api/appointments',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json',Cookie:guest.cookie,'X-CSRF-Token':'é'.repeat(64)},body:JSON.stringify(body(slots[1].id))});assert.equal(unicodeCsrf.status,403);
    const noCsrf=await fetch(base+'/api/appointments',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json',Cookie:guest.cookie},body:JSON.stringify(body(slots[1].id))});assert.equal(noCsrf.status,403);
    const logout=await fetch(base+'/admin/logout',{method:'POST',redirect:'manual',headers:{'Content-Type':'application/x-www-form-urlencoded',Cookie:admin.cookie},body:new URLSearchParams({_csrf:admin.csrf})});assert.equal(logout.status,302);
    assert.equal((await post(`/api/admin/appointments/${appt.id}/status`,{status:'cancelled'},admin)).status,401);
    if(process.env.TEST_DIRECT_APP!=='true')for(const endpoint of ['/metrics','/health/ready','/stub_status'])assert.equal((await fetch(base+endpoint)).status,404);
    const page=await fetch(base);assert.equal(page.headers.get('x-content-type-options'),'nosniff');assert.equal(page.headers.get('x-frame-options'),'SAMEORIGIN');
  } finally {
    for(const token of tokens) await post('/api/appointments/cancel',{token},guest).catch(()=>{});
  }
});
