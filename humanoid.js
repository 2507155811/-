import * as T from 'three';
import {mergeGeometries,mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';
let assetPromise;
export function loadAdultBase(){
 if(!assetPromise)assetPromise=fetch('/avatars/adult-clothed-base.json').then(r=>{if(!r.ok)throw Error('成年角色资源加载失败');return r.json();}).catch(e=>{assetPromise=null;throw e;});
 return assetPromise;
}
export async function createHumanoid(family,stage,palette=0,wardrobe={}){
 const data=await loadAdultBase(),root=new T.Group();root.name=family==='angel'?'MOMO-Angel':'MOMO-Adult-Companion';
 root.userData.presentation='Clothed adult character; not a real-person scan';
 const mat=(color,roughness=.64,metalness=0)=>new T.MeshStandardMaterial({color,roughness,metalness});
 const skin=mat(0xe5bba0,.7),hair=mat([0x48332c,0x342a34,0x534134,0x493a35][stage],.48);
 const white=mat(0xf6f0dc,.7),gold=mat(0xc8a258,.34,.64),metal=mat(0xaab9ba,.34,.65),ink=mat(0x293b4e,.72),eyes=mat(0x36302d,.3),iris=mat(0x66878a,.3);
 const cloth=mat(family==='angel'?[0xede8dc,0xf6efdc,0xe2dfdc,0xcbbb83][stage]:[0xf5eee1,0x718b89,0xd4b7a2,0x617864][stage],.9);
 const accent=mat([0x8ba28e,0x8b724c,0x8d799d][palette],.65),lip=mat(0xb57970,.65),glow=mat(0x8bd7d1,.3,.2);glow.emissive.set(0x3f8e91);glow.emissiveIntensity=.3;
 const sphere=new T.SphereGeometry(1,20,14);
 function mesh(parent,g,m,p=[0,0,0],s=[1,1,1],r=[0,0,0]){const o=new T.Mesh(g,m);o.position.fromArray(p);o.scale.fromArray(s);o.rotation.set(...r);o.castShadow=true;parent.add(o);return o;}
 const ball=(parent,m,p,s,r)=>mesh(parent,sphere,m,p,s,r);
 function line(parent,points,radius,m){return mesh(parent,new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),24,radius,8,false),m);}
 function rod(parent,a,b,r,m){const start=new T.Vector3(...a),delta=new T.Vector3(...b).sub(start);const o=mesh(parent,new T.CylinderGeometry(r,r,delta.length(),12),m,start.addScaledVector(delta,.5).toArray());o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize());return o;}
 function clothSurface(parent,profile,m,{radiusZ=.68,x=0,y=0,z=0,segments=48}={}){
  if(profile[0][1]>profile[profile.length-1][1])profile=[...profile].reverse();
  const g=new T.LatheGeometry(profile.map(([r,h])=>new T.Vector2(r,h)),segments);g.scale(1,1,radiusZ);return mesh(parent,g,m,[x,y,z]);
 }
 const neck=new T.Group();neck.position.y=2.36;root.add(neck);const head=new T.Group();head.position.y=-2.36;neck.add(head);
 // Smooth the adult facial topology once while preserving boundary edges.
 function smoothHead(geometry){
  const p=geometry.attributes.position.array, tris=geometry.index.array, n=p.length/3;
  const neighbours=Array.from({length:n},()=>new Set()), edges=new Map();
  for(let i=0;i<tris.length;i+=3){const t=[tris[i],tris[i+1],tris[i+2]];for(let j=0;j<3;j++){
   const a=t[j],b=t[(j+1)%3],c=t[(j+2)%3],key=a<b?a+':'+b:b+':'+a;
   neighbours[a].add(b);neighbours[b].add(a);const e=edges.get(key)||{a:Math.min(a,b),b:Math.max(a,b),opposite:[]};e.opposite.push(c);edges.set(key,e);
  }}
  const boundary=Array.from({length:n},()=>[]);for(const e of edges.values())if(e.opposite.length===1){boundary[e.a].push(e.b);boundary[e.b].push(e.a);}
  const out=[];
  for(let i=0;i<n;i++)for(let k=0;k<3;k++){
   if(boundary[i].length===2)out.push(p[i*3+k]*.75+(p[boundary[i][0]*3+k]+p[boundary[i][1]*3+k])*.125);
   else{const ids=[...neighbours[i]],beta=ids.length===3?3/16:3/(8*Math.max(1,ids.length));out.push(p[i*3+k]*(1-ids.length*beta)+ids.reduce((sum,id)=>sum+p[id*3+k],0)*beta);}
  }
  for(const e of edges.values()){e.id=out.length/3;for(let k=0;k<3;k++)out.push(e.opposite.length===2?(p[e.a*3+k]+p[e.b*3+k])*.375+(p[e.opposite[0]*3+k]+p[e.opposite[1]*3+k])*.125:(p[e.a*3+k]+p[e.b*3+k])*.5);}
  const edge=(a,b)=>edges.get(a<b?a+':'+b:b+':'+a).id,indices=[];
  for(let i=0;i<tris.length;i+=3){const a=tris[i],b=tris[i+1],c=tris[i+2],ab=edge(a,b),bc=edge(b,c),ca=edge(c,a);indices.push(a,ab,ca,b,bc,ab,c,ca,bc,ab,bc,ca);}
  geometry.dispose();const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(out,3));g.setIndex(indices);g.computeVertexNormals();return g;
 }
 // The asset has separate permanent shirt/trouser surfaces; no undress switch.
 for(const [name,indices]of Object.entries(data.segments)){
  const used=[...new Set(indices)],remap=new Map(used.map((id,i)=>[id,i]));
  let g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(used.flatMap(i=>data.positions.slice(i*3,i*3+3)),3));g.setIndex(indices.map(i=>remap.get(i)));g.computeVertexNormals();
  if(name==='head')g=smoothHead(g);
  const m=name==='head'||name==='hands'?skin:name==='top'?cloth:name==='trousers'?ink:eyes;
  m.name=(name==='head'||name==='hands')?'成年角色可见皮肤':'基础服装 · 始终保留';
  mesh(name==='head'?head:root,g,m);
 }
 const eyelids=[];
 for(const key of ['joint-l-eye','joint-r-eye']){
  const p=data.landmarks[key],s=p[0]>0?1:-1;
  const eye=new T.Group();eye.position.fromArray(p);head.add(eye);
  ball(eye,white,[0,0,0],[.035,.025,.035]);ball(eye,iris,[0,0,.031],[.014,.016,.007]);ball(eye,eyes,[0,0,.037],[.006,.010,.003]);ball(eye,white,[-.004,.005,.040],[.003,.004,.002]);eyelids.push(eye);
  line(head,[[p[0]-s*.031,p[1]+.036,p[2]+.021],[p[0],p[1]+.041,p[2]+.032],[p[0]+s*.029,p[1]+.034,p[2]+.024]],.004,hair);
  if(family==='human')ball(head,gold,[s*.126,2.555,.135],[.013,.025,.009]);
 }
 // Subtle lips follow the existing facial geometry rather than replacing the face.
 ball(head,lip,[0,2.505,.269],[.026,.004,.004]);ball(head,lip,[0,2.497,.268],[.023,.005,.004]);
 function feather(parent,m,p,scale,rotation){
  const shape=new T.Shape();shape.moveTo(0,0);shape.quadraticCurveTo(.13,.18,.05,.48);shape.quadraticCurveTo(.035,.65,0,.82);shape.quadraticCurveTo(-.10,.48,-.07,.15);shape.quadraticCurveTo(-.065,.035,0,0);
  return mesh(parent,new T.ExtrudeGeometry(shape,{depth:.012,bevelEnabled:true,bevelSegments:1,bevelSize:.006,bevelThickness:.006,steps:1,curveSegments:8}),m,p,scale,rotation);
 }
 for(const s of [-1,1]){
  ball(root,family==='angel'?white:eyes,[s*.40,.105,.13],[.115,.105,.225]);
  ball(root,family==='angel'?gold:ink,[s*.40,.036,.13],[.12,.032,.23]);
 }
 const wings=[];
 if(family==='angel'){
  const pairs=stage>=2?3:1;
  for(const s of [-1,1])for(let row=0;row<pairs;row++){
   const wing=new T.Group();wing.position.set(s*.20,2.12-row*.28,-.06-row*.025);root.add(wing);wings.push({group:wing,side:s,row});
   wing.rotation.z=-s*(row*.60);
   const length=stage===0?.70:1.05-row*.14;
   line(wing,[[0,0,0],[s*.35,.28,-.03],[s*.75,.38,-.03]],.035,stage===3?gold:white);
   for(let i=0;i<11;i++){
    const t=i/10;
    feather(wing,stage===3?(i%3===0?gold:white):white,[s*t*.65,t*.24,-.035],[s*length,length*(.72+t*.42),1],[0,s*.17,-s*(.17+t*1.05)]);
   }
   for(let i=0;i<7;i++)feather(wing,stage>=2?metal:white,[s*i*.075,.03+i*.036,.005],[s*.52,.42,1],[0,0,-s*(.12+i*.13)]);
  }
  mesh(head,new T.TorusGeometry(.18,.012,8,56),gold,[0,2.96,.055],[1,1,1],[Math.PI/2,0,0]);
  if(stage>=1){
   mesh(head,new T.SphereGeometry(1,24,14,0,Math.PI*2,0,1.65),white,[0,2.64,.12],[.15,.20,.145]);
   ball(head,gold,[0,2.611,.255],[.133,.045,.035]);
   for(const s of [-1,1]){
    line(head,[[s*.11,2.63,.24],[s*.15,2.77,.15],[s*.11,2.86,.07]],.012,gold);
    for(let i=0;i<3;i++)feather(head,white,[s*.12,2.70,.10],[s*.18,.25-i*.035,.6],[0,0,-s*(.28+i*.22)]);
   }
   rod(root,[.40,.55,.16],[.40,2.61,.16],.013,gold);
   mesh(root,new T.TorusGeometry(.095,.014,8,40),gold,[.40,2.68,.16]);ball(root,glow,[.40,2.68,.16],[.033,.048,.019]);
  }
  clothSurface(root,[[.13,2.28],[.30,2.12],[.26,1.83],[.23,1.67],[.29,1.40]],white,{z:.07,radiusZ:.85});
  for(const s of [-1,1]){
   ball(root,stage>=2?metal:gold,[s*.245,2.13,.04],[.125,.075,.13]);
   line(root,[[s*.19,2.20,.17],[s*.21,1.97,.23],[s*.09,1.75,.23]],.018,gold);
   for(let k=0;k<4;k++)ball(root,gold,[s*.19,1.83+k*.10,.23],[.011,.011,.012]);
  }
  clothSurface(root,[[.205,1.72],[.215,1.66]],gold,{z:.05});
  ball(root,glow,[0,1.95,.261],[.048,.067,.022]);
  // Layered tabard panels leave the permanently clothed base intact.
  for(const s of [-1,1])clothSurface(root,[[.265,1.42],[.33,.90],[.34,.82]],stage>=2?accent:white,{radiusZ:.66,x:s*.025,z:.04,segments:32});
 }else{
  const outfit=wardrobe.outfit&&wardrobe.outfit!=='stage'?['daily','sport','formal','elegant'].indexOf(wardrobe.outfit):stage;
  const style=outfit<0?stage:outfit;
  const hairStyle=wardrobe.hair&&wardrobe.hair!=='stage'?wardrobe.hair:['long','ponytail','long','bob'][stage];
  // The scalp cap has an open lower edge; shaped strands leave the face visible.
  mesh(head,new T.SphereGeometry(1,32,20,0,Math.PI*2,0,1.45),hair,[0,2.654,.104],[.151,.185,.167]);
  const long=hairStyle==='long', bob=hairStyle==='bob';
  for(let i=0;i<18;i++){
   const a=-Math.PI*.5+i/17*Math.PI,x=Math.sin(a)*.145,z=.10-Math.cos(a)*.175;
   const endY=long?2.13:bob?2.43:2.48;
   line(head,[[x*.8,2.78,z],[x,2.64,z-.015],[x*1.03,endY+.12,z-.015],[x*.91,endY,z+.025]],.022+(i%3)*.003,hair);
  }
  // Side locks have a smooth inward curve and fine highlights.
  for(const s of [-1,1]){
   line(head,[[s*.10,2.79,.17],[s*.142,2.65,.15],[s*.14,2.47,.12],[s*.12,long?2.27:2.43,.12]],.025,hair);
   line(head,[[s*.11,2.77,.18],[s*.153,2.65,.15],[s*.15,2.51,.12]],.003,accent);
  }
  if(hairStyle==='ponytail'){
   ball(head,gold,[0,2.69,-.064],[.035,.025,.028]);
   for(let i=0;i<9;i++)line(head,[[i*.008-.032,2.70,-.06],[i*.010-.04,2.55,-.19],[i*.009-.036,2.27,-.15],[i*.007-.028,2.20,-.09]],.018,hair);
  }
  // All clothing styles are opaque and can be replaced without touching identity.
  if(style===0||style===2||style===3){
   const bottom=style===0?1.04:style===2?.32:.72;
   clothSurface(root,[[.25,1.68],[.29,1.43],[style===2?.47:.35,bottom+.08],[style===2?.48:.36,bottom]],style===2?cloth:ink,{radiusZ:.72,z:.05,segments:64});
   for(let i=0;i<16;i++){
    const a=i/16*Math.PI*2;
    line(root,[[Math.sin(a)*.215,1.65,.05+Math.cos(a)*.155],[Math.sin(a)*.30,1.10,.05+Math.cos(a)*.22],[Math.sin(a)*(style===2?.465:.35),bottom+.02,.05+Math.cos(a)*(style===2?.335:.252)]],.004,style===2?gold:accent);
   }
  }
  clothSurface(root,[[.115,2.30],[.30,2.17],[.30,1.97],[.23,1.68]],cloth,{z:.06,radiusZ:.85});
  clothSurface(root,[[.25,1.70],[.252,1.64]],style===1?white:gold,{z:.06,radiusZ:.85});
  if(style===0||style===3){
   for(const s of [-1,1])line(root,[[0,2.25,.17],[s*.075,2.18,.32],[s*.03,2.07,.325]],.013,white);
   for(let i=0;i<5;i++)ball(root,style===3?gold:eyes,[0,1.79+i*.075,.068+Math.min(.30,.23+((1.79+i*.075)-1.68)*.07/.29)*.85],[.008,.008,.007]);
  }
  if(wardrobe.outerwear!==false){
   if(style===1){
    for(const s of [-1,1])ball(root,accent,[s*.25,2.13,.04],[.105,.08,.125]);
    line(root,[[0,2.27,.185],[0,1.75,.245]],.008,white);
   }else if(style===3){
    // Open tailored coat: curved panels frame the permanent blouse and skirt.
    for(const s of [-1,1]){
     const panel=new T.Shape();panel.moveTo(s*.08,2.24);panel.lineTo(s*.28,2.15);panel.lineTo(s*.31,.80);panel.lineTo(s*.12,.75);panel.lineTo(s*.16,1.74);panel.closePath();
     mesh(root,new T.ExtrudeGeometry(panel,{depth:.04,bevelEnabled:true,bevelSize:.012,bevelThickness:.01,bevelSegments:2,steps:1}),accent,[0,0,.28]);
     line(root,[[s*.10,2.23,.22],[s*.16,2.04,.25],[s*.13,1.83,.26]],.012,gold);
    }
    clothSurface(root,[[.13,2.32],[.145,2.24]],white,{z:.06});
   }else if(style===2){
    line(root,[[-.25,2.12,.04],[-.20,2.00,-.10],[0,1.92,-.12],[.20,2.00,-.10],[.25,2.12,.04]],.07,accent);
   }else{
    for(const s of [-1,1]){
     const panel=new T.Shape();panel.moveTo(s*.055,2.27);panel.lineTo(s*.26,2.18);panel.lineTo(s*.29,1.76);panel.lineTo(s*.10,1.72);panel.lineTo(s*.13,2.00);panel.closePath();
     mesh(root,new T.ExtrudeGeometry(panel,{depth:.032,bevelEnabled:true,bevelSize:.012,bevelThickness:.01,bevelSegments:2,steps:1}),accent,[0,0,.275]);
     line(root,[[s*.06,2.25,.32],[s*.12,2.12,.325],[s*.10,1.99,.325]],.008,white);
    }
   }
  }
  if(stage>=2){
   for(const s of [-1,1]){
    mesh(head,new T.TorusGeometry(.038,.003,8,28),gold,[s*.053,2.597,.248],[1,.8,1]);
   }
   rod(head,[-.015,2.601,.25],[.015,2.601,.25],.0025,gold);
  }
 }
 // Merge each joint by material and preserve texture coordinates for GLB export.
 const original=new Set();root.traverse(o=>{if(o.isMesh)original.add(o.geometry);});
 function batch(group){const bins=new Map();for(const o of [...group.children]){
  if(!o.isMesh){batch(o);continue;}
  o.updateMatrix();let g=o.geometry.clone().applyMatrix4(o.matrix);if(g.index){const old=g;g=g.toNonIndexed();old.dispose();}
  if(!g.getAttribute('uv'))g.setAttribute('uv',new T.Float32BufferAttribute(new Float32Array(g.attributes.position.count*2),2));
  const gs=bins.get(o.material)||[];gs.push(g);bins.set(o.material,gs);group.remove(o);
 }for(const [m,gs]of bins){const raw=mergeGeometries(gs,false),g=mergeVertices(raw);raw.dispose();gs.forEach(g=>g.dispose());mesh(group,g,m);}}
 batch(root);original.forEach(g=>g.dispose());
 root.rotation.y=-.16;
 root.updateMatrixWorld(true);const bounds=new T.Box3().setFromObject(root);if(bounds.max.y>3.05)root.scale.setScalar(3.05/bounds.max.y);
 return {root,animate(t,{asleep=false}={}){
  neck.rotation.y=asleep?-.08:Math.sin(t*.6)*.035;neck.rotation.x=asleep?.10:Math.sin(t*.8)*.012;
  for(const e of eyelids)e.scale.y=asleep?.08:Math.sin(t*1.1)>.997?.12:1;
  for(const w of wings)w.group.rotation.y=w.side*(Math.sin(t*.9+w.row)*.055);
 }};
}
