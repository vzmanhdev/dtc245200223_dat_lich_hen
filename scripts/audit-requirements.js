import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {dockerExecutable} from './docker-executable.js';
process.loadEnvFile('.env');
const docker=dockerExecutable(),report={at:new Date().toISOString(),timezone:'Asia/Bangkok',checks:[]};
function command(executable,args){const r=spawnSync(executable,args,{encoding:'utf8',timeout:30000});if(r.status!==0)throw new Error(`Command failed (${r.status})`);return r.stdout.trim();}
async function check(name,fn){try{const result=await fn();report.checks.push({name,status:'passed',result});console.log('PASS',name);}catch(e){report.checks.push({name,status:'failed',error:e.message});console.log('FAIL',name,e.message);}}
async function json(url,headers={}){const r=await fetch(url,{headers,signal:AbortSignal.timeout(15000)});if(!r.ok)throw new Error('HTTP '+r.status);return r.json();}
const web=`http://127.0.0.1:${process.env.WEB_PORT||8080}`,prom=`http://127.0.0.1:${process.env.PROMETHEUS_PORT||9090}`,grafana=`http://127.0.0.1:${process.env.GRAFANA_PORT||3001}`;
const grafanaHeaders={Authorization:'Basic '+Buffer.from(`${process.env.GRAFANA_ADMIN_USER}:${process.env.GRAFANA_ADMIN_PASSWORD}`).toString('base64')};
await check('Original report fingerprint',()=>({path:'docx/Bao_Cao_Trien_Khai_He_Thong.docx',sha256:createHash('sha256').update(readFileSync('docx/Bao_Cao_Trien_Khai_He_Thong.docx')).digest('hex')}));
await check('GitHub source and meaningful history',()=>{
 const local=command('git',['rev-parse','HEAD']),remote=command('git',['ls-remote','origin','refs/heads/main']).split(/\s/)[0];if(local!==remote)throw new Error('Local and remote HEAD differ');
 return {head:local,remote_matches:true,commits:Number(command('git',['rev-list','--count','HEAD'])),readme_length:readFileSync('README.md','utf8').length,readme_has_git_clone:/git\s+clone/.test(readFileSync('README.md','utf8'))};
});
await check('Running services and one-shot jobs',()=>{const rows=command(docker,['compose','ps','-a','--format','{{.Service}}|{{.State}}|{{.Health}}|{{.ExitCode}}']).split('\n');for(const row of rows){const [name,state,,code]=row.split('|');if(['migrate','log-init'].includes(name)){if(state!=='exited'||code!=='0')throw new Error(name+' did not complete successfully');}else if(state!=='running')throw new Error(name+' is '+state+' (exit '+code+')');}const expected=Object.keys(JSON.parse(command(docker,['compose','config','--format','json'])).services);for(const name of expected)if(!rows.some(row=>row.startsWith(name+'|')))throw new Error(name+' missing');return rows;});
await check('Hardening and internal networking',()=>{
 const config=JSON.parse(command(docker,['compose','config','--format','json'])),appId=command(docker,['compose','ps','-q','app']);
 const inspect=JSON.parse(command(docker,['inspect',appId]))[0];
 const hardening={app_user:inspect.Config.User,read_only:inspect.HostConfig.ReadonlyRootfs,cap_drop:inspect.HostConfig.CapDrop,security_opt:inspect.HostConfig.SecurityOpt,db_network_internal:config.networks.db.internal,monitoring_network_internal:config.networks.monitoring.internal,published_ports:Object.fromEntries(Object.entries(config.services).filter(([,s])=>s.ports?.length).map(([name,s])=>[name,s.ports.map(p=>({host:p.host_ip,published:p.published,target:p.target}))])),privileged_exceptions:Object.entries(config.services).filter(([,s])=>s.privileged).map(([name])=>name)};
 if(!hardening.read_only||!hardening.db_network_internal||hardening.app_user==='0'||hardening.app_user==='root')throw new Error('App hardening missing');
 return hardening;
});
await check('Actual HTTP security headers',async()=>{
 const r=await fetch(web);await r.arrayBuffer();return {status:r.status,headers:Object.fromEntries(['x-frame-options','x-content-type-options','content-security-policy','referrer-policy','permissions-policy','x-xss-protection','strict-transport-security'].map(k=>[k,r.headers.get(k)])),https_configured:readFileSync('infra/nginx/default.conf','utf8').includes('ssl_certificate')};
});
await check('Database schema and non-owner app role',()=>{
 const sql="SELECT 'schema_versions',string_agg(version::text,', ' ORDER BY version) FROM schema_migrations UNION ALL SELECT 'app_is_table_owner',count(*)::text FROM pg_tables WHERE schemaname='public' AND tableowner='appointment_app' UNION ALL SELECT 'app_superuser',rolsuper::text FROM pg_roles WHERE rolname='appointment_app' UNION ALL SELECT 'active_admins',count(*)::text FROM admin_users WHERE active;";
 return command(docker,['compose','exec','-T','postgres','psql','-U',process.env.POSTGRES_USER,'-d',process.env.POSTGRES_DB,'-At','-c',sql]).split('\n');
});
await check('Every provisioned Prometheus panel has finite samples',async()=>{
 const dashboard=(await json(grafana+'/api/dashboards/uid/appointment-local',grafanaHeaders)).dashboard,results=[];
 for(const panel of dashboard.panels.filter(p=>p.datasource.uid==='prometheus'))for(const target of panel.targets){
  const params=new URLSearchParams({query:target.expr,start:String(Math.floor(Date.now()/1000)-1800),end:String(Math.floor(Date.now()/1000)),step:'15'}),d=await json(prom+'/api/v1/query_range?'+params);
  if(d.status!=='success')throw new Error(panel.title+' query failed');
  const finite=d.data.result.reduce((n,s)=>n+s.values.filter(v=>Number.isFinite(Number(v[1]))).length,0);
  results.push({panel:panel.title,series:d.data.result.length,finite_samples:finite});
 }
 report.dashboard={total_panels:dashboard.panels.length,network_io_panel:dashboard.panels.some(p=>p.targets?.some(t=>t.expr.includes('container_network_'))),queries:results};
 if(results.some(p=>p.finite_samples===0))throw new Error('No finite samples: '+results.filter(p=>p.finite_samples===0).map(p=>p.panel).join(', '));
 return results;
});
await check('Container network metrics availability',async()=>{
 const d=await json(prom+'/api/v1/query?query='+encodeURIComponent('container_network_receive_bytes_total{container_label_com_docker_compose_service!=""}'));return {series:d.data.result.length,note:'Metric availability does not mean a dashboard panel exists.'};
});
await check('Actual centralized log sources',async()=>{
 const d=await json(grafana+'/api/datasources/proxy/uid/loki/loki/api/v1/label/service/values',grafanaHeaders);
 return {services:d.data,scope:'Promtail static file mounts for app, nginx access and postgres; not every container stdout/stderr.'};
});
report.compliance_notes=['Technical probes do not certify the final report or every statement in the supplied template.','See docs/08_DOI_CHIEU_DE_BAI_VA_BAO_CAO.md for missing deliverables and template differences.'];
mkdirSync('docs/evidence',{recursive:true});writeFileSync('docs/evidence/requirements-audit.json',JSON.stringify(report,null,2));
console.log('Deep audit:',report.checks.filter(c=>c.status==='passed').length+'/'+report.checks.length);
if(report.checks.some(c=>c.status==='failed'))process.exitCode=1;
