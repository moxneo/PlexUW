// PlexUW prototype v2. Mock data only; no network calls.
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)], D=MOCK;
const esc=s=>String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;");
const I=n=>`<svg class="ic"><use href="assets/icons.svg#${n}"/></svg>`;
const art=(m,w=200,h=300)=>{const a=m.hue,b=(m.hue+60)%360;
  const svg=`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${w} ${h}'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='hsl(${a},55%,32%)'/><stop offset='1' stop-color='hsl(${b},45%,12%)'/></linearGradient></defs><rect width='100%' height='100%' fill='url(#g)'/><circle cx='${w*.7}' cy='${h*.35}' r='${w*.28}' fill='hsl(${b},70%,60%)' opacity='.35'/><path d='M0 ${h*.8} L${w*.4} ${h*.55} L${w} ${h*.85} V${h} H0Z' fill='#000' opacity='.35'/><text x='12' y='${h-16}' font-family='sans-serif' font-size='${Math.min(w,h*1.2)/11}' fill='#fff' opacity='.85'>${esc(m.title)}</text></svg>`;
  return `url('data:image/svg+xml,${encodeURIComponent(svg).replace(/'/g,"%27")}')`};
const hms=s=>[3600,60,1].map(u=>String(Math.floor(s/u)%60).padStart(2,'0')).join(':');
// Plex playback duration comes from the item, never from a sample file and never a hardcoded 10s.
function dur(){
  if(String(location.hash||'').indexOf('#player/plex')===0){
    const n=window.__pxPlayDur;
    return (typeof n==='number'&&isFinite(n)&&n>0)?n/1000:0;
  }
  const d=vid.duration;
  return (typeof d==='number'&&isFinite(d)&&d>0)?d:0;
}
function paintDur(){const d=dur(),el=$('#tdur');if(el)el.textContent=d>0?hms(d):'--:--:--';}
const fmt=s=>`${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`;
const dec=m=>Math.floor(m.year/10)*10+'s';
// ---------- navigation ----------
const FACETS=[["genres","Genres","genre",m=>m.genres],["collections","Collections","collection",m=>m.collection?[m.collection]:[]],
  ["studios","Studios","studio",m=>[m.studio]],["decades","Decades","decade",m=>[dec(m)]],["tags","Tags","tag",m=>m.tags]];
const FX=Object.fromEntries(FACETS.map(f=>[f[0],f]));
$('#total').textContent=D.length;
$('#nav').innerHTML=`<a href="#home" data-r="#home">${I('home')}Home</a>
<div class="navh muted small">Movies</div>`+FACETS.map(([k,n,ic])=>`<a href="#lib/${k}" data-r="#lib/${k}">${I(ic)}${n}</a>`).join('')+
`<div class="navh muted small">TV Shows</div>`+[["shows","Shows","decade"],["genres","Genres","genre"],["networks","Networks","studio"],["collections","Collections","collection"]].map(([k,n,ic])=>`<a href="#tv/${k}" data-r="#tv/${k}">${I(ic)}${n}</a>`).join('')+
`<a href="#settings" data-r="#settings" class="navset">${I('gear')}Settings</a>`;
$$('#nav a').forEach(a=>{const sec=a.previousElementSibling;let h=a.previousElementSibling;while(h&&!h.classList.contains('navh'))h=h.previousElementSibling;a.dataset.label=(h&&!a.classList.contains('navset')?h.textContent.trim()+' · ':'')+a.textContent.trim();a.setAttribute('aria-label',a.textContent.trim())});
$('#tabs').innerHTML=FACETS.map(([k,n])=>`<a href="#lib/${k}" data-r="${k}">${n}</a>`).join('');
const meta=m=>`${m.year} · ${m.genres[0]} · ${m.mins}m`;
const card=(m,hero,sub)=>`<button class="card" data-id="${m.id}"><div class="poster" style="background-image:${hero?art(m,320,180):art(m)}"></div>${hero&&m.progress?`<div class="pbar"><i style="width:${m.progress*100}%"></i></div>`:''}<div class="meta"><div class="t">${esc(m.title)}</div><div class="muted small">${sub||meta(m)}</div></div></button>`;
$('#continue').innerHTML=D.filter(m=>m.progress).map(m=>card(m,1,`${Math.round(m.mins*(1-m.progress))} min left`)).join('');
// Next Up: next unwatched part of any box set where an earlier part is watched/in progress
const nextUp=COLLECTIONS.map(c=>{const parts=D.filter(m=>m.collection===c).sort((a,b)=>a.part-b.part);
  const i=parts.findIndex(m=>!m.watched&&!m.progress);return i>0?[parts[i],c]:null}).filter(Boolean);
$('#nextup').innerHTML=nextUp.map(([m,c])=>card(m,1,`${esc(c)} · Part ${m.part}`)).join('');
// Ask filters (home)
const CH={"Unwatched":m=>!m.watched,"Sci-Fi":m=>m.genres.includes("Sci-Fi"),"1990s":m=>m.year>=1990&&m.year<2000,"Under 2h":m=>m.mins<120,"Drama":m=>m.genres.includes("Drama"),"2010s":m=>m.year>=2010&&m.year<2020};
const on=new Set();
function render(){const list=D.filter(m=>[...on].every(c=>CH[c](m))).sort((a,b)=>b.added-a.added);
  $('#grid').innerHTML=list.length?list.map(m=>card(m)).join(''):`<div class="empty">${I('search')}<div>No titles match these filters.</div><button class="btn" onclick="on.clear();render()">Clear filters</button></div>`;
  $('#count').textContent=`· ${list.length} of ${D.length}`;
  $('#chipbox').innerHTML=Object.keys(CH).map(c=>`<button class="chip ${on.has(c)?'on':''}" data-c="${c}">${c}</button>`).join('');
  $('#activeChips').innerHTML=[...on].map(c=>`<button class="chip on" data-c="${c}">${c} ✕</button>`).join('');}
// Library views
const lib={facet:'genres',sel:new Set(),sort:'title',dir:1};
const values=f=>{const cnt={};D.forEach(m=>FX[f][3](m).forEach(v=>cnt[v]=(cnt[v]||0)+1));
  return Object.keys(cnt).sort((a,b)=>f==='decades'?a.localeCompare(b):a.localeCompare(b)).map(v=>[v,cnt[v]])};
function renderLib(){const f=FX[lib.facet],get=f[3];
  
  $('#facetChips').innerHTML=`<button class="fchip ${lib.sel.size?'':'on'}" data-v="">All</button>`+values(lib.facet).map(([v,n])=>`<button class="fchip ${lib.sel.has(v)?'on':''}" data-v="${esc(v)}">${esc(v)} <span>${n}</span></button>`).join('');
  const k=lib.sort,cmp=(a,b)=>(k==='title'?a.title.localeCompare(b.title):a[k]-b[k])*lib.dir;
  $('#sortSel').value=k;$('#sortDir').textContent=lib.dir>0?'↑':'↓';
  if(lib.facet==='collections'&&!lib.sel.size){ // box-set grid
    const sets=COLLECTIONS.map(c=>{const p=D.filter(m=>m.collection===c).sort((a,b)=>a.part-b.part);return{c,p,year:p[0].year,added:Math.max(...p.map(m=>m.added)),rating:p.reduce((s,m)=>s+m.rating,0)/p.length,mins:p.reduce((s,m)=>s+m.mins,0),title:c}});
    sets.sort((a,b)=>(k==='title'?a.c.localeCompare(b.c):a[k]-b[k])*lib.dir);
    $('#libCount').textContent=`${sets.length} box sets`;
    $('#libGrid').innerHTML=sets.map(s=>`<button class="card boxset" data-set="${esc(s.c)}"><div class="stack">${s.p.slice(0,3).map((m,i)=>`<div class="poster" style="background-image:${art(m)};--i:${i}"></div>`).join('')}</div><div class="meta"><div class="t">${esc(s.c)}</div><div class="muted small">${s.p.length} films · ${s.p[0].year}–${s.p.at(-1).year}</div></div></button>`).join('');return;}
  const list=D.filter(m=>!lib.sel.size||get(m).some(v=>lib.sel.has(v))).sort(cmp);
  $('#libCount').textContent=`${list.length} of ${D.length} titles`;
  const sub=m=>k==='rating'?`★ ${m.rating} · ${m.year}`:k==='mins'?`${m.mins} min · ${m.year}`:k==='added'?`Added ${new Date(m.added).toLocaleDateString('en-US',{month:'short',day:'numeric'})}`:lib.facet==='studios'?`${m.year} · ${m.studio}`:lib.facet==='tags'?m.tags.join(' · '):meta(m);
  $('#libGrid').innerHTML=list.map(m=>card(m,0,sub(m))).join('');}
$('#sortSel').onchange=e=>{lib.sort=e.target.value;lib.dir=['title'].includes(lib.sort)?1:-1;renderLib()};
$('#sortDir').onclick=e=>{e.preventDefault();lib.dir*=-1;renderLib()};
document.addEventListener('click',e=>{const c=e.target.closest('.chip[data-c]');if(c){const k=c.dataset.c;on.has(k)?on.delete(k):on.add(k);render();}
  const fc=e.target.closest('.fchip');if(fc){const v=fc.dataset.v;if(!v)lib.sel.clear();else lib.sel.has(v)?lib.sel.delete(v):lib.sel.add(v);renderLib();return;}
  const bs=e.target.closest('.boxset');if(bs){lib.sel=new Set([bs.dataset.set]);lib.sort='year';lib.dir=1;renderLib();return;}
  const cd=e.target.closest('.card,.up');if(cd&&cd.dataset.id){const it=ITEMS[cd.dataset.id];if(it&&it.kind!=='tv'&&!cd.closest('#player')){morphFrom(cd);location.hash='#title/'+cd.dataset.id}else location.hash='#player/'+cd.dataset.id;}});
