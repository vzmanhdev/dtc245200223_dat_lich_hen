import {existsSync,mkdirSync,readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {X509Certificate} from 'node:crypto';
import {join} from 'node:path';

// Certificates stay machine-local. Git for Windows supplies OpenSSL on Windows.
const dir='infra/nginx/certs',cert=join(dir,'localhost.crt'),key=join(dir,'localhost.key');
if(existsSync(cert)&&existsSync(key)) {
  const x=new X509Certificate(readFileSync(cert));
  if(!x.checkHost('localhost')||!x.checkIP('127.0.0.1')||Date.parse(x.validTo)<Date.now()+86400000)
    throw new Error('Local TLS certificate invalid or expiring. Move the old cert/key aside and run setup again.');
  console.log('Local TLS certificate preserved.');
} else {
  if(existsSync(cert)||existsSync(key)) throw new Error('Incomplete local certificate pair; move it aside before setup.');
  const candidates=['openssl',...(process.platform==='win32'?[join(process.env.ProgramFiles||'C:/Program Files','Git/usr/bin/openssl.exe')]:[])];
  const openssl=candidates.find(p=>spawnSync(p,['version'],{stdio:'ignore'}).status===0);
  if(!openssl) throw new Error('OpenSSL required. Install Git for Windows (includes OpenSSL), or openssl on Linux, then rerun npm run setup.');
  mkdirSync(dir,{recursive:true});
  const result=spawnSync(openssl,['req','-x509','-newkey','rsa:2048','-sha256','-nodes','-days','365','-subj','/CN=localhost/O=Appointment Local Lab','-addext','subjectAltName=DNS:localhost,IP:127.0.0.1','-keyout',key,'-out',cert],{encoding:'utf8',env:{...process.env,MSYS_NO_PATHCONV:'1'}});
  if(result.status!==0) throw new Error('OpenSSL certificate generation failed: '+result.stderr);
  console.log('Created self-signed localhost TLS certificate (365 days). Private key is ignored by Git.');
}
