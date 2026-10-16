import { EVOLUTION_STAGES, growthXP, unlockedStage } from './dinosaur.js';
import { readRecord } from './companion-data.js';
import './evolution.css';
import {AVATAR_FAMILIES,portraitPath} from './avatar-specs.js';
export function initEvolution({onChange, toast, openHome, getFamily=()=>"dragon",onFamilyChange=()=>{},getWardrobe=()=>({}),onWardrobeChange=()=>{}}) {
  let preview = null;
  const specs = () => AVATAR_FAMILIES[getFamily()].stages;
  const state = () => readRecord('momo-evolution', {stage:0, highest:0});
  function progress() {
    const xp=growthXP(readRecord('momo-journal',{}), readRecord('momo-care',{}));
    return {xp, unlocked:Math.max(state().highest,unlockedStage(xp))};
  }
  const panel=document.createElement('article');panel.className='evolution-panel';
  panel.innerHTML=`<div class="evolution-heading"><div><span class="eyebrow">EVOLVE WITH YOU</span><h2>从小小勇气，到可靠守护。</h2></div><span class="evolution-chip">4 段进化 · 记忆不变</span></div><p>沿着幼兽、幼龙、角冠暴龙、合金龙卫的路线成长。每一次互动 +1，完成专注 +5，每日签到 +3。无需付费，不会因离线退化。</p><div class="family-selector" role="group" aria-label="选择角色路线">${Object.entries(AVATAR_FAMILIES).map(([id,family])=>`<button data-family="${id}" aria-pressed="${id===getFamily()}">${family.name}</button>`).join('')}</div><p id="family-description" class="muted"></p><ol class="evolution-path">${EVOLUTION_STAGES.map((s,i)=>`<li><button class="evolution-form" data-evolution="${i}"><span class="evolution-number">0${i+1}</span><img class="evolution-portrait" src="/evolution/stage-${i}.png" alt="${s.name}的 3D 形态" loading="lazy"><small>${s.phase}</small><strong>${s.name}</strong><span class="evolution-requirement">${s.xp? s.xp+' 陪伴经验':'初始形态'}</span><span class="evolution-state"></span></button></li>`).join('')}</ol><div class="evolution-detail"><div><h3 id="evolution-title"></h3><p id="evolution-description"></p><p id="evolution-progress" role="status"></p><div class="evolution-meter"><i></i></div></div><div class="evolution-actions"><button class="primary" id="evolve-now">开始进化</button><button class="secondary" id="evolution-return" hidden>结束形态预览</button></div></div><div id="wardrobe-panel" hidden><h3>成年角色换装</h3><p class="muted">全部为成年形象。服饰和发型独立更换，基础内搭始终保留；非真人扫描或一比一复刻。</p><div class="wardrobe-controls"><label>服装<select id="wardrobe-outfit"><option value="stage">随当前阶段</option><option value="daily">日常衬衣与半裙</option><option value="sport">运动外套</option><option value="formal">高领礼服</option><option value="elegant">典雅长外套</option></select></label><label>发型<select id="wardrobe-hair"><option value="stage">随当前阶段</option><option value="long">长发</option><option value="bob">短发</option><option value="ponytail">马尾</option></select></label><label class="wardrobe-toggle"><input id="wardrobe-outerwear" type="checkbox" checked>展示外搭</label></div></div><p class="muted">每个阶段解锁后可随时选回；四阶段解锁后可自由选择全部四种形象。所有路线共用陪伴经验，预览不消耗经验或更改进度。</p>`;
  document.querySelector('#models .section-title').after(panel);
  const home=document.createElement('button');home.className='evolution-home';home.id='open-evolution';home.innerHTML='<span>✦ 进化实验室</span><strong id="home-evolution-name"></strong><small id="home-evolution-hint"></small><b>↗</b>';
  document.querySelector('.right-col').prepend(home);
  home.onclick=()=>{document.querySelector('[data-page="1"]').click();panel.scrollIntoView({block:'start',behavior:'smooth'});};
  function refresh() {
    const saved=state(), {xp,unlocked}=progress(), index=preview??saved.stage, forms=specs(), spec=forms[index], next=forms[saved.stage+1];
    const family=getFamily();
    panel.querySelectorAll('[data-family]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.family===family)));
    panel.querySelector('#family-description').textContent=AVATAR_FAMILIES[family].description;
    panel.querySelector('#wardrobe-panel').hidden=family!=='human';
    const outfit=getWardrobe();
    panel.querySelector('#wardrobe-outfit').value=outfit.outfit||'stage';panel.querySelector('#wardrobe-hair').value=outfit.hair||'stage';panel.querySelector('#wardrobe-outerwear').checked=outfit.outerwear!==false;
    panel.querySelectorAll('[data-evolution]').forEach((b,i)=>{
      b.setAttribute('aria-pressed',String(i===index));b.dataset.unlocked=String(i<=unlocked);
      const image=b.querySelector('img');image.src=portraitPath(family,i);image.alt=forms[i].name+'的 3D 形态';
      b.querySelector('strong').textContent=forms[i].name;b.querySelector('small').textContent=forms[i].phase;
      b.querySelector('.evolution-state').textContent=i===preview?'正在预览':i===saved.stage?'当前形态':i<=unlocked?'可切换':'点击预览';
    });
    panel.querySelector('#evolution-title').textContent=spec.name+(preview!==null?' · 形态预览':' · '+spec.phase);
    panel.querySelector('#evolution-description').textContent=spec.description;
    panel.querySelector('#evolution-progress').textContent=next?`陪伴经验 ${xp} / ${next.xp} · ${saved.stage+1<=unlocked?'已解锁，可进化或随时选回':`还需 ${next.xp-xp} 经验`}`:`陪伴经验 ${xp} · 已抵达完全体，陪伴仍在继续`;
    panel.querySelector('.evolution-meter i').style.width=Math.min(100,next?xp/next.xp*100:100)+'%';
    const btn=panel.querySelector('#evolve-now');btn.disabled=!next||saved.stage+1>unlocked;btn.textContent=next?'进化为 '+next.name:'完全体已达成';
    panel.querySelector('#evolution-return').hidden=preview===null;
    document.querySelector('#home-evolution-name').textContent=spec.name;
    document.querySelector('#home-evolution-hint').textContent=preview!==null?'形态预览中':`${spec.phase} · ${xp} 陪伴经验`;
    document.querySelector('.stage').dataset.preview=String(preview!==null);
  }
  function choose(index) {
    const {unlocked}=progress(), previous=state();
    if(index<=unlocked) {
      try{localStorage.setItem('momo-evolution',JSON.stringify({stage:index,highest:unlocked}));}catch{toast('进化进度保存失败，原有形态已保留');return;}
      preview=null;onChange(index);toast(index>previous.stage?'进化完成！我还是记得和你的每一件小事。':'已切换形态，记忆和成长仍保留');
    }else{preview=index;onChange(index);toast('正在预览 '+specs()[index].name+'，进度未改变');}
    refresh();openHome();
  }
  panel.querySelectorAll('[data-family]').forEach(b=>b.onclick=()=>{preview=null;onFamilyChange(b.dataset.family);refresh();});
  for(const id of ['wardrobe-outfit','wardrobe-hair','wardrobe-outerwear'])panel.querySelector('#'+id).onchange=()=>{
    const next={outfit:panel.querySelector('#wardrobe-outfit').value,hair:panel.querySelector('#wardrobe-hair').value,outerwear:panel.querySelector('#wardrobe-outerwear').checked};
    try{localStorage.setItem('momo-wardrobe',JSON.stringify(next));onWardrobeChange(next);}
    catch{toast('换装偏好保存失败');}
  };
  window.addEventListener('momo-family',refresh);
  panel.querySelectorAll('[data-evolution]').forEach(b=>b.onclick=()=>choose(Number(b.dataset.evolution)));
  panel.querySelector('#evolve-now').onclick=()=>{const next=state().stage+1;if(next<=progress().unlocked&&next<4)choose(next);};
  panel.querySelector('#evolution-return').onclick=()=>{preview=null;onChange(state().stage);refresh();openHome();};
  const exit=document.createElement('button');exit.className='preview-exit';exit.textContent='结束预览';exit.onclick=()=>panel.querySelector('#evolution-return').click();document.querySelector('.stage').append(exit);
  window.addEventListener('momo-growth',refresh);
  window.addEventListener('storage',e=>{
    if(['momo-evolution','momo-journal','momo-care'].includes(e.key)){
      if(e.key==='momo-evolution'){preview=null;onChange(state().stage);}
      refresh();
    }
  });
  refresh();
}
