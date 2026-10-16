import * as T from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

export const EVOLUTION_STAGES = [
  { name: '绒角幼兽', phase: '幼年期', xp: 0, description: '柔软的绒角、晶亮的眼睛，一颗还没长大的勇敢的心。' },
  { name: '赤焰龙仔', phase: '成长期', xp: 30, description: '学会用双脚探索世界，认真守护和你的每一个约定。' },
  { name: '角冠暴龙', phase: '成熟期', xp: 100, description: '骨质角冠、深色虎纹、强壮的尾巴。温柔也可以很有力量。' },
  { name: '合金龙卫', phase: '完全体', xp: 240, description: '机械臂与分层金属护甲，胸口仍然保留最初的陪伴印记。' },
];
export function growthXP(journal = {}, care = {}) {
  return Math.max(0, journal.total || 0) + (care.focusSessions || 0) * 5 + (care.visits?.length || 0) * 3;
}
export function unlockedStage(xp) {
  return EVOLUTION_STAGES.reduce((stage, spec, i) => xp >= spec.xp ? i : stage, 0);
}

// Original sculpted procedural meshes. No ripped or unlicensed character assets.
// Geometry is merged by material inside each articulated joint to reduce draw calls.
export function createDinosaur(stage = 0, palette = 0) {
  const root = new T.Group();
  root.name = `MOMO-${EVOLUTION_STAGES[stage].name}`;
  const colors = [0xe8a14a, 0xd26c53, 0x749885];
  const material = (color, roughness = .58, metalness = 0) => new T.MeshStandardMaterial({color, roughness, metalness});
  const skin = material(stage === 0 ? [0xd6a5bf, 0xe4b2a5, 0xa7c3ab][palette] : colors[palette]);
  const belly = material(0xffdfaa, .76), bone = material(0xd8c7a0, .64), horn = material(0x64544b);
  const stripe = material(0x4d6262), dark = material(0x242e35, .38), white = material(0xfff9dd, .32);
  const iris = material(0x69d3c5, .23), metal = material(0x8397a5, .3, .72), edge = material(0xd0dce0, .27, .66);
  const orange = material(0xd47737), glow = material(0x6ddcc8, .24, .3);
  glow.emissive.set(0x3ea18c); glow.emissiveIntensity = .35;
  const pixels=new Uint8Array(128*128*4);
  for(let y=0;y<128;y++)for(let x=0;x<128;x++) {
    const row=Math.floor(y/8), dx=((x+(row%2)*4)%8-4)/4, dy=(y%8-2)/5;
    const rim=Math.exp(-Math.abs(Math.hypot(dx,dy)-1)*14);
    const value=Math.round(220-rim*45+Math.sin(x*13+y*7)*3), k=(y*128+x)*4;
    pixels.set([value,value,value,255],k);
  }
  const scales=new T.DataTexture(pixels,128,128,T.RGBAFormat);
  scales.wrapS=scales.wrapT=T.RepeatWrapping;scales.magFilter=T.LinearFilter;scales.needsUpdate=true;
  skin.bumpMap=scales;skin.bumpScale=.013;skin.roughnessMap=scales;
  const sphere = new T.SphereGeometry(1, 20, 14);
  const unit = new T.Vector3(0, 1, 0);
  function mesh(parent, geometry, mat, p = [0,0,0], scale = [1,1,1], rot = [0,0,0]) {
    const o = new T.Mesh(geometry, mat);o.position.fromArray(p);o.scale.fromArray(scale);o.rotation.set(...rot);o.castShadow = true;parent.add(o);return o;
  }
  const ellipsoid = (p,m,xyz,scale,rot) => mesh(p,sphere,m,xyz,scale,rot);
  function tapered(parent, points, radii, mat, sides = 12) {
    const curve = new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p)));
    const count = Math.max(12, points.length * 7), frames = curve.computeFrenetFrames(count, false), positions=[], indices=[];
    for(let i=0;i<=count;i++) {
      const t=i/count, pos=curve.getPointAt(t), q=t*(radii.length-1), a=Math.min(radii.length-2,Math.floor(q)), r=T.MathUtils.lerp(radii[a],radii[a+1],q-a);
      for(let j=0;j<=sides;j++) {
        const theta=j/sides*Math.PI*2;
        const v=pos.clone().addScaledVector(frames.normals[i],Math.cos(theta)*r).addScaledVector(frames.binormals[i],Math.sin(theta)*r);
        positions.push(v.x,v.y,v.z);
        if(i<count&&j<sides){const k=i*(sides+1)+j;indices.push(k,k+1,k+sides+1,k+1,k+sides+2,k+sides+1);}
      }
    }
    // Closed caps allow GLB export and avoid visibly open horns/tails.
    for(const end of [0,count]) {const start=positions.length/3;const pos=curve.getPointAt(end/count);positions.push(pos.x,pos.y,pos.z);for(let j=0;j<sides;j++){const a=end*(sides+1)+j;indices.push(...(end?[start,a,a+1]:[start,a+1,a]));}}
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();
    return mesh(parent,g,mat);
  }
  function link(parent,a,b,r1,r2,mat) {
    const v=new T.Vector3(...b).sub(new T.Vector3(...a)), o=mesh(parent,new T.CylinderGeometry(r2,r1,v.length(),12),mat,new T.Vector3(...a).addScaledVector(v,.5).toArray());
    o.quaternion.setFromUnitVectors(unit,v.normalize());return o;
  }
  function plate(parent,mat,p,scale,rot=[0,0,0]) {
    return mesh(parent,new T.BoxGeometry(1,1,1,1,1,1),mat,p,scale,rot);
  }
  function bodyStripe(parent, side, y) {
    const positions=[], indices=[], steps=22;
    for(let i=0;i<=steps;i++) {
      const t=i/steps, angle=.45+t*2.1, width=Math.sin(Math.PI*t)*.065;
      for(const offset of [-1,1]) {
        const py=y+t*.09+offset*width, ring=Math.sqrt(Math.max(.01,1-((py-1.02)/.78)**2));
        positions.push(side*(.68*ring+.004)*Math.sin(angle),py,-.05+(.50*ring+.004)*Math.cos(angle));
      }
      if(i<steps){const k=i*2;indices.push(k,k+1,k+2,k+1,k+3,k+2);}
    }
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();
    const o=mesh(parent,g,stripe);o.material.side=T.DoubleSide;o.rotation.x=-.09;
  }
  const torso=new T.Group();root.add(torso);
  const head=new T.Group();torso.add(head);
  const tail=new T.Group();torso.add(tail);
  const limbs=[];
  const eyeLids=[];
  if(stage===0) {
    ellipsoid(torso,skin,[0,.92,0],[.7,.77,.56]);
    ellipsoid(torso,belly,[0,.65,.44],[.44,.35,.14]);
    head.position.y=1.22;
    for(const s of [-1,1]) {
      tapered(head,[[s*.38,.19,0],[s*.48,.59,-.03],[s*.31,.94,-.02]],[.19,.11,.001],skin);
      tapered(head,[[s*.39,.31,.14],[s*.44,.58,.08],[s*.33,.82,.02]],[.072,.055,.001],belly);
      ellipsoid(torso,skin,[s*.43,.2,.2],[.3,.2,.36]);
      ellipsoid(head,orange,[s*.4,-.2,.48],[.12,.05,.035]);
    }
    tapered(tail,[[0,.6,-.35],[.25,.69,-.73],[.32,.92,-.84]],[.22,.12,.001],skin);
  } else {
    const mature=stage>=2;
    ellipsoid(torso,skin,[0,1.02,-.05],mature?[.68,.78,.5]:[.49,.61,.39],[-.09,0,0]);
    ellipsoid(torso,belly,[0,.98,.36],mature?[.46,.57,.16]:[.34,.44,.14]);
    // Overlapping ventral scutes follow the curvature of the abdomen.
    for(let i=0;i<5;i++)ellipsoid(torso,belly,[0,.69+i*.13,.535-(i-2)**2*.018],[.32+Math.sin(i/4*Math.PI)*.09,.045,.025]);
    head.position.set(0,mature?1.88:1.68,.09);
    ellipsoid(head,skin,[0,.05,0],mature?[.61,.53,.55]:[.52,.5,.49]);
    ellipsoid(head,skin,[0,-.10,.45],mature?[.57,.30,.53]:[.46,.27,.43]);
    ellipsoid(head,dark,[0,-.25,.59],mature?[.49,.085,.4]:[.38,.052,.28]);
    ellipsoid(head,skin,[0,-.32,.5],mature?[.49,.17,.40]:[.39,.13,.31]);
    ellipsoid(head,belly,[0,-.36,.61],mature?[.39,.095,.29]:[.31,.07,.22]);
    for(const s of [-1,1]) {
      ellipsoid(head,dark,[s*.24,.015,mature?.895:.79],[.038,.025,.015],[0,0,s*.22]);
      // Individual rounded teeth, cheek creases and brow ridges.
      for(let i=0;i<(mature?5:3);i++) tapered(head,[[s*(.11+i*.075),-.21,.83-i*.038],[s*(.11+i*.075),-.30,.82-i*.038]],[.028,.001],white,8);
      tapered(head,[[s*.27,.02,.56],[s*.45,-.04,.45],[s*.5,-.13,.31]],[.02,.017,.001],orange,8);
      ellipsoid(head,skin,[s*.39,.25,.39],[.18,.105,.17],[0,0,-s*.23]);
      const leg=new T.Group();leg.position.set(s*(mature?.46:.32),.66,.03);torso.add(leg);limbs.push(leg);
      ellipsoid(leg,skin,[0,0,0],[mature?.29:.22,.39,.31],[0,0,s*.16]);
      ellipsoid(leg,skin,[s*.05,-.37,.21],[mature?.32:.25,.19,.42]);
      for(let k=0;k<3;k++)tapered(leg,[[s*.05+(k-1)*.15,-.38,.44],[s*.05+(k-1)*.16,-.40,.68]],[.065,.001],white);
      const arm=new T.Group();arm.position.set(s*(mature?.65:.47),1.27,.08);torso.add(arm);limbs.push(arm);
      ellipsoid(arm,skin,[s*.075,-.15,.07],[.18,.28,.18],[0,0,s*.38]);
      ellipsoid(arm,skin,[s*.13,-.38,.18],[.21,.18,.20]);
      for(let k=0;k<3;k++)tapered(arm,[[s*.13+(k-1)*.095,-.41,.28],[s*.13+(k-1)*.12,-.55,.39]],[.042,.001],white,8);
      if(mature) {
        // Sculpted skull helmet: forehead, cheek guards and a projecting nasal horn.
        ellipsoid(head,bone,[0,.32,-.005],[.62,.35,.52]);
        ellipsoid(head,bone,[s*.48,.04,.20],[.16,.32,.37],[0,0,s*.18]);
        tapered(head,[[s*.43,.48,-.16],[s*.65,.75,-.25],[s*.74,1.06,-.32]],[.17,.11,.001],horn);
        ellipsoid(head,horn,[s*.44,.50,-.14],[.19,.07,.18]);
        for(let i=0;i<3;i++)ellipsoid(head,horn,[s*(.13+i*.105),.55-i*.027,.30+i*.024],[.033,.014,.075],[0,0,-s*.25]);
        // Dark tiger marks are shaped meshes, not coplanar decals.
        for(let i=0;i<4;i++)bodyStripe(torso,s,.66+i*.22);
        for(let i=0;i<2;i++)ellipsoid(leg,stripe,[s*.19,.05-i*.15,.12],[.09,.047,.21],[0,0,s*.16]);
      }
    }
    if(mature) {
      tapered(head,[[0,.28,.42],[0,.53,.63],[0,.77,.69]],[.14,.085,.001],bone);
      for(let i=0;i<4;i++)tapered(torso,[[0,1.60-i*.19,-.43],[0,1.73-i*.19,-.65-i*.015]],[.11,.001],bone);
    }
    tail.position.set(0,.79,-.37);
    tapered(tail,[[0,0,0],[.35,-.10,-.43],[.75,-.07,-.85],[1.10,.15,-1.10],[1.21,.42,-1.15]],[mature?.3:.23,.23,.16,.085,.001],skin,16);
    if(mature) {
      const curve=new T.CatmullRomCurve3([[0,0,0],[.35,-.10,-.43],[.75,-.07,-.85],[1.10,.15,-1.10],[1.21,.42,-1.15]].map(p=>new T.Vector3(...p)));
      const radii=[.3,.23,.16,.085,.001];
      for(const center of [.30,.48,.66,.82]) {
        const ts=[center-.026,center,center+.026];
        tapered(tail,ts.map(t=>curve.getPointAt(t).toArray()),ts.map(t=>{const q=t*4,a=Math.min(3,Math.floor(q));return T.MathUtils.lerp(radii[a],radii[a+1],q-a)+.004;}),stripe,16);
      }
    }
    if(stage===3) {
      // Layered shoulder and breast armour, rivets, a robotic forearm and dorsal fins.
      ellipsoid(torso,metal,[0,1.25,.45],[.55,.35,.14]);
      ellipsoid(torso,edge,[0,1.45,.47],[.41,.08,.09]);
      mesh(torso,new T.OctahedronGeometry(.105),glow,[0,1.25,.60]);
      for(const s of [-1,1]) {
        ellipsoid(torso,metal,[s*.62,1.48,.06],[.34,.19,.35],[0,0,-s*.3]);
        for(let j=0;j<3;j++)ellipsoid(torso,edge,[s*(.58+j*.05),1.58-j*.065,.22],[.16,.035,.13],[0,0,-s*.3]);
        for(const y of [1.12,1.38])ellipsoid(torso,edge,[s*.36,y,.56],[.028,.028,.017]);
        for(let j=0;j<3;j++)plate(torso,metal,[s*(.36+j*.21),1.58+j*.09,-.44-j*.16],[.15,.62-j*.10,.09],[.3,0,-s*(.3+j*.19)]);
      }
      const arm=limbs[3];
      ellipsoid(arm,metal,[.12,-.24,.13],[.24,.30,.24]);
      for(let i=0;i<3;i++)plate(arm,edge,[.12,-.1-i*.11,.36],[.34,.047,.045],[0,0,.04]);
      ellipsoid(arm,glow,[.12,-.28,.38],[.065,.08,.018]);
      for(let k=0;k<3;k++)tapered(arm,[[.12+(k-1)*.12,-.4,.25],[.12+(k-1)*.15,-.68,.48]],[.055,.001],edge);
    }
  }
  // Eye whites, elliptical pupils and separate catchlights maintain expression at desktop size.
  for(const s of [-1,1]) {
    const y=stage===0?-.02:.12, x=stage===0?.25:.40, z=stage===0?.47:.45;
    const eye=new T.Group();eye.position.set(s*x,y,z);eye.rotation.y=s*.36;head.add(eye);
    ellipsoid(eye,dark,[0,0,-.018],[.145,.172,.072]);
    ellipsoid(eye,white,[0,0,.012],[.122,.142,.062]);
    ellipsoid(eye,iris,[s*.014,-.006,.067],[.075,.10,.027]);
    ellipsoid(eye,dark,[s*.015,-.008,.088],[.031,.082,.014]);
    ellipsoid(eye,white,[-.027,.043,.10],[.026,.030,.012]);
    ellipsoid(eye,white,[.035,-.046,.095],[.010,.013,.008]);
    eyeLids.push(eye);
  }
  if(stage===0) {
    tapered(head,[[-.09,-.23,.56],[0,-.27,.58],[.09,-.23,.56]],[.013,.013,.013],dark,8);
    ellipsoid(head,belly,[0,.25,.49],[.17,.13,.025]);
  }
  // Merge static geometry per material per joint. Each joint keeps its own transform.
  const sourceGeometries=new Set();
  root.traverse(o=>{if(o.isMesh)sourceGeometries.add(o.geometry);});
  function batch(group) {
    const buckets=new Map();
    for(const child of [...group.children]) {
      if(child.isMesh) {
        child.updateMatrix();let g=child.geometry.clone().applyMatrix4(child.matrix);
        if(g.index){const old=g;g=g.toNonIndexed();old.dispose();}
        // Supply UVs on custom tubes; standard sculpted surfaces retain their scale texture coordinates.
        if(!g.getAttribute('uv'))g.setAttribute('uv',new T.Float32BufferAttribute(new Float32Array(g.getAttribute('position').count*2),2));
        const list=buckets.get(child.material)||[];list.push(g);buckets.set(child.material,list);group.remove(child);
      } else batch(child);
    }
    for(const [mat,gs]of buckets) {const source=mergeGeometries(gs,false);const merged=mergeVertices(source);source.dispose();gs.forEach(g=>g.dispose());const o=new T.Mesh(merged,mat);o.castShadow=true;group.add(o);}
  }
  batch(root);sourceGeometries.forEach(g=>g.dispose());
  root.rotation.y=-.48;
  root.userData.evolutionStage=stage;
  return {
    root,
    animate(t, {asleep=false, jump=0}={}) {
      head.rotation.y=asleep?-.13:Math.sin(t*.67)*.085;
      head.rotation.x=asleep?.17:Math.sin(t*.9)*.025;
      tail.rotation.y=Math.sin(t*1.4)*.16;
      torso.scale.y=1+Math.sin(t*1.7)*.008;
      const blink=asleep?.10:Math.sin(t*1.13)>.997?.13:1;
      for(const e of eyeLids)e.scale.y=blink;
      for(let i=0;i<limbs.length;i++)limbs[i].rotation.z=(i%2?Math.sin(t*1.4)*.025:0)+(jump>0?Math.sin(jump)*.2*(i<2?-1:1):0);
    },
  };
}
