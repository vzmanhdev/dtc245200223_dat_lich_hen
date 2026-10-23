import assert from 'node:assert/strict';
import { mkdirSync,writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dockerExecutable } from './docker-executable.js';
process.loadEnvFile('.env');
const docker=dockerExecutable();
const report={at:new Date().toISOString(),scope:'Docker Compose localhost',checks:[]};
async function check(name,fn){try{const result=await fn();report.checks.push({name,status:'passed',result});console.log('PASS',name);}catch(e){report.checks.push({name,status:'failed',error:e.message});console.error('FAIL',name,e.message);}}
function command(args){const p=spawnSync(docker,args,{encoding:'utf8',timeout:30000});if(p.status!==0)throw new Error(p.stderr || p.error?.message || `exit ${p.status}`);return p.stdout.trim();}
async function json(url,options={}){const r=await fetch(url,{...options,signal:AbortSignal.timeout(15000)});if(!r.ok)throw new Error(`HTTP ${r.status}`);return r.json();}
const prom=`http://127.0.0.1:${process.env.PROMETHEUS_PORT || 9090}`;
const grafana=`http://127.0.0.1:${process.env.GRAFANA_PORT || 3001}`;
const auth='Basic '+Buffer.from(`${process.env.GRAFANA_ADMIN_USER}:${process.env.GRAFANA_ADMIN_PASSWORD}`).toString('base64');
const promQuery=async query=>{const d=await json(prom+'/api/v1/query?query='+encodeURIComponent(query));assert.equal(d.status,'success');return d.data.result;};
await check('Docker Engine',()=>command(['info','--format','{{.ServerVersion}}']));
await check('Compose configuration',()=>command(['compose','config','--quiet']));
await check('All long-running services active',()=>{const rows=command(['compose','ps','-a','--format','{{.Service}}|{{.State}}|{{.ExitCode}}']).split('\n');for(const row of rows){const [service,state,exit]=row.split('|');if(['migrate','log-init'].includes(service)){assert.equal(state,'exited',service);assert.equal(exit,'0',service);}else assert.equal(state,'running',service+' not running');}const expected=Object.keys(JSON.parse(command(['compose','config','--format','json'])).services);for(const name of expected)assert.ok(rows.some(row=>row.startsWith(name+'|')),name+' missing');return rows.length+' services checked';});
await check('Nginx syntax',()=>command(['compose','exec','-T','nginx','nginx','-t']));
await check('App non-root',()=>{const uid=command(['compose','exec','-T','app','id','-u']);assert.notEqual(uid,'0');return uid;});
await check('App readiness / DB',()=>command(['compose','exec','-T','app','node','-e',"fetch('http://127.0.0.1:3000/health/ready').then(async r=>{console.log(await r.text());process.exit(r.ok?0:1)})"]));
await check('No database port on host',()=>{const id=command(['compose','ps','-q','postgres']);assert.ok(id,'postgres not running');const ports=JSON.parse(command(['inspect','--format','{{json .HostConfig.PortBindings}}',id]));assert.equal(Object.keys(ports || {}).length,0);return 'not published';});
await check('Least privilege DB app role',()=>{const sql="SELECT rolsuper OR rolcreatedb OR rolcreaterole AS excessive FROM pg_roles WHERE rolname='appointment_app'";const p=command(['compose','exec','-T','postgres','psql','-U',process.env.POSTGRES_USER,'-d',process.env.POSTGRES_DB,'-At','-c',sql]);assert.equal(p,'f');return 'no superuser/createdb/createrole';});
await check('PostgreSQL constraints',()=>{const sql="SELECT count(*) FROM pg_indexes WHERE indexname='one_held_booking_per_slot'";const p=command(['compose','exec','-T','postgres','psql','-U',process.env.POSTGRES_USER,'-d',process.env.POSTGRES_DB,'-At','-c',sql]);assert.equal(p,'1');return 'unique active slot index exists';});
await check('Website + headers',async()=>{const r=await fetch(`http://127.0.0.1:${process.env.WEB_PORT || 8080}`);assert.equal(r.status,200);assert.equal(r.headers.get('x-content-type-options'),'nosniff');return 'HTTP 200, nosniff';});
await check('pgAdmin',async()=>{const r=await fetch(`http://127.0.0.1:${process.env.PGADMIN_PORT || 5050}`);assert.equal(r.status,200);return 'login UI reachable';});
await check('All 5 Prometheus jobs',async()=>{const d=await json(prom+'/api/v1/targets');const jobs=['prometheus','appointment','nginx','postgres','cadvisor'];for(const job of jobs)assert.ok(d.data.activeTargets.some(t=>t.labels.job===job && t.health==='up'),job+' not UP');return jobs;});
await check('DB and Nginx exporter connections',async()=>{for(const metric of ['pg_up','nginx_up']){const rows=await promQuery(metric);assert.ok(rows.some(r=>r.value[1]==='1'),metric+' not 1');}return 'pg_up=1, nginx_up=1';});
await check('Container metrics identified by service',async()=>{const rows=await promQuery('container_memory_working_set_bytes{container_label_com_docker_compose_service="app"}');assert.ok(rows.length,'No app-labelled container metrics; do not claim per-container visibility yet.');return 'app label identified';});
await check('Grafana dashboard provisioned',async()=>{const d=await json(grafana+'/api/dashboards/uid/appointment-local',{headers:{Authorization:auth}});assert.ok(d.dashboard.panels.length>=12);return `${d.dashboard.panels.length} panels`;});
await check('Loki and 3 LogQL queries',async()=>{
  const queries=['{service="app",environment="local"}','{service="nginx",environment="local"} | json | __error__="" | status >= 400','sum(count_over_time({service="nginx",environment="local"} | json | __error__="" | status >= 400 [5m]))'];
  await fetch(`http://127.0.0.1:${process.env.WEB_PORT || 8080}/logql-check-missing`);
  const results=[];
  for(const query of queries){const url=grafana+'/api/datasources/proxy/uid/loki/loki/api/v1/query_range?query='+encodeURIComponent(query)+'&start='+((Date.now()-900000)*1000000)+'&end='+(Date.now()*1000000)+'&limit=20';const d=await json(url,{headers:{Authorization:auth}});assert.equal(d.status,'success');assert.ok(d.data.result.length,'No log results: wait for Promtail to ship logs, then retry.');results.push({query,streams:d.data.result.length});}
  return results;
});
mkdirSync('docs/evidence',{recursive:true});report.status=report.checks.every(x=>x.status==='passed')?'passed':'failed';writeFileSync('docs/evidence/stack-verification.json',JSON.stringify(report,null,2));console.log('Overall:',report.status);if(report.status!=='passed')process.exitCode=1;
