import {spawnSync} from 'node:child_process';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {dockerExecutable} from './docker-executable.js';
const root=process.cwd(),stamp=new Date().toISOString().replace(/\D/g,'').slice(0,14);
const checkout=resolve('tmp','fresh-checkout-'+stamp),project='appointment_fresh_'+stamp,docker=dockerExecutable();
const report={at:new Date().toISOString(),checkout,project,checks:[],ports:{WEB_PORT:18080,HTTPS_PORT:18443,PGADMIN_PORT:15050,GRAFANA_PORT:13001,PROMETHEUS_PORT:19090}};
function run(exe,args,cwd=checkout,timeout=300000){const r=spawnSync(exe,args,{cwd,encoding:'utf8',timeout,env:{...process.env,NODE_OPTIONS:'--use-system-ca',SMOKE_BASE_URL:'http://127.0.0.1:18080'}});if(r.status!==0)throw new Error(`${exe} ${args.slice(0,3).join(' ')} failed: ${r.stderr}\n${r.stdout}`);return r.stdout.trim();}
mkdirSync(resolve('tmp'),{recursive:true});
run('git',['clone','--depth','1','https://github.com/vzmanhdev/dtc245200223_dat_lich_hen.git',checkout],root);
report.commit=run('git',['rev-parse','HEAD']);report.checks.push('Fresh remote clone');
run(process.execPath,['scripts/setup-env.js']);
let env=readFileSync(resolve(checkout,'.env'),'utf8');
for(const [name,value] of Object.entries({COMPOSE_PROJECT_NAME:project,...report.ports})) env=env.replace(new RegExp('^'+name+'=.*$','m'),name+'='+value);
writeFileSync(resolve(checkout,'.env'),env); // Independent random secrets, never copied from main .env.
try {
  console.log('Starting isolated full stack from remote commit',report.commit);
  run(docker,['compose','up','-d','--build','--wait','--wait-timeout','240']);report.checks.push('13 services, independent volumes and ports, startup healthy');
  run(process.execPath,['scripts/smoke.js']);report.checks.push('HTTP smoke');
  run(process.execPath,['scripts/verify-tls.js']);report.checks.push('TLS certificate, Secure cookie, private metrics');
  for(let attempt=0;attempt<4;attempt++){
    await new Promise(r=>setTimeout(r,20000));
    try{console.log(run(process.execPath,['scripts/verify-stack.js']));report.checks.push('16 stack checks');break;}
    catch(e){if(attempt===3)throw e;console.log('Waiting for fresh metrics and log ingestion.');}
  }
  report.services=run(docker,['compose','ps','-a','--format','{{.Service}}|{{.State}}|{{.ExitCode}}']);
  report.status='passed';
}catch(e){report.status='failed';report.error=e.message;process.exitCode=1;}
finally{
  try{run(docker,['compose','down','--timeout','20']);report.cleanup='Only isolated containers/networks stopped; volumes retained; main project untouched.';}catch(e){report.cleanup=e.message;process.exitCode=1;}
  mkdirSync(resolve(root,'docs/evidence'),{recursive:true});writeFileSync(resolve(root,'docs/evidence/clean-clone-verification.json'),JSON.stringify(report,null,2));
  console.log(report.status,report.checks,report.cleanup);
  if(report.error)console.error(report.error);
}
