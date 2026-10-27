#!/bin/bash
# Static server for PlexUW prototype (no deps). Serves /home/container on SERVER_PORT. Supports HTTP Range (206/416).
cd /home/container
exec node -e '
const http=require("http"),fs=require("fs"),path=require("path");
const T={".html":"text/html",".css":"text/css",".js":"application/javascript",".mp4":"video/mp4",".jpg":"image/jpeg",".png":"image/png",".svg":"image/svg+xml"};
const root=process.cwd(),port=process.env.SERVER_PORT||8080;
http.createServer((q,s)=>{let p;try{p=decodeURIComponent(q.url.split("?")[0]);}catch(e){s.writeHead(400);return s.end();}if(p==="/")p="/index.html";
const f=path.join(root,path.normalize(p));if(!f.startsWith(root)||p.includes("startup.sh")){s.writeHead(403);return s.end();}
fs.stat(f,(e,st)=>{if(e||!st.isFile()){s.writeHead(404);return s.end("not found");}
const type=T[path.extname(f)]||"application/octet-stream",size=st.size,r=q.headers.range;
if(r){const m=/^bytes=(\d*)-(\d*)$/.exec(r.trim());let a,b;
 if(m&&(m[1]!==""||m[2]!=="")){if(m[1]===""){a=Math.max(0,size-parseInt(m[2],10));b=size-1;}else{a=parseInt(m[1],10);b=m[2]===""?size-1:Math.min(parseInt(m[2],10),size-1);}}
 if(!m||a===undefined||isNaN(a)||isNaN(b)||a>b||a>=size||(m[1]===""&&parseInt(m[2],10)===0)){s.writeHead(416,{"Content-Range":"bytes */"+size,"Accept-Ranges":"bytes"});return s.end();}
 s.writeHead(206,{"Content-Type":type,"Content-Length":b-a+1,"Content-Range":"bytes "+a+"-"+b+"/"+size,"Accept-Ranges":"bytes"});
 if(q.method==="HEAD")return s.end();return fs.createReadStream(f,{start:a,end:b}).pipe(s);}
s.writeHead(200,{"Content-Type":type,"Content-Length":size,"Accept-Ranges":"bytes"});if(q.method==="HEAD")return s.end();fs.createReadStream(f).pipe(s);});
}).listen(port,"0.0.0.0",()=>console.log("PlexUW prototype listening on "+port));'
