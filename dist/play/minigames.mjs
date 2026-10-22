import {loadImage,sprite,spriteHTML,mountSprites} from './art.mjs';
const $=s=>document.querySelector(s);
const modal=$('#challenge-panel'),canvas=$('#challenge-canvas'),ctx=canvas.getContext('2d');
let game=null,options=null,frame=0,last=0,kind='sheep';
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export const challengeActive=()=>!!game;
function coords(e){const r=canvas.getBoundingClientRect();return {x:(e.clientX-r.left)/r.width*1000,y:(e.clientY-r.top)/r.height*600};}
function rounded(x,y,w,h,r=18){ctx.beginPath();ctx.roundRect(x,y,w,h,r);}
function drawBackground(im){const sw=im.naturalWidth,sh=im.naturalHeight,r=Math.max(1000/sw,600/sh),w=sw*r,h=sh*r;ctx.drawImage(im,(1000-w)/2,(600-h)/2,w,h);}
function stamp(index,x,y,w,h,flip=false){const im=sprite(index);ctx.save();ctx.translate(x,y);if(flip)ctx.scale(-1,1);ctx.drawImage(im,-w/2,-h,w,h);ctx.restore();}
function overlay(title,copy,buttons){$('#challenge-overlay').innerHTML=`${spriteHTML(kind==='sheep'?4:13)}<h3>${title}</h3><p>${copy}</p><div class="button-row">${buttons}</div>`;mountSprites($('#challenge-overlay'));}
function beginRun(assisted=false){
  if(!game)return;
  const image=game.image;
  game={kind,image,running:true,finished:false,assisted,keys:new Set(),elapsed:0,remaining:kind==='sheep'?100:40,
    dog:{x:170,y:460,tx:170,ty:460},pointer:false,barks:0,barkTimer:0,barkCooldown:0,
    sheep:[{x:290,y:270},{x:400,y:360},{x:510,y:260},{x:560,y:440}],captured:0,
    kite:{y:300,vy:0,pull:false},rings:[],spawn:0,collected:0,attempts:0,seed:8675309};
  $('#challenge-overlay').replaceChildren();$('#challenge-special').textContent=kind==='sheep'?'汪！ · 空格':'按住拉线';$('#challenge-special').hidden=false;
  last=performance.now();
}
export async function startChallenge(which,callbacks){
  stopChallenge();kind=which;options=callbacks;
  const image=await loadImage(which==='sheep'?'assets/paddock.png':'assets/kitehill.webp');
  game={kind:which,image,running:false,finished:false};
  $('#challenge-title').textContent=which==='sheep'?'带羊群回家':'借一阵风';
  $('#challenge-eyebrow').textContent=which==='sheep'?'云边牧场 · 豆丁的拿手好戏':'追风山丘 · 和阿葵一起';
  $('#challenge-score').textContent=which==='sheep'?'4 只小羊等你带路':'穿过至少 3 个风环';
  $('#challenge-instructions').textContent=which==='sheep'?'点击或拖动指挥豆丁 / WASD 移动 · 站在羊后方，把它们引进右侧围栏':'按住空格、画面或按钮拉线向上 · 松开顺风下降 · 穿过发亮的风环';
  $('#challenge-special').hidden=true;
  modal.showModal();
  overlay(which==='sheep'?'大家，回家啦':'让风带你飞',which==='sheep'?'小羊会避开豆丁。试着绕到它们左边，把它们引到右侧围栏。轻轻叫一声，可以让远一点的小羊也听见。':'按住时风筝向上，松开时慢慢下降。找到风的节奏，穿过至少三个风环。',`<button class="primary-button" data-mini="start">开始挑战</button><button class="secondary-button" data-mini="assist">慢慢来 · 不计时</button>`);
  drawBackground(image);last=performance.now();frame=requestAnimationFrame(tick);
}
export function stopChallenge(){cancelAnimationFrame(frame);game=null;if(modal.open)modal.close();$('#challenge-overlay').replaceChildren();}
function complete(win){
  if(!game||game.finished)return;game.finished=true;game.running=false;game.pointer=false;game.keys.clear();game.kite&&(game.kite.pull=false);$('#challenge-special').hidden=true;
  const score=kind==='sheep'?Math.max(100,Math.round(1000+Math.max(0,100-game.elapsed)*8-game.barks*7)):Math.round(game.collected*200+Math.max(0,40-game.elapsed)*3);
  if(win){options.onComplete(kind,score);options.sound?.(659.25,.35);}
  overlay(win?(kind==='sheep'?'一只都没落下':'风也记住了你'):'再试一次也没关系',win?`${kind==='sheep'?'四只小羊都安全回家了。':'风筝穿过了 '+game.collected+' 个风环。'} 本次得分 ${score}。${game.assisted?'这是一次自在的练习。':'还想再挑战一次吗？'}`:(kind==='sheep'?`已经带回 ${game.captured} 只小羊。换个站位，再和豆丁试一次。`:`你已经找到了 ${game.collected} 个风环。再试着提早一点拉线。`),`<button class="primary-button" data-mini="start">再来一次</button><button class="secondary-button" data-mini="assist">慢慢来</button><button class="secondary-button" data-mini="close">回到山谷</button>`);
}
function bark(){if(!game?.running||kind!=='sheep'||game.barkCooldown>0)return;game.barks++;game.barkTimer=.65;game.barkCooldown=1.8;options.sound?.(220,.1);setTimeout(()=>options?.sound?.(300,.1),100);}
function updateSheep(dt){
  const g=game,d=g.dog;
  let vx=(g.keys.has('d')||g.keys.has('arrowright')?1:0)-(g.keys.has('a')||g.keys.has('arrowleft')?1:0),vy=(g.keys.has('s')||g.keys.has('arrowdown')?1:0)-(g.keys.has('w')||g.keys.has('arrowup')?1:0);
  if(vx||vy){const n=Math.hypot(vx,vy);d.x+=vx/n*240*dt;d.y+=vy/n*240*dt;d.tx=d.x;d.ty=d.y;}else{const dx=d.tx-d.x,dy=d.ty-d.y,n=Math.hypot(dx,dy);if(n>2){d.x+=dx/n*Math.min(n,235*dt);d.y+=dy/n*Math.min(n,235*dt);}}
  d.x=clamp(d.x,20,970);d.y=clamp(d.y,90,565);g.barkTimer=Math.max(0,g.barkTimer-dt);g.barkCooldown=Math.max(0,g.barkCooldown-dt);
  g.sheep.forEach((s,i)=>{
    if(s.home)return;
    const dx=s.x-d.x,dy=s.y-d.y,n=Math.hypot(dx,dy)||1,radius=g.barkTimer>0?245:157;
    let sx=Math.sin(g.elapsed*.5+i*2)*2,sy=Math.cos(g.elapsed*.4+i*3)*2;
    if(n<radius){const speed=32+(1-n/radius)*(g.barkTimer>0?170:120);sx+=dx/n*speed;sy+=dy/n*speed;}
    for(let j=0;j<g.sheep.length;j++){if(j===i||g.sheep[j].home)continue;const o=g.sheep[j],ox=s.x-o.x,oy=s.y-o.y,on=Math.hypot(ox,oy)||1;if(on<56){sx+=ox/on*(56-on)*.55;sy+=oy/on*(56-on)*.55;}else if(on<190&&n<radius){sx-=ox*.035;sy-=oy*.035;}}
    if(s.x>710&&n<radius)sy+=(345-s.y)*.25;
    s.x=clamp(s.x+sx*dt,55,945);s.y=clamp(s.y+sy*dt,225,525);
    if(s.x>825&&s.y>265&&s.y<435){s.home=true;s.x=860+(i%2)*53;s.y=315+Math.floor(i/2)*62;g.captured++;options.sound?.(520+i*55,.2);}
  });
  if(g.captured===4)complete(true);
  $('#challenge-score').textContent=`${g.captured} / 4 已回家${g.assisted?' · 自在练习':` · ${Math.ceil(g.remaining)} 秒`}`;
}
function drawSheep(){
  const g=game;drawBackground(g.image);
  ctx.fillStyle='#4c704414';ctx.fillRect(0,0,1000,600);
  ctx.fillStyle='#e8efcc20';rounded(815,265,155,170,20);ctx.fill();ctx.strokeStyle='#fff8dcbd';ctx.lineWidth=3;ctx.setLineDash([10,7]);rounded(815,265,155,170,20);ctx.stroke();ctx.setLineDash([]);
  ctx.fillStyle='#fff9e5';ctx.font='17px sans-serif';ctx.textAlign='center';ctx.fillText('安全围栏',892,247);ctx.font='26px sans-serif';ctx.fillText('→',785,355);
  g.sheep.forEach((s,i)=>{ctx.fillStyle='#284b3325';ctx.beginPath();ctx.ellipse(s.x,s.y+2,28,9,0,0,Math.PI*2);ctx.fill();stamp(14,s.x,s.y,85,87,s.x<g.dog.x);if(s.home){ctx.fillStyle='#fffbe8';ctx.font='16px sans-serif';ctx.fillText('✓',s.x,s.y-80);}});
  if(g.barkTimer>0){ctx.strokeStyle=`rgba(255,249,218,${g.barkTimer})`;ctx.lineWidth=3;ctx.beginPath();ctx.arc(g.dog.x,g.dog.y-20,40+(1-g.barkTimer/.65)*180,0,Math.PI*2);ctx.stroke();}
  ctx.fillStyle='#284b3330';ctx.beginPath();ctx.ellipse(g.dog.x,g.dog.y+2,23,8,0,0,Math.PI*2);ctx.fill();stamp(g.dog.tx<g.dog.x?7:5,g.dog.x,g.dog.y,100,85);
  if(Math.hypot(g.dog.tx-g.dog.x,g.dog.ty-g.dog.y)>10){ctx.strokeStyle='#fffbe8a0';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(g.dog.tx,g.dog.ty,10,5,0,0,Math.PI*2);ctx.stroke();}
}
function random(){game.seed=(game.seed*1664525+1013904223)>>>0;return game.seed/4294967296;}
function updateKite(dt){
  const g=game,k=g.kite;const wind=Math.sin(g.elapsed*.7)*28;
  k.vy+=((k.pull?-290:180)+wind)*dt;k.vy=clamp(k.vy,-190,165);k.y+=k.vy*dt;
  if(k.y<100){k.y=100;k.vy=15;}if(k.y>505){k.y=505;k.vy=-10;}
  g.spawn-=dt;if(g.spawn<=0){g.rings.push({x:1070,y:145+random()*310,hit:false,miss:false});g.spawn=2.65;g.attempts++;}
  g.rings.forEach(r=>{r.x-=135*dt;if(!r.hit&&!r.miss&&Math.abs(r.x-260)<36&&Math.abs(r.y-k.y)<58){r.hit=true;g.collected++;options.sound?.(587.33+g.collected*30,.18);}if(r.x<220&&!r.hit)r.miss=true;});g.rings=g.rings.filter(r=>r.x>-80);
  $('#challenge-score').textContent=`${g.collected} 个风环${g.assisted?' · 自在练习':` · ${Math.ceil(g.remaining)} 秒`}`;
  if(g.assisted&&g.collected>=5)complete(true);
}
function drawKite(){
  const g=game;drawBackground(g.image);ctx.fillStyle='#76a8c910';ctx.fillRect(0,0,1000,600);
  g.rings.forEach(r=>{ctx.save();ctx.globalAlpha=r.miss?.25:r.hit?.45:1;ctx.strokeStyle=r.hit?'#d9f4af':'#fff9dfa8';ctx.lineWidth=r.hit?8:5;ctx.setLineDash(r.hit?[]:[12,9]);ctx.beginPath();ctx.ellipse(r.x,r.y,42,61,0,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);if(r.hit){ctx.fillStyle='#fffbe6';ctx.font='27px sans-serif';ctx.textAlign='center';ctx.fillText('✓',r.x,r.y+9);}ctx.restore();});
  const x=260,y=g.kite.y;ctx.strokeStyle='#fff5d9b0';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(340,590);ctx.quadraticCurveTo(x+130,y+180,x,y+25);ctx.stroke();
  ctx.save();ctx.translate(x,y);ctx.rotate(Math.sin(g.elapsed*2)*.08+(g.kite.pull?-.08:.08));ctx.scale(.85,.85);ctx.beginPath();ctx.moveTo(-12,-47);ctx.lineTo(43,-18);ctx.lineTo(15,40);ctx.lineTo(-37,16);ctx.closePath();ctx.clip();ctx.drawImage(g.image,552,20,108,108,-48,-54,108,108);ctx.restore();
  ctx.strokeStyle='#e9bf75';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(x+13,y+35);ctx.bezierCurveTo(x+40,y+63,x-18,y+75,x+15,y+106);ctx.stroke();
  ctx.fillStyle='#fffbe9dd';ctx.font='14px sans-serif';ctx.textAlign='left';ctx.fillText(g.kite.pull?'↑ 正在拉紧风筝线':'↓ 放松，让风筝滑翔',30,40);
}
function tick(now){
  if(!game)return;const dt=Math.max(0,Math.min(.035,(now-last)/1000||0));last=now;
  if(!document.hidden&&game.running){game.elapsed+=dt;if(!game.assisted)game.remaining-=dt;if(kind==='sheep')updateSheep(dt);else updateKite(dt);if(game?.running&&game.remaining<=0&&!game.assisted)complete(kind==='kite'&&game.collected>=3);}
  if(game){if(kind==='sheep'&&game.sheep)drawSheep();else if(game.kite)drawKite();else drawBackground(game.image);frame=requestAnimationFrame(tick);}
}
canvas.addEventListener('pointerdown',e=>{if(!game?.running)return;e.preventDefault();canvas.setPointerCapture(e.pointerId);game.pointer=true;const p=coords(e);if(kind==='sheep'){game.dog.tx=p.x;game.dog.ty=p.y;}else game.kite.pull=true;});
canvas.addEventListener('pointermove',e=>{if(!game?.running||!game.pointer)return;const p=coords(e);if(kind==='sheep'){game.dog.tx=p.x;game.dog.ty=p.y;}});
function release(){if(game){game.pointer=false;if(game.kite)game.kite.pull=false;}}
canvas.addEventListener('pointerup',release);canvas.addEventListener('pointercancel',release);
window.addEventListener('keydown',e=>{if(!game?.running)return;const key=e.key.toLowerCase();if([' ','arrowup','arrowdown','arrowleft','arrowright','w','a','s','d'].includes(key)){e.preventDefault();game.keys.add(key);if(key===' '){if(kind==='sheep'){if(!e.repeat)bark();}else game.kite.pull=true;}}});
window.addEventListener('keyup',e=>{if(!game)return;game.keys?.delete(e.key.toLowerCase());if(e.key===' '&&game.kite)game.kite.pull=false;});
window.addEventListener('blur',()=>{release();game?.keys?.clear();});
document.addEventListener('visibilitychange',()=>{release();game?.keys?.clear();last=performance.now();});
$('#challenge-special').addEventListener('pointerdown',e=>{e.preventDefault();if(kind==='sheep')bark();else if(game?.running)game.kite.pull=true;});
$('#challenge-special').addEventListener('pointerup',release);$('#challenge-special').addEventListener('pointercancel',release);$('#challenge-special').addEventListener('pointerleave',release);
modal.addEventListener('click',e=>{const b=e.target.closest('[data-mini]');if(!b)return;if(b.dataset.mini==='close')stopChallenge();else beginRun(b.dataset.mini==='assist');});
$('#close-challenge').addEventListener('click',stopChallenge);modal.addEventListener('cancel',()=>stopChallenge());modal.addEventListener('close',()=>{if(game){cancelAnimationFrame(frame);game=null;}});
// Read-only snapshots make challenge bug reports reproducible.
export function challengeSnapshot(){if(!game)return null;return {kind,running:game.running,elapsed:game.elapsed,captured:game.captured,collected:game.collected,dog:game.dog?{...game.dog}:null,sheep:game.sheep?.map(s=>({...s})),kite:game.kite?{...game.kite}:null,rings:game.rings?.map(r=>({...r}))};}
