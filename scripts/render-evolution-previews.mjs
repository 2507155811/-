// Run `npm run dev -- --port 5183` first. The portraits are rendered from the
// actual 3D models; the app uses static thumbnails instead of four WebGL scenes.
import {chromium} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
const browser=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox','--enable-unsafe-swiftshader']});
try {
 const page=await browser.newPage({viewport:{width:480,height:480}});
 await page.goto(process.env.MOMO_PREVIEW_URL || 'http://127.0.0.1:5183');await mkdir('public/evolution',{recursive:true});
 for(let stage=0;stage<4;stage++){
  await page.evaluate(async(stage)=>{
   const T=await import('/node_modules/three/build/three.module.js');const {createDinosaur}=await import('/dinosaur.js');
   window.previewRenderer?.dispose();
   const r=new T.WebGLRenderer({antialias:true,alpha:true});r.setSize(480,480);r.setPixelRatio(1);r.setClearColor(0,0);r.toneMapping=T.ACESFilmicToneMapping;r.toneMappingExposure=1.15;
   document.body.style.cssText='margin:0;background:transparent;';document.body.replaceChildren(r.domElement);r.domElement.id='preview-model';
   const scene=new T.Scene(),camera=new T.PerspectiveCamera(32,1,.1,100);camera.position.set(.7,2.3,6.1);camera.lookAt(0,1.3,0);
   scene.add(new T.HemisphereLight(0xffffff,0x768165,2));const l=new T.DirectionalLight(0xfff4df,3);l.position.set(3,5,4);scene.add(l);
   scene.add(createDinosaur(stage).root);r.render(scene,camera);window.previewRenderer=r;
  },stage);
  await page.locator('#preview-model').screenshot({path:`public/evolution/stage-${stage}.png`,omitBackground:true});
 }
}finally{await browser.close();}
