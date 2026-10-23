// Temporary PostgreSQL on Windows for app verification while Docker/WSL is prepared.
// This is NOT the Docker Compose deployment or its infrastructure acceptance test.
import EmbeddedPostgres from 'embedded-postgres';
import { existsSync,mkdirSync,writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
process.loadEnvFile('.env');
const dbPort=Number(process.env.TEST_PG_PORT || 55433);
const appPort=Number(process.env.TEST_APP_PORT || 3300);
const dbDir=`tmp/native-postgres-utf8-${dbPort}`;mkdirSync('tmp',{recursive:true});
const pg=new EmbeddedPostgres({databaseDir:dbDir,port:dbPort,user:'postgres',password:process.env.POSTGRES_PASSWORD,persistent:true,authMethod:'scram-sha-256',initdbFlags:['--encoding=UTF8','--locale=C'],postgresFlags:['-h','127.0.0.1'],onLog:()=>{},onError:e=>{const text=String(e);if(/FATAL|ERROR/.test(text))console.error(text);}});
const env={...process.env,DB_HOST:'127.0.0.1',DB_PORT:String(dbPort),PORT:String(appPort),BIND_HOST:'127.0.0.1',LOG_DIR:'tmp/native-logs'};
const run=(file,args,extra={})=>new Promise((resolve,reject)=>{const p=spawn(file,args,{env:{...env,...extra},stdio:'inherit'});p.once('error',reject);p.once('exit',code=>code===0?resolve():reject(new Error(`${args.join(' ')} exited ${code}`)));});
let app;
try {
  if(!existsSync(dbDir+'/PG_VERSION'))await pg.initialise();
  await pg.start();
  const db=pg.getPgClient('postgres','127.0.0.1');await db.connect();
  const found=await db.query('SELECT 1 FROM pg_database WHERE datname=$1',[process.env.POSTGRES_DB]);
  if(!found.rowCount)await db.query('CREATE DATABASE '+pg.getPgClient().escapeIdentifier(process.env.POSTGRES_DB));await db.end();
  await run(process.execPath,['app/migrate.js']);
  app=spawn(process.execPath,['app/server.js'],{env,stdio:'inherit'});
  let ready=false;
  for(let i=0;i<50;i++){try{const r=await fetch(`http://127.0.0.1:${appPort}/health/ready`);if(r.ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,200));}
  if(!ready)throw new Error('Native app failed readiness.');
  if(process.argv.includes('--serve')){
    console.log(`APP PREVIEW ONLY at http://127.0.0.1:${appPort}; Docker stack still requires separate deployment.`);
    await new Promise(resolve=>{process.once('SIGINT',resolve);process.once('SIGTERM',resolve);});
  }else{
    await run(process.execPath,['--test','--test-concurrency=1','tests/integration.test.js'],{TEST_BASE_URL:`http://127.0.0.1:${appPort}`,TEST_DIRECT_APP:'true'});
    writeFileSync('tmp/native-test-result.json',JSON.stringify({at:new Date().toISOString(),status:'passed',database:'PostgreSQL 17 native Windows',scope:'app only, not Docker/Nginx/Grafana/Loki acceptance'},null,2));
    console.log('Native PostgreSQL integration passed. Docker infrastructure is not verified by this test.');
  }
}finally{
  if(app){app.kill();await new Promise(resolve=>app.once('exit',resolve));}
  await pg.stop().catch(()=>{});
}
