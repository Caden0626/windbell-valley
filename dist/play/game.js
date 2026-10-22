import {freshState,act,CROPS,weather,mature,watered,irrigated,yieldFor,progress,goal,routeOpen,validChannels,restPreview,dailyOrder} from './engine.mjs';
import {SCENES,prepareArt,loadImage,paintSprite,mountSprites,spriteHTML} from './art.mjs';
import {loadSaved,saveGame,backupStates,downloadSave,readSaveFile} from './storage.mjs';
import {startChallenge,stopChallenge,challengeActive} from './minigames.mjs';

const $=s=>document.querySelector(s);
const icon=name=>`<svg aria-hidden="true"><use href="#i-${name}"/></svg>`;
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const button=(label,action,kind='primary-button',attrs='')=>`<button class="${kind}" data-action="${action}" ${attrs}>${label}</button>`;
let state=freshState(),saved=null,started=false,tool='explore',busy=false,selectedPlot=null;
let pos={x:81,y:87},dogPos={x:87,y:91},target=null,face=0,lastFrame=0,keys=new Set(),pendingInteraction=null;
let channels=[0,0,0,0],flowDraft='split',rowDraft=0;
let plane={w:innerWidth,h:innerHeight,left:0,top:0},panX=0,drag=null,scentTimer=0,saveSequence=0,captionTimer=0,toastTimer=0;
let audio=null,master=null,ambient=null,ambientTimer=null,importCandidate=null;
const reduced=matchMedia('(prefers-reduced-motion:reduce)');
const PLOTS=[[25,72],[45,64],[65,73],[47,88]];
const menu=$('#panel');

function showPanel(title,content,{eyebrow='风铃谷的日常',wide=false}={}){
  keys.clear();pendingInteraction=null;
  $('#panel-title').textContent=title;$('#panel-content').innerHTML=content;$('#panel-eyebrow').textContent=eyebrow;
  menu.classList.toggle('wide',wide);if(!menu.open)menu.showModal();mountSprites(menu);
}
function closePanel(){if(menu.open)menu.close();}
function toast(message,error=false){
  const area=$('#toast-area');area.replaceChildren();const n=document.createElement('div');n.className='toast'+(error?' error':'');n.textContent=message;area.append(n);clearTimeout(toastTimer);toastTimer=setTimeout(()=>n.remove(),5500);
}
async function persist(){state.x=pos.x;state.y=pos.y;state.updatedAt=Date.now();const id=++saveSequence;$('#save-state').textContent='正在保存…';const result=await saveGame(state);if(id===saveSequence){$('#save-state').textContent=result.ok?'已保存':'请导出存档';if(result.message)toast(result.message,!result.ok);}}
function sound(note=440,duration=.15){if(!state.settings.sound)return;try{initAudio();const o=audio.createOscillator(),g=audio.createGain();o.type='sine';o.frequency.value=note;g.gain.setValueAtTime(.0001,audio.currentTime);g.gain.exponentialRampToValueAtTime(.045,audio.currentTime+.015);g.gain.exponentialRampToValueAtTime(.0001,audio.currentTime+duration);o.connect(g);g.connect(master);o.start();o.stop(audio.currentTime+duration+.02);}catch(_){}}
function initAudio(){if(audio){audio.resume();return;}const A=window.AudioContext||window.webkitAudioContext;if(!A)return;audio=new A();master=audio.createGain();master.gain.value=.65;master.connect(audio.destination);ambientTimer=setInterval(()=>{if(started&&!document.hidden&&!challengeActive()&&state.settings.sound){const notes=[261.63,329.63,392,493.88,523.25];sound(notes[(state.day+Math.floor(performance.now()/4200))%notes.length],1.6);}},4200);}
function applySettings(){document.body.classList.toggle('no-motion',reduced.matches||!state.settings.motion);$('#world-hints').hidden=!state.settings.hints;const v=$('#title-video');if(reduced.matches||!state.settings.motion||started){v.pause();v.classList.remove('playing');}else{if(!v.src)v.src=v.dataset.src;v.play().catch(()=>{});}$('#title-sound').textContent=state.settings.sound?'声音开启':'声音关闭';}
$('#title-video').addEventListener('playing',()=>$('#title-video').classList.add('playing'));
reduced.addEventListener('change',applySettings);

function perform(type,payload={},quiet=false){
  const result=act(state,type,payload);if(!result.ok){toast(result.message,true);sound(190,.12);return result;}
  state=result.state;renderHUD();renderWorldState();persist();if(!quiet)toast(result.message);sound(type==='harvest'?659.25:type==='connect'?523.25:392,.2);
  if(type==='finish')showComplete();return result;
}

function renderHUD(){
  $('#day-label').textContent=`第 ${state.day} 天`;
  $('#time-label').textContent=['清晨','上午','午前','午后','傍晚','黄昏','晚风'][6-state.ap];
  $('#action-dots').innerHTML=Array.from({length:6},(_,i)=>`<i class="${i>=state.ap?'used':''}"></i>`).join('');$('#action-dots').setAttribute('aria-label',`剩余 ${state.ap} 个行动时段`);
  $('#weather-icon').innerHTML=icon(weather(state.day)==='rain'?'water':'sun');
  const g=goal(state);$('#quest-title').textContent=g.title;$('#quest-text').textContent=g.text;$('#quest-fraction').textContent=`${progress(state)} / 6`;$('#quest-progress').style.width=`${progress(state)/6*100}%`;
  $('#world-grade').classList.toggle('rain',weather(state.day)==='rain');
  $('#controls-hint').innerHTML=innerHeight>innerWidth?'轻扫查看场景 <span>·</span> 点击地面行走 <span>·</span> 点击标记互动':'点击地面行走 <span>·</span> 点击标记互动 <span>·</span> E 互动 / 空格呼唤豆丁';
}

