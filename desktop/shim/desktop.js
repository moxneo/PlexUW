// PlexUW desktop shell glue. Loaded after app.js. Bundled locally by esbuild
// (sync-web.sh) because withGlobalTauri is false (§6a M3). No Plex token ever reaches JS.
import { invoke as tInvoke } from '@tauri-apps/api/core';
import { listen as tListen } from '@tauri-apps/api/event';
import Hls from 'hls.js/dist/hls.light.min.js';
import { mountPlexBrowse, img } from './plex-browse.js';
import { pxIcon } from './px-icons.js';
import { coldStartOverlay, shouldDismissConnect } from './cold-start.js';
const TAURI = window.__TAURI_INTERNALS__ ? { core: { invoke: tInvoke }, event: { listen: tListen } } : null;
(function(){
  const T=TAURI; if(!T||!T.core) return; // plain browser: do nothing
  const invoke=T.core.invoke, body=document.body; body.classList.add('desktop');
  // Splash (lockup mark)
  const sp=document.createElement('div');sp.id='dtSplash';sp.innerHTML='<img src="brand/plexuw-lockup-dark.svg" alt="PlexUW">';body.appendChild(sp);
  setTimeout(()=>{sp.classList.add('out');setTimeout(()=>sp.remove(),450)},new URLSearchParams(location.search).get('splash')==='hold'?1e9:1100);
  // Frameless title bar
  const ic={min:'<svg viewBox="0 0 14 14"><path d="M2 7h10"/></svg>',max:'<svg viewBox="0 0 14 14"><rect x="2.5" y="2.5" width="9" height="9"/></svg>',close:'<svg viewBox="0 0 14 14"><path d="M3 3l8 8M11 3l-8 8"/></svg>'};
  const tb=document.createElement('div');tb.id='dtTitle';
  tb.innerHTML=`<div class="mark" data-tauri-drag-region title="PlexUW"></div><div class="drag" data-tauri-drag-region></div><button class="wb" id="dtMin" title="Minimize">${ic.min}</button><button class="wb" id="dtMax" title="Maximize">${ic.max}</button><button class="wb close" id="dtClose" title="Close">${ic.close}</button>`;
  body.prepend(tb);
  const W={min:()=>invoke('win_minimize'),max:()=>invoke('win_toggle_maximize'),close:()=>invoke('win_close'),fs:()=>invoke('win_toggle_fullscreen').then(syncFs)};
  function syncFs(v){if(typeof v==='boolean')body.classList.toggle('fs',v);else invoke('win_is_fullscreen').then(f=>body.classList.toggle('fs',!!f))}
  $('#dtMin').onclick=W.min;$('#dtMax').onclick=W.max;$('#dtClose').onclick=W.close;
  // Player's own top bar: wire its window buttons too, and make it draggable
  const ptb=document.querySelector('#player .tr');
  if(ptb){const bs=ptb.querySelectorAll('button.tb');bs.forEach(b=>{if(b.title==='Minimize')b.onclick=W.min;if(b.title==='Maximize')b.onclick=W.max})}
  const bF=document.getElementById('bF'); if(bF) bF.onclick=W.fs; // app fullscreen button -> real borderless window fullscreen
  addEventListener('keydown',e=>{if(e.key==='F11'){e.preventDefault();e.stopImmediatePropagation();W.fs()}},true);
  // Hide shell title bar while the player (which has its own chrome) is showing
  const pl=document.getElementById('player');const upd=()=>body.classList.toggle('inplayer',!!pl&&!pl.hidden);
  if(pl)new MutationObserver(upd).observe(pl,{attributes:true,attributeFilter:['hidden']});upd();
  addEventListener('resize',()=>syncFs());syncFs();
  // Media keys -> player. Focused window: DOM key events; unfocused: Rust global shortcuts emit 'media-key'.
  function media(k){const v=(typeof vid!=='undefined'?vid:null), inP=pl&&!pl.hidden;
    if(k==='MediaPlayPause'){if(inP)document.getElementById('play').click();}
    else if(k==='MediaStop'){if(inP){v&&v.pause();if(String(location.hash||'').indexOf('#player/plex')===0&&typeof goBackFromPlayer==='function')goBackFromPlayer();else location.hash='#home'}}
    else if(k==='MediaNextTrack'){if(inP&&typeof nextEp==='function'&&nextEp())location.hash='#player/'+nextEp().id}
    else if(k==='MediaPreviousTrack'){if(inP&&v){if(v.currentTime>3)v.currentTime=0;else history.back()}}
    window.__lastMediaKey=k;}
  window.__plexuwMedia=media;
  addEventListener('keydown',e=>{if(/^Media(PlayPause|NextTrack|PreviousTrack|Stop)$/.test(e.key)){e.preventDefault();media(e.key)}},true);
  if(T.event)T.event.listen('media-key',ev=>media(ev.payload));
  if('mediaSession' in navigator){const ms=navigator.mediaSession;
    [['play','MediaPlayPause'],['pause','MediaPlayPause'],['nexttrack','MediaNextTrack'],['previoustrack','MediaPreviousTrack'],['stop','MediaStop']].forEach(([a,k])=>{try{ms.setActionHandler(a,()=>media(k))}catch(_){}})}
  function $(s){return document.querySelector(s)}
})();

