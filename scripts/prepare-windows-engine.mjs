import {spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
if(process.platform==='win32') {
  const result=spawnSync(process.execPath,['scripts/prepare-llama.mjs'],{stdio:'inherit'});
  if(result.status!==0)process.exit(result.status??1);
  const spec=JSON.parse(readFileSync('ai/runtime-lock.json','utf8'));
  writeFileSync('ai-runtime/win32-x64/runtime-provenance.json',JSON.stringify({repository:spec.repository,commit:spec.commit,staticCRT:true,openmp:false,cpu:'baseline x64; AVX/AVX2/FMA/F16C/SSE4.2/BMI2 disabled'},null,2));
} else {
  console.error('Windows distribution packages must be built on Windows to include the compatible static CPU engine. Use the GitHub Actions package workflow.');
  process.exit(1);
}