const ask=$('#ask');const openAsk=()=>{ask.hidden=false;$('#askq').focus()},closeAsk=()=>ask.hidden=true;
$('#askBtn').onclick=openAsk;$('.modal-bg').onclick=closeAsk;
$('#askq').addEventListener('input',e=>{const q=e.target.value.toLowerCase();on.clear();
  for(const [k,t] of [["Unwatched","unwatch"],["Sci-Fi","sci"],["1990s","90"],["Under 2h","short"],["Under 2h","under"],["Drama","drama"],["2010s","2010"]]) if(q.includes(t))on.add(k);
  if(!$('#libView').hidden)location.hash='#home';render();});
render();
// ---------- player ----------
const ITEMS={};D.forEach(m=>ITEMS[m.id]=m);EPISODES.forEach(e=>ITEMS[e.id]=e);
const st=$('#stage'),vid=$('#vid');
const BLANK={id:'',title:'',year:'',genres:[''],mins:0,hue:210,summary:'',studio:'',rating:0,chapters:[{t:'',at:0}],kind:'movie',tags:[],progress:0,watched:false,show:'',season:0,episode:0};
let cur=D[0]||BLANK;
const MODES=[["fit","Fit"],["zoom","Zoom to fill"],["smart","Smart crop"],["stretch","Stretch"]];
const qs=new URLSearchParams(location.search);
let mode=null,ambient=qs.get('ambient')!=='0',bias=0;
const autoMode=()=>innerWidth/innerHeight>=2.2?'zoom':'fit';
function setMode(m,toastIt){mode=m;const lbl=MODES.find(x=>x[0]===m)[1];
  st.dataset.mode=m;$('#aspectTxt').textContent=lbl;if(typeof renderAspect==='function')renderAspect();$('#modeLabel').textContent=lbl;layout();if(toastIt)toast(lbl);}
let tT;function toast(t){const el=$('#toast');el.textContent=t;el.classList.add('show');clearTimeout(tT);tT=setTimeout(()=>el.classList.remove('show'),1200)}
function applyBias(){vid.style.objectPosition=mode==='smart'?`50% ${50+bias*2}%`:'50% 50%'}
function layout(){const W=innerWidth,H=innerHeight,fit=mode==='fit';
  const P=$('#pDetails').getBoundingClientRect().width;
  const L=$('#pDetails').classList.contains('open'),R=$('#pUpnext').classList.contains('open');
  // free rect between open panels: the video shifts AND resizes into it in every aspect mode (object-fit does the rest)
  const ovl=W<1600;st.classList.toggle('povl',ovl);
  const left=L&&!ovl?P:0,width=W-left-(R&&!ovl?P:0);
  st.style.setProperty('--vl',left+'px');st.style.setProperty('--vwid',width+'px');
  const tmpFit=(L||R)&&(mode==='zoom'||mode==='smart'),eff=tmpFit?'fit':mode;st.dataset.mode=eff;
  const lbl=MODES.find(x=>x[0]===mode)[1];$('#modeLabel').textContent=tmpFit?`Fit · panel (${lbl})`:(userMode?lbl:`Auto · ${lbl.split(' ')[0]}`);
  st.classList.toggle('fill',eff!=='fit');st.classList.toggle('amb',eff==='fit'&&ambient);
  $('#bAmb').classList.toggle('on',eff==='fit'&&ambient);$('#bAmb2').classList.toggle('on',ambient);
  st.classList.toggle('anyopen',L||R);st.classList.toggle('lopen',L);st.classList.toggle('ropen',R);
  ['#bD','#hL'].forEach(s=>$(s).classList.toggle('on',L));['#bU','#bU2','#hR'].forEach(s=>$(s).classList.toggle('on',R));
  st.scrollLeft=0;st.scrollTop=0;applyBias();}
addEventListener('resize',()=>{if(!userMode)setMode(autoMode());else layout()});
let userMode=false;
const cycle=()=>{userMode=true;const i=MODES.findIndex(x=>x[0]===mode);setMode(MODES[(i+1)%4][0],1)};
$('#bAspect').onclick=cycle;
const togAmb=()=>{ambient=!ambient;layout();const applies=st.dataset.mode==='fit';toast(ambient?(applies?'Ambient fill on':'Ambient fill on · shows in Fit mode'):'Ambient fill off')};$('#bAmb').onclick=togAmb;
$('#bias').oninput=e=>{bias=+e.target.value;applyBias()};
var openOrder=[];
const toggle=(id,force)=>{const p=$(id),was=p.classList.contains('open'),now=force===undefined?!was:force;
  if(now&&innerWidth<1600){const other=id==='#pDetails'?'#pUpnext':'#pDetails';$(other).classList.remove('open');openOrder=openOrder.filter(x=>x!==other);}
  p.classList.toggle('open',now);openOrder=openOrder.filter(x=>x!==id);if(now)openOrder.push(id);
  if(now&&!was)setTimeout(()=>p.querySelector('.pc').focus({preventScroll:true}),30);
  if(!now&&was&&p.contains(document.activeElement))$(id==='#pDetails'?'#hL':'#hR').focus({preventScroll:true});showUI();renderPanels();$('#bD').classList.toggle('on',$('#pDetails').classList.contains('open'));$('#bU2').classList.toggle('on',$('#pUpnext').classList.contains('open'));$('#bU').classList.toggle('on',$('#pUpnext').classList.contains('open'));layout();};
$('#bD').onclick=$('#hL').onclick=()=>toggle('#pDetails');$('#bU').onclick=$('#hR').onclick=()=>toggle('#pUpnext');$('#scrim').onclick=()=>{toggle('#pDetails',false);toggle('#pUpnext',false)};
$('#back').onclick=()=>location.hash='#home';
$('#bF').onclick=()=>document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen().catch(()=>{});
const sync=()=>{$('#play use').setAttribute('href','assets/icons.svg#'+(vid.paused?'tplay':'tpause'));$('#play').classList.toggle('paused',vid.paused);vis()};
$('#play').onclick=()=>{vid.paused?vid.play():vid.pause()};vid.onplay=vid.onpause=sync;sync();
const epStep=d=>{const i=EPISODES.indexOf(cur),n=EPISODES[i+d];if(n&&n.showId===cur.showId){location.hash='#player/'+n.id;toast(`S${n.season} E${n.episode} · ${n.title}`)}else toast(d>0?'Last episode':'First episode')};
const skip=s=>vid.currentTime=Math.max(0,Math.min(dur(),vid.currentTime+s));
$('#rew').onclick=()=>cur.kind==='tv'?epStep(-1):skip(-10);$('#fwd').onclick=()=>cur.kind==='tv'?epStep(1):skip(10);
vid.ontimeupdate=()=>{const d=dur(),p=d>0?vid.currentTime/d*100:0;$('#prog').style.width=`calc((100% - 4px) * ${p/100})`;$('#knob').style.left=`calc(2px + (100% - 4px) * ${p/100})`;$('#tcur').textContent=hms(vid.currentTime||0);paintDur()};
vid.onseeked=vid.onloadedmetadata=()=>vid.ontimeupdate();
const seek=$('#seek');
const chapAt=f=>{let k=0;cur.chapters.forEach((c,i)=>{if(f>=c.at)k=i});return k};
let hovF=0;
seek.onmousemove=e=>{const r=seek.getBoundingClientRect(),f=hovF=Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)),d=dur();
  if(e.target.closest('#thumb'))return;
  const ti=e.target.closest('#chaps i'),k=ti?+ti.dataset.k:chapAt(f),c=cur.chapters[k];
  $('#thumb').style.left=Math.max(80,Math.min(r.width-80,f*r.width))+'px';$('#thumb').dataset.k=k;
  $('#thumbimg').style.backgroundPosition=`-${Math.min(9,Math.floor((ti?c.at:f)*10))*160}px 0`;
  $('#thumbt').innerHTML=`<b>${k+1}. ${esc(c.t)}</b><span>${fmt((ti?c.at:f)*d)}</span>`};
seek.onclick=e=>{const d=dur(),ti=e.target.closest('#chaps i'),th=e.target.closest('#thumb');
  if(ti||th){const k=+(ti||th).dataset.k;vid.currentTime=cur.chapters[k].at*d;toast(`Chapter ${k+1}: ${cur.chapters[k].t}`);}
  else{const r=seek.getBoundingClientRect();vid.currentTime=(e.clientX-r.left)/r.width*d}};
// visibility: playing => bars hidden; show on bottom-zone hover (lowest 15%), on pause, or on control interaction (3000 ms, VLC Player.qml)
var hideT,curT,inZone=false,touched=false,pin=qs.has('pinui');
function vis(){st.classList.toggle('ui',pin||vid.paused||inZone||touched||!$('#gearMenu').hidden)}
const showUI=()=>{touched=true;vis();clearTimeout(hideT);hideT=setTimeout(()=>{touched=false;vis()},3000)};
st.addEventListener('mousemove',e=>{inZone=e.clientY>innerHeight*0.85||!!e.target.closest('.bar');vis();
  st.classList.add('cur');clearTimeout(curT);curT=setTimeout(()=>st.classList.remove('cur'),3000)});