// ---- M1: Plex sign-in, server picker, source badge. Tokens never reach this file;
// every string from Rust is rendered with textContent.
(function(){
  const T=TAURI; if(!T||!T.core) return;
  const invoke=T.core.invoke, listen=T.event&&T.event.listen;
  const el=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=text;return e};
  const btn=(text,cls,fn)=>{const b=el('button','px-btn'+(cls?' '+cls:''),text);b.type='button';b.onclick=fn;return b};
  // Persistent source badge in the sidebar footer
  const foot=document.querySelector('.side-foot');
  const badge=el('button','px-badge');badge.type='button';let cur=null;badge.onclick=()=>cur&&cur.kind==='plex'?connected(cur):open();
  if(foot){foot.textContent='';foot.appendChild(badge)}
  const KIND={local:'Local',remote:'Remote',manual:'Remote (manual)',relay:'Relay'};
  const PB=mountPlexBrowse(invoke,{connect:s=>connect(s),why:e=>why(e),profile:()=>openAccount(),listen,...(__PLEXUW_MOCK__?{pageDelay:()=>window.__pxDelay||0,navDelay:()=>window.__pxNavDelay||0}:{})});
  // fu6: one icon set in the chrome (brand mark, Ask button). Collapse lives on the logo. Static shell nodes only.
  {const sw=(sel,n)=>{const h=document.querySelector(sel);if(!h)return;const o=h.querySelector('svg');o?o.replaceWith(pxIcon(n)):h.prepend(pxIcon(n))};
   sw('.brand .logo','mark');sw('#askBtn','ask');
   const ab=document.getElementById('askBtn');if(ab){const t=ab.querySelector('span');if(t)t.textContent='Ask your library';ab.setAttribute('aria-label','Ask your library (Ctrl+K)');ab.setAttribute('aria-keyshortcuts','Control+K');ab.title='Search or ask your library (Ctrl+K)'}
   const set=document.querySelector('.profile .pxset');if(set&&!set.querySelector('svg'))set.prepend(pxIcon('gear'))}
  // fu6 QA LOW-1: demo-mode rail (app.js #nav) uses the same px icon set; collections/playlists get an initial so they differ.
  {const nav=document.getElementById('nav');const DI=r=>r==='#home'?'home':r==='#settings'?'gear':/^#lib\/collections\//.test(r)?'folder':/^#lib\//.test(r)?'film':/^#tv\//.test(r)?'tv':/^#music\/playlist/.test(r)?'playlist':/^#music\//.test(r)?'music':'';
   const fix=()=>{if(!nav)return;nav.querySelectorAll('a[data-r]').forEach(a=>{const n=DI(a.dataset.r);const o=a.querySelector('svg');if(!n||!o||o.classList.contains('pxi'))return;o.replaceWith(pxIcon(n));
     if(/collections\/|playlist\//.test(a.dataset.r)){const t=(a.querySelector('span')||a).textContent.trim();a.dataset.ini=(t.match(/[A-Za-z0-9]/)||[''])[0].toUpperCase();a.classList.add('pxini')}})};
   fix();if(nav)new MutationObserver(fix).observe(nav,{childList:true});
  // fu6 QA LOW-2: the rail toggle's tooltip/label always names the action for the current state.
   const tg=document.getElementById('logoBtn');const compact=()=>document.body.classList.contains('navc')||matchMedia('(max-width:1599px)').matches&&!document.body.classList.contains('navo');const lab=()=>{if(!tg)return;const c=compact();const t=(c?'Expand':'Collapse')+' sidebar';tg.setAttribute('aria-label',t);tg.setAttribute('aria-expanded',String(!c));tg.removeAttribute('title');delete tg.dataset.tip;if(c&&!document.body.classList.contains('navo'))tg.dataset.label='Expand';else delete tg.dataset.label};
   lab();new MutationObserver(lab).observe(document.body,{attributes:true,attributeFilter:['class']});addEventListener('resize',lab);if(tg)tg.addEventListener('click',()=>setTimeout(lab,0))}
  // FU7: below 1600px the toggle opens the full rail as an overlay; click outside or Esc closes it.
  {const tg=document.getElementById('logoBtn');const narrow=()=>matchMedia('(max-width:1599px)').matches;let scrim=null;
   const shut=()=>{document.body.classList.remove('navo');scrim&&scrim.remove();scrim=null};
   if(tg)tg.addEventListener('click',e=>{if(!narrow())return;e.preventDefault();e.stopImmediatePropagation();
     if(document.body.classList.contains('navo'))return shut();document.body.classList.add('navo');scrim=el('div','pxnavscrim');scrim.onclick=shut;document.body.appendChild(scrim)},true);
   addEventListener('keydown',e=>{if(e.key==='Escape'&&document.body.classList.contains('navo')){e.stopImmediatePropagation();shut()}},true);
   addEventListener('hashchange',shut);addEventListener('resize',()=>{if(!narrow())shut()})}
  // Top-right clock (HTPC reference).
  {const ck=el('div','pxclock');ck.setAttribute('aria-hidden','true');document.body.appendChild(ck);const tick=()=>{ck.textContent=new Date().toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})};tick();setInterval(tick,15000)}
  function showSource(s, signedIn){cur=s;PB&&PB.setSource(s);
    badge.textContent='';badge.classList.toggle('demo',s.kind==='demo');
    // A keychain session is signed-in even while Rust is still on the first-run placeholder.
    // Offline reconnect keeps that session; only a real signed-out state hides the library.
    const authed=s.kind==='demo'&&(signedIn===true||(signedIn==null&&s.reason==='offline'));
    if(s.kind==='demo'){document.body.classList.toggle('pxneedsign',!authed);badge.appendChild(el('span','px-dot'+(authed?' on':'')));badge.appendChild(el('b',null,authed?'Signed in':'Not signed in'));
      badge.appendChild(el('span','px-sub',s.reason==='offline'?'Server unreachable':(authed?'Connecting…':'Sign in to Plex')));}
    else{document.body.classList.remove('pxneedsign');paintAccount();badge.appendChild(el('span','px-dot on'));badge.appendChild(el('b',null,s.server));
      badge.appendChild(el('span','px-chip '+s.connection,KIND[s.connection]||s.connection));}
  }
  // Overlay
  const ov=el('div');ov.id='pxOverlay';ov.hidden=true;
  const card=el('div','px-card');ov.appendChild(card);document.body.appendChild(ov);
  let pinUp=false;
  ov.addEventListener('click',e=>{if(e.target===ov&&!pinUp)close()});
  addEventListener('keydown',e=>{if(e.key==='Escape'&&!ov.hidden){e.stopImmediatePropagation();pinUp?pinCancel():close()}},true);
  let pinTimer=null;
  function pinCancel(){pinUp=false;clearInterval(pinTimer);invoke('auth_cancel');welcome()}
  function close(){pinUp=false;ov.hidden=true;clearInterval(pinTimer);invoke('auth_cancel')}
  function screen(title,sub){clearInterval(pinTimer);pinUp=false;card.textContent='';ov.hidden=false;
    card.appendChild(el('h2',null,title));if(sub)card.appendChild(el('p','px-sub',sub));return card}
  async function open(){const st=await invoke('source_get');
    if(st.keychain==='unavailable')return keychain();
    if(st.signedIn)return auto();return welcome(st)}
  // fu7e: merged servers are the model. After sign-in PlexUW connects on its own (best owned,
  // online server first; every other server joins the merged views). 'Choose a server' lives
  // only in Settings → Account & server.
  async function auto(){let list;try{list=await invoke('servers_list')}catch(e){return error(why(e))}
    const best=list.find(s=>s.owned&&s.online)||list.find(s=>s.online)||list[0];
    if(!best){const c=screen('No servers on this account','Add a server by address in Settings → Account & server.');const row=el('div','px-row');row.appendChild(btn('Open settings','primary',()=>{close();openAccount()}));row.appendChild(btn('Close','',close));c.appendChild(row);return}
    connect(best,null,true)}
  function welcome(){const c=screen('Connect to Plex','Sign in with your Plex account to browse your own libraries. Your token is kept in the system keychain and never shown here.');
    const row=el('div','px-row');row.appendChild(btn('Sign in with Plex','primary',()=>start()));c.appendChild(row)}
  async function start(){let p;
    try{p=await invoke('auth_start',{strong:false})}catch(e){return error(why(e))}
    const c=screen('Sign in to Plex',p.browserOpened?'We opened plex.tv in your browser. Approve PlexUW there, or on any device go to plex.tv/link and enter this code:':'On any device, go to plex.tv/link and enter this code:');
    c.appendChild(el('div','px-code',p.code));
    c.appendChild(el('p','px-link','plex.tv/link'));
    const t=el('p','px-sub px-timer');c.appendChild(t);
    let left=p.expiresIn;const tick=()=>{if(left<=0){expired();return}t.textContent='Waiting for approval · code expires in '+Math.floor(left/60)+':'+String(left%60).padStart(2,'0');left--};tick();pinTimer=setInterval(tick,1000);
    // FU7: the code always stays in the app with a waiting state; Cancel returns here, never to demo Home.
    pinUp=true;const row=el('div','px-row');row.appendChild(btn('Cancel','',pinCancel));c.appendChild(row)}
  function expired(){const c=screen('That code expired','Codes are short-lived for safety.');
    const row=el('div','px-row');row.appendChild(btn('Get a new code','primary',()=>start()));row.appendChild(btn('Cancel','',close));c.appendChild(row)}
  function keychain(){const linux=/Linux/.test(navigator.userAgent)&&!/Android/.test(navigator.userAgent);const c=screen('Couldn’t save your sign-in',linux?'PlexUW couldn’t save your sign-in securely. Your system has no keyring service running (for example GNOME Keyring or KWallet). Install or unlock one, then try again.':'PlexUW couldn’t save your sign-in securely because the system credential store didn’t respond. Try again.');c.appendChild(el('p','px-sub','Nothing was saved to disk.'));
    const row=el('div','px-row');row.appendChild(btn('Retry','primary',()=>open()));row.appendChild(btn('Close','',close));c.appendChild(row)}
  // Sentinel follow-up: Rust returns a fixed category; only fixed text is shown, never raw error text.
  const WHY={unreachable:'None of this server’s addresses answered. Check that the server is on and reachable.',
    timeout:'The server took too long to answer (over 5 seconds per address).',
    tls:'The server’s secure connection could not be verified, so nothing was sent.',
    'not-on-account':'That server isn’t on your Plex account.',
    'signed-out':'You’re signed out of Plex. Sign in again.',
    blocked:'The connection was blocked: the address redirected or returned a page that isn’t a Plex server (for example a login or challenge page).',
    keychain:'The system keychain reported an error.',
    'keychain-unavailable':'No system keychain is available.',
    'keychain-toolong':'The system keychain refused the sign-in data because it is too large.',
    'keychain-timeout':'The system keychain didn’t respond in time.',
    'keychain-stale':'Sign-in was cancelled because you signed out while it was saving.',
    'keychain-missing':'Saved sign-in data in the system keychain is incomplete. Sign in again.',
    'signout-incomplete':'Some saved sign-in data could not be removed from the system keychain. Try signing out again.',
    'bad-address':'Enter an https address like plex.example.com.'};
  const why=e=>WHY[String(e)]||'Something went wrong. Try again.';
  function error(msg){const c=screen('Something went wrong',msg);const row=el('div','px-row');
    row.appendChild(btn('Try again','primary',()=>open()));row.appendChild(btn('Close','',close));c.appendChild(row)}
  async function servers(){const c=screen('Choose a server','Servers on your Plex account.');
    let list;try{list=await invoke('servers_list')}catch(e){return error(why(e))}
    const ul=el('div','px-list');
    list.forEach(s=>{const it=el('button','px-srv');it.type='button';
      it.appendChild(el('span','px-dot'+(s.online?' on':'')));const n=el('span','px-name',s.name);it.appendChild(n);
      it.appendChild(el('span','px-tag',s.owned?'Owned':'Shared'));it.appendChild(el('span','px-tag',s.online?'Online':'Offline'));
      it.onclick=()=>connect(s);ul.appendChild(it)});
    if(!list.length)ul.appendChild(el('p','px-sub','No servers on this account.'));
    c.appendChild(ul);
    const prefs=await invoke('prefs_get');
    const man=el('div','px-manual');man.appendChild(el('label',null,'Or connect by address'));
    const inp=el('input');inp.value=prefs.manualHost||'';inp.placeholder='https://plex.example.com';inp.spellcheck=false;man.appendChild(inp);
    const msg=el('p','px-sub');
    man.appendChild(btn('Check','',async()=>{msg.textContent='Checking…';try{const r=await invoke('manual_probe',{host:inp.value});
      const go=()=>{msg.textContent='Found '+(r.name||'your server')+'.';const s=list.find(x=>x.id===r.id);if(s)connect(s)};
      if(!r.needsConfirm){go();return}
      // MED-1: host is not in this server's plex.tv connection list -> ask before any token goes there.
      while(ask.firstChild)ask.removeChild(ask.firstChild);
      ask.appendChild(el('p','px-sub',r.host+' answers as '+(r.name||'your server')+' but is not one of its addresses on your Plex account. Send your server token to '+r.host+'?'));
      ask.appendChild(btn('Allow','primary',async()=>{ask.textContent='';if(await invoke('manual_confirm',{allow:true}))go()}));
      ask.appendChild(btn("Don't allow",'',async()=>{ask.textContent='';await invoke('manual_confirm',{allow:false});msg.textContent='Not connected. Your token was not sent.'}));
      msg.textContent=''}catch(e){msg.textContent=why(e)}}));
    const ask=el('div','px-row px-ask');man.appendChild(ask);
    c.appendChild(man);c.appendChild(msg);
    const row=el('div','px-row');row.appendChild(btn('Sign out','',async()=>{try{showSource(await invoke('sign_out'));welcome()}catch(e){error(why(e))}}));
    row.appendChild(btn('Close','',close));c.appendChild(row)}
  async function connect(s,hold,quiet){const c=screen('Connecting to '+s.name,'Trying every address at once: local and your saved address first, then remote, then relay.');
    const pr=el('p','px-sub px-progress');const sp=el('span','pxspin');sp.setAttribute('aria-hidden','true');pr.appendChild(sp);const pt=el('span',null,'Connecting… 0 s');pr.appendChild(pt);pr.setAttribute('role','status');c.appendChild(pr);
    let secs=0;pinTimer=setInterval(()=>{secs++;pt.textContent='Connecting… '+secs+' s'+(secs>=4?' (relay can take a few more seconds)':'')},1000);
    // da Vinci LOW: a switch can be cancelled while connecting; Rust keeps the current server
    // and returns it, so the UI always shows what Rust is actually connected to.
    let cancelled=false;const row=el('div','px-row');row.appendChild(btn('Cancel','',async()=>{cancelled=true;clearInterval(pinTimer);try{showSource(await invoke('server_connect_cancel'))}catch{}close()}));c.appendChild(row);
    try{if(hold)await hold;if(cancelled)return;const v=await invoke('server_connect',{id:s.id});if(cancelled)return;clearInterval(pinTimer);showSource(v);if(quiet&&v.connection!=='relay')close();else connected(v)}
    catch(e){if(cancelled||String(e)==='cancelled')return;clearInterval(pinTimer);showSource({kind:'demo',reason:'offline'});error(why(e))}}
  function connected(v){const c=screen('Connected to '+v.server,null);
    const chip=el('p',null);chip.appendChild(el('span','px-chip '+v.connection,KIND[v.connection]||v.connection));c.appendChild(chip);
    if(v.connection==='relay'){const d=el('details','px-why');d.appendChild(el('summary',null,'Why relay?'));
      d.appendChild(el('p','px-sub','PlexUW couldn’t reach your server directly, so traffic goes through Plex’s relay. Relay is slower and limited to roughly 2 Mbps (approximate; Plex sets the limit). Enabling remote access on the server, or adding its address under “Connect by address”, avoids it.'));c.appendChild(d)}
    c.appendChild(el('p','px-sub','Your libraries are in the sidebar. Play starts the title.'));
    const row=el('div','px-row');row.appendChild(btn('Done','primary',close));row.appendChild(btn('Account settings','',()=>{close();openAccount()}));c.appendChild(row)}
  if(listen){listen('plex-auth',ev=>{const s=ev.payload.state;
    if(s==='signed-in')auto();else if(s==='expired')expired();else if(s==='keychain-unavailable')keychain();else if(s==='error')error(ev.payload.message?why(ev.payload.message):'Sign-in failed.');});
    listen('plex-source',ev=>{showSource(ev.payload);if(shouldDismissConnect(ev.payload,pinUp,!ov.hidden))close()})}
  // Ship builds: Connect only when the keychain has no account token. A saved session
  // stays on Home (Rust reconnects the selected server). Mock screenshot builds skip the card.
  invoke('source_get').then(st=>{showSource(st.source,st.signedIn);if(typeof __PLEXUW_MOCK__!=='undefined'&&__PLEXUW_MOCK__)return;if(!ov.hidden)return;const card=coldStartOverlay(st);if(card==='keychain')keychain();else if(card==='connect')welcome();});

  // Settings: Server & streaming, Skip, Window. Wired to Rust prefs (prefs_get/prefs_set).
  const QP=[['original','Original (no conversion)'],['20mbps-1080p','20 Mbps 1080p'],['12mbps-1080p','12 Mbps 1080p'],['8mbps-1080p','8 Mbps 1080p'],['4mbps-720p','4 Mbps 720p'],['2mbps-720p','2 Mbps 720p'],['1.5mbps-480p','1.5 Mbps 480p'],['0.7mbps-328p','0.7 Mbps 328p']];
  const setView=document.getElementById('setView');
  async function buildSettings(){if(!setView)return;let pr=await invoke('prefs_get');
    const save=async patch=>{pr=await invoke('prefs_set',{patch});fill()};
    const sec=(id,title,sub)=>{const s=el('section','setcard');s.id=id;const h=el('h3',null,title);if(sub){h.appendChild(document.createTextNode(' '));h.appendChild(el('span','muted small',sub))}s.appendChild(h);return s};
    const row=(label,ctl)=>{const r=el('div','frow');const l=el('label',null,label);l.htmlFor=ctl.id;r.appendChild(l);r.appendChild(ctl);return r};
    const sel=(id,opts,key)=>{const x=el('select');x.id=id;opts.forEach(([v,t])=>{const o=el('option',null,t);o.value=v;x.appendChild(o)});x.onchange=()=>save({[key]:x.value});return x};
    const tog=(id,label,hint,key)=>{const l=el('label','switch');const i=el('input');i.type='checkbox';i.id=id;i.onchange=()=>save({[key]:i.checked});l.appendChild(i);const sp=el('span',null,label+' ');sp.appendChild(el('i','muted small',hint));l.appendChild(sp);return l};
    const s0=sec('pxAccount','Account & server');
    const acct=el('div','pxacct');s0.appendChild(acct);
    const fillAcct=async()=>{acct.textContent='';let st;try{st=await invoke('source_get')}catch{return}
      const s=st.source||{};const r=el('div','px-row');
      if(s.kind==='plex'){const p=el('p',null);p.appendChild(el('span','px-dot on'));p.appendChild(el('b',null,' '+s.server+' '));p.appendChild(el('span','px-chip '+s.connection,KIND[s.connection]||s.connection));acct.appendChild(p)}
      else acct.appendChild(el('p','muted',st.signedIn?'Signed in · no server connected':'Not signed in'));
      if(st.signedIn){r.appendChild(btn(s.kind==='plex'?'Switch server':'Choose a server','primary',servers));r.appendChild(btn('Sign out','',async()=>{try{showSource(await invoke('sign_out'));fillAcct()}catch(e){error(why(e))}}))}
      else r.appendChild(btn('Sign in with Plex','primary',()=>start()));acct.appendChild(r)};
    fillAcct();addEventListener('hashchange',()=>{if(location.hash==='#settings')fillAcct()});
    const s1=sec('pxServer','Server & streaming','quality presets like the Plex app; limits come from your Plex dashboard');
    const ql=sel('pxQLocal',QP,'localQuality'),qr=sel('pxQRemote',QP,'remoteQuality'),qy=sel('pxQRelay',QP,'relayQuality');
    s1.appendChild(row('Local quality',ql));s1.appendChild(row('Remote quality',qr));s1.appendChild(row('Relay quality',qy));
    const mh=el('input');mh.id='pxManual';mh.spellcheck=false;mh.placeholder='https://plex.example.com';
    mh.onchange=()=>save({manualHost:mh.value.trim()});s1.appendChild(row('Server address (optional)',mh));
    s1.appendChild(el('p','note small','Used when automatic discovery can’t reach your server. Checked without your sign-in first; https only.'));
    const s2=sec('pxSkip','Skip intro, recap & credits');
    const sm=sel('pxSkipMode',[['prompt','Show a Skip prompt'],['skip-automatically','Skip automatically']],null);
    sm.onchange=()=>save({skipIntro:sm.value,skipRecap:sm.value,skipCredits:sm.value});s2.appendChild(row('When a marker starts',sm));
    const ss=el('input');ss.id='pxSkipSecs';ss.type='range';ss.min='10';ss.max='20';ss.step='1';const sv=el('span','muted small');
    ss.oninput=()=>{sv.textContent=ss.value+' s'};ss.onchange=()=>save({skipPromptSeconds:Number(ss.value)});
    const sw=el('div','trow');sw.appendChild(ss);sw.appendChild(sv);const sr=row('Prompt stays visible',sw);sr.querySelector('label').htmlFor='pxSkipSecs';s2.appendChild(sr);
    const s3=sec('pxWindow','Window');
    const cq=el('p','note small','Closing the window quits PlexUW.');
    const tt=tog('pxTray','Minimize to tray','off by default · closing hides PlexUW to the tray instead of quitting','minimizeToTray');
    const tp=tog('pxPip','Picture-in-picture','off by default · lets the player pop out into a small window','pictureInPicture');
    s3.appendChild(cq);s3.appendChild(tt);s3.appendChild(tp);
    s3.appendChild(el('p','note small','Saved now; tray and picture-in-picture behaviour arrive in a later milestone.'));
    function fill(){ql.value=pr.localQuality;qr.value=pr.remoteQuality;qy.value=pr.relayQuality;if(document.activeElement!==mh)mh.value=pr.manualHost||'';
      sm.value=pr.skipIntro;ss.value=String(pr.skipPromptSeconds);sv.textContent=pr.skipPromptSeconds+' s';ss.disabled=pr.skipIntro!=='prompt';
      document.getElementById('pxTray').checked=!!pr.minimizeToTray;document.getElementById('pxPip').checked=!!pr.pictureInPicture;
      cq.textContent=pr.minimizeToTray?'Closing the window hides PlexUW to the tray.':'Closing the window quits PlexUW.'}
    const h2=setView.querySelector('.row-title');const after=h2?h2.nextSibling:null;
    [s0,s1,s2,s3].forEach(x=>setView.insertBefore(x,after));fill()}
  buildSettings();
  // AI key: keychain only in the desktop app. JS can write or clear it, never read it back.
  (function(){const k=document.getElementById('aiKey'),pv=document.getElementById('aiProv'),cl=document.getElementById('aiClear'),stt=document.getElementById('aiStatus');if(!k||!pv)return;
    const provs=['xai','openai','openrouter','self'];
    // LOW-3: move old localStorage keys to the keychain; oversized values are dropped, failures are shown.
    const warn=t=>{stt.textContent=t};
    invoke('ai_migration_failed').then(f=>{if(f)warn('A saved AI key could not be moved to the system keychain. Please enter it again.')}).catch(()=>{});
    provs.forEach(p=>{const ls='plexuw.ai.key:'+p,v=localStorage.getItem(ls);if(!v)return;
      if(new TextEncoder().encode(v).length>512){localStorage.removeItem(ls);warn('A saved AI key was invalid and has been removed. Please enter it again.');return}
      invoke('ai_key_set',{provider:p,key:v}).then(()=>localStorage.removeItem(ls)).catch(()=>warn('A saved AI key could not be moved to the system keychain. It stays in local app storage and will be retried next start.'))});
    const show=async()=>{k.value='';const has=await invoke('ai_key_has',{provider:pv.value});k.placeholder=has?'Saved in the system keychain · type to replace':'Paste your key (saved in the system keychain)'};
    let tmr=null;k.oninput=()=>{clearTimeout(tmr);tmr=setTimeout(async()=>{const v=k.value;try{await invoke('ai_key_set',{provider:pv.value,key:v});k.value='';stt.textContent=v?'Saved to keychain':'';show()}catch(e){stt.textContent=String(e)==='keychain-unavailable'?'Keychain unavailable; key not saved':'Key not saved'}},700)};
    cl.onclick=async()=>{await invoke('ai_key_set',{provider:pv.value,key:''}).catch(()=>{});stt.textContent='Key cleared';show()};
    pv.addEventListener('change',show);show();
    const note=document.querySelector('#aiProvider .note');if(note)note.textContent='Mock: the key is kept in the OS keychain (Credential Manager / Keychain / Secret Service), never in localStorage, never logged, put in a URL or sent anywhere. Test connection returns a mock result without any network request.';})();
  // Scrollbars fade in while a container scrolls (CSS shows them on hover too).
  {const tm=new WeakMap();document.addEventListener('scroll',e=>{const t=e.target===document?document.documentElement:e.target;if(!(t instanceof Element))return;t.classList.add('px-scrolling');clearTimeout(tm.get(t));tm.set(t,setTimeout(()=>t.classList.remove('px-scrolling'),900))},{capture:true,passive:true});}
  // Connect dialog still scrolls to the paired-server card. The rail has one Settings link.
  function openAccount(){location.hash='#settings';setTimeout(()=>document.getElementById('pxAccount')?.scrollIntoView({block:'start'}),250)}
  const plexOrigin=()=>/Windows/i.test(navigator.userAgent)?'http://plexuw.localhost':'plexuw://localhost';
  function paintAccount(){
    const nm=document.querySelector('.profile .pxname');
    if(!nm) return;
    const chip=document.querySelector('.profile .pxwho .av');
    const rail=document.querySelector('.profile .pxrailav');
    const fill=(slot,id,gear)=>{
      if(!slot) return;
      slot.replaceChildren();
      if(id){
        const i=document.createElement('img'); i.alt='';
        i.onerror=()=>{i.remove(); if(gear) slot.appendChild(pxIcon('gear')); else slot.hidden=true;};
        i.src=plexOrigin()+'/img/'+id+'/80x80';
        slot.hidden=false; slot.appendChild(i); return;
      }
      if(gear){slot.hidden=false; slot.appendChild(pxIcon('gear'));}
      else slot.hidden=true;
    };
    invoke('account_me').then(c=>{
      const name=c&&typeof c.name==='string'?c.name.trim():'';
      nm.textContent=name||'Plex';
      const id=c&&typeof c.thumb==='string'&&/^[0-9a-f]{32}$/.test(c.thumb)?c.thumb:'';
      fill(chip,id,false); fill(rail,id,true);
    }).catch(()=>{nm.textContent='Plex'; fill(chip,'',false); fill(rail,'',true);});
  }
  // Real library playback. The webview never XHRs plexuw://; playlists and segments
  // come back through opaque_get. A failure clears the video element.
  function b64ToU8(s){const bin=atob(s||'');const out=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)out[i]=bin.charCodeAt(i);return out}
  let hlsPlayer=null, plexLive=false;
  function clearVid(){if(hlsPlayer){try{hlsPlayer.destroy()}catch(e){}hlsPlayer=null}const v=document.getElementById('vid');if(!v)return;try{v.pause()}catch(e){}v.onerror=null;if(v.getAttribute('src')){v.removeAttribute('src');v.load()}}
  function showPlayErr(msg){const t=document.getElementById('toast');if(t){t.textContent=msg;t.classList.add('show','status')}const d=document.getElementById('tdur');if(d&&d.textContent==='00:00:10')d.textContent='--:--:--'}
  class PlexLoader extends Hls.DefaultConfig.loader {
    load(context, config, callbacks){
      const url=String(context&&context.url||'');
      const m=/\/(?:hls|media)\/([0-9a-f]{32})/.exec(url);
      if(!m){callbacks.onError({code:502,text:'playback'},context,null);return}
      const kind=url.indexOf('/media/')>=0?'media':'hls';
      invoke('opaque_get',{kind,id:m[1]}).then(r=>{
        if(!r||!r.ok){callbacks.onError({code:(r&&r.status)||502,text:'playback'},context,null);return}
        const bin=b64ToU8(r.bodyB64||'');
        const ct=String(r.contentType||'');
        const playlist=/mpegurl/i.test(ct)||(bin.length&&bin[0]===35);
        const stats={aborted:false,loaded:bin.length,retry:0,total:bin.length,chunkCount:1,bwEstimate:0,loading:{start:0,first:0,end:0},parsing:{start:0,end:0},buffering:{start:0,first:0,end:0}};
        callbacks.onSuccess({url,data:playlist?new TextDecoder().decode(bin):bin.buffer,code:r.status||200},stats,context,null);
      }).catch(()=>callbacks.onError({code:502,text:'playback'},context,null));
    }
  }
  function onVidErr(){const v=document.getElementById('vid');const c=v&&v.error&&v.error.code;const name={1:'MEDIA_ERR_ABORTED',2:'MEDIA_ERR_NETWORK',3:'MEDIA_ERR_DECODE',4:'MEDIA_ERR_SRC_NOT_SUPPORTED'}[c]||'MEDIA_ERR';showPlayErr('Could not start playback ('+name+(c!=null?' '+c:'')+')');clearVid()}
  async function beginPlexPlay(){
    if(String(location.hash||'').indexOf('#player/plex')!==0)return;
    clearVid();plexLive=true;
    let ctx={};try{ctx=JSON.parse(sessionStorage.getItem('pxPlayCtx')||'{}')}catch(e){ctx={}}
    if(!ctx.plexId){showPlayErr('Could not start playback');return}
    let out;try{out=await invoke('play_start',{id:ctx.plexId,versionId:ctx.versionId||null,offsetMs:ctx.fromStart?0:(ctx.viewOffsetMs||0)})}catch(e){
      const s=String(e&&e.message||e||'');console.error('plexuw play: step=play_start err='+s.slice(0,180));const mm=/\(([0-9]{3}|rewrite|redirect|denied|network|segment|auth)\)/.exec(s);showPlayErr('Could not start playback'+(mm?' ('+mm[1]+')':''));clearVid();return}
    if(out&&out.durationMs){window.__pxPlayDur=out.durationMs;const td=document.getElementById('tdur');if(td&&typeof hms==='function')td.textContent=hms(out.durationMs/1000)}
    const v=document.getElementById('vid');if(!v||!out||!out.url){showPlayErr('Could not start playback');return}
    const abs=plexOrigin()+out.url;
    v.onerror=onVidErr;
    if(out.kind==='hls'){
      if(Hls.isSupported()){
        hlsPlayer=new Hls({enableWorker:false,loader:PlexLoader});
        hlsPlayer.on(Hls.Events.ERROR,function(_ev,data){if(!data||!data.fatal)return;const code=data.response&&data.response.code;console.error('plexuw play: step=hls fatal type='+(data.type||'')+' details='+(data.details||'')+' code='+(code==null?'':code));showPlayErr('Could not start playback '+(code?'('+code+')':(data.details?'('+data.details+')':'')));clearVid()});
        hlsPlayer.loadSource(abs);hlsPlayer.attachMedia(v);
        hlsPlayer.on(Hls.Events.MANIFEST_PARSED,function(){v.play().catch(function(){})});
      }else{console.error('plexuw play: step=mse Hls.isSupported=false');showPlayErr('Could not start playback (mse)');clearVid()}
    }else{
      const off=(ctx.fromStart?0:(ctx.viewOffsetMs||0))/1000;
      if(off>1)v.addEventListener('loadedmetadata',function(){try{v.currentTime=off}catch(e){}},{once:true});
      v.src=abs;v.play().catch(function(){});
    }
  }
  addEventListener('hashchange',function(){
    if(String(location.hash||'').indexOf('#player/plex')===0)beginPlexPlay();
    else if(plexLive){plexLive=false;clearVid();invoke('playback_stop').catch(function(){})}
  });
  if(String(location.hash||'').indexOf('#player/plex')===0)beginPlexPlay();
  // Fixture-build screenshot driver. fu7g (Sentinel INFO-1): the whole driver, fu7fBadge and the
  // __pxDelay/__pxNavDelay setters are compiled out unless PLEXUW_MOCK=true.
  if(__PLEXUW_MOCK__){
  if(window.__plexShot){const sh=m=>{const d=document.createElement('pre');d.style.cssText='position:fixed;bottom:0;left:80px;z-index:999;color:#f66;background:#000;font-size:11px';d.textContent=String(m);document.body.appendChild(d)};addEventListener('error',e=>sh(e.message+' '+e.lineno));addEventListener('unhandledrejection',e=>sh('rej '+(e.reason&&e.reason.stack||e.reason)))}
  window.__plexShot=async scene=>{window.__plexShot=null;await new Promise(r=>setTimeout(r,1500));
    if(scene==='pin')start();
    else if(scene==='settings'){location.hash='#settings'}
    else if(scene==='servers'){start();}
    else if(scene==='relay'){showSource({kind:'plex',server:'MoxBox',connection:'relay',owned:true});connected({server:'MoxBox',connection:'relay'})}
    else if(scene==='expired')expired();
    else if(scene==='demo'){}
    else if(scene==='fuprogress'){start();await new Promise(r=>setTimeout(r,3000));connect({name:'MoxBox',id:'__first'},new Promise(()=>{}))}
    else if(scene==='fuerror'){start();await new Promise(r=>setTimeout(r,3000));connect({name:'Old Server',id:'not-a-server'})}
    else if(/^m[23]|^fu6|^fu7[efgh]|^scrollbars$/.test(scene)){ // connect to the fixture server, then open a browse view
      // fu7e: sign-in auto-connects (no picker); wait for it rather than picking by hand.
      try{start();for(let i=0;i<80&&!(cur&&cur.kind==='plex');i++)await new Promise(r=>setTimeout(r,200));
      if(!(cur&&cur.kind==='plex')){const l0=await invoke('servers_list');const v=await invoke('server_connect',{id:(l0.find(x=>x.name==='MoxBox')||l0[0]).id});showSource(v)}close();await new Promise(r=>setTimeout(r,600));}catch(e){error('shot: '+e);return}
      let to={'fu7gback':'#px/sec/1','fu7hclick':'#px/sec/1','fu6rail':'#px/sec/1','m2home':'#px/home','m2library':'#px/sec/1','m2details':'#px/item/1013','m2show':'#px/item/2000','m2season':'#px/item/2001','m2search':'#px/search/the','m2music':'#px/sec/3','m2panels':'#px/item/2023','m2genres':'#px/sec/1/genres','m2filter':'#px/sec/1/all/genre/12','m2palette':'#px/home','m2az':'#px/sec/1','m3direct':'#px/item/2013','m3hls':'#px/item/1013','m3skip':'#px/item/2013','m3chapters':'#px/item/2013','m3upnext':'#px/item/2013','m3detail':'#px/item/2013','scrollbars':'#px/home','m2account':'#px/home','m2episode':'#px/item/2013','m2epinfo':'#px/item/2013','fu7edetails':'#px/item/1003','fu7erelated':'#px/item/1003','fu7eperson':'#px/item/1003','fu7escroll':'#px/sec/1','fu7esignin':'#px/home','fu7fperson':'#px/item/1003','fu7fskeleton':'#px/sec/1','fu7fshowperson':'#px/item/2000','fu7fnav':'#px/item/1003','fu7ftvload':'#px/sec/2'}[scene];
      if(__PLEXUW_MOCK__&&to){const m=/^#px\/(item|sec)\/(\d+)(.*)$/.exec(to);if(m){try{const id=await invoke('shot_id',{kind:m[1],n:+m[2]});to=`#px/${m[1]}/${id}${m[3]}`}catch(e){}}}
      if(scene.startsWith('m3')&&scene!=='m3detail')setTimeout(()=>{const b=document.querySelector('.pxplay');b&&b.click();
        const at={m3skip:40,m3upnext:114,m3chapters:12}[scene];
        setTimeout(()=>{const v=document.querySelector('.pxvideo');if(!v)return;if(at)v.currentTime=at;v.pause();
          if(scene==='m3chapters'){const c=[...document.querySelectorAll('.pxvbtn')].find(x=>x.textContent==='Chapters');c&&c.click()}
          setTimeout(()=>v.play().catch(()=>{}),300);document.querySelector('.pxplayer')?.dispatchEvent(new MouseEvent('mousemove'))},3500)},3500);
      if(scene==='m2catswitch'){const W=ms=>new Promise(r=>setTimeout(r,ms));const txt=q=>[...document.querySelectorAll(q)].map(x=>x.textContent.trim()).filter(Boolean);(async()=>{
        // Categories regression proof: initial pick -> genres; switch server -> new server's libraries + genres.
        location.hash='#px/sec/1/genres';await W(2500);const n1=txt('#pxNav a[data-r^="sec/"]'),g1=txt('.pxtile b');
        connect((await invoke('servers_list')).find(x=>x.name==='Slowpoke'));await W(3500);close();
        location.hash='#px/sec/7/genres';await W(2500);const n2=txt('#pxNav a[data-r^="sec/"]'),g2=txt('.pxtile b');
        const ok=n1.includes('Movies')&&g1.includes('Sci-Fi')&&n2.includes('Friend Films')&&!n2.includes('Movies')&&g2.join()==='Documentary,Western,Noir';
        const o=el('pre','pxshoterr');o.style.cssText='position:fixed;left:30%;bottom:20px;z-index:9999;padding:12px;border-radius:8px;font:13px monospace;color:#fff;background:'+(ok?'#1d6b34':'#8b1d1d');
        o.textContent=(ok?'PASS':'FAIL')+' categories pick+switch\npick  MoxBox   libs='+n1.join('|')+'  genres='+g1.join('|')+'\nswitch Slowpoke libs='+n2.join('|')+'  genres='+g2.join('|');document.body.appendChild(o)})()}
      if(scene==='fu6collapsed'||scene==='fu6search'||scene==='fu6profile'||scene==='fu6rail'){const c=scene==='fu6collapsed';if(document.body.classList.contains('navc')!==c)document.getElementById('logoBtn')?.click();location.hash='#px/sec/1'}
      if(scene==='fu6search')setTimeout(()=>{location.hash='#px/search/the';setTimeout(()=>{const i=document.querySelector('.pxsoin');if(i){i.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true}));i.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true}))}},1500)},3500);
      if(scene==='fu6profile')setTimeout(()=>{const p=document.querySelector('.profile');if(p){p.classList.add('pxfocus');p.focus()}},4000);
      if(scene==='m2account')setTimeout(()=>document.querySelector('.profile')?.click(),4000);
      if(scene==='scrollbars')setTimeout(()=>{document.querySelectorAll('*').forEach(e=>{const cs=getComputedStyle(e);if(e.scrollHeight>e.clientHeight+20&&/(auto|scroll)/.test(cs.overflowY))e.scrollTop+=300;if(e.scrollWidth>e.clientWidth+20&&/(auto|scroll)/.test(cs.overflowX))e.scrollLeft+=300})},5000);
      if(scene==='m2panels'){sessionStorage.setItem('pxR','1')}
      if(to)location.hash=to;
      if(scene==='m2palette')setTimeout(()=>{document.body.dispatchEvent(new KeyboardEvent('keydown',{key:'k',ctrlKey:true,bubbles:true}));setTimeout(()=>{const i=document.querySelector('.pxsoin');if(i){i.value='the';i.dispatchEvent(new Event('input'))}},600)},5000);
      // fu7e scenes: related row (scroll to bottom), person page (click the first cast photo),
      // library mid-scroll (scroll the merged grid ~2 pages down; tiles stay mounted).
      if(scene==='fu7erelated')setTimeout(()=>{const m=document.getElementById('main');const r=document.querySelector('.pxrelated');if(m&&r)m.scrollTop+=r.getBoundingClientRect().top-m.getBoundingClientRect().top-260},5000);
      // fu7f scenes: popover over a scrolled movie page (scroll kept, dialog semantics), and
      // a library mid-load (next page held back) comparing skeleton and real tile heights.
      const fu7fBadge=(ok,t)=>{const o=el('pre','pxshoterr');o.style.cssText='position:fixed;right:16px;bottom:16px;z-index:9999;padding:10px 12px;border-radius:8px;font:12px monospace;color:#fff;background:'+(ok?'#1d6b34':'#8b1d1d');o.textContent=(ok?'PASS ':'FAIL ')+t;document.body.appendChild(o)};
      if(scene==='fu7fperson'||scene==='fu7fshowperson')setTimeout(()=>{const m=document.getElementById('main'),h=document.querySelector('.pxheads');if(!m||!h)return fu7fBadge(false,'no credits');m.scrollTop+=h.getBoundingClientRect().top-m.getBoundingClientRect().top-140;const s0=m.scrollTop,a=document.querySelector('a.pxcred');const h0=location.hash;a.click();
        setTimeout(()=>{const d=document.querySelector('.pxpm:not([hidden]) [role=dialog]');const ok=!!d&&d.getAttribute('aria-modal')==='true'&&m.scrollTop===s0&&location.hash===h0&&d.contains(document.activeElement)&&getComputedStyle(m).overflowY==='hidden';fu7fBadge(ok,'popover open · role=dialog aria-modal · page scroll '+s0+'→'+m.scrollTop+' · hash unchanged · focus in dialog · bg scroll locked')},2500)},4500);
      const rawLoad=()=>{const t=[document.getElementById('pxView'),...document.querySelectorAll('.pxghost')].map(n=>n?n.textContent:'').join(' ');return /loading/i.test(t)};
      if(scene==='fu7fnav')setTimeout(()=>{const m=document.getElementById('main');m.scrollTop=420;window.__pxNavDelay=600000;let raw=false;const mo=new MutationObserver(()=>{raw=raw||rawLoad()});mo.observe(document.body,{subtree:true,childList:true,characterData:true});location.hash='#px/item/1013';
        setTimeout(()=>{const g=document.querySelector('.pxghost');const ok=!!g&&getComputedStyle(g).opacity==='1'&&g.textContent.length>50&&!raw&&!rawLoad();fu7fBadge(ok,'mid-navigation · old page held ('+(g?'snapshot':'none')+') · raw loading text seen: '+raw)},1500)},4500);
      if(scene==='fu7ftvload'){let raw=false,sk=false;const mo=new MutationObserver(()=>{raw=raw||rawLoad();sk=sk||!!document.querySelector('#pxView .pxload .pxsk,#pxView .pxph')});mo.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true});
        setTimeout(()=>{const im=[...document.querySelectorAll('#pxView .pxcard .poster img')];const fd=im.filter(i=>i.classList.contains('pxfade')),inn=fd.filter(i=>i.classList.contains('in'));const ph=document.querySelector('#pxView .pxload .pxsk');const ok=im.length>0&&fd.length===im.length&&!raw&&sk;fu7fBadge(ok,'TV library · styled skeleton seen: '+sk+' · raw loading text seen: '+raw+' · posters with fade-in '+fd.length+'/'+im.length+', faded in '+inn.length)},6000)}
      if(scene==='fu7fskeleton')setTimeout(()=>{window.__pxDelay=600000;const m=document.getElementById('main');let n=0;const step=()=>{const ph=document.querySelector('.pxvgrid .pxph');if(ph&&ph.getBoundingClientRect().top<m.clientHeight*0.6||n++>40){
          const ph1=document.querySelector('.pxvgrid .pxph'),real=[...document.querySelectorAll('.pxvgrid .pxcard:not(.pxph)')].pop();if(real)m.scrollTop+=real.getBoundingClientRect().top-m.getBoundingClientRect().top-m.clientHeight*0.2;
          setTimeout(()=>{const a=real&&real.getBoundingClientRect().height,b=ph1&&ph1.getBoundingClientRect().height;fu7fBadge(!!a&&a===b,'mid-load · real tile '+(a||0).toFixed(1)+'px = skeleton '+(b||0).toFixed(1)+'px')},400);return}
        m.scrollTop+=600;setTimeout(step,150)};step()},4500);
      // fu7g MUST-1 scene: scroll the library to 1800 px, open a title, press the app Back button; badge shows the restored scroll.
      if(scene==='fu7gback')setTimeout(async()=>{const W=ms=>new Promise(r=>setTimeout(r,ms));const m=document.getElementById('main');if(!m)return fu7fBadge(false,'no main');
        for(let i=0;i<20&&m.scrollTop<1800;i++){m.scrollTop=1800;await W(400)}const y0=m.scrollTop;await W(800);
        const c=document.querySelector('#pxView .pxcard:not(.pxph) a, #pxView a.pxcard, #pxView .pxcard');c&&c.click();await W(3000);const h1=location.hash,y1=m.scrollTop;
        history.back();await W(3500);const y2=m.scrollTop,h2=location.hash;
        fu7fBadge(y0===1800&&y2===1800&&h1.startsWith('#px/item/')&&y1===0&&!h2.startsWith('#px/item/'),'scrolled '+y0+'px → opened '+h1+' at '+y1+'px\nBack → '+h2+' scrollTop '+y2+'px')},4500);
      // fu7h scene: scroll to 1800, open a title, scroll it, then history.back() (Alt+Left / mouse 4). Badge: restored scroll.
      if(scene==='fu7hclick')setTimeout(async()=>{const W=ms=>new Promise(r=>setTimeout(r,ms));const m=document.getElementById('main');if(!m)return fu7fBadge(false,'no main');
        for(let i=0;i<20&&m.scrollTop<1800;i++){m.scrollTop=1800;await W(400)}const y0=m.scrollTop;await W(800);
        const c=document.querySelector('#pxView .pxcard:not(.pxph) a, #pxView a.pxcard, #pxView .pxcard');c&&c.click();await W(3000);const h1=location.hash;
        for(let i=0;i<10&&m.scrollTop<300;i++){m.scrollTop=300;m.dispatchEvent(new Event('scroll'));await W(200)}const y1=m.scrollTop;await W(600);
        history.back();await W(3500);const y2=m.scrollTop;
        fu7fBadge(y0===1800&&h1.startsWith('#px/item/')&&y1>0&&!location.hash.startsWith('#px/item/')&&y2===1800,
          'library scrolled '+y0+'px\nopened '+h1+', scrolled to '+y1+'px\nhistory.back → '+location.hash+' scrollTop '+y2+'px')},4500);
      if(scene==='fu7eperson')setTimeout(()=>{const a=document.querySelector('a.pxcred');a&&a.click()},4500);
      if(scene==='fu7escroll')setTimeout(async()=>{const m=document.getElementById('main');if(!m)return;const first=document.querySelector('.pxvgrid .pxcard:not(.pxph)');for(let i=0;i<14;i++){m.scrollTop+=420;await new Promise(r=>setTimeout(r,120))}
        setTimeout(()=>{const o=el('pre','pxshoterr');const n=document.querySelectorAll('.pxvgrid>.pxcard').length,ph=document.querySelectorAll('.pxvgrid>.pxph').length;o.style.cssText='position:fixed;right:24px;bottom:20px;z-index:9999;padding:10px;border-radius:8px;font:12px monospace;color:#fff;background:'+(first&&first.isConnected?'#1d6b34':'#8b1d1d');o.textContent=(first&&first.isConnected?'PASS':'FAIL')+' first tile still mounted · '+n+' slots · '+ph+' placeholders';document.body.appendChild(o)},900)},4500);
      if(scene==='m2az')setTimeout(()=>{const b=[...document.querySelectorAll('.pxazb')].find(x=>x.textContent==='S');b&&b.click()},3500);}
  };
  }
})();