function spots(){
  const exit=(id,x,y,destination,label)=>({id,x,y,icon:'arrow',label,kind:'exit',destination});
  switch(state.scene){
    case 'garden':return [
      ...PLOTS.map(([x,y],i)=>({id:`plot-${i}`,x,y:y-3,icon:state.plots[i]?(mature(state.plots[i])?'leaf':'water'):'sprout',label:state.plots[i]?(mature(state.plots[i])?'可以收获':CROPS[state.plots[i].crop].name):'种点什么',plot:i,primary:!state.stats.actions&&i===0,approach:[77,84]})),
      {id:'mail',x:12,y:34,icon:'book',label:'米拉的信箱',approach:[77,70]},
      {id:'seedbox',x:89,y:79,icon:'bag',label:'种子盒',approach:[85,86]},
      {id:'gather',x:91,y:55,icon:'leaf',label:state.gatherDay===state.day?'明日再来':'收集枯枝',approach:[83,73]},
      exit('to-creek',94,65,'creek','去溪谷'),exit('to-meadow',72,43,'meadow','去山坡'),
    ];
    case 'meadow':return [
      {id:'rest',x:35,y:65,icon:'moon',label:'躺下听风'},
      {id:'cloud',x:61,y:28,icon:'eye',label:'云朵的形状',discovery:'cloud',discoverLabel:'一朵像比格犬的云'},
      {id:'daisy',x:69,y:82,icon:'leaf',label:'草间的小花',discovery:'meadow-daisy',discoverLabel:'山坡上的雏菊'},
      exit('to-garden',83,62,'garden','回菜园'),exit('to-pasture',87,80,'pasture','云边牧场'),
    ];
    case 'creek':return [
      {id:'clue',x:47,y:70,icon:'paw',label:state.flags.clue?'潮湿的线索':'豆丁好像闻到了什么',primary:!state.flags.clue,approach:[40,81]},
      {id:'bridge',x:37,y:51,icon:'hand',label:state.flags.bridge?'木桥已修好':'修复木桥',approach:[31,66]},
      {id:'fetch',x:12,y:49,icon:'paw',label:state.flags.latch?'门闩已找到':'灌木矮洞',approach:[15,66]},
      {id:'gate',x:8,y:40,icon:'hand',label:state.flags.gate?'侧门已打开':'旧侧门',approach:[12,59]},
      {id:'source',x:60,y:36,icon:'water',label:state.flags.source?'清澈的山泉':'被堵住的泉眼',primary:routeOpen(state)&&!state.flags.source,approach:[59,52]},
      {id:'channels',x:77,y:62,icon:'water',label:state.flags.connected?'每日分水':'调整水槽',primary:state.flags.source&&!state.flags.connected,approach:[72,76]},
      {id:'pond',x:89,y:79,icon:'eye',label:state.flags.pond?'听见青蛙了吗':'安静的浅池',approach:[79,84]},
      exit('to-garden',15,88,'garden','回菜园'),
    ];
    case 'pasture':return [
      {id:'sheep',x:34,y:52,icon:'paw',label:'带羊群回家',primary:!state.flags.sheep,approach:[47,70]},
      {id:'sea',x:86,y:39,icon:'eye',label:'远处的海湾',discovery:'sea',discoverLabel:'云边牧场看见的蓝色海湾',approach:[53,65]},
      {id:'gather',x:20,y:70,icon:'leaf',label:state.gatherDay===state.day?'明日再来':'收集枯枝',approach:[43,82]},
      exit('to-kite',46,26,'kite','去追风山丘'),exit('to-meadow',67,92,'meadow','回风铃山坡'),
    ];
    case 'kite':return [
      {id:'kite',x:36,y:63,icon:'leaf',label:'和阿葵放风筝',primary:!state.flags.kite,approach:[46,79]},
      {id:'flowers',x:69,y:80,icon:'eye',label:'风里的野花',discovery:'kite-flower',discoverLabel:'在海风里摇头的野花',approach:[65,88]},
      {id:'clouds',x:73,y:33,icon:'eye',label:'云下的远帆',discovery:'sails',discoverLabel:'云下的白色小帆船',approach:[70,80]},
      exit('to-pasture',12,77,'pasture','回云边牧场'),
    ];
  }
}