st.addEventListener('mouseleave',()=>{inZone=false;vis()});
$$('.bar').forEach(b=>b.addEventListener('pointerdown',showUI));
$('#bGear').onclick=e=>{e.stopPropagation();$('#gearMenu').hidden=!$('#gearMenu').hidden;vis()};
document.addEventListener('click',e=>{if(!e.target.closest('.gearwrap')){$('#gearMenu').hidden=true;vis()}});
$('#bAmb2').onclick=()=>togAmb();$('#bU2').onclick=()=>toggle('#pUpnext');$('#bX').onclick=()=>goBackFromPlayer();

var renderAspect=()=>$('#aspectList').innerHTML=MODES.map(([k,n])=>`<button class="mi ${k===mode?'on':''}" data-m="${k}">${n}</button>`).join('');
$('#aspectList').addEventListener('click',e=>{const b=e.target.closest('[data-m]');if(b){userMode=true;setMode(b.dataset.m,1)}});
function plexCtx(){try{return JSON.parse(sessionStorage.getItem('pxPlayCtx')||'{}')}catch(e){return {}}}
function loadPlayer(id){
  if(id==='plex'){
    const ctx=plexCtx();
    const title=ctx.title||'';
    cur=Object.assign({},BLANK,{id:'plex',title,year:ctx.year||'',kind:ctx.kind==='episode'?'tv':'movie',show:ctx.show||'',season:ctx.season,episode:ctx.episode,genres:[''],chapters:[{t:'',at:0}],summary:'',mins:ctx.durationMs?Math.round(ctx.durationMs/60000):0,studio:'',rating:''});
    window.__pxPlayDur=ctx.durationMs||0;
    $('#chaps').textContent='';
    $('#ptitle').textContent=ctx.kind==='episode'&&ctx.show?`${ctx.show} · S${ctx.season||'?'} E${ctx.episode||'?'} · ${title}`:(ctx.year?`${title} (${ctx.year})`:title);
    $('#crumb').textContent=ctx.show||'';
    $('#ambient').style.backgroundImage='none';
    $$('#stage .art').forEach(a=>{a.style.backgroundImage='none'});
    if(vid.getAttribute('src')){vid.removeAttribute('src');vid.load()}
    paintDur();
    renderPanels();
    return;
  }
  if(window.__PLEXUW_SHIP||!D.length){if(location.hash.startsWith('#player'))location.hash='#home';return;}
  cur=ITEMS[id]||D[0]||BLANK;$('#chaps').innerHTML=cur.chapters.slice(1).map((c,k)=>`<i data-k="${k+1}" title="${esc(c.t)}" style="left:${c.at*100}%"></i>`).join('');$('#ptitle').textContent=cur.kind==='tv'?`${cur.show} · S${cur.season} E${cur.episode} · ${cur.title}`:`${cur.title} (${cur.year})`;$('#crumb').textContent=cur.kind==='tv'?cur.show:cur.genres[0];$('#rew').title=cur.kind==='tv'?'Previous episode':'Back 10s (←)';$('#fwd').title=cur.kind==='tv'?'Next episode':'Forward 10s (→)';
  $$('#stage .art').forEach(a=>a.style.backgroundImage=art(cur,320,180));$('#ambient').style.backgroundImage=art(cur,320,180);
  renderPanels();}
