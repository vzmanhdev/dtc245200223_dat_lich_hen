import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
export function dockerExecutable() {
  if(process.env.DOCKER_EXE)return process.env.DOCKER_EXE;
  if(process.platform==='win32') {
    const candidates=[path.join(homedir(),'AppData','Local','Programs','DockerDesktop','resources','bin','docker.exe'),'C:/Program Files/Docker/Docker/resources/bin/docker.exe'];
    for(const candidate of candidates)if(existsSync(candidate))return candidate;
  }
  return 'docker';
}
