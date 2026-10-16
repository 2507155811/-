import { EVOLUTION_STAGES, growthXP, unlockedStage } from './dinosaur.js';
import { readRecord } from './companion-data.js';
import './evolution.css';
export function initEvolution({onChange, toast, openHome}) {
  let preview = null;
  const state = () => readRecord('momo-evolution', {stage:0, highest:0});
  function progress() {
    const xp=growthXP(readRecord('momo-journal',{}), readRecord('momo-care',{}));
    return {xp, unlocked:Math.max(state().highest,unlockedStage(xp))};
  }
  const panel=document.createElement('article');panel.className='evolution-panel';
  panel.innerHTML=`<div class="evolution-heading"><div><span class="eyebrow">EVOLVE WITH YOU</span><h2>从小小勇气，到可靠守护。</h2></div><span class="evolution-chip">4 段进化 · 记忆不变</span></div><p>沿着幼兽、幼龙、角冠暴龙、合金龙卫的路线成长。每一次互动 +1，完成专注 +5，每日签到 +3。无需付费，不会因离线退化。</p><ol class="evolution-path">${EVOLUTION_STAGES.map((s,i)=>`<li><button class="evolution-form" data-evolution="${i}"><span class="evolution-number">0${i+1}</span><img class="evolution-portrait" src="/evolution/stage-${i}.png" alt="${s.name}的 3D 形态" loading="lazy"><small>${s.phase}</small><strong>${s.name}</strong><span class="evolution-requirement">${s.xp? s.xp+' 陪伴经验':'初始形态'}</span><span class="evolution-state"></span></button></li>`).join('')}</ol><div class="evolution-detail"><div><h3 id="evolution-title"></h3><p id="evolution-description"></p><p id="evolution-progress" role="status"></p><div class="evolution-meter"><i></i></div></div><div class="evolution-actions"><button class="primary" id="evolve-now">开始进化</button><button class="secondary" id="evolution-return" hidden>结束形态预览</button></div></div><p class="muted">原创程序化龙系造型，以经典龙系伙伴的成长轮廓为参考；非官方角色模型。预览不消耗经验、不更改实际进度。</p>`;
  document.querySelector('#models .section-title').after(panel);
  const home=document.createElement('button');home.className='evolution-home';home.id='open-evolution';home.innerHTML='<span>✦ 进化实验室</span><strong id="home-evolution-name"></strong><small id="home-evolution-hint"></small><b>↗</b>';
  document.querySelector('.right-col').prepend(home);
  home.onclick=()=>{document.querySelector('[data-page="1"]').click();panel.scrollIntoView({block:'start',behavior:'smooth'});};
  function refresh() {
    const saved=state(), {xp,unlocked}=progress(), index=preview??saved.stage, spec=EVOLUTION_STAGES[index], next=EVOLUTION_STAGES[saved.stage+1];
    panel.querySelectorAll('[data-evolution]').forEach((b,i)=>{
      b.setAttribute('aria-pressed',String(i===index));b.dataset.unlocked=String(i<=unlocked);
      b.querySelector('.evolution-state').textContent=i===preview?'正在预览':i===saved.stage?'当前形态':i<=unlocked?'可切换':'点击预览';
    });
    panel.querySelector('#evolution-title').textContent=spec.name+(preview!==null?' · 形态预览':' · '+spec.phase);
    panel.querySelector('#evolution-description').textContent=spec.description;
    panel.querySelector('#evolution-progress').textContent=next?`陪伴经验 ${xp} / ${next.xp} · ${xp>=next.xp?'已经可以进化':`还需 ${next.xp-xp} 经验`}`:`陪伴经验 ${xp} · 已抵达完全体，陪伴仍在继续`;
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
    }else{preview=index;onChange(index);toast('正在预览 '+EVOLUTION_STAGES[index].name+'，进度未改变');}
    refresh();openHome();
  }
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