const CAST=["Ada Morrow","Felix Grant","Juno Okafor","Theo Lindqvist","Mira Sato","Owen Hale","Priya Nair","Luca Ferro"];
function renderPanels(){
  if(cur&&cur.id==='plex'){
    const b=$('#detailsBody');if(b){b.textContent='';const p=document.createElement('p');p.className='muted small';p.textContent='Playing from your Plex library.';b.appendChild(p)}
    const u=$('#upList');if(u)u.textContent='';
    return;
  }
  const c=cur,i=c.id,tv=c.kind==='tv',d=dur()||0,now=d?vid.currentTime/d:0;
  const cast=[0,1,2,3].map(k=>[CAST[(i+k*3)%8],["Lead","Rival","Mentor","Pilot","Narrator"][(i+k)%5]]);
  $('#detailsBody').innerHTML=`<div class="ptabs"><b>Info</b><span class="muted small">I</span></div>
   <div class="dhead"><div class="dposter" style="background-image:${art(c)}"></div><div><h3>${tv?esc(c.show)+'</h3><div>'+esc(c.title)+'</div>':esc(c.title)+'</h3>'}
   <p class="muted small">${tv?`Season ${c.season} · Episode ${c.episode} · `:''}${c.year} · ${c.mins} min · ★ ${c.rating}</p>
   <p>${c.genres.map(g=>`<span class="tag">${g}</span>`).join('')}</p></div></div><p class="small">${c.summary}</p>
   <h4>Cast</h4><div class="cast">${cast.map(([n,r])=>`<div class="person"><i style="background:hsl(${(c.hue+n.length*30)%360},35%,35%)">${n.split(' ').map(x=>x[0]).join('')}</i><div>${n}<div class="muted small">${r}</div></div></div>`).join('')}</div>
   <h4>Crew</h4><dl class="kv"><dt>Director</dt><dd>${CAST[(i+5)%8]}</dd><dt>Writer</dt><dd>${CAST[(i+6)%8]}</dd><dt>Studio</dt><dd>${esc(c.studio)}</dd>${c.collection?`<dt>Collection</dt><dd>${esc(c.collection)} #${c.part}</dd>`:''}</dl>
   <h4>File</h4><dl class="kv"><dt>File</dt><dd class="mono">${tv?esc(c.show.replace(/\W+/g,'.'))+'.S'+String(c.season).padStart(2,'0')+'E'+String(c.episode).padStart(2,'0'):esc(c.title.replace(/\W+/g,'.'))+'.'+c.year}.2160p.mkv</dd><dt>Video</dt><dd>HEVC Main10 · 3840×1608 · 23.976 fps · HDR10</dd><dt>Audio</dt><dd>E-AC3 5.1 · English</dd><dt>Subtitles</dt><dd>English (SRT), Spanish (PGS)</dd><dt>Size</dt><dd>${(8+i%9*1.7).toFixed(1)} GB · ${(18+i%7*3)} Mbps</dd></dl>
   <h4>Source</h4><div class="sources">${[["Home NAS (local)","Direct Play · 2160p HDR",1],["Basement Mini","Transcode → 1080p",0],["Remote · Cabin","Transcode → 720p · 4 Mbps",0]].map(([n,s,on],k)=>`<button class="src ${on?'on':''}" data-src="${k}"><span class="dot"></span><span><b>${esc(n)}</b><span class="muted small">${esc(s)}</span></span></button>`).join('')}</div>`;
  const rest=c.chapters.map((ch,k)=>({...ch,k})).filter(ch=>ch.at>now||c.chapters[ch.k+1]&&c.chapters[ch.k+1].at>now);
  const ei=tv?EPISODES.indexOf(c):-1,nextEps=tv?EPISODES.slice(ei+1).filter(e=>e.showId===c.showId).slice(0,6):[];
  const related=D.filter(m=>m.id!==c.id&&m.genres.some(g=>c.genres.includes(g))).slice(0,4);
  $('#upList').innerHTML=`<div class="ptabs"><b>Up next</b>${tv?`<button class="aptog ${apOn()?'on':''}" data-ap title="Autoplay next episode"><span></span>Autoplay</button>`:''}<span class="muted small">U · C</span></div>
   <h4 id="chapHead" tabindex="-1">${rest.length} chapters remaining</h4>${rest.map(ch=>`<button class="chrow ${ch.at<=now?'now':''}" data-k="${ch.k}"><div class="poster" style="background:url(assets/sprite.jpg) -${Math.min(9,Math.floor(ch.at*10))*112}px 0/1120px 63px"></div><div><div>${ch.k+1}. ${esc(ch.t)}</div><div class="muted small">${fmt(ch.at*d)}${ch.at<=now?' · now playing':''}</div></div></button>`).join('')}
   ${tv?`<h4>Next episodes · ${esc(c.show)}</h4>${nextEps.length?nextEps.map(e=>`<div class="up" data-id="${e.id}"><div class="poster" style="background-image:${art({...e,title:'S'+e.season+'E'+e.episode},320,180)}"></div><div><div>S${e.season} E${e.episode} · ${esc(e.title)}</div><div class="muted small">${e.mins} min${e.season!==c.season?' · next season':''}</div></div></div>`).join(''):'<p class="muted small">Series finale — nothing up next.</p>'}`:
   `<h4>Related</h4>${related.map(m=>`<div class="up" data-id="${m.id}"><div class="poster" style="background-image:${art(m,320,180)}"></div><div><div>${esc(m.title)}</div><div class="muted small">${m.year} · ${m.mins}m</div></div></div>`).join('')}`}`;}
document.addEventListener('click',e=>{const r=e.target.closest('.chrow');if(r){const k=+r.dataset.k;vid.currentTime=cur.chapters[k].at*(dur());toast(`Chapter ${k+1}: ${cur.chapters[k].t}`);}
  const s=e.target.closest('.src');if(s){$$('.src').forEach(x=>x.classList.toggle('on',x===s));toast('Source: '+s.querySelector('b').textContent);}});
vid.addEventListener('seeked',()=>{if(!$('#pUpnext').classList.contains('open'))return;renderPanels()});
const NAVSEL={show:'#tv/shows'};
function route(){const h0=location.hash||'#home';
  if(h0.startsWith('#music')){location.hash='#home';return;}
  const h=h0,isP=h.startsWith('#player'),isL=h.startsWith('#lib/'),isS=h==='#settings',isT=h.startsWith('#tv/');
  $('#home').hidden=isP;$('#player').hidden=!isP;$('#homeView').hidden=isL||isS||isT;$('#libView').hidden=!isL;$('#setView').hidden=!isS;$('#tvView').hidden=!isT;
  const parts=h.split('/'),key=isT?parts[0]+'/'+parts[1]:isL?'#lib/'+parts[1]:h,sel=NAVSEL[parts[1]]||key;
  $$('#nav a').forEach(a=>a.classList.toggle('on',a.dataset.r===sel||(!isP&&!isL&&!isS&&!isT&&a.dataset.r==='#home')));
  if(isL){const [,f,v]=parts;if(FX[f]){if(f!==lib.facet)lib.sel.clear();lib.facet=f;}if(v)lib.sel=new Set([decodeURIComponent(v)]);}
  
  renderLib();if(isT)renderTV(parts.slice(1));
  if(isP){const seg=parts[1];if(seg==='plex'){loadPlayer('plex');const qm=qs.get('mode');if(qm&&MODES.some(x=>x[0]===qm)){userMode=true;setMode(qm)}else if(!userMode)setMode(autoMode());else layout();vis();}
    else if(window.__PLEXUW_SHIP||!D.length){location.hash='#home'}
    else{loadPlayer(+seg||0);const qm=qs.get('mode');if(qm&&MODES.some(x=>x[0]===qm)){userMode=true;setMode(qm)}else if(!userMode)setMode(autoMode());else layout();vid.play().catch(()=>{});vis();}}else{vid.pause();}}
// ---------- TV library ----------
const showCard=s=>`<a class="card" href="#tv/show/${s.id}"><div class="poster" style="background-image:${art(s)}"></div><div class="meta"><div class="t">${esc(s.title)}</div><div class="muted small">${s.year}– · ${s.seasons.length} seasons · ${esc(s.network)}</div></div></a>`;
function facetPage(title,base,vals,v,list,cardFn,count){return `<h2 class="row-title">${title}</h2><div class="chips fbar"><a class="fchip ${v?'':'on'}" href="${base}">All</a>${vals.map(([x,n])=>`<a class="fchip ${x===v?'on':''}" href="${base}/${encodeURIComponent(x)}">${esc(x)} <span>${n}</span></a>`).join('')}</div><div class="muted small lc">${count}</div><div class="grid">${list.map(cardFn).join('')}</div>`}
const tally=(arr,get)=>{const c={};arr.forEach(x=>[].concat(get(x)).forEach(v=>c[v]=(c[v]||0)+1));return Object.entries(c).sort((a,b)=>a[0].localeCompare(b[0]))};
function renderTV([view,a,b]){const el=$('#tvView'),v=a&&decodeURIComponent(a);
  if(view==='show'){const s=TV[+a]||TV[0],se=s.seasons.find(x=>x.n===+b)||s.seasons[0];
    el.innerHTML=`<div class="crumbs"><a href="#tv/shows">TV Shows</a> › ${esc(s.title)}</div>
    <div class="showhead" style="--bg:${art(s,320,180)}"><div class="poster" style="background-image:${art(s)}"></div><div><h1>${esc(s.title)}</h1>
    <p class="muted">${s.year}– · ${esc(s.network)} · ${s.genre} · ★ ${s.rating} · ${s.seasons.reduce((n,x)=>n+x.episodes.length,0)} episodes</p>
    <p>A fictional placeholder series for the prototype.</p><a class="btn accent" href="#player/${se.episodes.find(e=>!e.watched)?.id??se.episodes[0].id}">▶ Play ${'S'+se.n} E${(se.episodes.find(e=>!e.watched)||se.episodes[0]).episode}</a></div></div>
    <div class="tabs">${s.seasons.map(x=>`<a href="#tv/show/${s.id}/${x.n}" class="${x===se?'on':''}">Season ${x.n}</a>`).join('')}</div>
    <div class="seasons">${s.seasons.map(x=>`<a class="season ${x===se?'on':''}" href="#tv/show/${s.id}/${x.n}"><div class="poster" style="background-image:${art({...s,hue:(s.hue+x.n*30)%360,title:'Season '+x.n})}"></div><div class="small">Season ${x.n}${(u=>u?` <b class="ucount" title="${u} unwatched">${u}</b>`:'')(x.episodes.filter(e=>!e.watched).length)}<div class="muted">${x.year} · ${x.episodes.length} eps</div></div></a>`).join('')}</div>
    <h2 class="row-title">Season ${se.n} · Episodes</h2><div class="eplist">${se.episodes.map(e=>`<a class="ep" href="#player/${e.id}"><div class="poster" style="background-image:${art({...e,title:'E'+e.episode},320,180)}">${e.watched?'<b class="seen">✓</b>':'<b class="unw" title="Unwatched">New</b>'}</div><div><div class="t">${e.episode}. ${esc(e.title)}</div><div class="muted small">${e.mins} min · ★ ${e.rating}</div><div class="small muted">${e.summary}</div></div></a>`).join('')}</div>`;return;}
  if(view==='genres')el.innerHTML=facetPage('TV · Genres','#tv/genres',tally(TV,s=>s.genre),v,TV.filter(s=>!v||s.genre===v),showCard,'');
  else if(view==='networks')el.innerHTML=facetPage('TV · Networks','#tv/networks',tally(TV,s=>s.network),v,TV.filter(s=>!v||s.network===v),showCard,'');
  else if(view==='collections')el.innerHTML=facetPage('TV · Collections','#tv/collections',tally(TV,s=>s.collections),v,TV.filter(s=>!v||s.collections.includes(v)),showCard,'');
  else el.innerHTML=`<h2 class="row-title">TV Shows <span class="muted">· ${TV.length}</span></h2><div class="grid">${TV.map(showCard).join('')}</div>`;}
// Home: TV Next Up = next unwatched episode of each in-progress show
$('#tvnext').innerHTML=TV.map(s=>{const eps=s.seasons.flatMap(x=>x.episodes),w=eps.filter(e=>e.watched).length,n=eps.find(e=>!e.watched);
  return w&&n?`<button class="card tvn" data-id="${n.id}"><div class="poster" style="background-image:${art({...n,title:s.title},320,180)}"><span class="sxe">S${n.season} E${n.episode}</span></div><div class="pbar"><i style="width:${w/eps.length*100}%"></i></div><div class="meta"><div class="t">${esc(s.title)}</div><div class="small">S${n.season}E${n.episode} · ${esc(n.title)}</div><div class="muted small">${w} of ${eps.length} watched · ${n.mins} min</div></div></button>`:''}).join('');
addEventListener('hashchange',route);route();
addEventListener('keydown',e=>{
  if(!ask.hidden){if(e.key==='Escape'||e.key==='Enter')closeAsk();return;}
  if($('#player').hidden||e.target.tagName==='INPUT'&&e.target.type!=='range')return;const k=e.key.toLowerCase();
  if(k===' '){e.preventDefault();$('#play').click();showUI();}
  else if(['z','a','arrowleft','arrowright','d','u','i'].includes(k)){showUI();if(k==='z')cycle();else if(k==='a')togAmb();else if(k==='arrowleft')skip(-10);else if(k==='arrowright')skip(10);else if(k==='d'||k==='i')toggle('#pDetails');else toggle('#pUpnext');}
  else if(k==='z')cycle();else if(k==='a')togAmb();else if(k==='f')$('#bF').click();
  else if(k==='arrowleft')$('#rew').click();else if(k==='arrowright')$('#fwd').click();
  else if(k==='d')toggle('#pDetails');else if(k==='u')toggle('#pUpnext');
  else if(k==='escape'){if(String(location.hash||'').indexOf('#player/plex')===0){goBackFromPlayer();return;}if(!$('#apCard').hidden){apCancel();return;}const top=openOrder.at(-1);if(top&&$(top).classList.contains('open')){toggle(top,false);}else if(st.classList.contains('ui')&&!vid.paused&&!pin){touched=false;inZone=false;vis();}else goBackFromPlayer();}});

// ---------- Settings: AI Provider (BYO key). Key lives only in localStorage; never logged or put in URLs. ----------
const AIP={xai:{name:"xAI Grok",base:"https://api.x.ai/v1",model:"grok-4"},openai:{name:"OpenAI",base:"https://api.openai.com/v1",model:"gpt-4o-mini"},
  openrouter:{name:"OpenRouter",base:"https://openrouter.ai/api/v1",model:"openrouter/auto"},self:{name:"Self-hosted",base:"http://localhost:11434/v1",model:"llama3.1"}};
const LS='plexuw.ai.';const aiGet=k=>localStorage.getItem(LS+k)||'',aiSet=(k,v)=>v?localStorage.setItem(LS+k,v):localStorage.removeItem(LS+k);
function aiLoad(){const p=aiGet('provider')||'xai';$('#aiProv').value=p;$('#aiKey').value=aiGet('key:'+p);
  $('#aiModel').value=aiGet('model:'+p)||AIP[p].model;$('#aiModel').placeholder=AIP[p].model;$('#aiBase').value=aiGet('base')||'';
  $('#aiBaseRow').hidden=p!=='self';$('#aiStatus').textContent='';$('#aiStatus').className='muted small';
  $('#askProv').textContent=`AI: ${AIP[p].name} · ${$('#aiModel').value}${aiGet('key:'+p)?'':' (no key — local filters only)'}`;}
$('#aiProv').onchange=e=>{aiSet('provider',e.target.value);aiLoad()};
$('#aiKey').oninput=e=>aiSet('key:'+$('#aiProv').value,e.target.value.trim());
$('#aiModel').oninput=e=>aiSet('model:'+$('#aiProv').value,e.target.value.trim());
$('#aiBase').oninput=e=>aiSet('base',e.target.value.trim());
$('#aiEye').onclick=()=>{const k=$('#aiKey'),show=k.type==='password';k.type=show?'text':'password';$('#aiEyeSlash').style.display=show?'none':'';};
$('#aiClear').onclick=()=>{aiSet('key:'+$('#aiProv').value,'');$('#aiKey').value='';aiLoad();$('#aiStatus').textContent='Key cleared';};
$('#aiTest').onclick=()=>{const st=$('#aiStatus');st.textContent='Testing… (mock)';st.className='muted small';
  setTimeout(()=>{st.textContent='OK (mock) — UI prototype, no network request was made';st.className='ok small'},600)};
aiLoad();

// ---------- Voice assistant (UI mock: scripted transcript, no Web Speech, no network) ----------
const VM_KEY='plexuw.voice.mode';const vmode=()=>localStorage.getItem(VM_KEY)||'pause';
$$('#voiceMode input').forEach(r=>{r.checked=r.value===vmode();r.onchange=()=>localStorage.setItem(VM_KEY,r.value)});
const SCRIPT=qs.get('vq')||"Find something like this, but funnier";let vT=[],vPrev=null;
function openVoice(){if(!$('#voice').hidden)return;const inP=!$('#player').hidden,m=vmode();vPrev={paused:vid.paused,vol:vid.volume,np:np.playing};
  if(inP){if(m==='pause')vid.pause();else if(m==='duck')vid.volume=0.2;}
  if(np.playing&&m==='pause'){np.playing=false;npRender()}
  $('#voice').hidden=false;$('#voice').dataset.mode=m;$('#vtx').textContent='';$('.vlisten').textContent='Listening…';
  const words=SCRIPT.split(' ');vT.forEach(clearTimeout);vT=words.map((w,k)=>setTimeout(()=>{$('#vtx').textContent=words.slice(0,k+1).join(' ')},500+k*260));
  vT.push(setTimeout(()=>$('.vlisten').textContent='Got it (mock)',700+words.length*260));
  $('#vhint').textContent=(m==='pause'?'Playback paused':m==='duck'?'Volume lowered to 20%':'Playback continues')+' · Esc or click outside to close';}
function closeVoice(){if($('#voice').hidden)return;$('#voice').hidden=true;vT.forEach(clearTimeout);const m=$('#voice').dataset.mode;
  if(!$('#player').hidden){if(m==='pause'&&vPrev&&!vPrev.paused)vid.play().catch(()=>{});if(m==='duck')vid.volume=vPrev?vPrev.vol:1;}
  if(m==='pause'&&vPrev&&vPrev.np){np.playing=true;npRender()}}
$('#voiceBtn').onclick=openVoice;$('#bMic').onclick=e=>{e.stopPropagation();openVoice()};$('.vback').onclick=closeVoice;
addEventListener('keydown',e=>{if(!$('#voice').hidden){if(e.key==='Escape'){e.stopImmediatePropagation();closeVoice()}return;}
  if(e.key.toLowerCase()==='v'&&!e.ctrlKey&&!e.metaKey&&!/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)){openVoice()}},true);
// ---------- Ask: mock context chip + one canned answer card (no payload, no actions) ----------
function askContext(){const c=(!$('#player').hidden&&cur)?cur:(EPISODES.find(e=>e.showId===4&&e.season===2)||EPISODES[0]||BLANK);
  const where=c.kind==='tv'?`${c.show} S${c.season}E${c.episode}`:c.title,mins=Math.max(1,Math.round((vid.currentTime||0)/(dur())*c.mins))||12;
  return {c,label:`Watching: ${where} · ${!$('#player').hidden?mins:12}m`}}
function renderAskCtx(){const {c,label}=askContext();const box=$('.modal-box');let el=$('#askCtx');
  if(!el){el=document.createElement('div');el.id='askCtx';box.insertBefore(el,box.children[1]);}
  const who=CAST[(c.id+3)%8];
  el.innerHTML=`<div class="chips"><span class="ctxchip">${I('play')}${esc(label)}</span><button class="chip" id="askWho">Who's that?</button></div><div id="askCard"></div>`;
  $('#askWho').onclick=()=>{$('#askq').value="Who's that?";ansCard(c,who)};}
