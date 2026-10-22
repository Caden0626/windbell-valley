import test from 'node:test';
import assert from 'node:assert/strict';
import {freshState,act,normalize,weather,mature,watered,yieldFor,validChannels} from '../dist/play/engine.mjs';

function apply(s,type,payload){const r=act(s,type,payload);assert.equal(r.ok,true,r.message);return r.state;}
function restored(route='bridge'){
  let s=freshState();s=apply(s,'plant',{index:0,crop:'radish'});s=apply(s,'water',{index:0});s=apply(s,'clue');
  if(route==='bridge')s=apply(s,'bridge');else{s=apply(s,'fetch');s=apply(s,'gate');}
  s=apply(s,'source');s=apply(s,'connect',{channels:[1,2,0,3]});return s;
}
test('either upstream route completes the chapter without requiring the other',()=>{
  for(const route of ['bridge','gate']){
    let s=restored(route);assert.equal(s.ap,route==='bridge'?1:0);assert.equal(s.flags.bridge,route==='bridge');assert.equal(s.flags.gate,route==='gate');
    s=apply(s,'rest');assert.equal(s.flags.pond,true);assert.equal(mature(s.plots[0]),true);
    s=apply(s,'harvest',{index:0});s=apply(s,'finish');assert.equal(s.flags.chapter,true);assert.equal(s.day,2);
  }
});
test('failed actions neither spend time nor mutate inventory or the original state',()=>{
  const s=freshState(),before=structuredClone(s);for(const[type,payload]of [['source',{}],['connect',{channels:[0,0,0,0]}],['harvest',{index:0}],['plant',{index:9,crop:'bean'}]]){
    const r=act(s,type,payload);assert.equal(r.ok,false);assert.deepEqual(r.state,before);assert.deepEqual(s,before);
  }
  const poor={...freshState(),inventory:{...freshState().inventory,wood:0},flags:{...freshState().flags,clue:true}};assert.equal(act(poor,'bridge').ok,false);assert.equal(act(poor,'fetch').ok,true);
});
test('repeating a reward or a collection does not duplicate resources',()=>{
  let s=apply(freshState(),'gather');assert.equal(s.inventory.wood,4);assert.equal(act(s,'gather').ok,false);
  s=apply(s,'sheep',{score:1000});const beans=s.seeds.bean;s=apply(s,'sheep',{score:2000});assert.equal(s.seeds.bean,beans);assert.equal(s.stats.sheepBest,2000);
  s=apply(s,'kite',{score:600});const flowers=s.seeds.daisy;s=apply(s,'kite',{score:800});assert.equal(s.seeds.daisy,flowers);
});
test('plants grow exactly once overnight and dry plants safely pause',()=>{
  let s=apply(freshState(),'plant',{index:0,crop:'bean'});s=apply(s,'water',{index:0});s=apply(s,'clue');s=apply(s,'clue');assert.equal(s.plots[0].growth,0);
  s=apply(s,'rest');assert.equal(s.plots[0].growth,1);assert.equal(s.plots[0].watered,false);
  s=apply(s,'rest');assert.equal(s.plots[0].growth,1);assert.equal(weather(s.day),'rain');s=apply(s,'rest');assert.equal(s.plots[0].growth,2);
});
test('changing flow does not accumulate automatic watering across rows or pond',()=>{
  let s=restored();s.ap=6;s.plots=[0,1,2,3].map(()=>({crop:'bean',need:2,growth:0,watered:false}));
  s=apply(s,'flow',{flow:'garden'});s=apply(s,'flow',{flow:'split',row:1});
  assert.equal(watered(s,0),false);assert.equal(watered(s,2),true);s=apply(s,'rest');
  assert.deepEqual(s.plots.map(p=>p.growth),[0,0,1,1]);assert.equal(s.flags.pond,true);
  s=restored();s.ap=3;s=apply(s,'flow',{flow:'garden'});s=apply(s,'rest');assert.equal(s.flags.pond,false);
});
test('flower bonuses apply only orthogonally and never stack',()=>{
  const s=freshState();s.plots=[{crop:'radish',growth:1,need:1},null,null,{crop:'daisy',growth:2,need:2}];assert.equal(yieldFor(s,0),2);
  s.plots[1]={crop:'daisy',growth:2,need:2};s.plots[2]={crop:'daisy',growth:2,need:2};assert.equal(yieldFor(s,0),3);
});
test('bean fertility is consumed once and crops never require less than one night',()=>{
  let s=freshState();s.plots[0]={crop:'bean',growth:2,need:2};s=apply(s,'harvest',{index:0});assert.equal(s.fertile[0],true);s=apply(s,'plant',{index:0,crop:'radish'});assert.equal(s.plots[0].need,1);assert.equal(s.fertile[0],false);
});
test('a zero-material zero-seed state always has a free recovery route',()=>{
  let s=freshState();s.inventory.wood=0;s.seeds={radish:0,bean:0,daisy:0};s=apply(s,'seedbox');assert.equal(s.seeds.radish,1);assert.equal(act(s,'seedbox').ok,false);s=apply(s,'clue');s=apply(s,'fetch');s=apply(s,'gate');assert.equal(s.flags.gate,true);
});
test('saves round trip at every chapter stage and reject invalid files',()=>{
  let s=freshState();for(const[type,p]of [['plant',{index:0,crop:'radish'}],['water',{index:0}],['clue',{}],['bridge',{}],['source',{}],['connect',{channels:[1,2,0,3]}],['rest',{}],['harvest',{index:0}],['finish',{}]]){
    s=apply(s,type,p);const loaded=normalize(JSON.parse(JSON.stringify(s)));assert.deepEqual(loaded,s);
  }
  assert.throws(()=>normalize({...s,ap:-1}));assert.throws(()=>normalize({...s,version:99}));assert.throws(()=>normalize({...s,plots:[]}));assert.throws(()=>normalize({...s,inventory:{...s.inventory,wood:-10}}));
});
test('water puzzle validates the full circuit and zero AP still permits free observation',()=>{
  assert.equal(validChannels([1,2,0,3]),true);assert.equal(validChannels([1,2,0,2]),false);let s=freshState();s.ap=0;assert.equal(act(s,'clue').ok,true);assert.equal(act(s,'plant',{index:0,crop:'radish'}).ok,false);assert.equal(act(s,'rest').state.ap,6);
});
test('daily village deliveries spend produce once and rotate only after resting',()=>{
  let s=freshState();s.flags.chapter=true;s.inventory.radish=8;s=apply(s,'delivery');assert.equal(s.inventory.radish,4);assert.equal(s.stats.deliveries,1);assert.equal(act(s,'delivery').ok,false);s=apply(s,'rest');s.inventory.bean=3;s=apply(s,'delivery');assert.equal(s.stats.deliveries,2);assert.equal(s.inventory.bean,0);
});
test('imported journal fields cannot inject markup through date values',()=>{
  const s=freshState();s.journal=[{text:'<img onerror=alert(1)>',day:'<script>alert(1)</script>'}];const n=normalize(s);assert.equal(n.journal[0].day,1);assert.equal(typeof n.journal[0].text,'string');assert.throws(()=>normalize({...s,flags:{...s.flags,clue:'true'}}));
});
