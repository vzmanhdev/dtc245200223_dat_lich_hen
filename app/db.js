import pg from 'pg';
export const pool = new pg.Pool({
  host: process.env.DB_HOST || 'postgres',
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.POSTGRES_DB || 'appointment',
  user: 'appointment_app',
  password: process.env.APP_DB_PASSWORD,
  max: 10,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000
});
