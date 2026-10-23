import test from 'node:test';
import assert from 'node:assert/strict';
import { passwordHash,passwordMatches,validateBooking,canTransition,tokenHash,formatDate } from '../app/domain.js';

test('passwords are salted and verified without storing plaintext',()=>{
  const password='correct-long-password';const a=passwordHash(password),b=passwordHash(password);
  assert.notEqual(a,b);assert.ok(passwordMatches(password,a));assert.equal(passwordMatches('wrong',a),false);assert.equal(passwordMatches('',null),false);
});
test('booking validation rejects malformed data and normalizes safe values',()=>{
  const valid={fullName:'  Nguyễn Văn Mạnh ',phone:'0912345678',email:' MANH@example.com ',slotId:'1',idempotencyKey:'0123456789abcdef'};
  assert.deepEqual(validateBooking(valid),{name:'Nguyễn Văn Mạnh',phone:'0912345678',email:'manh@example.com',slotId:1,key:'0123456789abcdef'});
  for(const invalid of [{fullName:'A'},{phone:'bad'},{email:'wrong'},{slotId:0},{slotId:1.2},{idempotencyKey:'short'}])assert.throws(()=>validateBooking({...valid,...invalid}),e=>e.status===422);
});
test('state transitions enforce timing, confirmation and terminal states',()=>{
  const before=new Date('2026-01-01T08:00:00+07:00'),after=new Date('2026-01-01T11:00:00+07:00');
  const start='2026-01-01T09:00:00+07:00',end='2026-01-01T09:30:00+07:00';
  assert.ok(canTransition('pending','confirmed',start,end,before));
  assert.ok(canTransition('confirmed','cancelled',start,end,before));
  assert.equal(canTransition('pending','confirmed',start,end,after),false);
  assert.equal(canTransition('pending','completed',start,end,after),false);
  assert.equal(canTransition('confirmed','completed',start,end,before),false);
  assert.ok(canTransition('confirmed','completed',start,end,after));
  for(const from of ['cancelled','completed'])assert.equal(canTransition(from,'confirmed',start,end,before),false);
});
test('token hash is deterministic and dates use Vietnam calendar boundary',()=>{
  assert.equal(tokenHash('a'),tokenHash('a'));assert.notEqual(tokenHash('a'),tokenHash('b'));
  assert.equal(formatDate('2026-10-23T18:00:00Z'),'24/10/2026');
});
