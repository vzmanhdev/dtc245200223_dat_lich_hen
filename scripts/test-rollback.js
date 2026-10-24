import {readFileSync,writeFileSync} from 'node:fs';
import {resolve,relative} from 'node:path';
import {spawnSync} from 'node:child_process';
import {dockerExecutable} from './docker-executable.js';
const root=process.cwd(),fresh=JSON.parse(readFileSync('docs/evidence/clean-clone-verification.json'));
const cwd=resolve(fresh.checkout),rel=relative(resolve('tmp'),cwd);
if(rel.startsWith('..')||!rel||!fresh.project.startsWith('appointment_fresh_'))throw new Error('Only an isolated fresh rehearsal under workspace/tmp is allowed.');
const envText=readFileSync(resolve(cwd,'.env'),'utf8');
if(!envText.includes('COMPOSE_PROJECT_NAME='+fresh.project)||!envText.includes('WEB_PORT=18080'))throw new Error('Isolated environment mismatch');
const docker=dockerExecutable(),stamp=Date.now(),good='manh-appointment:rollback-good-'+stamp,bad='manh-appointment:rollback-bad-'+stamp;
function cmd(args,{image=good,input,allowFailure=false}={}){const r=spawnSync(docker,args,{cwd,env:{...process.env,APP_IMAGE:image},input,encoding:'utf8',timeout:240000});if(r.status!==0&&!allowFailure)throw new Error(r.stderr||r.stdout);return r;}
const compose=['compose','-f','compose.rollback.yaml'];
writeFileSync(resolve(cwd,'compose.rollback.yaml'),readFileSync(resolve(root,'compose.yaml')));
cmd(['tag','manh-appointment:local',good]);
cmd(['build','--network','none','-t',bad,'-f','-','.'],{input:`FROM ${good}\nCMD ["node","-e","process.exit(1)"]\n`});
const report={at:new Date().toISOString(),project:fresh.project,good_image:good,bad_image:bad,scenario:'Isolated unhealthy candidate, return to exact known-good image; no schema downgrade.'};
try{
  cmd([...compose,'up','-d','--no-build','--wait','--wait-timeout','120','nginx']);
  const hash=String(stamp).padEnd(64,'0');
  const fixture=`WITH c AS (INSERT INTO customers(full_name,phone,email) VALUES('Rollback fixture','0900000000','rollback@example.com') RETURNING id), s AS (SELECT t.id,sv.name FROM time_slots t JOIN services sv ON sv.id=t.service_id ORDER BY t.id LIMIT 1) INSERT INTO appointments(booking_code,token_hash,idempotency_key,request_hash,customer_id,slot_id,service_name_snapshot,status) SELECT 'RB-${stamp}','${hash}','rollback-${stamp}','${hash}',c.id,s.id,s.name,'cancelled' FROM c CROSS JOIN s;`;
  cmd([...compose,'exec','-T','postgres','psql','-v','ON_ERROR_STOP=1','-U','postgres','-d','appointment','-c',fixture]);
  const snapshot='SELECT count(*)::text || chr(124) || md5(string_agg(row_to_json(a)::text,chr(44) ORDER BY id)) FROM appointments a;';
  const before=cmd([...compose,'exec','-T','postgres','psql','-U','postgres','-d','appointment','-Atc',snapshot]).stdout.trim();
  const failed=cmd([...compose,'up','-d','--no-deps','--no-build','--wait','--wait-timeout','25','app'],{image:bad,allowFailure:true});
  if(failed.status===0)throw new Error('Broken candidate unexpectedly passed readiness');
  report.unhealthy_candidate_rejected=true;
  cmd([...compose,'up','-d','--no-deps','--no-build','--wait','--wait-timeout','120','app']);
  let status=0;for(let i=0;i<10;i++){try{const r=await fetch('http://127.0.0.1:18080');await r.arrayBuffer();status=r.status;if(status===200)break;}catch{}await new Promise(r=>setTimeout(r,1000));}
  if(status!==200)throw new Error('Website did not recover');
  const after=cmd([...compose,'exec','-T','postgres','psql','-U','postgres','-d','appointment','-Atc',snapshot]).stdout.trim();
  if(before!==after)throw new Error('Appointment count changed');
  report.status='passed';report.http_status=status;report.appointment_count_and_checksum_before=before;report.appointment_count_and_checksum_after=after;
}catch(e){report.status='failed';report.error=e.message;process.exitCode=1;}
finally{cmd([...compose,'down','--timeout','20'],{allowFailure:true});writeFileSync(resolve(root,'docs/evidence/rollback-verification.json'),JSON.stringify(report,null,2));console.log(report);}
