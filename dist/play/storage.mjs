import {normalize} from './engine.mjs';
const KEY='meadowbell-windbell-save-v1';
let database=null,queue=Promise.resolve();
function databaseReady(){if(database)return database;database=new Promise((resolve,reject)=>{if(!window.indexedDB)return reject(new Error('浏览器未提供本地数据库。'));const r=indexedDB.open('meadowbell-windbell',1);r.onupgradeneeded=()=>r.result.createObjectStore('slots');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);r.onblocked=()=>reject(new Error('请关闭其他正在升级的游戏标签页后重试。'));});return database;}
function request(req){return new Promise((resolve,reject)=>{req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
async function readSlots(){const db=await databaseReady();const tx=db.transaction('slots','readonly'),store=tx.objectStore('slots');return await Promise.all(['current','backup1','backup2','backup3'].map(k=>request(store.get(k))));}
export async function loadSaved(){
  let slots=[];try{slots=await readSlots();}catch(_){}
  try{const local=JSON.parse(localStorage.getItem(KEY)||'null');if(local)slots.push(local);}catch(_){}
  const valid=[];for(let i=0;i<slots.length;i++){try{if(slots[i])valid.push({state:normalize(slots[i]),recovered:i>0});}catch(_){}}
  valid.sort((a,b)=>(b.state.updatedAt||0)-(a.state.updatedAt||0));return valid[0]||null;
}
async function persist(s){
  let local=false;try{localStorage.setItem(KEY,JSON.stringify(s));local=true;}catch(_){}
  try{
    const previous=await readSlots();const db=await databaseReady();
    await new Promise((resolve,reject)=>{const tx=db.transaction('slots','readwrite'),store=tx.objectStore('slots');store.put(previous[2]||previous[1]||s,'backup3');store.put(previous[1]||previous[0]||s,'backup2');store.put(previous[0]||s,'backup1');store.put(s,'current');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});
    return {ok:true,backup:true};
  }catch(e){return {ok:local,backup:false,message:local?'进度已保存，备份暂不可用。':'无法写入浏览器存储，请导出存档保留进度。'};}
}
export function saveGame(state){const copy=structuredClone(state);queue=queue.catch(()=>{}).then(()=>persist(copy));return queue;}
export async function backupStates(){try{const slots=await readSlots();return slots.slice(1).map(s=>{try{return normalize(s);}catch(_){return null;}}).filter(Boolean);}catch(_){return [];}}
export function downloadSave(s){const a=document.createElement('a');const url=URL.createObjectURL(new Blob([JSON.stringify(s,null,2)],{type:'application/json'}));a.href=url;a.download=`风铃谷_第${s.day}天_存档.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
export async function readSaveFile(file){if(!file||file.size>2_000_000)throw new Error('请选择小于 2MB 的游戏 JSON 存档。');let raw;try{raw=JSON.parse(await file.text());}catch(_){throw new Error('这不是有效的 JSON 存档文件。');}return normalize(raw);}