function ansCard(c,who){$('#askCard').innerHTML=`<div class="anscard"><div class="avatar" style="background:hsl(${(c.hue+40)%360},35%,35%)">${who.split(' ').map(x=>x[0]).join('')}</div>
  <div class="ansbody"><div class="muted small">Mock answer · on screen now</div><b>${who}</b><div class="small">plays the Lead in ${esc(c.kind==='tv'?c.show:c.title)}. Also in 3 other titles in your library (mock).</div>
  <div class="ansact"><button class="btn accent" id="askOpenInfo">Open Info</button><span class="muted small">No request sent — canned UI response</span></div></div></div>`;
  $('#askOpenInfo').onclick=()=>{closeAsk();if(!$('#player').hidden){$('#pDetails').classList.contains('open')||toggle('#pDetails')}else{location.hash='#player/'+c.id;setTimeout(()=>toggle('#pDetails',true),300)}};}
const _openAsk=openAsk;$('#askBtn').onclick=()=>{_openAsk();renderAskCtx()};
addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k')setTimeout(()=>{if(!ask.hidden)renderAskCtx()},0)});
$('#askq').addEventListener('keydown',e=>{if(e.key==='Enter'&&/who/i.test(e.target.value)){const {c}=askContext();ansCard(c,CAST[(c.id+3)%8]);e.stopPropagation()}});
if(qs.get('ask')==='who'){openAsk();renderAskCtx();$('#askWho').click();}
if(qs.get('voice')==='1')setTimeout(openVoice,300);

// ================= M1-M3 (APPLE-POLISH-SPEC-v1) =================
$$('.panel .pc').forEach(p=>p.tabIndex=-1);
// --- M1 edge handles: show with bar, or pointer within 120px of an edge; dwell 350ms opens (only while bar visible)
var dwellT=null;
function nearEdges(x){st.classList.toggle('nearL',x<=120);st.classList.toggle('nearR',x>=innerWidth-120)}
st.addEventListener('mousemove',e=>nearEdges(e.clientX));st.addEventListener('mouseleave',()=>{st.classList.remove('nearL','nearR')});
function dwell(el,id){el.addEventListener('mouseenter',()=>{clearTimeout(dwellT);dwellT=setTimeout(()=>{if(st.classList.contains('ui')&&!$(id).classList.contains('open'))toggle(id,true)},350)});
  el.addEventListener('mouseleave',()=>clearTimeout(dwellT));}
dwell($('#hL'),'#pDetails');dwell($('#stripL'),'#pDetails');dwell($('#hR'),'#pUpnext');dwell($('#stripR'),'#pUpnext');
// first-run pulse + hint, remembered
if(!localStorage.getItem('plexuw.edgehint')&&!qs.has('nohint')){st.classList.add('pulse');$('#edgeHint').hidden=false;
  const dismiss=()=>{st.classList.remove('pulse');$('#edgeHint').hidden=true;localStorage.setItem('plexuw.edgehint','1')};
  setTimeout(dismiss,qs.has('hint')?60000:4000);['#hL','#hR'].forEach(s=>$(s).addEventListener('click',dismiss,{once:true}));}
// --- M2 skip pills
var skipKind=null,skipShownAt=0;
function skipTick(){const t=vid.currentTime,c=cur;let k=null,span=null;
  if(c.intro&&t>=c.intro[0]&&t<c.intro[1]){k='intro';span=c.intro}else if(c.credits&&t>=c.credits[0]&&t<(c.credits[1]||dur())&&!(c.kind==='tv'&&!$('#apCard').hidden)){k='credits';span=c.credits}
  const b=$('#skipBtn');if(k!==skipKind){skipKind=k;skipShownAt=performance.now();b.hidden=!k;b.classList.remove('in');if(k){void b.offsetWidth;b.classList.add('in')}$('#skipTxt').textContent=k==='credits'?'Skip Credits':'Skip Intro';}
  if(k){const end=span[1]||dur();$('#skipBar').style.width=Math.max(0,(end-t)/(end-span[0])*100)+'%';
    b.classList.toggle('dim',!st.classList.contains('ui')&&performance.now()-skipShownAt>5000);}}
function doSkip(){if(!skipKind)return;const span=skipKind==='intro'?cur.intro:cur.credits;
  if(skipKind==='credits'&&cur.kind==='tv'&&nextEp()&&apOn()){apPlayNext(true);return;}
  vid.currentTime=Math.min((span[1]||dur()),(dur())-0.05);toast(skipKind==='intro'?'Intro skipped':'Credits skipped');}
