import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {dockerExecutable} from './docker-executable.js';
process.loadEnvFile('.env');
const docker=dockerExecutable(),web=`http://127.0.0.1:${process.env.WEB_PORT||8080}`,grafana=`http://127.0.0.1:${process.env.GRAFANA_PORT||3001}`;
const headers={Authorization:'Basic '+Buffer.from(`${process.env.GRAFANA_ADMIN_USER}:${process.env.GRAFANA_ADMIN_PASSWORD}`).toString('base64')};
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function command(args){const p=spawnSync(docker,args,{encoding:'utf8',timeout:30000});assert.equal(p.status,0,p.stderr);return p.stdout.trim();}
async function marker(){const r=await fetch(web+'/audit-log-'+randomUUID(),{method:'POST'});await r.arrayBuffer();assert.equal(r.status,404);const row=JSON.parse(command(['compose','exec','-T','nginx','tail','-n','1','/logs/access.log']));assert.equal(row.status,404);assert.equal(row.method,'POST');return row;}
async function entries(row){const query=`{service="nginx",environment="local"} | json | request_id="${row.request_id}"`,p=new URLSearchParams({query,start:String((Date.now()-300000)*1000000),end:String(Date.now()*1000000),limit:'100'});const r=await fetch(grafana+'/api/datasources/proxy/uid/loki/loki/api/v1/query_range?'+p,{headers});assert.equal(r.status,200);const d=await r.json();assert.equal(d.status,'success');return d.data.result.flatMap(s=>s.values.map(v=>({timestamp:v[0],line:JSON.parse(v[1]),filename:s.stream.filename})));}
async function received(row){for(let attempt=0;attempt<20;attempt++){const rows=await entries(row);if(rows.length)return rows;await wait(1500);}throw Error('Promtail did not deliver controlled request');}
const before=await marker();let rows=await received(before);assert.equal(rows.length,1);assert.ok(Math.abs(Number(rows[0].timestamp)/1e6-Date.parse(before.time))<1,'Event time must match JSON timestamp');
command(['compose','exec','-T','-e','LOG_MAX_BYTES=1','nginx','sh','/etc/nginx/rotate-logs.sh','--once']);
const after=await marker();const next=await received(after);assert.equal(next.length,1);assert.ok(Math.abs(Number(next[0].timestamp)/1e6-Date.parse(after.time))<1);
await wait(10000);rows=await entries(before);assert.equal(rows.length,1,'Rotated archive must not be ingested again');
writeFileSync('docs/evidence/log-ingestion-verification.json',JSON.stringify({at:new Date().toISOString(),status:'passed',before_request:before.request_id,after_request:after.request_id,before_copies_after_rotation:rows.length,after_copies:next.length,json_timestamp_matches:true},null,2));
console.log('PASS new Nginx event timestamps and no replay across actual log rotation');
