import {spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {dockerExecutable} from './docker-executable.js';
process.loadEnvFile('.env');
// Verify the actual Nginx certificate inside the Docker network. Some host
// antivirus software replaces TLS certificates, including localhost traffic.
const script=`const https=require('https'),fs=require('fs'),assert=require('assert/strict');
const agent=new https.Agent({ca:fs.readFileSync(0),rejectUnauthorized:true});
function get(path){return new Promise((resolve,reject)=>{https.get({hostname:'nginx',port:8443,servername:'localhost',path,agent,headers:{Host:'localhost:8443'}},r=>{let body='';r.on('data',x=>body+=x);r.on('end',()=>resolve({status:r.statusCode,headers:r.headers,body,protocol:r.socket.getProtocol(),authorized:r.socket.authorized}));}).on('error',reject);});}
(async()=>{const first=await get('/login');assert.equal(first.status,200);assert.equal(first.authorized,true);assert.ok(['TLSv1.2','TLSv1.3'].includes(first.protocol));assert.ok(first.body.includes('_csrf'));assert.ok(first.headers['set-cookie']?.some(x=>/; Secure/i.test(x)),'Secure cookie missing');assert.equal((await get('/metrics')).status,404);console.log(JSON.stringify({status:first.status,authorized:first.authorized,protocol:first.protocol,secure_cookie:true,private_metrics_blocked:true}));})().catch(e=>{console.error(e.message);process.exitCode=1;});`;
const result=spawnSync(dockerExecutable(),['compose','exec','-T','app','node','-e',script],{input:readFileSync('infra/nginx/certs/localhost.crt'),encoding:'utf8',timeout:30000});
if(result.status!==0)throw new Error(result.stderr||'TLS probe failed');
const report={at:new Date().toISOString(),url:`https://localhost:${process.env.HTTPS_PORT||8443}`,...JSON.parse(result.stdout),trust:'Direct Nginx connection from Docker network using explicit local CA, SAN localhost, verification enabled. Host browser may have antivirus TLS inspection. No OS trust store change.'};
mkdirSync('docs/evidence',{recursive:true});writeFileSync('docs/evidence/tls-verification.json',JSON.stringify(report,null,2));console.log('PASS TLS certificate verification, Secure cookie, private metrics blocked',report.protocol);