function renderWorldState(){
  if(!started)return;
  const scene=SCENES[state.scene];const bg=$('#scene-background');bg.className='scene-background'+(scene.atlas?' atlas':'');bg.style.backgroundImage=`url("${scene.src}")`;bg.style.backgroundPosition=scene.atlas&&state.flags.connected?'100% 0':'0 0';
  $('#location-name').textContent=scene.name;$('#location-en').textContent=scene.en;
  $('#hotspots').innerHTML=spots().map(s=>`<button class="hotspot ${s.kind||''} ${s.primary?'primary':''} ${s.discovery&&state.discoveries.includes(s.discovery)?'discovered':''}" style="left:${s.x}%;top:${s.y}%" data-spot="${s.id}" aria-label="${esc(s.label)}">${icon(s.icon)}<span>${esc(s.label)}</span></button>`).join('');
  $('#boy').hidden=!!scene.rest;$('#dog').hidden=!!scene.rest;
  const layer=$('#plot-layer');layer.replaceChildren();
  if(state.scene==='garden'&&state.flags.frame)PLOTS.forEach(([x,y])=>{const node=document.createElement('div');node.className='world-crop world-bed';node.style.left=x+'%';node.style.top=(y+7)+'%';node.style.zIndex=String(Math.round(y)-1);const c=document.createElement('canvas');c.width=320;c.height=360;paintSprite(c,15);node.append(c);layer.append(node);});
  if(state.scene==='garden')state.plots.forEach((p,i)=>{if(!p)return;const [x,y]=PLOTS[i];const node=document.createElement('div');node.className='world-crop';node.style.left=x+'%';node.style.top=(y+2)+'%';node.style.zIndex=String(Math.round(y));node.style.height=(mature(p)?25:15)+'%';const c=document.createElement('canvas');c.width=320;c.height=360;paintSprite(c,mature(p)?CROPS[p.crop].matureSprite:CROPS[p.crop].sprite);node.append(c);layer.append(node);const status=document.createElement('i');status.className='plot-status '+(mature(p)?'ripe':watered(state,i)?'':'dry');status.style.left=(x+5)+'%';status.style.top=(y+3)+'%';layer.append(status);});
  $('#world-hints').replaceChildren();
}
function resizePlane(){
  const scene=SCENES[state.scene],world=$('#world');const w=world.clientWidth||innerWidth,h=world.clientHeight||innerHeight;
  const pw=Math.max(w,h*scene.ratio),ph=pw/scene.ratio;
  if(h>w){const focus=state.scene==='garden'?45:state.scene==='creek'?50:pos.x;const desired=w*.5-focus/100*pw;panX=Math.max(w-pw,Math.min(0,panX||desired));}else panX=(w-pw)/2;
  plane={w:pw,h:ph,left:panX,top:(h-ph)/2};const p=$('#world-plane');p.style.width=pw+'px';p.style.height=ph+'px';p.style.left=plane.left+'px';p.style.top=plane.top+'px';
  renderHUD();
}
async function goScene(id,{keepPosition=false}={}){
  if(!SCENES[id]||busy)return;closePanel();busy=true;keys.clear();target=null;pendingInteraction=null;$('#scene-loading').hidden=false;
  try{await loadImage(SCENES[id].src);state.scene=id;const p=keepPosition?[state.x,state.y]:SCENES[id].spawn;pos={x:p[0],y:p[1]};dogPos={x:p[0]+5,y:p[1]+2};state.x=pos.x;state.y=pos.y;panX=0;renderWorldState();resizePlane();renderActors(0);persist();clearTimeout(captionTimer);$('#scene-caption').textContent=id==='creek'&&state.flags.connected?'溪水回来了，山谷也跟着醒了。':SCENES[id].caption;$('#scene-caption').classList.add('show');captionTimer=setTimeout(()=>$('#scene-caption').classList.remove('show'),5200);}
  catch(e){toast(e.message,true);}finally{busy=false;$('#scene-loading').hidden=true;}
}
function groundPoint(x,y){
  if(state.scene==='garden')return {x:Math.max(76,Math.min(95,x)),y:Math.max(69,Math.min(97,y))};
  if(state.scene==='pasture'){const yy=Math.max(36,Math.min(97,y));const center=yy<60?40+(yy-36)*.45:50;return {x:Math.max(center-8,Math.min(center+14,x)),y:yy};}
  if(state.scene==='creek'&&!routeOpen(state))return {x:Math.max(7,Math.min(81,x)),y:Math.max(65,Math.min(95,y))};
  return {x:Math.max(6,Math.min(95,x)),y:Math.max(state.scene==='creek'?47:69,Math.min(96,y))};
}
function moveTo(x,y,callback=null){if(SCENES[state.scene].rest){callback?.();return;}target=groundPoint(x,y);pendingInteraction=callback;const mark=$('#move-target');mark.style.left=target.x+'%';mark.style.top=target.y+'%';mark.classList.remove('show');void mark.offsetWidth;mark.classList.add('show');}
function renderActors(t){
  for(const [el,p]of [[$('#boy'),pos],[$('#dog'),dogPos]]){el.style.left=p.x+'%';el.style.top=p.y+'%';el.style.zIndex=String(100+Math.round(p.y));}
  paintSprite($('#boy canvas'),face);paintSprite($('#dog canvas'),face+4);
}
function tick(now){
  const dt=Math.max(0,Math.min(.05,(now-lastFrame)/1000||0));lastFrame=now;
  if(started&&!busy&&!menu.open&&!challengeActive()&&!document.hidden&&!SCENES[state.scene].rest){
    let dx=(keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0),dy=(keys.has('s')||keys.has('arrowdown')?1:0)-(keys.has('w')||keys.has('arrowup')?1:0);
    if(dx||dy){target=null;pendingInteraction=null;const n=Math.hypot(dx,dy);const next=groundPoint(pos.x+dx/n*14*dt,pos.y+dy/n*16*dt);dx=next.x-pos.x;dy=next.y-pos.y;pos=next;}
    else if(target){dx=target.x-pos.x;dy=target.y-pos.y;const n=Math.hypot(dx,dy);if(n<.7){pos={...target};target=null;const cb=pendingInteraction;pendingInteraction=null;state.x=pos.x;state.y=pos.y;persist();cb?.();dx=dy=0;}else{pos.x+=dx/n*Math.min(n,18*dt);pos.y+=dy/n*Math.min(n,18*dt);}}
    const moving=Math.abs(dx)+Math.abs(dy)>.005;if(moving)face=Math.abs(dx)>Math.abs(dy)?(dx>0?1:3):(dy>0?0:2);
    $('#boy').classList.toggle('moving',moving&&state.settings.motion&&!reduced.matches);
    const tx=pos.x+(face===1?-4:face===3?4:4),ty=pos.y+2;const dd=Math.hypot(tx-dogPos.x,ty-dogPos.y);if(dd>2){dogPos.x+=(tx-dogPos.x)*Math.min(1,dt*3);dogPos.y+=(ty-dogPos.y)*Math.min(1,dt*3);}$('#dog').classList.toggle('moving',dd>2&&state.settings.motion&&!reduced.matches);
    if(innerHeight>innerWidth&&moving){const old=panX;panX=Math.max(innerWidth-plane.w,Math.min(0,innerWidth*.5-pos.x/100*plane.w));if(Math.abs(old-panX)>.5){plane.left=panX;$('#world-plane').style.left=panX+'px';}}
    renderActors(now);
  }else{$('#boy').classList.remove('moving');$('#dog').classList.remove('moving');}
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
$('#world').addEventListener('pointerdown',e=>{if(e.target.closest('button')||busy||menu.open)return;drag={x:e.clientX,y:e.clientY,pan:panX,moved:false};});
$('#world').addEventListener('pointermove',e=>{if(!drag||innerWidth>=innerHeight)return;if(Math.abs(e.clientX-drag.x)>8)drag.moved=true;if(drag.moved){panX=Math.max(innerWidth-plane.w,Math.min(0,drag.pan+e.clientX-drag.x));plane.left=panX;$('#world-plane').style.left=panX+'px';}});
$('#world').addEventListener('pointerup',e=>{if(!drag)return;const d=drag;drag=null;if(d.moved)return;moveTo((e.clientX-plane.left)/plane.w*100,(e.clientY-plane.top)/plane.h*100);});
$('#world').addEventListener('pointercancel',()=>drag=null);

function activateSpot(id){
  const spot=spots().find(s=>s.id===id);if(!spot)return;
  const invoke=()=>{
    if(spot.destination){goScene(spot.destination);return;}
    if(Number.isInteger(spot.plot)){selectedPlot=spot.plot;if(tool==='water'&&state.plots[spot.plot]&&!mature(state.plots[spot.plot])){perform('water',{index:spot.plot});return;}showPlot(spot.plot);return;}
    if(spot.discovery){showDiscovery(spot);return;}
    switch(id){
      case 'rest':showRest();break;
      case 'mail':showMail();break;
      case 'seedbox':showSeedbox();break;
      case 'gather':showPanel('拾起一点木香',`<p>只收集已经落下的枯枝，把仍在生长的树留给风和小鸟。</p><p class="material-line">行动时段 1 · 获得木材 2 · 每个游戏日可收集一次</p><div class="button-row">${button(state.gatherDay===state.day?'今天已经收集过':'收集枯枝','gather')}</div>`);break;
      case 'clue':doSniff();break;
      case 'bridge':showRoutes();break;
      case 'fetch':showFetch();break;
      case 'gate':showGate();break;
      case 'source':showSource();break;
      case 'channels':if(state.flags.connected)showFlow();else showChannels();break;
      case 'pond':showPond();break;
      case 'sheep':showSheep();break;
      case 'kite':showKite();break;
    }
  };
  // Hotspot actions remain reachable from the path. Long-distance clicks open
  // the interaction immediately while the party approaches the nearest point.
  if(spot.approach&&!SCENES[state.scene].rest&&innerWidth>=innerHeight){moveTo(...spot.approach);}
  invoke();
}
$('#hotspots').addEventListener('click',e=>{const b=e.target.closest('[data-spot]');if(b){e.stopPropagation();activateSpot(b.dataset.spot);}});

function showPlot(i){
  selectedPlot=i;const p=state.plots[i];
  if(!p){showPanel(`第 ${i+1} 块小花床`,`${state.fertile[i]?'<div class="inline-message">豆子留下了肥沃的土地，下一株植物会更快成熟。</div>':'<p>一小块土地，就能开始一段生长的故事。选择要种下的种子。</p>'}<div class="seeds-grid">${Object.entries(CROPS).map(([key,c])=>`<button class="seed-card" data-action="plant" data-crop="${key}" ${state.seeds[key]===0?'disabled':''}>${spriteHTML(c.matureSprite)}<strong>${c.name}</strong><small>${state.seeds[key]} 颗种子 · ${c.days} 次有水过夜<br>${key==='bean'?'收获后改善土地':key==='daisy'?'为相邻作物增加收成':'很快就能看见收获'}</small></button>`).join('')}</div><p class="small-label" style="margin-top:17px">播种消耗 1 个行动时段。走路、观察和选择种子不花时间。</p>`);return;}
  const c=CROPS[p.crop],ready=mature(p),wet=watered(state,i);
  showPanel(`${c.name}的生长日记`,`<div class="plot-inspection">${spriteHTML(ready?c.matureSprite:c.sprite)}<div><p>${ready?(p.crop==='daisy'?'雏菊开花了！保留它，相邻的作物每次收获会多一份。':'它已经成熟，第一份喜悦就在手边。'):`已经长大 ${p.growth} / ${p.need} 格。${wet?'今天有水，休息后会继续成长。':'今天还缺一点水。'}`}</p><div class="growth-dots">${Array.from({length:p.need},(_,n)=>`<i class="${n<p.growth?'active':''}"></i>`).join('')}</div><p class="small-label">${ready?`预计收获 ${yieldFor(state,i)} 份${c.name}`:irrigated(state,i)?weather(state.day)==='rain'?'雨水在照顾它':'水渠正在照顾它':p.watered?'今天已经浇过水':'水井一直可以使用'}</p></div></div><div class="button-row">${ready?button('收获 · 1 时段','harvest'):button(wet?'今天已经不缺水':'浇水 · 1 时段','water','primary-button',wet?'disabled':'')}${button('查看整个菜园','farm','secondary-button')}</div>`);
}
function showFarm(){showPanel('四块土地的可能',`<p>萝卜长得快，豆子改善下一轮土地，开花的雏菊能让相邻作物多收一份。</p><div class="farm-overview">${state.plots.map((p,i)=>`<button class="farm-plot" data-action="inspect-plot" data-index="${i}">${spriteHTML(p?(mature(p)?CROPS[p.crop].matureSprite:CROPS[p.crop].sprite):15)}<span>${i+1} · ${p?CROPS[p.crop].name:'空花床'}</span><small>${p?mature(p)?'可以收获':`${p.growth}/${p.need} · ${watered(state,i)?'今天有水':'需要浇水'}`:state.fertile[i]?'土地肥沃':'等待一颗种子'}</small></button>`).join('')}</div><div class="button-row">${button('为缺水的植物浇水','water-two','secondary-button')}${button('查看种子盒','seedbox','secondary-button')}</div>`,{wide:false});}
function showMap(){showPanel('沿着小路，去哪里',`<p>山谷里的每一处风景，都有自己的小小故事。点击一张画就能沿路抵达。</p><div class="map-grid">${Object.entries(SCENES).map(([key,s])=>`<button class="map-card ${state.scene===key?'current':''}" data-action="travel" data-scene="${key}">${s.atlas?`<div class="map-art" style="background-image:url('${s.thumb}');background-position:${state.flags.connected?'100%':'0'} 0" role="img" aria-label="${s.name}"></div>`:`<img src="${s.thumb}" alt="${s.name}">`}<span>${s.name}<small>${s.en}</small></span></button>`).join('')}</div><div class="button-row">${button('看看这里的线索','local-spots','secondary-button')}</div>`,{wide:true,eyebrow:'风铃谷地图'});}
function showLocalSpots(){showPanel(SCENES[state.scene].name,`<p>留意一下附近，也许就有新的发现。</p><div class="button-row">${spots().map(s=>`<button class="secondary-button" data-action="activate-spot" data-spot="${s.id}">${icon(s.icon)}${esc(s.label)}</button>`).join('')}</div>`);}
function showBag(){const names={wood:'木材',stone:'石料',fiber:'纤维',radish:'萝卜',bean:'豆子',daisy:'雏菊'};showPanel('背包里的小收获',`<div class="inventory-grid">${Object.entries(names).map(([k,n])=>`<div class="inventory-item">${CROPS[k]?spriteHTML(CROPS[k].matureSprite):icon(k==='wood'?'leaf':k==='stone'?'sun':'sprout')}<span>${n}<br><strong>${state.inventory[k]}</strong></span></div>`).join('')}</div><h3>等待发芽的种子</h3><div class="badge-line">${Object.entries(CROPS).map(([k,c])=>`<span>${c.name}种子 ${state.seeds[k]}</span>`).join('')}</div>${state.flags.latch&&!state.flags.gate?'<div class="inline-message">任务物品：旧门闩。它可以打开溪谷的侧门。</div>':''}<div class="button-row">${button('去种子盒交换','seedbox','secondary-button')}${state.flags.order&&!state.flags.frame?button('制作花床边框','frame','secondary-button'):''}</div>`);}
function showSeedbox(){showPanel('把收获换成新的开始',`<p>用任意一份收获物，换两颗你喜欢的种子。没有种子、也没有在种作物时，盒子会留一颗萝卜种子帮你重新开始。</p><div class="seeds-grid">${Object.entries(CROPS).map(([k,c])=>`<button class="seed-card" data-action="trade" data-crop="${k}">${spriteHTML(c.matureSprite)}<strong>${c.name}种子 × 2</strong><small>已有 ${state.seeds[k]} 颗<br>交换消耗任意收获物 1 份</small></button>`).join('')}</div><div class="button-row">${button('看看补给种子','recover-seed','secondary-button')}${button('查看菜园','farm','secondary-button')}</div>`);}
function showMail(){
  const ready=state.flags.pond&&state.stats.harvests&&!state.flags.chapter,o=dailyOrder(state),mat={wood:'木材',fiber:'纤维',stone:'石料'};
  showPanel('米拉留给你的便条',`<p>“这片菜园好久没听见溪水了。如果你和豆丁愿意去上游看看，整个山谷都会感谢你们。”</p>${state.flags.pond?'<p>“今天早上，我又听见浅池里的青蛙了。你们把溪水带回来了，真好。”</p>':''}<div class="button-row">${ready?button('告诉米拉：溪水回来了','finish'):!state.flags.chapter?button('查看修复手记','quest'):button('重温这段故事','quest','secondary-button')}</div><div class="rule-line"></div><h3>一份温暖的晚餐</h3><p>${state.flags.order?'“萝卜很好吃，谢谢你！那份花床边框做法，希望你会喜欢。”':'带来两份萝卜，米拉会送你一份纤维和花床边框的做法。'}</p><div class="button-row">${button(state.flags.order?'已经分享过收获':'交付萝卜 × 2','order','secondary-button',state.flags.order?'disabled':'')}${state.flags.order&&!state.flags.frame?button('制作边框 · 木材2 纤维1','frame','secondary-button'):''}</div>${state.flags.chapter?`<div class="rule-line"></div><h3>今日的小村委托 · ${o.label}</h3><p>需要 ${CROPS[o.crop].name} × ${o.amount}。奖励 ${CROPS[o.seed].name}种子 × ${o.seeds} 和${mat[o.material]} × 1。</p><p class="small-label">每个游戏日一份不同需要，休息后更新。不消耗行动时段。已完成 ${state.stats.deliveries} 份。</p><div class="button-row">${button(state.deliveryDay===state.day?'今天的委托已完成':'分享这份收获','delivery','secondary-button',state.deliveryDay===state.day?'disabled':'')}</div>`:''}`);
}
function showQuest(){const labels=['在干渠边发现线索','开放木桥或侧门','清理上游泉眼','接通菜园与浅池','过夜后看见环境变化','收获作物并告诉米拉'];const step=progress(state);showPanel('让溪水回来',`<p>和豆丁一起，找回山泉通往家园的路。</p><ol class="quest-steps">${labels.map((s,i)=>`<li class="${i<step?'done':''}"><i>${i<step?'✓':i+1}</i>${s}</li>`).join('')}</ol><div class="button-row">${button('去下一处线索','go-goal')}${button('自然与冒险日记','journal','secondary-button')}</div>`);}
function showJournal(){showPanel('风铃谷手记',`<div class="badge-line"><span>第 ${state.day} 天</span><span>${state.discoveries.length} 个自然发现</span><span>${state.stats.harvests} 次收获</span>${state.flags.chapter?'<span>第一章已完成</span>':''}</div><h3>那些被记住的时刻</h3>${state.journal.length?`<ol class="entry-list">${state.journal.slice().reverse().slice(0,15).map(e=>`<li><small>第 ${e.day} 天</small>${esc(e.text)}</li>`).join('')}</ol>`:'<p>有些故事，从一颗种子开始。</p>'}<h3>自然小发现</h3>${state.records.length?`<ol class="entry-list">${state.records.map(e=>`<li><small>第 ${e.day} 天</small>${esc(e.label)}</li>`).join('')}</ol>`:'<p>在云朵、草丛和远方的海湾里，慢慢找找看。</p>'}<div class="button-row">${button('查看修复目标','quest','secondary-button')}${button('导出这段冒险','export','secondary-button')}</div>`,{wide:false});}
function showDiscovery(s){const content={cloud:'那朵小小的云，有两只垂下来的耳朵。豆丁看了看天空，又看了看你。',daisy:'花瓣会随着风轻轻点头。留在土地上的花，也能照顾附近的作物。',sea:'远处的海湾像一块蓝玻璃。某一天，你们也许会走到那里去。',flowers:'阿葵说，分辨风的方向，可以先看看花茎在向哪里弯腰。',clouds:'一张白帆从蓝色里慢慢经过。世界很大，今天先记住这小小的一角。'};showPanel(s.label,`<p>${content[s.id]||'观察一下，平凡的风景里总有新的发现。'}</p><div class="button-row">${button(state.discoveries.includes(s.discovery)?'已经画进手记':'画进自然手记','record-discovery','primary-button',state.discoveries.includes(s.discovery)?'disabled':`data-id="${s.discovery}" data-label="${esc(s.discoverLabel)}"`)}</div>`);}
function doSniff(){
  closePanel();if(state.scene==='creek')perform('clue');const hints=$('#world-hints');hints.hidden=false;hints.innerHTML=state.scene==='creek'?[[47,70,'潮湿的石头'],[12,49,'旧木头的气味'],[60,36,'上游的水声']].map(([x,y,t])=>`<div class="scent" style="left:${x}%;top:${y}%"><span>${t}</span></div>`).join(''):spots().filter(s=>s.discovery||s.id==='gather').map(s=>`<div class="scent" style="left:${s.x}%;top:${s.y}%"><span>${esc(s.label)}</span></div>`).join('');
  clearTimeout(scentTimer);scentTimer=setTimeout(()=>{hints.replaceChildren();hints.hidden=!state.settings.hints;},9000);sound(523.25,.22);
  if(state.scene!=='creek')toast('豆丁在附近闻了闻。留意发亮的线索，或者呼唤它跟上你。');
}
function showDog(){showPanel('豆丁的小本领',`<div class="plot-inspection">${spriteHTML(4)}<div><p>好鼻子能发现藏在画里的线索，小小的身子能穿过你进不去的矮洞。</p><p class="small-label">嗅闻和呼唤不消耗时段。成功取物消耗 1 个时段。</p></div></div><div class="button-row">${button('豆丁，嗅一嗅','sniff')}${button('到我身边来','recall','secondary-button')}${state.scene==='creek'&&!state.flags.latch?button('看看灌木矮洞','fetch-info','secondary-button'):''}</div>`);}
function showRoutes(){if(state.flags.bridge){showPanel('木桥迎着风',`<p>新修的桥板很结实。上游的路已经为你们打开。</p><div class="button-row">${button('去看看泉眼','source-info')}</div>`);return;}showPanel('通向上游的两条路',`<p>可以把木材用在桥上，也可以和豆丁一起打开侧门。两条路都能抵达同一个上游。</p><div class="route-cards"><div class="route-card"><h3>修好木桥</h3><p>木材 2 · 行动时段 1<br>节省今天的时间，开放这条捷径。</p>${button('修桥','repair-bridge','primary-button',!state.flags.clue?'disabled':'')}</div><div class="route-card"><h3>让豆丁帮忙</h3><p>无需木材 · 共 2 个时段<br>取回门闩，再打开侧门。</p>${button(state.flags.latch?'打开侧门':'看看灌木矮洞',state.flags.latch?'gate-info':'fetch-info','primary-button',!state.flags.clue?'disabled':'')}</div></div>${!state.flags.clue?'<div class="inline-message">先让豆丁嗅一嗅干涸的水渠，找出上游的线索。</div>':''}`);}
function showFetch(){showPanel('矮洞后面的旧门闩',`<div class="plot-inspection">${spriteHTML(5)}<div><p>${state.flags.latch?'豆丁已经把旧门闩叼回来了。它正在等你一起去开门。':'你过不去的小洞，豆丁刚好能钻进去。旧门闩就在另一头。'}</p><p class="small-label">成功取回门闩 · 消耗 1 个行动时段</p></div></div><div class="button-row">${state.flags.latch?button('去打开侧门','gate-info'):button('豆丁，帮我拿回来','fetch','primary-button',state.flags.clue?'':'disabled')}${!state.flags.clue?button('先嗅闻附近','sniff','secondary-button'):''}</div>`);}
function showGate(){showPanel('灌木旁的旧侧门',`<p>${state.flags.gate?'门已经打开，风穿过木栅栏，吹向上游。':state.flags.latch?'旧门闩正好能装回原位。打开门，就能走上另一条路。':'门闩丢在矮洞后面了。也许豆丁有办法。'}</p><div class="button-row">${state.flags.gate?button('看看上游泉眼','source-info'):state.flags.latch?button('装好门闩 · 1 时段','open-gate'):button('去看看矮洞','fetch-info')}</div>`);}
function showSource(){showPanel('石缝里的山泉',`<p>${state.flags.source?'泉水已经恢复，清理过的石缝里传来了熟悉的水声。':routeOpen(state)?'落叶与枯枝堵住了泉眼。用旁边的旧耙子清开它，水就能重新流动。':'泉眼在上游。先修复木桥，或与豆丁一起打开侧门，再安全地走过去。'}</p><div class="button-row">${state.flags.source?button('去调整水槽','channels'):routeOpen(state)?button('疏通泉眼 · 1 时段','clear-source'):button('查看两条路线','routes')}</div>`);}
function channelHTML(){return `<div class="channel-puzzle ${validChannels(channels)?'connected':''}"><div class="water-source">${icon('water')}让四块弯槽连成完整的回水路</div><div class="channel-grid">${channels.map((v,i)=>`<button class="channel-tile ${v===[1,2,0,3][i]?'correct':''}" data-action="rotate-channel" data-index="${i}" aria-label="转动第 ${i+1} 块水槽，当前朝向 ${v+1}"><svg viewBox="0 0 100 100" style="transform:rotate(${v*90}deg)"><path class="bank-line" d="M50 0V50H100"/><path class="water-line" d="M50 0V50H100"/></svg></button>`).join('')}</div><div class="water-exits"><span>↙ 菜园</span><span>${validChannels(channels)?'水路已经接通 ✓':'点击弯槽，试着转个方向'}</span><span>浅池 ↘</span></div></div>`;}
function showChannels(keep=false){if(state.flags.connected){showFlow();return;}if(!keep)channels=[0,0,0,0];showPanel('让水找到回家的路',`<p>${state.flags.source?'把四块水槽转成一圈连续的回水路，再同时接向菜园和浅池。预览和转动不花时间。':'上游还没有水。可以先试着摆放水槽，恢复山泉后再提交。'}</p><div id="channel-board">${channelHTML()}</div><div class="button-row">${button('开启分流 · 1 时段','connect-water','primary-button',state.flags.source?'':'disabled')}${button('给我一点提示','channel-hint','secondary-button')}</div><p class="small-label" style="margin-top:13px">成功提交后默认菜园与浅池各分一份水。错误尝试不会扣时段或材料。</p>`);}
function showFlow(keep=false){if(!keep){flowDraft=state.flow;rowDraft=state.row;}showPanel('两份溪水，怎样安排',`<p>每份水能照顾一排菜园，或让浅池恢复生机。手动浇水始终可用；雨天所有露天地块都会有水。</p><div class="flow-choices">${[['garden','两份给菜园','两排自动灌溉','2 : 0'],['split','各分一份','一排灌溉，浅池有水','1 : 1'],['pond','两份给浅池','更多观察机会','0 : 2']].map(([k,t,d,n])=>`<button class="flow-choice ${flowDraft===k?'selected':''}" data-action="flow-choice" data-flow="${k}"><span>${n}</span><strong>${t}</strong>${d}</button>`).join('')}</div><div class="flow-row">自动灌溉的位置 <button class="${rowDraft===0?'selected':''}" data-action="flow-row" data-row="0">花床 1 和 2</button><button class="${rowDraft===1?'selected':''}" data-action="flow-row" data-row="1">花床 3 和 4</button></div><div class="button-row">${button('确认安排 · 1 时段','save-flow')}${button('去看看菜园','travel','secondary-button','data-scene="garden"')}</div><p class="small-label" style="margin-top:13px">以每天休息时的分流配置结算。一天内反复改配不会累计自动灌溉。</p>`);}
function showPond(){showPanel(state.flags.pond?'浅池里的第一声蛙鸣':'还在等待的浅池',`<p>${state.flags.pond?'水回来以后，青蛙也回来了。这里曾经干涸，如今又能倒映天空。':'让溪水流向浅池，至少保持一份水直到休息过夜。明天再来，看看会不会有新的邻居。'}</p><div class="button-row">${state.flags.pond?button(state.discoveries.includes('frog')?'蛙鸣已经记进手记':'记住这一声蛙鸣','record-discovery','primary-button',state.discoveries.includes('frog')?'disabled':'data-id="frog" data-label="溪谷修复后的第一声蛙鸣"'):button('查看水路','channels')}${button('回山坡休息','rest','secondary-button')}</div>`);}
function showDay(){showPanel(`第 ${state.day} 天的风与光`,`<p>今天还剩 ${state.ap} 个行动时段。移动、观察、对话和嗅闻不花时间，确认有效行动才推进时段。</p><div class="weather-row">${[0,1,2].map(n=>`<div class="weather-cell"><small>${n===0?'今天':n===1?'明天':'后天'}</small>${icon(weather(state.day+n)==='rain'?'water':'sun')}<strong>${weather(state.day+n)==='rain'?'温柔的雨':'晴朗有风'}</strong></div>`).join('')}</div><p class="small-label">雨天会照顾全部露天作物。缺水只会暂停成长，不会让植物枯死。</p><div class="button-row">${button('查看休息预览','rest','secondary-button')}</div>`);}
function showRest(){const preview=restPreview(state),grow=preview.filter(p=>p.grow).length,ripe=preview.filter(p=>p.ripe).length;showPanel('把今天交给晚风',`<p>男孩和豆丁躺在山坡上。等你准备好了，就让今天轻轻过去。</p><div class="weather-row"><div class="weather-cell"><small>明天</small>${icon(weather(state.day+1)==='rain'?'water':'sun')}<strong>第 ${state.day+1} 天 · ${weather(state.day+1)==='rain'?'下雨':'晴天'}</strong></div><div class="weather-cell"><small>今晚的菜园</small>${icon('sprout')}<strong>${grow} 株成长 · ${ripe} 株成熟</strong></div></div>${preview.some(p=>!p.grow&&!mature(state.plots[p.index]))?'<div class="inline-message">有植物今天还缺水。你可以先回菜园浇水，也可以让它们明天再长。</div>':''}${state.flags.connected&&!state.flags.pond?`<p class="small-label">${state.flow==='garden'?'目前两份水都给了菜园，浅池还不会恢复。':'目前浅池有水，明天会有新的变化。'}</p>`:''}<div class="button-row">${button('休息到明天','sleep')}${button('我再走走','close','secondary-button')}</div><p class="small-label" style="margin-top:13px">剩余 ${state.ap} 个时段会结束。没有现实等待，醒来就是新的一天。</p>`);}
async function sleep(){closePanel();const r=perform('rest',{},true);if(!r.ok)return;const tr=$('#day-transition');$('#new-day-title').textContent=`第 ${state.day} 天`;tr.classList.add('show');await new Promise(resolve=>setTimeout(resolve,reduced.matches||!state.settings.motion?100:1350));await goScene('garden');tr.classList.remove('show');toast(r.message);}
function showSheep(){showPanel('豆丁，带大家回家',`<div class="plot-inspection">${spriteHTML(14)}<div><p>几只小羊跑出了围栏。带豆丁站到羊群的后方，把它们慢慢引向右边的安全围栏。</p><p class="small-label">点击或拖动指挥豆丁，靠近羊会让它们朝相反方向走。按空格轻轻叫一声。</p></div></div><p class="small-label">可重复挑战 · 不消耗行动时段 · 首次完成获得豆子种子 × 2</p><div class="button-row">${button('带羊群回家','start-sheep')}${button('我再看看牧场','close','secondary-button')}</div>`);}
function showKite(){showPanel('借一阵风，飞高一点',`<p>阿葵邀请你一起放第二只风筝。按住空格或屏幕拉紧风筝线，松开让它随风下降，穿过空中的风环。</p><p class="small-label">可重复挑战 · 不消耗行动时段 · 首次完成获得雏菊种子 × 2</p><div class="button-row">${button('和风一起出发','start-kite')}${button('先看看山丘','close','secondary-button')}</div>`);}
async function launchChallenge(kind){closePanel();keys.clear();$('#scene-loading').hidden=false;try{await startChallenge(kind,{onComplete:(type,score)=>{perform(type,{score});},sound});}catch(e){toast(e.message,true);}finally{$('#scene-loading').hidden=true;}}
function showComplete(){showPanel('第一章 · 让溪水回来',`<div class="chapter-complete"><span class="chapter-stamp">A LITTLE CHANGE IN A BIG WORLD</span>${spriteHTML(0)}${spriteHTML(4)}<strong>山谷记住了你们。</strong><p>溪水流回了菜园，青蛙回到了浅池。<br>这些小小的变化，都是你和豆丁一起做到的。</p></div><div class="badge-line"><span>第 ${state.day} 天完成</span><span>${state.stats.harvests} 次收获</span><span>${state.discoveries.length} 个发现</span></div><p>现在可以继续照顾菜园、挑战赶羊和放风筝，或去看看还没被记进手记的风景。</p><div class="button-row">${button('去云边牧场','travel','primary-button','data-scene="pasture"')}${button('继续我的菜园','close','secondary-button')}${button('导出纪念存档','export','secondary-button')}</div>`,{eyebrow:'小芽小队 · 风铃谷'});sound(659.25,.4);setTimeout(()=>sound(783.99,.6),230);}
function showSettings(){showPanel('留住这段冒险',`<div class="setting-line"><span>声音<small>温柔的音符与动作反馈</small></span><button class="toggle ${state.settings.sound?'on':''}" data-action="toggle-sound">${state.settings.sound?'开启':'关闭'}</button></div><div class="setting-line"><span>氛围动态<small>系统减少动态设置始终优先</small></span><button class="toggle ${state.settings.motion&&!reduced.matches?'on':''}" data-action="toggle-motion">${state.settings.motion&&!reduced.matches?'开启':'关闭'}</button></div><div class="setting-line"><span>线索提示<small>保留文字和标记，方便识别场景</small></span><button class="toggle ${state.settings.hints?'on':''}" data-action="toggle-hints">${state.settings.hints?'开启':'关闭'}</button></div><h3>存档与恢复</h3><p>进度自动保存在当前设备和浏览器。你可以导出文件，再在另一台设备导入。清理浏览器数据前，请先导出。</p><div class="button-row">${button('导出存档','export')}${button('导入存档','import','secondary-button')}${button('查看自动备份','backups','secondary-button')}</div><div class="rule-line"></div><div class="button-row">${button('返回标题画面','title','secondary-button')}${button('角色卡住了，回家','unstuck','secondary-button')}</div>`);}
async function showBackups(){const list=await backupStates();showPanel('自动保存的几页日记',`<p>保留最近三次保存的备份。恢复前可以先导出当前进度。</p>${list.length?`<div class="button-row">${list.map((s,i)=>button(`恢复第 ${s.day} 天 · ${s.ap} 时段`,'restore-backup','secondary-button',`data-index="${i}"`)).join('')}</div>`:'<p>还没有可恢复的自动备份。</p>'}<div class="button-row">${button('先导出当前进度','export')}</div>`);}

document.addEventListener('click',async e=>{
  const b=e.target.closest('[data-action]');if(!b||b.disabled)return;const a=b.dataset.action;
  switch(a){
    case 'close':closePanel();break;case 'travel':await goScene(b.dataset.scene);break;case 'local-spots':showLocalSpots();break;case 'activate-spot':{const id=b.dataset.spot;closePanel();activateSpot(id);break;}
    case 'farm':showFarm();break;case 'inspect-plot':showPlot(Number(b.dataset.index));break;
    case 'plant':{const r=perform('plant',{index:selectedPlot,crop:b.dataset.crop});if(r.ok)showPlot(selectedPlot);break;}
    case 'water':{const r=perform('water',{index:selectedPlot});if(r.ok)showPlot(selectedPlot);break;}
    case 'water-two':{const indices=state.plots.map((p,i)=>p&&!mature(p)&&!watered(state,i)?i:-1).filter(i=>i>=0).slice(0,2);const r=perform('water',{indices});if(r.ok)showFarm();break;}
    case 'harvest':{const r=perform('harvest',{index:selectedPlot});if(r.ok){closePanel();if(state.flags.pond&&!state.flags.chapter)toast('收获了第一份喜悦！去米拉的信箱，告诉她溪水回来了。');}break;}
    case 'gather':if(perform('gather').ok)closePanel();break;
    case 'seedbox':showSeedbox();break;case 'recover-seed':if(perform('seedbox').ok)showSeedbox();break;case 'trade':if(perform('trade',{crop:b.dataset.crop}).ok)showSeedbox();break;
    case 'order':if(perform('order').ok)showMail();break;case 'frame':if(perform('frame').ok)showMail();break;case 'delivery':if(perform('delivery').ok)showMail();break;case 'finish':perform('finish');break;
    case 'quest':showQuest();break;case 'journal':showJournal();break;case 'go-goal':await goScene(goal(state).scene);break;
    case 'record-discovery':if(perform('discover',{id:b.dataset.id,label:b.dataset.label}).ok)closePanel();break;
    case 'sniff':doSniff();break;case 'recall':dogPos={x:pos.x+4,y:pos.y+2};closePanel();sound(523);toast('豆丁摇着尾巴跑回了你身边。');break;
    case 'routes':showRoutes();break;case 'repair-bridge':if(perform('bridge').ok)closePanel();break;
    case 'fetch-info':showFetch();break;case 'fetch':if(perform('fetch').ok){closePanel();dogPos={x:15,y:55};}break;
    case 'gate-info':showGate();break;case 'open-gate':if(perform('gate').ok)closePanel();break;
    case 'source-info':showSource();break;case 'clear-source':if(perform('source').ok)closePanel();break;
    case 'channels':showChannels();break;
    case 'rotate-channel':{const i=Number(b.dataset.index);channels[i]=(channels[i]+1)%4;$('#channel-board').innerHTML=channelHTML();sound(290+i*40,.08);break;}
    case 'channel-hint':toast('四块弯槽的开口要互相相接：左上向右下，右上向左下，左下向右上，右下向左上。');break;
    case 'connect-water':{const r=perform('connect',{channels});if(r.ok)closePanel();break;}
    case 'flow-choice':flowDraft=b.dataset.flow;showFlow(true);break;case 'flow-row':rowDraft=Number(b.dataset.row);showFlow(true);break;case 'save-flow':if(perform('flow',{flow:flowDraft,row:rowDraft}).ok)closePanel();break;
    case 'rest':showRest();break;case 'sleep':await sleep();break;
    case 'start-sheep':launchChallenge('sheep');break;case 'start-kite':launchChallenge('kite');break;
    case 'toggle-sound':state.settings.sound=!state.settings.sound;if(state.settings.sound){initAudio();sound(523);}persist();applySettings();showSettings();break;
    case 'toggle-motion':state.settings.motion=!state.settings.motion;applySettings();persist();showSettings();break;
    case 'toggle-hints':state.settings.hints=!state.settings.hints;applySettings();persist();showSettings();break;
    case 'export':downloadSave(started?state:saved?.state||state);break;case 'import':$('#import-save').click();break;case 'backups':await showBackups();break;
    case 'restore-backup':{const list=await backupStates();if(list[Number(b.dataset.index)]){importCandidate=list[Number(b.dataset.index)];showImportConfirm();}break;}
    case 'confirm-import':state=importCandidate;importCandidate=null;closePanel();applySettings();await goScene(state.scene,{keepPosition:true});toast('这段冒险已经接上了。');break;
    case 'title':closePanel();started=false;persist();saved={state:structuredClone(state)};$('#game-app').hidden=true;$('#title-screen').hidden=false;$('#continue-game').hidden=false;applySettings();break;
    case 'unstuck':closePanel();await goScene('garden');toast('你和豆丁安全地回到了菜园。');break;
    case 'new-confirm':await begin(false);break;
  }
});
function showImportConfirm(){showPanel('接上另一段冒险',`<p>这份存档停在第 ${importCandidate.day} 天，地点是${SCENES[importCandidate.scene].name}。导入后会替换当前进度；当前进度会进入自动备份。</p><div class="button-row">${button('导入并继续','confirm-import')}${button('先导出当前进度','export','secondary-button')}${button('取消','close','secondary-button')}</div>`);}
$('#import-save').addEventListener('change',async e=>{try{importCandidate=await readSaveFile(e.target.files[0]);showImportConfirm();}catch(err){toast(err.message,true);}e.target.value='';});

$('#close-panel').addEventListener('click',closePanel);menu.addEventListener('click',e=>{if(e.target===menu){const r=menu.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closePanel();}});
menu.addEventListener('close',()=>keys.clear());
$('#open-map').onclick=showMap;$('#open-bag').onclick=showBag;$('#open-settings').onclick=showSettings;$('#open-journal').onclick=showJournal;$('#quest-note').onclick=showQuest;$('#open-rest').onclick=showRest;$('#day-details').onclick=showDay;$('#call-dog').onclick=showDog;$('#home-menu').onclick=showSettings;
document.querySelectorAll('[data-tool]').forEach(b=>b.addEventListener('click',()=>{tool=b.dataset.tool;document.querySelectorAll('[data-tool]').forEach(t=>t.classList.toggle('selected',t===b));if(tool==='seeds')showFarm();else if(tool==='water'){toast('选择缺水的花床浇水。水井一直可用，一次可照顾两格。');if(state.scene!=='garden')showFarm();}else toast('点击地面散步，或点击发光标记看看。');}));
window.addEventListener('keydown',e=>{if(!started)return;if(['INPUT','TEXTAREA'].includes(e.target.tagName))return;if(challengeActive())return;if(menu.open){keys.clear();return;}const key=e.key.toLowerCase();if(['arrowup','arrowdown','arrowleft','arrowright',' '].includes(key))e.preventDefault();if(e.repeat&&!['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(key))return;keys.add(key);if(key===' '){dogPos={x:pos.x+4,y:pos.y+2};doSniff();}if(key==='j')showJournal();if(key==='r')showRest();if(key==='m')showMap();if(key==='b')showBag();if(['1','2','3'].includes(key))document.querySelectorAll('[data-tool]')[Number(key)-1].click();if(key==='e'){const list=spots().filter(s=>!s.destination);list.sort((a,b)=>Math.hypot(a.x-pos.x,a.y-pos.y)-Math.hypot(b.x-pos.x,b.y-pos.y));if(list[0])activateSpot(list[0].id);}});
window.addEventListener('keyup',e=>{const k=e.key.toLowerCase();keys.delete(k);if(started&&!menu.open&&!challengeActive()&&['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(k))persist();});window.addEventListener('blur',()=>keys.clear());document.addEventListener('visibilitychange',()=>{keys.clear();if(document.hidden){$('#title-video').pause();if(started){state.x=pos.x;state.y=pos.y;persist();}}else applySettings();});window.addEventListener('resize',()=>{if(started)resizePlane();});

async function begin(continuing){
  if(busy)return;busy=true;const btn=continuing?$('#continue-game'):$('#start-game');const old=btn.innerHTML;btn.disabled=true;btn.textContent='画笔准备好了，马上出发…';
  try{await Promise.all([prepareArt(),loadImage(SCENES[continuing?saved.state.scene:'garden'].src)]);if(continuing)state=structuredClone(saved.state);else{const sound=state.settings.sound;state=freshState();state.settings.sound=sound;}started=true;$('#title-screen').hidden=true;$('#game-app').hidden=false;applySettings();busy=false;await goScene(state.scene,{keepPosition:continuing});renderHUD();if(!continuing)showPanel('米拉的第一封信',`<p>“欢迎回到风铃谷！菜园里的土已经松好了，只差你和几颗小种子。”</p><p>“只是溪水好像不再经过这里了。等你准备好了，带豆丁去上游看看吧。”</p><p class="small-label">先点击一块空花床种萝卜，再浇一点水。你可以随时打开右上角地图，去其他地方走走。</p><div class="button-row">${button('去种下第一颗种子','close')}${button('先看看整个山谷','show-map','secondary-button')}</div>`,{eyebrow:'第一章 · 让溪水回来'});if(continuing&&saved.recovered)toast('已从有效的自动备份接上冒险。');}
  catch(e){toast(e.message,true);showPanel('小路暂时被云遮住了',`<p>${esc(e.message)}</p><div class="button-row">${button('关闭后重试','close')}</div>`);}finally{busy=false;btn.disabled=false;btn.innerHTML=old;}
}
document.addEventListener('click',e=>{if(e.target.closest('[data-action="show-map"]'))showMap();});
$('#start-game').onclick=()=>{if(saved)showPanel('开始一段新的冒险',`<p>你已经有一份第 ${saved.state.day} 天的冒险。可以继续，也可以先导出，再重新开始。</p><div class="button-row">${button('开始新冒险','new-confirm')}${button('先导出进度','export','secondary-button')}${button('取消','close','secondary-button')}</div>`);else begin(false);};
$('#continue-game').onclick=()=>begin(true);
$('#title-sound').onclick=()=>{state.settings.sound=!state.settings.sound;if(state.settings.sound){initAudio();sound(523);}applySettings();};
async function init(){saved=await loadSaved();if(saved){state.settings={...saved.state.settings};$('#continue-game').hidden=false;$('#continue-game').innerHTML=`继续第 ${saved.state.day} 天的冒险 <span>↗</span>`;}applySettings();const sceneQuery=new URLSearchParams(location.search).get('scene');if(sceneQuery&&SCENES[sceneQuery]){await begin(!!saved);closePanel();await goScene(sceneQuery);} }
init();
// Read-only diagnostics support checking a player's reported save without
// exposing mutable engine objects. Game commands still go through the UI.
window.Windbell={state:()=>structuredClone(state),scene:()=>state.scene,version:'0.1.0'};
