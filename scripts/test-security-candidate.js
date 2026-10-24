import {readFileSync,writeFileSync} from 'node:fs';
import {resolve,relative} from 'node:path';
import {spawnSync} from 'node:child_process';
import {dockerExecutable} from './docker-executable.js';
const root=process.cwd(),fresh=JSON.parse(readFileSync('docs/evidence/clean-clone-verification.json'));
const cwd=resolve(fresh.checkout),rel=relative(resolve('tmp'),cwd);
if(!rel||rel.startsWith('..')||!fresh.project.startsWith('appointment_fresh_'))throw new Error('An isolated fresh checkout is required.');
const env=readFileSync(resolve(cwd,'.env'),'utf8');
if(!env.includes('COMPOSE_PROJECT_NAME='+fresh.project)||!env.includes('WEB_PORT=18080'))throw new Error('Unexpected rehearsal project/ports');
writeFileSync(resolve(cwd,'compose.security.yaml'),readFileSync('compose.yaml'));
const childEnv={...process.env,APP_IMAGE:'manh-appointment:security-candidate',COMPOSE_FILE:'compose.security.yaml',TEST_BASE_URL:'http://127.0.0.1:18080',SMOKE_BASE_URL:'http://127.0.0.1:18080'};
function run(exe,args,timeout=300000){const r=spawnSync(exe,args,{cwd,env:childEnv,encoding:'utf8',timeout});if(r.status!==0)throw new Error(r.stderr+'\n'+r.stdout);return r.stdout.trim();}
const report={at:new Date().toISOString(),project:fresh.project,image:childEnv.APP_IMAGE,checks:[]};
try{
 report.image_id=run(dockerExecutable(),['image','inspect',childEnv.APP_IMAGE,'--format','{{.Id}}']);
 run(dockerExecutable(),['compose','up','-d','--no-build','--wait','--wait-timeout','240']);report.checks.push('All 13 services ready with candidate app/migrate');
 for(const script of ['smoke.js','verify-tls.js']){console.log(run(process.execPath,[resolve(root,'scripts',script)]));report.checks.push(script);}
 // Use the repository's actual test names, not an assumed file list.
 const {readdirSync}=await import('node:fs');
 const tests=readdirSync(resolve(root,'tests')).filter(n=>n==='unit.test.js'||n.endsWith('integration.test.js')).map(n=>resolve(root,'tests',n));
 console.log(run(process.execPath,['--env-file=.env','--test','--test-concurrency=1',...tests]));report.checks.push('Unit and all integration groups against isolated PostgreSQL');
 await new Promise(r=>setTimeout(r,20000));
 console.log(run(process.execPath,[resolve(root,'scripts/verify-stack.js')]));report.checks.push('16 stack checks');
 report.status='passed';
}catch(e){report.status='failed';report.error=e.message;console.error(e.message);process.exitCode=1;}
finally{try{run(dockerExecutable(),['compose','down','--timeout','20']);}catch(e){report.cleanup_error=e.message;process.exitCode=1;}writeFileSync(resolve(root,'docs/evidence/security-candidate-verification.json'),JSON.stringify(report,null,2));console.log(report.status,report.checks);}
