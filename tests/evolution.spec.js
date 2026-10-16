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
