import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import './setup-tls.js';
if (existsSync('.env')) {
  console.log('.env already exists; secrets preserved.');
} else {
  const secret = () => randomBytes(24).toString('base64url');
  let data = readFileSync('.env.example', 'utf8');
  for (const key of ['POSTGRES_PASSWORD','APP_DB_PASSWORD','MONITOR_DB_PASSWORD','SESSION_SECRET','ADMIN_PASSWORD','PGADMIN_DEFAULT_PASSWORD','GRAFANA_ADMIN_PASSWORD']) {
    data = data.replace(new RegExp(`^${key}=$`, 'm'), `${key}=${secret()}`);
  }
  writeFileSync('.env', data, { mode: 0o600, flag: 'wx' });
  console.log('Created .env with unique random secrets. Read credentials locally; do not commit this file.');
}
