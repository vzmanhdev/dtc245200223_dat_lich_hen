import pg from 'pg';
import { readFileSync } from 'node:fs';
import { passwordHash } from './domain.js';
for (const key of ['POSTGRES_PASSWORD','APP_DB_PASSWORD','MONITOR_DB_PASSWORD','ADMIN_PASSWORD']) {
  if (!process.env[key] || process.env[key].length < (key==='ADMIN_PASSWORD'?12:16)) throw new Error(`Missing or weak ${key}; run npm run setup.`);
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
  const hasSchema=(await db.query("SELECT to_regclass('public.schema_migrations') AS name")).rows[0].name;
  const initialized=hasSchema && (await db.query('SELECT 1 FROM schema_migrations WHERE version=3')).rowCount>0;
  await db.query(readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'));
  await db.query(readFileSync(new URL('./schema-v2.sql', import.meta.url), 'utf8'));
  await db.query(readFileSync(new URL('./schema-v3.sql', import.meta.url), 'utf8'));
  const adminEmail=(process.env.ADMIN_USERNAME || 'admin@example.com').trim().toLowerCase();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail))throw new Error('ADMIN_USERNAME must be a valid email.');
  if(process.argv.includes('--reset-admin')) {
    const old=await db.query('SELECT id FROM admin_users ORDER BY (lower(username)=$1) DESC,id LIMIT 1',[adminEmail]);
    if(old.rowCount)await db.query('UPDATE admin_users SET username=$1,password_hash=$2,active=true WHERE id=$3',[adminEmail,passwordHash(process.env.ADMIN_PASSWORD),old.rows[0].id]);
    else await db.query('INSERT INTO admin_users(username,password_hash) VALUES($1,$2)',[adminEmail,passwordHash(process.env.ADMIN_PASSWORD)]);
    await db.query('UPDATE admin_users SET active=false WHERE lower(username)<>$1',[adminEmail]);
    await db.query('UPDATE customer_accounts SET active=false WHERE email=$1',[adminEmail]);
    await db.query("DELETE FROM session WHERE sess::jsonb ? 'admin'");
    console.log('Admin credentials updated from local environment; previous admin sessions revoked.');
  } else await db.query('INSERT INTO admin_users(username,password_hash) VALUES($1,$2) ON CONFLICT(username) DO NOTHING',[adminEmail,passwordHash(process.env.ADMIN_PASSWORD)]);
  if(!initialized) {
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
    JOIN services s ON s.name = (ARRAY['Tư vấn công nghệ','Hỗ trợ kỹ thuật','Tư vấn dự án'])[1 + (h.part % 3)]
    CROSS JOIN LATERAL (SELECT (((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Ho_Chi_Minh')::date + d.day + time '09:00') AT TIME ZONE 'Asia/Ho_Chi_Minh') + h.part * interval '30 minutes' AS t) x
    WHERE t > now() AND member.active ON CONFLICT(staff_id,start_at) WHERE is_open DO NOTHING`);
  await db.query('INSERT INTO staff_services SELECT member.id,s.id FROM staff member CROSS JOIN services s ON CONFLICT DO NOTHING');
  }
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
