const assert = require('node:assert/strict');
const {LocalAI,startupFailure} = require('../desktop/ai.cjs');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
(async()=>{
 assert.match(startupFailure(-1073741515),/运行库/);
 assert.match(startupFailure(-1073741795),/CPU 指令/);
 assert.match(startupFailure(-1073741701),/架构不匹配/);
 assert.match(startupFailure(null,{code:'ENOENT'}),/完整解压/);
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'momo-failure-'));
 try {
   const dir=path.join(root,'ai-runtime',process.platform+'-'+process.arch);fs.mkdirSync(dir,{recursive:true});
   const binary=path.join(dir,process.platform==='win32'?'llama-server.exe':'llama-server');
   if(process.platform!=='win32') {
     fs.writeFileSync(binary,'#!/bin/sh\necho "failed to load model: corrupted test weights" >&2\nexit 3\n',{mode:0o755});
     fs.mkdirSync(path.join(root,'ai-assets'));const weights=Buffer.alloc(1024*1024);weights.write('GGUF');fs.writeFileSync(path.join(root,'ai-assets','qwen2.5-0.5b-instruct-q4_k_m.gguf'),weights);
     const ai=new LocalAI(root,{logFile:path.join(root,'diagnostic.log')});
     await assert.rejects(ai.load(),/退出码 3/);assert.equal(ai.status().loaded,false);assert.equal(ai.status().busy,false);assert.equal(ai.child,null);
     assert.match(ai.status().lastError,/corrupted test weights/);assert.match(fs.readFileSync(ai.logFile,'utf8'),/corrupted test weights/);
     ai.cancel();
   }
 } finally {fs.rmSync(root,{recursive:true,force:true});}
 console.log('PASS: Windows startup codes, native startup failure, accurate status, cleanup, local diagnostic.');
})().catch(e=>{console.error(e);process.exitCode=1;});