$('#skipBtn').onclick=doSkip;
// --- M3 autoplay
var AP_KEY='plexuw.profile.default.autoplay';function apOn(){return localStorage.getItem(AP_KEY)!=='0'}
function apSync(){$('#apSet').checked=apOn();$('#apGear').classList.toggle('on',apOn());$('#apGear').textContent='Autoplay next episode: '+(apOn()?'On':'Off');$$('.aptog').forEach(x=>x.classList.toggle('on',apOn()))}
document.addEventListener('click',e=>{if(e.target.closest('[data-ap]')){localStorage.setItem(AP_KEY,apOn()?'0':'1');apSync();toast('Autoplay '+(apOn()?'on':'off'))}});
$('#apSet').onchange=e=>{localStorage.setItem(AP_KEY,e.target.checked?'1':'0');apSync()};apSync();
function nextEp(){if(cur.kind!=='tv')return null;const n=EPISODES[EPISODES.indexOf(cur)+1];return n&&n.showId===cur.showId?n:null};
var apState={ep:null,cancelled:false,timer:null,left:10,shown:false},apStreak=+(sessionStorage.getItem('plexuw.apstreak')||0);
const userInput=()=>{apStreak=0;sessionStorage.setItem('plexuw.apstreak','0')};
['keydown','pointerdown','wheel'].forEach(ev=>addEventListener(ev,e=>{if(e.isTrusted)userInput()},true));
function apReset(){clearInterval(apState.timer);apState={ep:cur.id,cancelled:false,timer:null,left:10,shown:false};$('#apCard').hidden=true;st.classList.remove('apon');vid.loop=cur.kind!=='tv';}
function apShow(){const n=nextEp(),c=$('#apCard');apState.shown=true;st.classList.add('apon');c.hidden=false;
  if(cur.kind!=='tv'||!n){const r=cur.kind==='tv'?null:D.find(m=>m.id!==cur.id&&m.genres.some(g=>cur.genres.includes(g)));
    if(!r){c.hidden=true;st.classList.remove('apon');return;}
    c.innerHTML=`<div class="apthumb" style="background-image:${art(r,320,180)}"></div><div class="apbody"><div class="muted small">Up Next suggestion</div><b>${esc(r.title)}</b><div class="muted small">${r.year} · ${r.mins} min</div><div class="apbtns"><button class="btn accent" id="apPlay">Play</button><button class="btn" id="apCancel">Dismiss</button></div></div>`;
    $('#apPlay').onclick=()=>{location.hash='#player/'+r.id};$('#apCancel').onclick=apCancel;return;}
  if(apStreak>=3){c.innerHTML=`<div class="apbody still"><b>Still watching?</b><div class="muted small">${esc(cur.show)} · paused after 3 episodes in a row</div><div class="apbtns"><button class="btn accent" id="apPlay">Continue watching</button><button class="btn" id="apCancel">I'm done</button></div></div>`;
    vid.pause();$('#apPlay').onclick=()=>{userInput();apPlayNext(true)};$('#apCancel').onclick=apCancel;return;}
  apState.left=10;const R=2*Math.PI*18;
  c.innerHTML=`<div class="apthumb" style="background-image:${art({...n,title:'S'+n.season+'E'+n.episode},320,180)}"></div><div class="apbody"><div class="muted small">S${n.season} E${n.episode}</div><b>${esc(n.title)}</b>
   <div class="apcount"><svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="18" class="trk"/><circle cx="20" cy="20" r="18" class="ring" id="apRing" style="stroke-dasharray:${R};stroke-dashoffset:0"/></svg><span>Next episode in <b id="apLeft">10</b></span></div>
   <div class="apbtns"><button class="btn accent" id="apPlay">Play Now</button><button class="btn" id="apCancel">Cancel</button></div></div>`;
  $('#apPlay').onclick=()=>apPlayNext(true);$('#apCancel').onclick=apCancel;
  const t0=performance.now();clearInterval(apState.timer);apState.timer=setInterval(()=>{const el=(performance.now()-t0)/1000,left=Math.max(0,10-el);
    $('#apLeft').textContent=Math.ceil(left);$('#apRing').style.strokeDashoffset=R*(el/10);if(left<=0){clearInterval(apState.timer);apStreak++;sessionStorage.setItem('plexuw.apstreak',apStreak);apPlayNext(false)}},100);}
function apPlayNext(manual){const n=nextEp();clearInterval(apState.timer);if(!n)return;if(manual)userInput();location.hash='#player/'+n.id;}
function apCancel(){clearInterval(apState.timer);apState.cancelled=true;$('#apCard').hidden=true;st.classList.remove('apon');}
function apTick(){if(apState.ep!==cur.id)apReset();const t=vid.currentTime,d=dur(),start=cur.credits?cur.credits[0]:Math.max(0,d-15);
  if(apState.shown&&t<start-0.05){clearInterval(apState.timer);apState.shown=false;$('#apCard').hidden=true;st.classList.remove('apon');apState.cancelled=true;return;}
  const wants=cur.kind==='tv'?(apOn()&&nextEp()):true;
  if(!apState.shown&&!apState.cancelled&&wants&&t>=start)apShow();}
vid.addEventListener('timeupdate',()=>{if($('#player').hidden)return;skipTick();apTick()});
vid.addEventListener('seeked',()=>{skipTick();apTick()});
// keys: S skip, Enter skip while visible, C chapters
addEventListener('keydown',e=>{if($('#player').hidden||!$('#voice').hidden||!ask.hidden||/INPUT|SELECT|TEXTAREA/.test(e.target.tagName))return;const k=e.key.toLowerCase();
  if(k==='s'&&!e.ctrlKey&&!e.metaKey){if(skipKind){e.preventDefault();doSkip()}}
  else if(e.key==='Enter'&&skipKind&&!e.target.closest('button')){e.preventDefault();doSkip()}
  else if(k==='c'&&!e.ctrlKey&&!e.metaKey){toggle('#pUpnext',true);setTimeout(()=>{const h=$('#chapHead');if(h){h.focus({preventScroll:true});h.closest('.pc').scrollTop=h.offsetTop-16;}st.scrollLeft=0;st.scrollTop=0;},60)}});

// ================= S1-S4 (APPLE-POLISH-SPEC-v1) =================
const RM=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
const EASE='cubic-bezier(0.32,0.72,0,1)';
// --- S1 sidebar: primary destinations, collections/playlists, Settings + profile at bottom; collapsible
$('#nav').innerHTML=[["#home","Home","home"],["#lib/rec","Movies","decade"],["#tv/shows","TV Shows","studio"]].map(([r,n,ic])=>`<a href="${r}" data-r="${r}" data-label="${n}">${I(ic)}<span>${n}</span></a>`).join('')+
 `<div class="navh muted small">Collections</div>`+COLLECTIONS.slice(0,4).map(c=>`<a href="#lib/collections/${encodeURIComponent(c)}" data-r="#lib/collections/${encodeURIComponent(c)}" data-label="Collection · ${esc(c)}">${I('collection')}<span>${esc(c)}</span></a>`).join('')+
 `<a href="#settings" data-r="#settings" class="navset" data-label="Settings">${I('gear')}<span>Settings</span></a>`;
$$('#nav a').forEach(a=>a.setAttribute('aria-label',a.dataset.label));
const NAVK='plexuw.navc';function setNavC(c){document.body.classList.toggle('navc',c);localStorage.setItem(NAVK,c?'1':'0');const t=$('#logoBtn')||$('#navToggle');if(!t)return;const lab=(c?'Expand':'Collapse')+' sidebar';t.setAttribute('aria-label',lab);t.setAttribute('aria-expanded',String(!c));t.removeAttribute('title');if(c)t.dataset.tip='Expand sidebar';else delete t.dataset.tip}
setNavC(localStorage.getItem(NAVK)==='1');const logoTog=$('#logoBtn')||$('#navToggle');if(logoTog)logoTog.onclick=()=>setNavC(!document.body.classList.contains('navc'));
addEventListener('keydown',e=>{if(e.key==='['&&$('#player').hidden&&$('#pal').hidden&&!/INPUT|SELECT|TEXTAREA/.test(e.target.tagName))setNavC(!document.body.classList.contains('navc'))});
// in-library segmented tabs
const LTABS=[["rec","Recommended"],["all","Library"],["collections","Collections"],["cats","Categories"]];
$('#tabs').innerHTML=LTABS.map(([k,n])=>`<a href="#lib/${k}" data-t="${k}" role="tab">${n}</a>`).join('');$('#tabs').classList.add('seg2');$('#tabs').setAttribute('role','tablist');
const TVT=[["shows","Shows"],["genres","Genres"],["networks","Networks"],["collections","Collections"]];
const segTabs=(base,list,on)=>`<div class="tabs seg2" role="tablist">${list.map(([k,n])=>`<a href="${base}/${k}" class="${k===on?'on':''}" role="tab">${n}</a>`).join('')}</div>`;
$('#facetSel').onchange=e=>location.hash='#lib/'+e.target.value;
// --- S4 smart collections + genre tiles
const SMART={unwatched2h:["Unwatched · under 2h",m=>!m.watched&&m.mins<120],top:["Highly rated ★ 8+",m=>m.rating>=8],inprog:["In progress",m=>m.progress>0],nineties:["’90s night",m=>m.year>=1990&&m.year<2000],recent:["Added this month",m=>D.length&&m.added>=Math.max(...D.map(x=>x.added))-30*864e5],award:["Award winners",m=>m.tags.includes('Award Winner')]};
const castOf=m=>[0,1,2,3].map(k=>CAST[(m.id+k)%8]);
const endsAt=mins=>new Date(Date.now()+mins*60000).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'});
const hrow=(t,list,sub)=>list.length?`<h2 class="row-title">${t}</h2><div class="row hero">${list.map(m=>card(m,1,sub&&sub(m))).join('')}</div>`:'';
function libAlt(tab,arg){const el=$('#libAlt');
  if(tab==='rec'){const seed=D.find(m=>m.watched)||D[0];
    el.innerHTML=hrow('Continue Watching',D.filter(m=>m.progress),m=>`${Math.round(m.mins*(1-m.progress))} min left`)+hrow(`Because you watched ${esc(seed.title)}`,D.filter(m=>m.id!==seed.id&&m.genres.some(g=>seed.genres.includes(g))).slice(0,12))+hrow('Top rated',[...D].sort((a,b)=>b.rating-a.rating).slice(0,12),m=>`★ ${m.rating} · ${m.year}`)+hrow('Recently added',[...D].sort((a,b)=>b.added-a.added).slice(0,12));return;}
  if(tab==='cats'){const g=values('genres');
    el.innerHTML=`<h2 class="row-title">Genres</h2><div class="tiles">${g.map(([v,n],i)=>`<a class="tile" href="#lib/genres/${encodeURIComponent(v)}" style="--h:${(i*47)%360}"><b>${esc(v)}</b><span>${n} titles</span></a>`).join('')}</div>
     <h2 class="row-title">Smart collections <span class="muted small">auto-updating rules</span></h2><div class="tiles smart">${Object.entries(SMART).map(([k,[n,f]],i)=>`<a class="tile sm" href="#lib/smart/${k}" style="--h:${(200+i*29)%360}">${I('collection')}<b>${n}</b><span>${D.filter(f).length} titles</span></a>`).join('')}</div>`;return;}
  if(tab==='smart'||tab==='person'){const nm=decodeURIComponent(arg||''),[n,f]=tab==='smart'?(SMART[arg]||SMART.top):[nm,m=>castOf(m).includes(nm)];const list=D.filter(f);
    el.innerHTML=`<div class="crumbs"><a href="#lib/cats">${tab==='smart'?'Categories':'People'}</a> › ${esc(n)}</div><div class="muted small lc">${list.length} titles</div><div class="grid">${list.map(m=>card(m)).join('')}</div>`;}}
