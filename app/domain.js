import { scryptSync, randomBytes, timingSafeEqual, createHash } from 'node:crypto';

export const tokenHash = token => createHash('sha256').update(token).digest('hex');
export function passwordHash(password) {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
}
export function passwordMatches(password, hash) {
  const [salt, key] = (hash || '').split(':');
  if (!salt || !key || typeof password !== 'string' || password.length > 256) return false;
  const saved = Buffer.from(key, 'hex');
  const actual = scryptSync(password, salt, 64);
  return saved.length === actual.length && timingSafeEqual(saved, actual);
}
export function validateBooking(input) {
  const name = String(input.fullName || '').trim();
  const phone = String(input.phone || '').trim();
  const email = String(input.email || '').trim().toLowerCase();
  const slotId = Number(input.slotId);
  const key = String(input.idempotencyKey || '');
  if (name.length < 2 || name.length > 100) throw Object.assign(new Error('Họ tên cần từ 2 đến 100 ký tự.'), { status: 422 });
  if (!/^[+0-9 ()-]{9,20}$/.test(phone)) throw Object.assign(new Error('Số điện thoại chưa hợp lệ.'), { status: 422 });
  if (email && (email.length > 200 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) throw Object.assign(new Error('Email chưa hợp lệ.'), { status: 422 });
  if (!Number.isSafeInteger(slotId) || slotId < 1) throw Object.assign(new Error('Chọn khung giờ hợp lệ.'), { status: 422 });
  if (!/^[a-zA-Z0-9_-]{16,80}$/.test(key)) throw Object.assign(new Error('Mã yêu cầu chưa hợp lệ.'), { status: 422 });
  return { name, phone, email, slotId, key };
}
export function canTransition(from, to, startAt, endAt, now = new Date()) {
  if (to === 'completed') return from === 'confirmed' && new Date(endAt) <= now;
  if (new Date(startAt) <= now) return false;
  return (from === 'pending' && ['confirmed','cancelled'].includes(to)) || (from === 'confirmed' && to === 'cancelled');
}
export const statusNames = { pending: 'Chờ xác nhận', confirmed: 'Đã xác nhận', completed: 'Hoàn thành', cancelled: 'Đã hủy' };
export const formatDate = value => new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(value));
export const formatTime = value => new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value));
