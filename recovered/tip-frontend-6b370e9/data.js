// MOCK DATA ONLY — fictional titles, no real Plex server, tokens or network calls.
window.MOCK = (() => {
  const names = ["Neon Meridian","The Quiet Orbit","Saltwater Kings","Paper Lanterns","Glass Harbor","Iron Prairie","Last Signal","Velvet District","Northbound","Cinder Falls","The Lattice","Hollow Crown Inn","Moth & Mirror","Static Bloom","Arctic Relay","Brass Tide","Echo Valley","Solar Drift","Midnight Ledger","Copper Moon","The Long Fold","Driftwood","Parallax","Low Tide Club",
    "Amber Circuit","Ghost Freight","Lantern Row","Orchid Protocol","Red Dune Motel","Silver Ash","Tin Soldier Blues","Undertow","Wildfire Season","Zero Meridian","Blue Hour","Chalk Line","Dead Reckoning","Fable Street","Granite Heart","Harbor Lights",
    "Ivory Coast Line","Juniper Hollow","Kite Runner's Map","Lunar Freight","Marrow","Night Ferry","Open Water","Pale Engine","Quartz City","Rust Belt Saints","Second Sun","Tangent","Umbra","Vantage","Winter Relay","Yellow Signal","Zephyr","Atlas Unfolded","Bellwether","Crosswind"];
  const G = ["Sci-Fi","Drama","Comedy","Thriller","Adventure","Mystery","Animation","Documentary","Horror","Romance"];
  const STUDIOS = ["Northlight Pictures","Harbor & Pine","Kestrel Films","Monolith Works","Bluebird Studio","Iron Gate Media"];
  const COLS = [["Meridian Saga",[0,33,24]],["Relay Trilogy",[14,54,44]],["Harbor Stories",[4,39,45]],["Signal Files",[6,55,37]],["Tide & Sun",[15,23,50]],["Winter Box Set",[29,32,58]]];
  const TAGS = ["Cult Classic","Award Winner","Based on a Book","Time Travel","Heist","Road Trip","Space","Small Town","Noir","Feel-Good"];
  const col = {}; COLS.forEach(([n,ids])=>ids.forEach((id,k)=>col[id]=[n,k+1]));
  const base = Date.parse("2026-10-20");
  return names.map((t,i)=>({id:i,title:t,year:1958+((i*13)%68),
    genres:[G[i%10],...(i%3?[G[(i*7+3)%10]]:[])].filter((g,k,a)=>a.indexOf(g)===k),
    studio:STUDIOS[(i*5)%6], collection:col[i]?col[i][0]:null, part:col[i]?col[i][1]:null,
    tags:[TAGS[i%10],TAGS[(i*3+1)%10]].filter((g,k,a)=>a.indexOf(g)===k),
    added:base-((i*37)%365)*864e5, rating:Math.round((5.2+((i*29)%46)/10)*10)/10,
    mins:78+((i*17)%92), watched:i%4===0,
    progress:[0.32,0.71,0.15,0.55,0.88,0.42,0.63][[3,8,11,17,26,41,47].indexOf(i)]||0,
    hue:(i*47)%360, kind:'movie',
    chapters:(()=>{const N=["Opening","Arrival","The Offer","Crossing","Fallout","Night Run","Reckoning","Coda"],n=6+(i%3),c=[];
      for(let k=0;k<n;k++)c.push({t:N[k===n-1?7:k],at:k?Math.round((k/n+((i+k)%3-1)*0.02)*1000)/1000:0});return c})(),
    summary:"A fictional placeholder synopsis for prototype purposes. Nothing here references a real title."}));
})();
window.COLLECTIONS=[...new Set(window.MOCK.map(m=>m.collection).filter(Boolean))];

// ---- TV (mock) ----
window.mkChapters=(i)=>{const N=["Cold Open","Setup","Turn","Midpoint","Escalation","Climax","Tag","Credits"],n=6+(i%3),c=[];
  for(let k=0;k<n;k++)c.push({t:N[k===n-1?7:k],at:k?Math.round((k/n+((i+k)%3-1)*0.02)*1000)/1000:0});return c};
