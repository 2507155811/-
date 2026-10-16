import {spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
if(process.platform==='win32') {
  const lock=JSON.parse(readFileSync('ai/runtime-lock.json','utf8'));
  const file='ai-runtime/win32-x64/llama-server.exe', provenance='ai-runtime/win32-x64/runtime-provenance.json';
  if(existsSync(file)&&existsSync(provenance)&&!process.env.MOMO_FORCE_BUILD_ENGINE){
    const saved=JSON.parse(readFileSync(provenance,'utf8'));
    const hash=createHash('sha256').update(readFileSync(file)).digest('hex');
    if(saved.commit===lock.commit && saved.build_variant==='static-baseline-v1' && saved.staticCRT===true && saved.openmp===false && saved.engine_sha256===hash){console.log('Reused verified compatible static Windows engine');process.exit(0);}
  }
  const result=spawnSync(process.execPath,['scripts/prepare-llama.mjs'],{stdio:'inherit'});
  if(result.status!==0)process.exit(result.status??1);
  const spec=JSON.parse(readFileSync('ai/runtime-lock.json','utf8'));
  writeFileSync('ai-runtime/win32-x64/runtime-provenance.json',JSON.stringify({repository:spec.repository,commit:spec.commit,staticCRT:true,openmp:false,cpu:'baseline x64; AVX/AVX2/FMA/F16C/SSE4.2/BMI2 disabled',build_variant:'static-baseline-v1',engine_sha256:createHash('sha256').update(readFileSync(file)).digest('hex')},null,2));
} else {
  console.error('Windows distribution packages must be built on Windows to include the compatible static CPU engine. Use the GitHub Actions package workflow.');
  process.exit(1);
}
