import assert from 'node:assert/strict';
const root=process.env.SMOKE_BASE_URL || 'http://127.0.0.1:8080';
for(const [path,status] of [['/',200],['/login',200],['/api/services',200],['/missing-smoke',404],['/metrics',404],['/health/ready',404]]) {
  const r=await fetch(root+path,{signal:AbortSignal.timeout(10000)});assert.equal(r.status,status,path);
  assert.equal(r.headers.get('x-content-type-options'),'nosniff',path+' header');console.log('PASS',path,status);
}
console.log('Web smoke passed. Infrastructure and PostgreSQL integration need their separate checks.');
