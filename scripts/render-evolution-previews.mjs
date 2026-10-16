// Render portraits from the actual meshes; only one WebGL scene is used in-app.
// Run `npm run dev -- --port 5183` first.
import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const browser=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox','--enable-unsafe-swiftshader']});
try {
 const page=await browser.newPage({viewport:{width:480,height:480}});
 await page.goto(process.env.MOMO_PREVIEW_URL || 'http://127.0.0.1:5183');await mkdir('public/evolution',{recursive:true});
 await page.evaluate(()=>window.dispatchEvent(new CustomEvent('momo-power',{detail:{paused:true}})));
 for(const family of ['dragon','angel','human'])for(let stage=0;stage<4;stage++){
  const png=await page.evaluate(async({family,stage})=>{
   const T=await import('/node_modules/three/build/three.module.js');
   const {createDinosaur}=await import('/dinosaur.js');const {createHumanoid}=await import('/humanoid.js');
   if(window.previewRenderer){window.previewRenderer.dispose();window.previewRenderer.forceContextLoss();}
   const r=new T.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true});r.setSize(480,480);r.setPixelRatio(1);r.setClearColor(0,0);r.toneMapping=T.ACESFilmicToneMapping;r.toneMappingExposure=1.15;
   document.body.style.cssText='margin:0;background:transparent;';document.body.replaceChildren(r.domElement);
   const scene=new T.Scene(),camera=new T.PerspectiveCamera(32,1,.1,100);camera.position.set(.6,2.3,family==='dragon'?6.1:6.5);camera.lookAt(0,1.45,0);
   scene.add(new T.HemisphereLight(0xffffff,0x768165,2));const l=new T.DirectionalLight(0xfff4df,3);l.position.set(3,5,4);scene.add(l);
   const avatar=family==='dragon'?createDinosaur(stage):await createHumanoid(family,stage);
   scene.add(avatar.root);
   const size=new T.Box3().setFromObject(avatar.root).getSize(new T.Vector3());
   const distance=Math.max(size.x,size.y)*.5/Math.tan(T.MathUtils.degToRad(16))*1.13;
   camera.position.set(.45,1.65+distance*.1,distance);camera.lookAt(0,1.45,0);
   r.render(scene,camera);window.previewRenderer=r;
   let vertices=0,draws=0;avatar.root.traverse(o=>{if(o.isMesh){vertices+=o.geometry.attributes.position.count;draws++;}});
   return {url:r.domElement.toDataURL('image/png'),vertices,draws};
  },{family,stage});
  const name=family==='dragon'?`stage-${stage}`:`${family}-${stage}`;
  await writeFile(`public/evolution/${name}.png`,Buffer.from(png.url.split(',')[1],'base64'));
  console.log(family,stage,png.vertices,png.draws);
 }
}finally{await browser.close();}