function azRail(){const r=$('#azRail'),on=innerWidth>=1920&&!$('#libGrid').hidden&&lib.sort==='title'&&lib.facet!=='collections';r.hidden=!on;if(!on)return;
  const have=new Set($$('#libGrid .card .t').map(t=>t.textContent.trim()[0].toUpperCase()));
  r.innerHTML=[...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'].map(L=>`<button data-l="${L}" ${have.has(L)?'':'disabled'}>${L}</button>`).join('');}
$('#azRail').onclick=e=>{const b=e.target.closest('button[data-l]');if(!b)return;const c=$$('#libGrid .card').find(c=>c.querySelector('.t').textContent.trim().toUpperCase().startsWith(b.dataset.l));if(c){const m=$('#main');m.scrollTo({top:c.getBoundingClientRect().top-m.getBoundingClientRect().top+m.scrollTop-80,behavior:RM()?'auto':'smooth'});c.focus({preventScroll:true})}};
const _rl=renderLib;renderLib=function(){_rl();requestAnimationFrame(azRail)};
// Next Up movie cards: box-set progress
function nextUpProgress(){$$('#nextup .card').forEach(c=>{if(c.querySelector('.pbar'))return;const m=ITEMS[c.dataset.id],p=D.filter(x=>x.collection===m.collection),w=p.filter(x=>x.watched).length;c.querySelector('.poster').insertAdjacentHTML('afterend',`<div class="pbar"><i style="width:${w/p.length*100}%"></i></div>`);c.querySelector('.muted').textContent+=` · ${w} of ${p.length} watched`})}nextUpProgress();
// --- S3 details page + shared-element morph
var morph=null,playFx=null,backFx=null,fromDetails=null,pendingStart=null;
function morphFrom(cd){const p=cd.querySelector('.poster');if(!p)return;morph={id:+cd.dataset.id,r:p.getBoundingClientRect()}}
function renderDetails(id){const m=ITEMS[id]||D[0]||BLANK;if(!m||!m.title){$('#detView').textContent='';return;}const left=m.progress?Math.round(m.mins*(1-m.progress)):m.mins,cast=castOf(m);
  $('#detView').innerHTML=`<div class="det"><div class="dback" id="dBack" style="background-image:${art(m,320,180)}"></div><div class="dshade"></div>
   <button class="dbk tb" id="detBack" title="Back (Esc)">‹ Back</button>
   <div class="dwrap"><div class="poster dposter" id="dPoster" style="background-image:${art(m)}"></div>
    <div class="dinfo"><h1>${esc(m.title)}</h1><div class="dmeta muted">${m.year} · ${m.genres.join(', ')} · ${Math.floor(m.mins/60)}h ${m.mins%60}m · ★ ${m.rating} · ${esc(m.studio)}</div>
     <div class="dacts"><button class="btn primary big" id="dPlay">${I('play')}${m.progress?`Resume · ${left} min left`:'Play'}</button>${m.progress?`<button class="btn" id="dStart">Start over</button>`:''}</div>
     <div class="ends" id="dEnds">Ends at ${endsAt(left)}</div>${m.progress?`<div class="pbar dpb"><i style="width:${m.progress*100}%"></i></div>`:''}
     <p class="dsum">${esc(m.summary)}</p>
     <div class="dcast">${cast.map(n=>`<a class="person" href="#lib/person/${encodeURIComponent(n)}"><span class="av">${n.split(' ').map(x=>x[0]).join('')}</span>${esc(n)}</a>`).join('')}</div>
     ${m.collection?`<div class="muted small">Part ${m.part} of <a href="#lib/collections/${encodeURIComponent(m.collection)}">${esc(m.collection)}</a></div>`:''}</div></div></div>`;
  $('#dPlay').onclick=()=>playFromDetails(m,m.progress?'resume':'start');if($('#dStart'))$('#dStart').onclick=()=>playFromDetails(m,'start');
  $('#detBack').onclick=()=>history.length>1&&lastLib?location.hash=lastLib:location.hash='#home';}
function flip(el,from,dur){if(RM()||!from)return;const to=el.getBoundingClientRect();if(!to.width)return;
  el.animate([{transformOrigin:'0 0',transform:`translate(${from.left-to.left}px,${from.top-to.top}px) scale(${from.width/to.width},${from.height/to.height})`},{transformOrigin:'0 0',transform:'none'}],{duration:dur,easing:EASE})}
function fx(bg,from,to,dur,done){if(RM()){done&&done();return}const o=document.createElement('div');o.className='morphfx';o.style.backgroundImage=bg;document.body.appendChild(o);
  const R=r=>({left:r.left+'px',top:r.top+'px',width:r.width+'px',height:r.height+'px'});const a=o.animate([R(from),R(to)],{duration:dur,easing:EASE,fill:'forwards'});a.onfinish=()=>{done&&done();requestAnimationFrame(()=>o.remove())};return o}
const full=()=>({left:0,top:0,width:innerWidth,height:innerHeight});
function playFromDetails(m,how){fromDetails=m.id;pendingStart={id:m.id,at:how==='resume'?m.progress:0};const b=$('#dBack');
  $('#home').classList.add('chromefade');fx(b.style.backgroundImage,b.getBoundingClientRect(),full(),450,()=>{location.hash='#player/'+m.id;$('#home').classList.remove('chromefade')});}
function goBackFromPlayer(){
  if(String(location.hash||'').indexOf('#player/plex')===0||(cur&&cur.id==='plex')){
    const ctx=plexCtx();
    const ret=(ctx.returnHash&&String(ctx.returnHash).indexOf('#px/')===0)?ctx.returnHash:'#px/home';
    try{sessionStorage.removeItem('pxPlayCtx')}catch(e){}
    window.__pxPlayDur=0;
    try{vid.pause()}catch(e){}
    if(vid.getAttribute('src')){vid.removeAttribute('src');vid.load()}
    const amb=$('#ambient');if(amb)amb.style.backgroundImage='none';
    st.classList.remove('amb');
    $('#home').hidden=false;$('#player').hidden=true;
    document.body.classList.remove('inplayer');
    paintDur();
    if(location.hash===ret){history.replaceState(null,'',ret);dispatchEvent(new HashChangeEvent('hashchange'))}
    else location.hash=ret;
    const px=document.getElementById('pxView');
    if(px&&!px.querySelector('.pxshell,.pxhome,.pxrow,.pxdet'))dispatchEvent(new HashChangeEvent('hashchange'));
    return;
  }
  if(window.__PLEXUW_SHIP||!D.length){location.hash='#home';return;}
  if(fromDetails!=null&&String(cur.id)===String(fromDetails)){backFx=true;location.hash='#title/'+fromDetails}else location.hash=lastLib||'#home'}
$('#back').onclick=goBackFromPlayer;
addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('#detView').hidden&&$('#pal').hidden&&ask.hidden&&$('#voice').hidden)$('#detBack').click()});
// scroll memory per library view
const scrollMem={};var curKey=location.hash||'#home',lastLib=null;
$('#main').addEventListener('scroll',()=>{if(!$('#home').hidden)scrollMem[curKey]=$('#main').scrollTop},{passive:true});
function sPost(){const h=location.hash||'#home';
  if(h.startsWith('#music'))return;
  const parts=h.split('/'),isL=h.startsWith('#lib/'),isD=h.startsWith('#title/'),isP=h.startsWith('#player');
  $('#detView').hidden=!isD;if(isD){$('#homeView').hidden=true;$('#libView').hidden=true;$('#tvView').hidden=true;$('#setView').hidden=true;}
  // nav highlight
  const sec=isL||isD?'#lib/rec':h.startsWith('#tv')?'#tv/shows':h==='#settings'?'#settings':'#home';
  $$('#nav a').forEach(a=>a.classList.toggle('on',a.dataset.r===h||(a.dataset.r===sec&&!$$('#nav a').some(x=>x.dataset.r===h))));
  if(isL){const t=parts[1],alt=['rec','cats','smart','person'].includes(t);if(t==='all'){lib.facet=$('#facetSel').value||'genres';lib.sel.clear()}
    const tab=alt?(t==='rec'?'rec':'cats'):t==='collections'?'collections':'all';$$('#tabs a').forEach(a=>{a.classList.toggle('on',a.dataset.t===tab);a.setAttribute('aria-selected',a.dataset.t===tab)});
    $('#libAlt').hidden=!alt;$('.libbar').hidden=alt;$('#libCount').hidden=alt;$('#libGrid').hidden=alt;$('#facetWrap').hidden=tab!=='all';if(tab==='all')$('#facetSel').value=lib.facet;
    if(alt)libAlt(t,parts[2]);else renderLib();lastLib=h;}
  if(h.startsWith('#tv/')&&parts[1]!=='show'){$('#tvView').insertAdjacentHTML('afterbegin',segTabs('#tv',TVT,parts[1]||'shows'))}
  if(!isP&&!isD&&h!=='#settings')lastLib=h;
  if(isD){renderDetails(+parts[1]);if(backFx){backFx=false;const b=$('#dBack');const r=b.getBoundingClientRect();b.style.visibility='hidden';fx(b.style.backgroundImage,full(),r,450,()=>b.style.visibility='');$('#detView').animate([{opacity:0},{opacity:1}],{duration:RM()?0:300,delay:150,fill:'backwards'})}
    else if(morph&&morph.id===+parts[1]){flip($('#dPoster'),morph.r,450);$$('.dinfo,.dback').forEach(x=>x.animate([{opacity:0},{opacity:1}],{duration:RM()?0:250,delay:RM()?0:150,fill:'backwards'}))}morph=null;}
  if(isP&&pendingStart&&pendingStart.id===+parts[1]){const at=pendingStart.at;pendingStart=null;const go=()=>{vid.currentTime=at*(dur())};vid.readyState>=1?go():vid.addEventListener('loadedmetadata',go,{once:true});if(!RM())st.animate([{opacity:.6},{opacity:1}],{duration:200})}
  // fu7g MUST-1: #px/ routes own their scroll (plex-browse back stack); never reset it here.
  if(!isP&&!h.startsWith('#px/')){curKey=h;$('#main').scrollTop=scrollMem[h]||0;}}