window.TV=(()=>{const shows=[["Harbor Watch","Drama","Northwind TV",["Prestige Drama"]],["Signal & Noise","Sci-Fi","Orbit+",["Sci-Fi Nights"]],
 ["The Bakehouse","Comedy","Hearth Network",["Comfort TV"]],["Cold Ledger","Thriller","Northwind TV",["Prestige Drama"]],["Far Stations","Sci-Fi","Orbit+",["Sci-Fi Nights","Prestige Drama"]],
 ["Little Brass Town","Comedy","Hearth Network",["Comfort TV"]],["Deep Survey","Documentary","Lumen Docs",[]],["Night Shift Diner","Drama","Orbit+",["Comfort TV"]]];
 const EP=["Pilot","The Thaw","Signal Fire","Undertow","Long Night","Glass Door","Homecoming","Paper Trail","Open Water","Last Light"];
 let uid=1000;return shows.map(([t,g,net,cols],s)=>{const hue=(s*67+20)%360,y=2012+s;
  const seasons=Array.from({length:2+(s%2)},(_,si)=>({n:si+1,year:y+si,episodes:Array.from({length:6+((s+si)%3)},(_,ei)=>({id:uid++,kind:'tv',showId:s,show:t,season:si+1,episode:ei+1,
    title:EP[(ei+s+si)%10],year:y+si,mins:42+((s*7+ei*3)%16),genres:[g],studio:net,rating:Math.round((7+((s+ei)%25)/10)*10)/10,
    hue:(hue+ei*9)%360,summary:"Fictional placeholder episode synopsis for the prototype.",chapters:mkChapters(s+ei),collection:null,watched:si===0&&ei<3,progress:0}))}));
  return {id:s,title:t,genre:g,network:net,collections:cols,year:y,hue,seasons,rating:Math.round((7.2+(s%6)/4)*10)/10}});})();
window.EPISODES=TV.flatMap(sh=>sh.seasons.flatMap(se=>se.episodes));
// ---- Music (mock) ----
window.MUSIC=(()=>{const A=[["Velvet Static","Synthwave"],["The Long Grass","Folk"],["Juniper Lane","Indie"],["Orbit Choir","Ambient"],["Brass & Bone","Jazz"],["Neon Ferns","Synthwave"],["Cold Harbor","Indie"],["Mara Sol","Soul"]];
 const W=["Midnight","Paper","Glass","River","Signal","Ember","Hollow","Velvet","Northern","Static","Golden","Quiet"],X=["Lights","Hearts","Roads","Echoes","Tides","Rooms","Fields","Lines"];
 let tid=0;const artists=A.map(([n,g],i)=>({id:i,name:n,genre:g,hue:(i*53+10)%360}));
 const albums=[];artists.forEach(a=>[0,1].forEach(k=>{const id=albums.length;albums.push({id,artist:a.id,title:W[(a.id*2+k)%12]+" "+X[(a.id+k*3)%8],year:2009+((a.id*3+k*4)%16),genre:a.genre,hue:(a.hue+k*40)%360,
   tracks:Array.from({length:8},(_,t)=>({id:tid++,album:id,artist:a.id,no:t+1,title:W[(a.id+t*5+k)%12]+" "+X[(t+k)%8],secs:150+((a.id*31+t*47)%160)}))})}));
 const songs=albums.flatMap(al=>al.tracks);
 const playlists=[["Late Drive",[0,9,17,33,41,50,58,66,75]],["Focus",[24,25,26,27,88,89,90]],["Sunday Kitchen",[8,12,70,71,100,101,120]],["Synth Only",[0,1,2,3,40,41,42,43]]].map(([n,ids],i)=>({id:i,name:n,tracks:ids.filter(x=>x<songs.length),hue:(i*90+30)%360}));
 return {artists,albums,songs,playlists,genres:[...new Set(artists.map(a=>a.genre))]};})();

// ---- Skip markers (mock, scaled to the 10 s sample clip; real data later from Plex intro/credits markers) ----
MOCK.forEach((m,i)=>{m.intro=i%7===5?null:[0.5,2.5];m.credits=[8.5,10];});
EPISODES.forEach((e,i)=>{e.intro=[0.5+(i%3)*0.2,2.5+(i%3)*0.2];e.credits=[8.5,10];});
