export const VERSION = 1;
export const CROPS = {
  radish:{name:'萝卜',days:1,yield:2,seed:'萝卜种子',sprite:8,matureSprite:9},
  bean:{name:'豆子',days:2,yield:3,seed:'豆子种子',sprite:10,matureSprite:11},
  daisy:{name:'雏菊',days:2,yield:1,seed:'雏菊种子',sprite:12,matureSprite:13},
};
export const WEATHER = ['sun','sun','rain','sun','rain','sun','sun'];
export const weather = day => WEATHER[(day-1)%WEATHER.length];
export function freshState(){
  return {version:VERSION,day:1,ap:6,scene:'garden',x:81,y:87,
    inventory:{wood:2,stone:1,fiber:1,radish:0,bean:0,daisy:0},
    seeds:{radish:3,bean:2,daisy:1},plots:[null,null,null,null],fertile:[false,false,false,false],
    flags:{clue:false,latch:false,bridge:false,gate:false,source:false,connected:false,pond:false,chapter:false,order:false,frame:false,kite:false,sheep:false},
    flow:'split',row:0,channels:[0,0,0,0],gatherDay:0,fetchDay:0,
    discoveries:[],records:[],journal:[],deliveryDay:0,stats:{harvests:0,actions:0,kiteBest:0,sheepBest:0,deliveries:0},
    settings:{sound:false,motion:true,hints:true},seed:271828,updatedAt:Date.now()};
}
export function normalize(raw){
  if(!raw||typeof raw!=='object'||raw.version!==VERSION) throw new Error('这份存档版本暂不支持。');
  const n=freshState();
  if(!Number.isInteger(raw.day)||raw.day<1||raw.day>99999||!Number.isInteger(raw.ap)||raw.ap<0||raw.ap>6) throw new Error('存档日期或行动点无效。');
  for(const key of Object.keys(n.inventory))if(!Number.isInteger(raw.inventory?.[key])||raw.inventory[key]<0||raw.inventory[key]>999999)throw new Error('存档背包数据无效。');
  for(const key of Object.keys(CROPS))if(!Number.isInteger(raw.seeds?.[key])||raw.seeds[key]<0||raw.seeds[key]>999999)throw new Error('存档种子数据无效。');
  if(!Array.isArray(raw.plots)||raw.plots.length!==4)throw new Error('存档菜园数据无效。');
  for(const p of raw.plots)if(p&&(!CROPS[p.crop]||!Number.isInteger(p.growth)||p.growth<0||p.growth>3||!Number.isInteger(p.need)||p.need<1||p.need>2))throw new Error('存档作物数据无效。');
  if(!['garden','meadow','creek','pasture','kite'].includes(raw.scene))throw new Error('存档地点无效。');
  if(!['garden','split','pond'].includes(raw.flow))throw new Error('存档水路数据无效。');
  if(!Array.isArray(raw.channels)||raw.channels.length!==4||raw.channels.some(x=>!Number.isInteger(x)||x<0||x>3))throw new Error('存档水槽数据无效。');
  const flags={...n.flags},stats={...n.stats},settings={...n.settings};
  for(const k of Object.keys(flags)){if(raw.flags?.[k]!==undefined&&typeof raw.flags[k]!=='boolean')throw new Error('存档任务标记无效。');flags[k]=raw.flags?.[k]??flags[k];}
  for(const k of Object.keys(stats)){if(raw.stats?.[k]!==undefined&&(!Number.isInteger(raw.stats[k])||raw.stats[k]<0||raw.stats[k]>999999))throw new Error('存档记录无效。');stats[k]=raw.stats?.[k]??stats[k];}
  for(const k of Object.keys(settings))settings[k]=typeof raw.settings?.[k]==='boolean'?raw.settings[k]:settings[k];
  const safeDay=d=>Number.isInteger(d)&&d>0&&d<=raw.day?d:raw.day;
  return {...n,...raw,inventory:{...n.inventory,...raw.inventory},seeds:{...n.seeds,...raw.seeds},flags,stats,settings,
    row:raw.row===1?1:0,x:Number.isFinite(raw.x)?Math.max(3,Math.min(97,raw.x)):81,y:Number.isFinite(raw.y)?Math.max(45,Math.min(97,raw.y)):87,
    fertile:Array.isArray(raw.fertile)&&raw.fertile.length===4?raw.fertile.map(Boolean):[false,false,false,false],
    discoveries:Array.isArray(raw.discoveries)?raw.discoveries.filter(x=>typeof x==='string').slice(0,100):[],
    records:Array.isArray(raw.records)?raw.records.filter(x=>x&&typeof x.label==='string').slice(-100).map(x=>({id:typeof x.id==='string'?x.id.slice(0,60):'',label:x.label.slice(0,300),day:safeDay(x.day)})):[],
    journal:Array.isArray(raw.journal)?raw.journal.filter(x=>x&&typeof x.text==='string').slice(-100).map(x=>({text:x.text.slice(0,1000),day:safeDay(x.day)})):[]};
}
export const mature = p => !!p && p.growth >= p.need;
export function irrigated(s,index){
  if(weather(s.day)==='rain')return true;
  if(!s.flags.connected)return false;
  return s.flow==='garden'||(s.flow==='split'&&Math.floor(index/2)===s.row);
}
export function watered(s,i){return !!s.plots[i]?.watered||irrigated(s,i);}
export function yieldFor(s,index){
  const p=s.plots[index];if(!p)return 0;
  const adjacent=[index^1,index^2];
  const bonus=p.crop!=='daisy'&&adjacent.some(i=>s.plots[i]?.crop==='daisy'&&mature(s.plots[i]))?1:0;
  return CROPS[p.crop].yield+bonus;
}
export function progress(s){
  if(s.flags.chapter)return 6;
  if(s.flags.pond&&s.stats.harvests)return 5;
  if(s.flags.connected)return 4;
  if(s.flags.source)return 3;
  if(s.flags.bridge||s.flags.gate)return 2;
  if(s.flags.clue)return 1;
  return 0;
}
export function goal(s){
  if(!s.flags.clue)return {title:'让溪水回来',text:s.stats.actions===0?'先在菜园种一颗萝卜，再带豆丁去溪谷。':'去溪谷，让豆丁嗅一嗅干涸的水渠。',scene:'creek'};
  if(!s.flags.bridge&&!s.flags.gate)return {title:'找到上游的路',text:s.flags.latch?'门闩找到了，去打开灌木旁的侧门。':'修好木桥，或让豆丁穿过矮洞取回门闩。',scene:'creek'};
  if(!s.flags.source)return {title:'疏通山泉',text:'沿新开的路到达泉眼，清理堵塞的落叶。',scene:'creek'};
  if(!s.flags.connected)return {title:'接通两条水路',text:'转动水槽，让溪水同时流向菜园和浅池。',scene:'creek'};
  if(!s.flags.pond)return {title:'给山谷一晚时间',text:'保持菜园与浅池各分一份水，回山坡休息到明天。',scene:'meadow'};
  if(!s.stats.harvests)return {title:'收获第一份喜悦',text:'回菜园收获成熟作物。没有种子时可以查看种子盒。',scene:'garden'};
  if(!s.flags.chapter)return {title:'告诉米拉好消息',text:'看看菜园旁的信箱，为修复溪流的故事写下结尾。',scene:'garden'};
  return {title:'山谷正在生长',text:'试试赶羊、放风筝，或为菜园安排新的种植组合。',scene:'pasture'};
}
function log(s,text){s.journal.push({day:s.day,text});s.journal=s.journal.slice(-100);}
function rewardOnce(s,flag,apply){if(s.flags[flag])return false;s.flags[flag]=true;apply?.();return true;}
export function routeOpen(s){return s.flags.bridge||s.flags.gate;}
export function dailyOrder(s){return [{crop:'radish',amount:4,seed:'bean',seeds:3,material:'fiber',label:'米拉的萝卜汤'},{crop:'bean',amount:3,seed:'daisy',seeds:2,material:'wood',label:'牧场的一篮青豆'},{crop:'daisy',amount:1,seed:'radish',seeds:3,material:'stone',label:'阿葵窗前的小花束'}][(s.day-1)%3];}
function requireAP(s,n=1){if(s.ap<n)throw new Error('今天的行动时段用完了。可以自由散步，或去山坡休息到明天。');}
function spend(s,n=1){s.ap-=n;s.stats.actions+=n;}
function materials(s,cost){for(const [k,v]of Object.entries(cost))if(s.inventory[k]<v)throw new Error(`还需要${k==='wood'?'木材':k==='fiber'?'纤维':'石料'} ${v} 份。`);for(const[k,v]of Object.entries(cost))s.inventory[k]-=v;}
export function act(state,type,payload={}){
  const s=structuredClone(state);let message='';let used=0;
  try{
    switch(type){
      case 'plant':{
        const i=payload.index,crop=payload.crop;if(!Number.isInteger(i)||i<0||i>3||!CROPS[crop])throw new Error('请选择有效的地块与种子。');
        if(s.plots[i])throw new Error('这里已经有植物了。');if(!s.seeds[crop])throw new Error('这种种子用完了，可以去种子盒或用收成换取。');
        requireAP(s);s.seeds[crop]--;s.plots[i]={crop,growth:0,need:Math.max(1,CROPS[crop].days-(s.fertile[i]?1:0)),watered:false};s.fertile[i]=false;spend(s);used=1;message=`种下了${CROPS[crop].name}。记得浇水，休息后它就会长大。`;break;
      }
      case 'water':{
        const indices=payload.indices||[payload.index];if(!Array.isArray(indices)||!indices.length||indices.length>2)throw new Error('一次可照顾一到两格植物。');
        const valid=[...new Set(indices)].filter(i=>Number.isInteger(i)&&i>=0&&i<4&&s.plots[i]&&!watered(s,i)&&!mature(s.plots[i]));
        if(!valid.length)throw new Error('这些植物今天已经不缺水了。');requireAP(s);valid.forEach(i=>s.plots[i].watered=true);spend(s);used=1;message=`浇好了 ${valid.length} 格菜园。今天结束时，它们会成长。`;break;
      }
      case 'harvest':{
        const i=payload.index;if(!Number.isInteger(i)||i<0||i>3||!mature(s.plots[i]))throw new Error('这株植物还没成熟。');requireAP(s);const p=s.plots[i],n=yieldFor(s,i);s.inventory[p.crop]+=n;s.fertile[i]=p.crop==='bean';s.plots[i]=null;s.stats.harvests++;spend(s);used=1;message=`收获了 ${n} 份${CROPS[p.crop].name}${n>CROPS[p.crop].yield?'，还有邻近雏菊带来的加成！':'！'}`;log(s,message);break;
      }
      case 'clue':{if(rewardOnce(s,'clue')){log(s,'豆丁闻到了潮湿石头的气味。上游还有水！');message='豆丁找到两条路：修木桥，或从灌木矮洞找回门闩。';}else message='气味沿着潮湿的石头一直通向上游。';break;}
      case 'bridge':{if(s.flags.bridge)throw new Error('木桥已经修好了。');if(!s.flags.clue)throw new Error('先让豆丁嗅闻，找出通往上游的线索。');requireAP(s);materials(s,{wood:2});s.flags.bridge=true;spend(s);used=1;message='木桥修好了！你们可以去上游泉眼了。';log(s,'用两份木材修好了溪谷的桥。');break;}
      case 'fetch':{if(s.flags.latch)throw new Error('门闩已经找回来了。');if(!s.flags.clue)throw new Error('先让豆丁嗅一嗅附近。');requireAP(s);s.flags.latch=true;spend(s);used=1;message='豆丁钻过矮洞，叼回了旧门闩。去打开侧门吧！';log(s,'豆丁从矮洞后面找回了门闩。');break;}
      case 'gate':{if(s.flags.gate)throw new Error('侧门已经打开了。');if(!s.flags.latch)throw new Error('门闩在矮洞后面，豆丁可以帮你取回来。');requireAP(s);s.flags.gate=true;spend(s);used=1;message='装好门闩，侧门打开了！上游就在前面。';log(s,'和豆丁一起打开了溪谷侧门。');break;}
      case 'source':{if(s.flags.source)throw new Error('泉眼已经恢复了。');if(!routeOpen(s))throw new Error('先修桥或打开侧门，才能安全抵达泉眼。');requireAP(s);s.flags.source=true;spend(s);used=1;message='落叶清开了，清澈的泉水重新涌出。接下来去调整水槽。';log(s,'清理了泉眼，山泉重新涌出。');break;}
      case 'connect':{if(!s.flags.source)throw new Error('需要先恢复上游水源。');if(s.flags.connected)throw new Error('水路已经接通，可以用分流器安排用水。');if(!validChannels(payload.channels))throw new Error('水路还没接通：每块水槽的开口都要沿线连接。');requireAP(s);s.channels=[...payload.channels];s.flags.connected=true;s.flow='split';spend(s);used=1;message='溪水通向了菜园与浅池！保持一比一分水，休息一晚看看变化。';log(s,'接通水槽，让溪水回到菜园和浅池。');break;}
      case 'flow':{if(!s.flags.connected)throw new Error('先接通水槽，再安排每日分水。');if(!['garden','split','pond'].includes(payload.flow))throw new Error('请选择有效分水方式。');const row=payload.row===1?1:0;if(s.flow===payload.flow&&s.row===row)throw new Error('当前已经是这项分水安排。');requireAP(s);s.flow=payload.flow;s.row=row;spend(s);used=1;message='分水安排已更新，以今晚休息时的配置为准。';break;}
      case 'gather':{if(s.gatherDay===s.day)throw new Error('今天的枯枝已经收集过了，明天再来。');requireAP(s);s.inventory.wood+=2;s.gatherDay=s.day;spend(s);used=1;message='捡到了 2 份木材。倒下的枯枝明天还会带来新的材料。';break;}
      case 'seedbox':{if(Object.values(s.seeds).some(n=>n>0)||s.plots.some(Boolean))throw new Error('种子盒里的补给留给真正没有种子和作物的时候。也可以用收成换种子。');s.seeds.radish=1;message='种子盒里还有一颗萝卜种子，新的开始就在这里。';break;}
      case 'trade':{const crop=payload.crop;if(!CROPS[crop])throw new Error('请选择种子。');const produce=['radish','bean','daisy'].find(k=>s.inventory[k]>0);if(!produce)throw new Error('带一份收成来，就能换两颗种子。');s.inventory[produce]--;s.seeds[crop]+=2;message=`用一份${CROPS[produce].name}换到了两颗${CROPS[crop].name}种子。`;break;}
      case 'order':{if(s.flags.order)throw new Error('米拉已经收到你的萝卜啦。');if(s.inventory.radish<2)throw new Error('带来 2 份萝卜，米拉就能准备晚餐。');s.inventory.radish-=2;s.inventory.fiber++;s.flags.order=true;message='米拉收下了萝卜，送给你一份纤维和花床边框的做法。';log(s,'把第一份收成分享给米拉。');break;}
      case 'frame':{if(s.flags.frame)throw new Error('花床边框已经做好了。');if(!s.flags.order)throw new Error('先完成米拉的萝卜委托，获得边框做法。');requireAP(s);materials(s,{wood:2,fiber:1});s.flags.frame=true;spend(s);used=1;message='菜园有了新的木边框，这里越来越像你的家了。';break;}
      case 'delivery':{if(!s.flags.chapter)throw new Error('先把溪水带回山谷，再来接村民的小委托。');if(s.deliveryDay===s.day)throw new Error('今天的委托已经完成，明天会有新的需要。');const o=dailyOrder(s);if(s.inventory[o.crop]<o.amount)throw new Error(`这个委托需要 ${o.amount} 份${CROPS[o.crop].name}。`);s.inventory[o.crop]-=o.amount;s.seeds[o.seed]+=o.seeds;s.inventory[o.material]++;s.deliveryDay=s.day;s.stats.deliveries++;message=`完成了${o.label}，得到 ${o.seeds} 颗${CROPS[o.seed].name}种子和一份材料。`;log(s,message);break;}
      case 'finish':{if(s.flags.chapter)throw new Error('这一段故事已经记进日记。');if(!s.flags.pond||!s.stats.harvests)throw new Error('让浅池在一晚之后恢复生机，并完成一次收获，再来告诉米拉。');s.flags.chapter=true;message='第一章完成：让溪水回来。你和豆丁真的改变了这座山谷。';log(s,'完成第一章，让溪水回到风铃谷。');break;}
      case 'discover':{const id=payload.id;if(typeof id!=='string'||!id||id.length>60)throw new Error('没有发现可记录的线索。');if(s.discoveries.includes(id))throw new Error('这个发现已经画进自然手记。');s.discoveries.push(id);s.records.push({id,label:payload.label||id,day:s.day});message=`已记录：${payload.label||id}。`;break;}
      case 'sheep':{const score=Math.round(payload.score);if(!Number.isFinite(score)||score<0||score>10000)throw new Error('挑战成绩无效。');s.stats.sheepBest=Math.max(s.stats.sheepBest,score);if(rewardOnce(s,'sheep')){s.seeds.bean+=2;message='羊群安全回家！牧场主人送给你两颗豆子种子。';log(s,'和豆丁一起把羊群带回围栏。');}else message=`羊群回家了！本次得分 ${score}，最佳 ${s.stats.sheepBest}。`;break;}
      case 'kite':{const score=Math.round(payload.score);if(!Number.isFinite(score)||score<0||score>10000)throw new Error('挑战成绩无效。');s.stats.kiteBest=Math.max(s.stats.kiteBest,score);if(rewardOnce(s,'kite')){s.seeds.daisy+=2;message='风筝飞过了山坡！阿葵送给你两颗雏菊种子。';log(s,'和阿葵一起让风筝乘上了风。');}else message=`风筝挑战得分 ${score}，最佳 ${s.stats.kiteBest}。`;break;}
      case 'rest':{
        let grew=0,ripe=0;s.plots.forEach((p,i)=>{if(p&&!mature(p)&&watered(s,i)){p.growth++;grew++;if(mature(p))ripe++;}if(p)p.watered=false;});
        if(s.flags.connected&&s.flow!=='garden'){if(!s.flags.pond)log(s,'浅池重新有了水，青蛙回来了。');s.flags.pond=true;}
        s.day++;s.ap=6;message=`新的一天。${grew?`${grew} 株植物长大了${ripe?`，其中 ${ripe} 株已经成熟`:'一格'}。`:'今天也有新的发现等着你。'}`;log(s,`第 ${s.day} 天开始，${weather(s.day)==='rain'?'一场温柔的雨来了。':'阳光洒满山谷。'}`);break;
      }
      default:throw new Error('这个动作还没有准备好。');
    }
    s.updatedAt=Date.now();return {ok:true,state:s,message,used};
  }catch(e){return {ok:false,state,message:e.message,used:0};}
}
// Four reciprocal elbow pieces form a closed return circuit; the junction then
// distributes the spring water to the garden and pond.
// Piece orientations: 0=N+E, 1=E+S, 2=S+W, 3=W+N.
export const CHANNEL_PORTS=[[0,1],[1,2],[2,3],[3,0]];
export function validChannels(a){
  if(!Array.isArray(a)||a.length!==4||a.some(n=>!Number.isInteger(n)||n<0||n>3))return false;
  const delta=[[0,-1],[1,0],[0,1],[-1,0]],edges=a.map(()=>[]);
  for(let i=0;i<4;i++)for(const p of CHANNEL_PORTS[a[i]]){const x=i%2+delta[p][0],y=Math.floor(i/2)+delta[p][1];if(x<0||x>1||y<0||y>1)return false;const j=y*2+x;if(!CHANNEL_PORTS[a[j]].includes((p+2)%4))return false;edges[i].push(j);}
  const seen=new Set([0]),todo=[0];while(todo.length){for(const j of edges[todo.pop()])if(!seen.has(j)){seen.add(j);todo.push(j);}}return seen.size===4;
}
export function restPreview(s){return s.plots.map((p,i)=>p?{index:i,crop:p.crop,grow:!mature(p)&&watered(s,i),ripe:!mature(p)&&watered(s,i)&&p.growth+1>=p.need}:null).filter(Boolean);}