addEventListener('hashchange',sPost);sPost();
// info panel: Ends at
const _rp=renderPanels;renderPanels=function(){_rp();const b=$('#detailsBody');if(!b||b.querySelector('.ends')||(cur&&cur.id==='plex'))return;const d=dur(),left=d?Math.max(0,Math.round((cur.mins||0)*(1-vid.currentTime/d))):0;
  const h=b.querySelector('h3,h2,.ptitle')||b.querySelector('.ptabs');h&&h.insertAdjacentHTML('afterend',`<div class="ends" id="pEnds">Ends at ${endsAt(left)} <span class="muted">· ${left} min left</span></div>`)};
// --- S2 command palette (Ctrl/Cmd-K)
const pal=$('#pal'),palq=$('#palq');let palSel=0,palItems=[];
const CMDS=[["Go to Home",()=>location.hash='#home'],["Go to Movies",()=>location.hash='#lib/rec'],["Go to Movies · Library",()=>location.hash='#lib/all'],["Go to Movies · Categories",()=>location.hash='#lib/cats'],["Go to TV Shows",()=>location.hash='#tv/shows'],["Open Settings",()=>location.hash='#settings'],
 ["Toggle sidebar",()=>setNavC(!document.body.classList.contains('navc'))],["Toggle autoplay next episode",()=>{localStorage.setItem(AP_KEY,apOn()?'0':'1');apSync();toast('Autoplay '+(apOn()?'on':'off'))}],["Shuffle an unwatched movie",()=>{const u=D.filter(m=>!m.watched);location.hash='#title/'+u[Math.floor(Math.random()*u.length)].id}],
 ["Open Info panel (I)",()=>{if(!$('#player').hidden)toggle('#pDetails',true)},1],["Open Up Next (U)",()=>{if(!$('#player').hidden)toggle('#pUpnext',true)},1]];
function palRender(){const q=palq.value.trim().toLowerCase(),inP=!$('#player').hidden,mt=s=>!q||s.toLowerCase().includes(q);
  const titles=[...D.map(m=>({k:'t',l:m.title,s:`Movie · ${m.year} · ${m.genres[0]}`,go:()=>{location.hash='#title/'+m.id},bg:art(m)})),...TV.map(s=>({k:'t',l:s.title,s:`TV show · ${s.network}`,go:()=>location.hash='#tv/show/'+s.id,bg:art(s)}))].filter(x=>q?mt(x.l):false).slice(0,6);
  if(!q)D.filter(m=>m.progress).slice(0,3).forEach(m=>titles.push({k:'t',l:m.title,s:`Continue · ${Math.round(m.mins*(1-m.progress))} min left`,go:()=>location.hash='#title/'+m.id,bg:art(m)}));
  const people=CAST.filter(mt).slice(0,q?4:0).map(n=>({k:'p',l:n,s:`Actor · ${D.filter(m=>castOf(m).includes(n)).length} titles`,go:()=>location.hash='#lib/person/'+encodeURIComponent(n),av:n.split(' ').map(x=>x[0]).join('')}));
  const cmds=CMDS.filter(c=>(!c[2]||inP)&&mt(c[0])).slice(0,q?5:6).map(c=>({k:'c',l:c[0],go:c[1]}));
  const ai=q?[{k:'a',l:`Ask AI: “${palq.value.trim()}”`,s:'Mock answer · no request sent',go:()=>palAnswer(palq.value.trim()),stay:1}]:[];
  palItems=[...titles,...people,...cmds,...ai];palSel=Math.min(palSel,Math.max(0,palItems.length-1));
  const grp=(n,k)=>{const xs=palItems.map((x,i)=>[x,i]).filter(([x])=>x.k===k);return xs.length?`<div class="pgh">${n}</div>`+xs.map(([x,i])=>`<div class="pit ${i===palSel?'sel':''}" role="option" id="pi${i}" aria-selected="${i===palSel}" data-i="${i}">${x.bg?`<span class="pth" style="background-image:${x.bg}"></span>`:x.av?`<span class="av">${x.av}</span>`:`<span class="pic">${I(k==='a'?'search':'more')}</span>`}<span class="pl">${esc(x.l)}${x.s?`<small class="muted">${esc(x.s)}</small>`:''}</span>${i===palSel?'<kbd>↵</kbd>':''}</div>`).join(''):''};
  $('#palList').innerHTML=(grp(q?'Titles':'Continue watching','t')+grp('People','p')+grp('Commands','c')+grp('Ask AI','a'))||`<div class="muted small pempty">No matches — press Enter to ask AI (mock)</div>`;palq.setAttribute('aria-activedescendant','pi'+palSel);
  const s=$('#palList .sel');s&&s.scrollIntoView({block:'nearest'});}
function palAnswer(q){const m=D.find(x=>!x.watched&&x.rating>=7)||D[1];$('#palList').innerHTML=`<div class="pgh">Ask AI · mock</div><div class="anscard pans"><b>Here’s a pick for “${esc(q)}”</b><p class="muted small">${esc(m.title)} (${m.year}) — ${m.genres[0]}, ★ ${m.rating}, ${m.mins} min, unwatched. Canned response; nothing was sent to a provider.</p><button class="btn accent" id="palOpen">Open ${esc(m.title)}</button></div>`;$('#palOpen').onclick=()=>{palClose();location.hash='#title/'+m.id};palItems=[];}
let palPrev=null;function palOpen(){palPrev=document.activeElement;pal.hidden=false;palq.value='';palSel=0;palRender();palq.focus();if(!RM())$('.palbox').animate([{opacity:0,transform:'scale(.98)'},{opacity:1,transform:'scale(1)'}],{duration:200,easing:EASE})}
function palClose(){pal.hidden=true;palPrev&&palPrev.focus&&palPrev.focus({preventScroll:true})}
palq.addEventListener('input',()=>{palSel=0;palRender()});pal.querySelector('.modal-bg').onclick=palClose;
$('#palList').addEventListener('mousemove',e=>{const it=e.target.closest('.pit');if(it&&+it.dataset.i!==palSel){palSel=+it.dataset.i;palRender()}});
$('#palList').addEventListener('click',e=>{const it=e.target.closest('.pit');if(it){palSel=+it.dataset.i;palRun()}});
function palRun(){const x=palItems[palSel];if(!x){if(palq.value.trim())palAnswer(palq.value.trim());return}if(x.stay){x.go();return}palClose();x.go()}
addEventListener('keydown',e=>{if(document.body.classList.contains('plexmode')&&pal.hidden)return;/* Plex mode: Ctrl-K belongs to the Plex search palette */if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();e.stopImmediatePropagation();if(!ask.hidden)closeAsk();pal.hidden?palOpen():palClose();return}
  if(pal.hidden)return;e.stopImmediatePropagation();
  if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();if(palItems.length){palSel=(palSel+(e.key==='ArrowDown'?1:-1)+palItems.length)%palItems.length;palRender()}}
  else if(e.key==='Enter'){e.preventDefault();palRun()}else if(e.key==='Escape'){e.preventDefault();palClose()}},true);
$('#askBtn').onclick=palOpen;
if(qs.get('pal'))setTimeout(()=>{palOpen();palq.value=qs.get('pal')==='1'?'':qs.get('pal');palRender()},200);
