// Registry metadata check only; does not claim containers can start.
import { readFileSync,mkdirSync,writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { dockerExecutable } from './docker-executable.js';
const docker=dockerExecutable();
const compose=readFileSync('compose.yaml','utf8');
const images=[...new Set([...compose.matchAll(/^\s+image:\s+(\S+)/gm)].map(m=>m[1]).filter(s=>!s.startsWith('manh-appointment:')).concat(['node:24-bookworm-slim']))];
const report={at:new Date().toISOString(),scope:'registry metadata linux/amd64 only',images:[]};
async function inspect(image){
  const raw=await new Promise((resolve,reject)=>{let out='',err='';const p=spawn(docker,['manifest','inspect',image],{timeout:60000});p.stdout.on('data',d=>out+=d);p.stderr.on('data',d=>err+=d);p.once('error',reject);p.once('close',c=>c===0?resolve(out):reject(new Error(err.trim()||`exit ${c}`)));});
  const index=JSON.parse(raw),manifest=index.manifests?.find(m=>m.platform?.os==='linux'&&m.platform.architecture==='amd64');
  if(!manifest && image.includes('@sha256:') && index.schemaVersion===2)return image.split('@')[1];
  if(!manifest)throw new Error('No linux/amd64 platform descriptor in manifest index.');
  return manifest.digest;
}
let position=0;
await Promise.all(Array.from({length:3},async()=>{while(position<images.length){const image=images[position++];try{const digest=await inspect(image);report.images.push({image,digest,status:'passed'});console.log('PASS',image,digest);}catch(e){report.images.push({image,status:'failed',error:e.message});console.error('FAIL',image,e.message.slice(0,200));}}}));
mkdirSync('docs/evidence',{recursive:true});writeFileSync('docs/evidence/image-manifests.json',JSON.stringify(report,null,2));
if(report.images.some(x=>x.status!=='passed'))process.exitCode=1;
if(!process.exitCode)writeFileSync('infra/images.lock.json',JSON.stringify(report,null,2));
if(process.argv.includes('--pin') && !process.exitCode){
  let pinned=compose,df=readFileSync('app/Dockerfile','utf8');
  for(const {image,digest} of report.images){
    if(!image.includes('@'))pinned=pinned.replaceAll(`image: ${image}\n`,`image: ${image}@${digest}\n`);
    if(image.startsWith('node:'))df=df.replace(/node:24-bookworm-slim(?:@sha256:[a-f0-9]{64})?/g,`node:24-bookworm-slim@${digest}`);
  }
  writeFileSync('compose.yaml',pinned);writeFileSync('app/Dockerfile',df);console.log('Pinned verified linux/amd64 digests.');
}
