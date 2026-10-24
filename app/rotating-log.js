import { appendFileSync,existsSync,statSync,renameSync,unlinkSync } from 'node:fs';
// Small local lab: bounded append-only JSON logs, three 10 MiB generations.
export function rotatingLog(filename,maxBytes=10*1024*1024) {
  let bytes=existsSync(filename)?statSync(filename).size:0;
  return { write(chunk) {
    const size=Buffer.byteLength(chunk);
    if(bytes+size>maxBytes) {
      if(existsSync(filename+'.2'))unlinkSync(filename+'.2');
      if(existsSync(filename+'.1'))renameSync(filename+'.1',filename+'.2');
      if(existsSync(filename))renameSync(filename,filename+'.1');
      bytes=0;
    }
    appendFileSync(filename,chunk,{encoding:'utf8',mode:0o640});bytes+=size;
    return true;
  }};
}
