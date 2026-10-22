import http from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {stat} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../dist');
const port=Number(process.env.WINDBELL_PORT||8765);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.mp4':'video/mp4','.woff2':'font/woff2','.ttf':'font/ttf','.txt':'text/plain; charset=utf-8'};
http.createServer(async(req,res)=>{try{const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(name.includes('\0'))throw new Error();let file=path.resolve(root,'.'+name);if(file!==root&&!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}let s=await stat(file);if(s.isDirectory()){file=path.join(file,'index.html');s=await stat(file);}if(!s.isFile())throw new Error();res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache','Content-Length':s.size});if(req.method==='HEAD')res.end();else createReadStream(file).pipe(res);}catch(_){res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});res.end('这条小路暂时没有开放。');}}).listen(port,'127.0.0.1',()=>console.log(`Windbell Valley: http://127.0.0.1:${port}/play/`));
