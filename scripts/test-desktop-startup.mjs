import {_electron,expect} from '@playwright/test';
import {createRequire} from 'node:module';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';import path from 'node:path';
const require=createRequire(import.meta.url),profile=await mkdtemp(path.join(os.tmpdir(),'momo-startup-'));
const options={executablePath:require('electron'),args:[...(process.platform==='linux'?['--no-sandbox','--ozone-platform=headless','--enable-unsafe-swiftshader']:[]),process.cwd(),"--momo-no-tray"],env:{...process.env,MOMO_PROFILE_DIR:profile}};
let app;
try {
 app=await _electron.launch(options);const pet=await app.firstWindow();await pet.setViewportSize({width:360,height:450});
 await pet.waitForSelector('.native-pet');expect(pet.url()).toContain('pet=1');
 await pet.locator('#native-menu-toggle').click();
 await pet.locator('[data-pet-page="1"]').click();
 await expect.poll(()=>app.windows().length).toBe(2);
 const dashboard=app.windows().find(w=>w!==pet);
 await expect(dashboard.locator('#models')).toBeVisible();
 await pet.locator('#native-menu-toggle').click();await pet.locator('[data-pet-page="2"]').click();
 await expect(dashboard.locator('#chat')).toBeVisible();
 await dashboard.locator('[data-page="4"]').click();await dashboard.locator('#native-startup').uncheck();
 await expect.poll(()=>dashboard.evaluate(async()=>(await window.momoDesktop.status()).startupPet)).toBe(false);
 await app.close();app=null;
 app=await _electron.launch(options);const first=await app.firstWindow();await first.waitForSelector('canvas');expect(first.url()).not.toContain('pet=1');
 console.log('PASS: pet-first startup, evolution and chat navigation, persisted startup preference.');
}finally{await app?.close();await rm(profile,{recursive:true,force:true});}
