import {test,expect} from '@playwright/test';
test('preview is temporary; evolution and memories survive switching and reload',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');
 await page.locator('[data-page="4"]').click();await page.locator('#memory-notes').fill('我喜欢红茶，进化后也要记得');await page.locator('#save-memory').click();
 await page.locator('[data-page="1"]').click();await page.locator('[data-evolution="3"]').click();
 await expect(page.locator('.pet-label h2 span')).toHaveText('合金龙卫');
 expect(await page.evaluate(()=>localStorage.getItem('momo-evolution'))).toBeNull();
 await page.reload();await expect(page.locator('.pet-label h2 span')).toHaveText('绒角幼兽');
 await page.evaluate(()=>{const j=JSON.parse(localStorage.getItem('momo-journal'));j.total=100;localStorage.setItem('momo-journal',JSON.stringify(j));});await page.reload();
 await page.locator('[data-page="1"]').click();await page.locator('[data-evolution="2"]').click();
 await expect(page.locator('.pet-label h2 span')).toHaveText('角冠暴龙');
 await page.locator('[data-page="1"]').click();await page.locator('[data-model="1"]').click();await page.reload();
 await expect(page.locator('.pet-label h2 span')).toHaveText('角冠暴龙');
 await page.locator('[data-page="4"]').click();await expect(page.locator('#memory-notes')).toHaveValue('我喜欢红茶，进化后也要记得');
 const backup=await page.evaluate(async()=>{const {createBackup}=await import('/companion-data.js');return createBackup();});
 expect(backup.records['momo-evolution']).toEqual({stage:2,highest:2});
 expect(errors).toEqual([]);
});
test('evolution screen fits a phone and preview remains cancelable',async({page})=>{
 await page.setViewportSize({width:393,height:852});await page.goto('/');
 await page.locator('[data-page="1"]').click();await expect(page.locator('#evolve-now')).toBeDisabled();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 await page.locator('[data-evolution="2"]').click();await page.locator('.preview-exit').click();
 await expect(page.locator('.pet-label h2 span')).toHaveText('绒角幼兽');
});
test('fully evolved pet exports and reimports within the energy budget',async({page})=>{
 await page.goto('/');await page.locator('[data-page="1"]').click();await page.locator('[data-evolution="3"]').click();
 await page.locator('[data-page="1"]').click();
 const downloadEvent=page.waitForEvent('download');await page.locator('#export-model').click();const download=await downloadEvent;
 const file=await download.path();await page.locator('#model-file').setInputFiles(file);
 await expect(page.locator('#import-status')).toContainText('已加载');await expect(page.locator('.pet-label h2 span')).toHaveText('自定义模型');
});
test('all four unlocked forms remain selectable across all families and wardrobe preserves memory',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');
 await page.evaluate(()=>{localStorage.setItem('momo-evolution',JSON.stringify({stage:3,highest:3}));localStorage.setItem('momo-memory',JSON.stringify({notes:'四种形态都记得红茶',messages:[]}));});await page.reload();
 await page.locator('[data-page="1"]').click();await page.locator('[data-family="angel"]').click();
 await expect(page.locator('#canvas')).toHaveAttribute('data-model-state','ready');
 await page.locator('[data-evolution="0"]').click();await expect(page.locator('.pet-label h2 span')).toHaveText('光羽使者');
 await page.locator('[data-page="1"]').click();await page.locator('[data-evolution="3"]').click();await expect(page.locator('.pet-label h2 span')).toHaveText('炽光天使');
 await page.locator('[data-page="1"]').click();await page.locator('[data-family="human"]').click();await expect(page.locator('#canvas')).toHaveAttribute('data-model-state','ready');
 await expect(page.locator('#wardrobe-panel')).toBeVisible();await page.locator('#wardrobe-outfit').selectOption('formal');await page.locator('#wardrobe-hair').selectOption('ponytail');await page.locator('#wardrobe-outerwear').uncheck();
 await expect(page.locator('#canvas')).toHaveAttribute('data-model-state','ready');
 await page.reload();await page.locator('[data-page="1"]').click();await expect(page.locator('#wardrobe-outfit')).toHaveValue('formal');await expect(page.locator('#wardrobe-hair')).toHaveValue('ponytail');await expect(page.locator('#wardrobe-outerwear')).not.toBeChecked();
 await page.locator('[data-evolution="0"]').click();await page.locator('[data-page="1"]').click();await page.locator('[data-evolution="2"]').click();
 await expect(page.locator('.pet-label h2 span')).toHaveText('月华 · 成熟');
 await page.locator('[data-page="4"]').click();await expect(page.locator('#memory-notes')).toHaveValue('四种形态都记得红茶');
 expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('momo-evolution')).highest)).toBe(3);expect(errors).toEqual([]);
});
test('angel avatar can export and reimport under the 100k vertex budget',async({page})=>{
 await page.goto('/');await page.locator('[data-page="1"]').click();await page.locator('[data-family="angel"]').click();await page.locator('[data-evolution="3"]').click();await expect(page.locator('#canvas')).toHaveAttribute('data-model-state','ready');
 await page.locator('[data-page="1"]').click();const event=page.waitForEvent('download');await page.locator('#export-model').click();const d=await event;await page.locator('#model-file').setInputFiles(await d.path());await expect(page.locator('#import-status')).toContainText('已加载');
});
