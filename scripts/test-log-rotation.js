import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';
import {dockerExecutable} from './docker-executable.js';
const docker=dockerExecutable();
function run(args){const p=spawnSync(docker,args,{encoding:'utf8',timeout:90000});if(p.status!==0)throw Error(p.stderr||'Docker operation failed');return p.stdout;}
const record={at:new Date().toISOString(),status:'passed'};
run(['compose','exec','-T','nginx','sh','-n','/etc/nginx/rotate-logs.sh']);
await(await fetch('http://127.0.0.1:8080/')).arrayBuffer();
run(['compose','exec','-T','-e','LOG_MAX_BYTES=1','nginx','sh','/etc/nginx/rotate-logs.sh','--once']);
assert.equal((await fetch('http://127.0.0.1:8080/')).status,200);
run(['compose','exec','-T','nginx','sh','-c','test -s /logs/access.log.1 && test -s /logs/access.log']);
record.rotation='old file retained; new access log receives requests';
run(['compose','restart','nginx']);
run(['compose','up','-d','--no-deps','--wait','--wait-timeout','90','nginx']);
const processes=run(['compose','exec','-T','nginx','ps','-o','pid,args']);
assert.ok(processes.includes('sh /etc/nginx/rotate-logs.sh'));record.processes_after_restart=processes.trim();
assert.equal((await fetch('http://127.0.0.1:8080/')).status,200);record.restart='web and rotation process recover together';
writeFileSync('docs/evidence/log-rotation-verification.json',JSON.stringify(record,null,2));console.log('PASS rotation, Nginx restart, rotation process recovery and HTTP 200');
