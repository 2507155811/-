import { EVOLUTION_STAGES } from './dinosaur.js';
export const AVATAR_FAMILIES={
 dragon:{name:'龙系伙伴',description:'从幼兽到合金龙卫的四阶段进化',stages:EVOLUTION_STAGES},
 angel:{name:'天使系伙伴',description:'原创羽翼、面甲与圣光装甲；非官方角色模型',stages:[
  {name:'光羽使者',phase:'第一形态',xp:0,description:'羽翼初展，带着安静而明亮的陪伴。'},
  {name:'圣翼天使',phase:'第二形态',xp:30,description:'金色面甲、分层羽翼与守护权杖。'},
  {name:'六翼圣卫',phase:'第三形态',xp:100,description:'六片独立羽翼、光环和镶边护甲。'},
  {name:'炽光天使',phase:'第四形态',xp:240,description:'金白装甲与宝石核心，守护与你共同成长。'},
 ]},
 human:{name:'成年女性伙伴',description:'全部形态均为成年人；CC0 人体基础网格，原创服饰与发型，非真人扫描',stages:[
  {name:'晴日 · 年轻成年',phase:'成年形象',xp:0,description:'成年角色的日常造型：衬衣、半裙与长发。'},
  {name:'晨风 · 干练',phase:'成年形象',xp:30,description:'运动外套与利落马尾，陪你保持自己的节奏。'},
  {name:'月华 · 成熟',phase:'成年形象',xp:100,description:'高领礼服与细致配饰，沉静而从容。'},
  {name:'星澜 · 典雅',phase:'成年形象',xp:240,description:'长外套、围巾与金属配饰，优雅的成年造型。'},
 ]},
};
export const portraitPath=(family,stage)=>family==='dragon'?`/evolution/stage-${stage}.png`:`/evolution/${family}-${stage}.png`;
