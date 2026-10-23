import pg from 'pg';
import { readFileSync } from 'node:fs';
import { passwordHash } from './domain.js';
for (const key of ['POSTGRES_PASSWORD','APP_DB_PASSWORD','MONITOR_DB_PASSWORD','ADMIN_PASSWORD']) {
  if (!process.env[key] || process.env[key].length < 16) throw new Error(`Missing or weak ${key}; run npm run setup.`);
}
const db = new pg.Client({ host: process.env.DB_HOST || 'postgres', port: Number(process.env.DB_PORT || 5432), user: process.env.POSTGRES_USER || 'postgres', password: process.env.POSTGRES_PASSWORD, database: process.env.POSTGRES_DB || 'appointment' });
await db.connect();
try {
  await db.query('SELECT pg_advisory_lock(245200223)');
  await db.query('BEGIN');
  for (const [role, pass] of [['appointment_app',process.env.APP_DB_PASSWORD],['appointment_monitor',process.env.MONITOR_DB_PASSWORD]]) {
    const found = await db.query('SELECT 1 FROM pg_roles WHERE rolname=$1', [role]);
    const sql = await db.query(`SELECT format('${found.rowCount ? 'ALTER' : 'CREATE'} ROLE %I LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD %L', $1::text, $2::text) AS sql`, [role, pass]);
    await db.query(sql.rows[0].sql);
  }
  await db.query(readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'));
  await db.query(readFileSync(new URL('./schema-v2.sql', import.meta.url), 'utf8'));
  await db.query('INSERT INTO admin_users(username,password_hash) VALUES($1,$2) ON CONFLICT(username) DO NOTHING', [process.env.ADMIN_USERNAME || 'manh',passwordHash(process.env.ADMIN_PASSWORD)]);
  await db.query(`INSERT INTO services(name,description,duration_minutes,price) VALUES
    ('Tư vấn công nghệ','Tư vấn giải pháp phần mềm, học tập và định hướng công nghệ.',30,150000),
    ('Hỗ trợ kỹ thuật','Kiểm tra và hỗ trợ các vấn đề về máy tính, phần mềm.',30,100000),
    ('Tư vấn dự án','Trao đổi ý tưởng, xác định phạm vi và lộ trình triển khai.',30,200000)
    ON CONFLICT(name) DO NOTHING`);
  // Each consultant has independent half-hour availability across services.
  await db.query(`INSERT INTO time_slots(staff_id,service_id,start_at,end_at)
    SELECT member.id, s.id, t, t + interval '30 minutes'
    FROM generate_series(0,13) AS d(day)
    CROSS JOIN generate_series(0,15) AS h(part)
    CROSS JOIN staff member
    JOIN services s ON s.id = 1 + (h.part % 3)
    CROSS JOIN LATERAL (SELECT (((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Ho_Chi_Minh')::date + d.day + time '09:00') AT TIME ZONE 'Asia/Ho_Chi_Minh') + h.part * interval '30 minutes' AS t) x
    WHERE t > now() AND member.active ON CONFLICT(staff_id,start_at) DO NOTHING`);
  await db.query('COMMIT');
  console.log('Schema, least-privilege roles and demo slots ready. Existing data and admin credentials preserved.');
} catch (error) {
  await db.query('ROLLBACK');
  console.error('Migration failed:', error.code || error.message);
  process.exitCode = 1;
} finally {
  await db.query('SELECT pg_advisory_unlock(245200223)').catch(() => {});
  await db.end();
}
