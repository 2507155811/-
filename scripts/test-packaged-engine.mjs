import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import path from 'node:path';
const require=createRequire(import.meta.url), {LocalAI}=require('../desktop/ai.cjs');
const root=path.resolve('artifacts/desktop/MOMO-win32-x64/resources/app');
const ai=new LocalAI(root);
try {
  const status=await ai.load();assert.equal(status.loaded,true);
  const reply=await ai.chat([{role:'system',content:'请用中文简短回答。'},{role:'user',content:'你好，请打个招呼。'}]);
  assert.match(reply.text,/[\u4e00-\u9fff]/);
  console.log('Actual packaged Windows engine and bundled model inference passed:',reply.text);
} finally {ai.cancel();}
