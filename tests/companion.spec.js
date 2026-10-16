import {test,expect} from '@playwright/test';
function modelFile(){
  const data=Buffer.from(new Float32Array([-1,0,0,1,0,0,0,2,0]).buffer);
  return {name:'triangle.gltf',mimeType:'model/gltf+json',buffer:Buffer.from(JSON.stringify({asset:{version:'2.0'},scene:0,scenes:[{nodes:[0]}],nodes:[{mesh:0}],meshes:[{primitives:[{attributes:{POSITION:0}}]}],buffers:[{uri:'data:application/octet-stream;base64,'+data.toString('base64'),byteLength:36}],bufferViews:[{buffer:0,byteLength:36}],accessors:[{bufferView:0,componentType:5126,count:3,type:'VEC3',min:[-1,0,0],max:[1,2,0]}]}))};
}
test('custom model persists, exports, reimports and deletes',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');await page.locator('[data-page="1"]').click();
  await page.locator('#model-file').setInputFiles(modelFile());
  await expect(page.locator('#import-status')).toContainText('已保存到本机');
  await page.reload();await expect(page.locator('.pet-label h2 span')).toHaveText('自定义模型');
  await expect(page.locator('.pet-label p')).toHaveText('triangle.gltf');
  await page.locator('[data-page="1"]').click();
  const downloadPromise=page.waitForEvent('download');await page.locator('#export-model').click();
  const download=await downloadPromise;expect(download.suggestedFilename()).toBe('MOMO-companion.glb');
  const file=await download.path();
  await page.locator('#model-file').setInputFiles(file);
  await expect(page.locator('#import-status')).toContainText('已保存到本机');
  await page.locator('[data-page="1"]').click();
  await page.locator('#model-file').setInputFiles({name:'broken.glb',mimeType:'model/gltf-binary',buffer:Buffer.from('invalid')});
  await expect(page.locator('#import-status')).toContainText('加载失败');
  await expect(page.locator('.pet-label h2 span')).toHaveText('自定义模型');
  await page.locator('#delete-model').click();await expect(page.locator('#import-status')).toContainText('已删除');
  await expect(page.locator('#restore-model')).toBeDisabled();await page.reload();
  await expect(page.locator('.pet-label h2 span')).toHaveText('云朵精灵');expect(errors).toEqual([]);
});
test('mobile preferences and interaction survive reload',async({page})=>{
  await page.setViewportSize({width:412,height:915});await page.goto('/');
  await page.locator('#wave').click();await page.locator('[data-world="night"]').click();
  await page.locator('#accessory').check();await page.reload();
  await expect(page.locator('#touches')).toHaveText('1');await expect(page.locator('.stage')).toHaveAttribute('data-world','night');
  await expect(page.locator('#accessory')).toBeChecked();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.locator('#focus-mode').click();await page.keyboard.press('Escape');await expect(page.locator('body')).not.toHaveClass('companion-mode');
});
