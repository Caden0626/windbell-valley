// All world and character artwork is raster art. The sprite atlas is keyed at
// runtime, which preserves its painted edges without a generated white matte.
export const ASSET_VERSION='windbell-0.1';
export const SCENES={
  garden:{name:'小小菜园',en:'THE COTTAGE GARDEN',src:'assets/garden-play.png',thumb:'assets/garden.webp',ratio:1477/1066,spawn:[84,88],caption:'泥土里藏着，明天的小小惊喜。'},
  meadow:{name:'风铃山坡',en:'THE MEADOW OF BEGINNINGS',src:'assets/hillside.jpg',thumb:'assets/hillside.jpg',ratio:9/8,spawn:[55,78],caption:'有时候，躺下来听风也是一件正经事。',rest:true},
  creek:{name:'回声溪谷',en:'THE WHISPERING CREEK',src:'assets/creek-atlas.png',thumb:'assets/creek-atlas.png',ratio:1.5,spawn:[25,87],atlas:true,caption:'豆丁停下了脚步。空气里，有一点潮湿的气味。'},
  pasture:{name:'云边牧场',en:'THE SHEEP ABOVE THE SEA',src:'assets/pasture-play.png',thumb:'assets/pasture.webp',ratio:1477/1066,spawn:[53,87],caption:'羊群走得很慢，海风却已经翻过了山。'},
  kite:{name:'追风山丘',en:'WHERE THE WIND TAKES US',src:'assets/kitehill.webp',thumb:'assets/kitehill.webp',ratio:756/546,spawn:[61,89],caption:'阿葵说，风也有自己的方向。'},
};
const rects=[
  [75,12,185,367],[390,12,180,367],[702,12,190,367],[1012,12,185,367],
  [75,397,185,225],[340,397,280,225],[705,397,185,225],[960,397,280,225],
  [12,745,285,190],[315,625,310,310],[640,730,295,205],[945,625,300,310],
  [12,1068,285,175],[307,944,310,300],[624,944,310,295],[940,993,310,252],
];
export const images=new Map();
let atlas=null;
const spriteCache=new Map();
export function loadImage(src){if(images.has(src))return Promise.resolve(images.get(src));return new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>{images.set(src,im);resolve(im);};im.onerror=()=>reject(new Error('这幅风景暂时没有加载成功，请检查连接后重试。'));im.src=src;});}
export async function prepareArt(){
  if(atlas)return;
  const image=await loadImage('assets/cast-and-garden.png');
  const c=document.createElement('canvas');c.width=image.naturalWidth;c.height=image.naturalHeight;
  const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0);
  const pixels=ctx.getImageData(0,0,c.width,c.height),d=pixels.data;
  for(let i=0;i<d.length;i+=4){const r=d[i],g=d[i+1],b=d[i+2];if(r>g+65&&b>g+65&&Math.min(r,b)>115){d[i+3]=0;}else if(r>g+40&&b>g+40&&Math.min(r,b)>110){const a=Math.max(0,1-(Math.min(r,b)-g-40)/35);d[i+3]=Math.round(255*a);}}
  ctx.putImageData(pixels,0,0);atlas=c;
}
export function sprite(index){
  if(spriteCache.has(index))return spriteCache.get(index);
  const c=document.createElement('canvas');c.width=320;c.height=360;
  if(atlas){const [x,y,w,h]=rects[index];const scale=Math.min(304/w,344/h);const dw=w*scale,dh=h*scale;c.getContext('2d').drawImage(atlas,x,y,w,h,(320-dw)/2,360-dh,dw,dh);}
  spriteCache.set(index,c);return c;
}
export function paintSprite(target,index){const im=sprite(index);const ctx=target.getContext('2d');ctx.clearRect(0,0,target.width,target.height);const scale=Math.min(target.width/im.width,target.height/im.height);const w=im.width*scale,h=im.height*scale;ctx.drawImage(im,(target.width-w)/2,target.height-h,w,h);}
export function mountSprites(root=document){root.querySelectorAll('canvas[data-sprite]').forEach(c=>paintSprite(c,Number(c.dataset.sprite)));}
export function spriteHTML(index,extra=''){return `<canvas class="sprite-canvas ${extra}" width="320" height="360" data-sprite="${index}" aria-hidden="true"></canvas>`;}
