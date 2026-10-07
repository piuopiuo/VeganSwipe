import {
  openDB,countRecipes,countVegan,getVeganRecipes,getAllActions,setAction,getSavedRecipes,
  setSetting,getSetting,getAllSettings,exportPersonalData,restorePersonalData,clearRecipes
} from './db.js';
import {
  CUISINES,METHODS,HEALTH,DEFAULT_EQUIPMENT,INGREDIENT_GROUPS,
  passesFilters,recommendationScore,buildProfile,norm
} from './recipe-utils.js';
import {importModernRecipes,DATASET_VERSION} from './importer.js';

const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const FALLBACK_IMAGE='./fallback-food.svg';
const TIME_PRESETS=[null,20,30,45,60,90];
const PRICE_PRESETS=[null,2.5,3.5,5,7.5,10];
const PROTEIN_PRESETS=[null,10,15,20,25,30];
const CALORIE_PRESETS=[null,400,500,600,700,800];

const state={
  queue:[],current:null,drag:null,layout:'grid',importing:false,
  filters:{tempExclude:[],tempPrefer:[],excludedCuisines:[],methods:[],health:[],maxTime:null,maxPrice:null,minProtein:null,maxCalories:null},
  settings:{permanentExclude:[],defaultMaxTime:null,equipment:[...DEFAULT_EQUIPMENT],language:'en'}
};

function escapeHTML(s=''){return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function escapeAttr(s=''){return escapeHTML(s)}
function fmtMoney(v){return v==null?'—':`${Number(v).toFixed(2)} €`}
function pretty(s=''){return String(s).replaceAll('-',' ').replace(/\b\w/g,x=>x.toUpperCase())}
function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.classList.remove('show'),2200)}
function saveSessionFilters(){sessionStorage.setItem('veganswipe.filters.v2',JSON.stringify(state.filters))}

function imageHTML(r,cls='food-photo'){
  return `<img class="${cls} recipe-photo" src="${escapeAttr(r.imageURL)}" alt="${escapeAttr(r.title)}" loading="eager" decoding="async" referrerpolicy="no-referrer">`;
}
function bindImageFallback(root=document){
  root.querySelectorAll('img.recipe-photo').forEach(img=>{
    img.addEventListener('error',()=>{if(!img.src.endsWith('fallback-food.svg'))img.src=FALLBACK_IMAGE},{once:true});
  });
}
function cardHTML(r){
  if(!r)return'';
  const meta=[`${r.realisticTime} min`,r.pricePerServing!=null?`${r.pricePerServing.toFixed(2)} €/portion`:null,r.protein!=null?`${r.protein} g protein`:null].filter(Boolean);
  return `<div class="recipe-visual">${imageHTML(r)}<div class="photo-badges"><span>VEGAN</span><span>MAIN</span></div></div>
    <div class="recipe-body"><h2 class="recipe-title">${escapeHTML(r.title)}</h2>
    <div class="meta-row">${meta.map(x=>`<span class="meta-pill">${escapeHTML(x)}</span>`).join('')}</div>
    <p class="recipe-summary">${escapeHTML(r.ingredients.slice(0,7).join(' · '))}</p></div>`;
}

async function updateCounts(){
  const [all,vegan,saved,source]=await Promise.all([countRecipes(),countVegan(),getSavedRecipes(),getSetting('sourceRowsScanned',0)]);
  $('#sourceRecipeCount').textContent=Number(source||0).toLocaleString();
  $('#veganRecipeCount').textContent=vegan.toLocaleString();
  $('#savedCount').textContent=saved.length.toLocaleString();
  $('#setupBanner').classList.toggle('hidden',all>0);
  return{all,vegan};
}

function currentFilters(){
  return{
    ...state.filters,
    permanentExclude:state.settings.permanentExclude,
    maxTime:Number(state.filters.maxTime||state.settings.defaultMaxTime)||null,
    maxPrice:Number(state.filters.maxPrice)||null,
    minProtein:Number(state.filters.minProtein)||null,
    maxCalories:Number(state.filters.maxCalories)||null,
    equipment:state.settings.equipment
  };
}

async function rebuildQueue(){
  const recipes=await getVeganRecipes(5000),actions=await getAllActions(),am=new Map(actions.map(a=>[a.id,a])),now=Date.now();
  const filters=currentFilters();
  const eligible=recipes.filter(r=>{
    const a=am.get(r.id);
    if(a?.disliked||a?.saved)return false;
    if(a?.laterUntil&&a.laterUntil>now)return false;
    return passesFilters(r,filters);
  });
  const map=new Map(recipes.map(r=>[r.id,r])),profile=buildProfile(map,actions);
  const scored=eligible.map(r=>({r,s:recommendationScore(r,profile,filters)})).sort((a,b)=>b.s-a.s);
  const cutoff=Math.ceil(scored.length*.7);
  const preferred=[...scored.slice(0,cutoff)],discovery=[...scored.slice(Math.floor(scored.length*.3))];
  const chosen=new Set(),queue=[];
  while(queue.length<Math.min(240,scored.length)&&(preferred.length||discovery.length)){
    let pool=(Math.random()<.7&&preferred.length)?preferred:(discovery.length?discovery:preferred);
    const idx=Math.floor(Math.random()*pool.length),item=pool.splice(idx,1)[0];
    if(item&&!chosen.has(item.r.id)){chosen.add(item.r.id);queue.push(item.r)}
  }
  state.queue=queue;showNext();prefetchImages(queue.slice(0,10));
}

function showNext(){
  state.current=state.queue.shift()||null;
  const card=$('#recipeCard'),next=$('#nextCard');
  card.style.transition='none';card.style.transform='';card.style.opacity='1';
  card.innerHTML=cardHTML(state.current);next.innerHTML=cardHTML(state.queue[0]);
  bindImageFallback(card);bindImageFallback(next);
  $('#emptyState').classList.toggle('hidden',!!state.current);
  card.classList.toggle('hidden',!state.current);next.classList.toggle('hidden',!state.current||!state.queue[0]);
}
function prefetchImages(items){for(const r of items){if(!r?.imageURL)continue;const img=new Image();img.referrerPolicy='no-referrer';img.src=r.imageURL}}

async function act(kind){
  const r=state.current;if(!r)return;
  if(kind==='reject')await setAction(r.id,{disliked:true,saved:false,seen:true,later:false,laterUntil:null});
  if(kind==='save')await setAction(r.id,{saved:true,disliked:false,seen:true,later:false,laterUntil:null,savedAt:Date.now()});
  if(kind==='later')await setAction(r.id,{later:true,laterUntil:Date.now()+24*3600e3,seen:true});
  animateOut(kind);
  setTimeout(async()=>{showNext();if(state.queue.length<18)await rebuildQueue();updateCounts()},210);
}
function animateOut(kind){const card=$('#recipeCard');const t=kind==='reject'?'translateX(-125%) rotate(-18deg)':kind==='save'?'translateX(125%) rotate(18deg)':'translateY(-125%) rotate(2deg)';card.style.transition='transform .2s ease,opacity .2s';card.style.transform=t;card.style.opacity='.2'}

function bindSwipe(){
  const card=$('#recipeCard');
  card.addEventListener('pointerdown',e=>{if(!state.current)return;card.setPointerCapture(e.pointerId);state.drag={x:e.clientX,y:e.clientY,t:performance.now(),moved:false}});
  card.addEventListener('pointermove',e=>{if(!state.drag)return;const dx=e.clientX-state.drag.x,dy=e.clientY-state.drag.y;if(Math.abs(dx)+Math.abs(dy)>8)state.drag.moved=true;card.style.transition='none';card.style.transform=`translate(${dx}px,${dy}px) rotate(${dx*.035}deg)`});
  card.addEventListener('pointerup',e=>{if(!state.drag)return;const d=state.drag,dx=e.clientX-d.x,dy=e.clientY-d.y,dt=Math.max(1,performance.now()-d.t),vx=dx/dt,vy=dy/dt;state.drag=null;if(!d.moved){openDetail(state.current);card.style.transform='';return}if(dx>95||vx>.7)return act('save');if(dx<-95||vx<-.7)return act('reject');if(dy<-90||vy<-.7)return act('later');card.style.transition='transform .25s ease';card.style.transform=''});
  card.addEventListener('pointercancel',()=>{state.drag=null;card.style.transition='transform .25s';card.style.transform=''})
}

function fractionToNumber(s){if(!s)return null;const t=s.trim();if(/^\d+\s+\d+\/\d+$/.test(t)){const [w,f]=t.split(/\s+/),[a,b]=f.split('/').map(Number);return Number(w)+a/b}if(/^\d+\/\d+$/.test(t)){const[a,b]=t.split('/').map(Number);return b?a/b:null}const n=Number(t);return Number.isFinite(n)?n:null}
function displayNumber(n){if(Math.abs(n-Math.round(n))<.03)return String(Math.round(n));for(const [v,s] of [[.25,'¼'],[.333,'⅓'],[.5,'½'],[.667,'⅔'],[.75,'¾']]){const whole=Math.floor(n),frac=n-whole;if(Math.abs(frac-v)<.04)return`${whole?whole+' ':''}${s}`}return Number(n.toFixed(1)).toString()}
function scaleIngredient(line,factor){return line.replace(/^(\s*)(\d+(?:\.\d+)?(?:\s+\d+\/\d+)?|\d+\/\d+)/,(m,sp,num)=>{const n=fractionToNumber(num);return n==null?m:`${sp}${displayNumber(n*factor)}`})}
function renderDetail(r,servings=r.servings||4){
  const base=r.servings||4,factor=servings/base;
  $('#recipeDetail').innerHTML=`<div class="detail-hero">${imageHTML(r,'detail-photo')}</div><div class="detail-body">
    <div class="detail-flags"><span>Strict vegan</span><span>Main dish</span><span>${escapeHTML(r.culture)}</span></div>
    <h2>${escapeHTML(r.title)}</h2>
    <div class="meta-row"><span class="meta-pill">${r.realisticTime} min realistic</span><span class="meta-pill">${fmtMoney(r.pricePerServing)}/portion</span>${r.protein!=null?`<span class="meta-pill">${r.protein} g protein</span>`:''}<span class="meta-pill">Health ${r.healthyScore}/100</span></div>
    <div class="serving-control"><strong>Portions</strong><div><button id="servingMinus" type="button">−</button><span>${servings}</span><button id="servingPlus" type="button">+</button></div></div>
    <h3>Ingredients</h3><ul>${r.ingredients.map(x=>`<li>${escapeHTML(scaleIngredient(x,factor))}</li>`).join('')}</ul>
    <h3>Instructions</h3><ol>${r.instructions.map(x=>`<li>${escapeHTML(x)}</li>`).join('')}</ol>
    <p class="detail-provenance">Source dataset: ${escapeHTML(r.source)} · ${escapeHTML(r.license)}</p></div>`;
  bindImageFallback($('#recipeDetail'));
  $('#servingMinus').onclick=()=>renderDetail(r,Math.max(1,servings-1));
  $('#servingPlus').onclick=()=>renderDetail(r,Math.min(16,servings+1));
}
function openDetail(r){if(!r)return;renderDetail(r);$('#recipeDialog').showModal()}

async function renderSaved(){
  let items=await getSavedRecipes();const q=norm($('#savedSearch').value),sort=$('#savedSort').value;
  if(q)items=items.filter(r=>norm(`${r.title} ${r.ingredients.join(' ')}`).includes(q));
  if(sort==='time')items.sort((a,b)=>a.realisticTime-b.realisticTime);else if(sort==='price')items.sort((a,b)=>(a.pricePerServing??999)-(b.pricePerServing??999));else if(sort==='favorite')items.sort((a,b)=>Number(b._action?.favorite)-Number(a._action?.favorite));else items.sort((a,b)=>(b._action?.savedAt||0)-(a._action?.savedAt||0));
  const root=$('#savedRecipes');root.classList.toggle('list',state.layout==='list');
  root.innerHTML=items.map(r=>`<article class="saved-item" data-id="${escapeAttr(r.id)}"><div class="thumb">${imageHTML(r,'saved-photo')}</div><div class="copy"><button class="favorite-star" data-fav="${escapeAttr(r.id)}">${r._action?.favorite?'★':'☆'}</button><h3>${escapeHTML(r.title)}</h3><p>${r.realisticTime} min · ${fmtMoney(r.pricePerServing)}/portion</p></div></article>`).join('')||'<p class="muted">No saved recipes yet.</p>';
  bindImageFallback(root);
  root.querySelectorAll('.saved-item').forEach(el=>el.addEventListener('click',e=>{if(e.target.matches('[data-fav]'))return;openDetail(items.find(x=>x.id===el.dataset.id))}));
  root.querySelectorAll('[data-fav]').forEach(b=>b.addEventListener('click',async e=>{e.stopPropagation();const a=(await getAllActions()).find(x=>x.id===b.dataset.fav);await setAction(b.dataset.fav,{favorite:!a?.favorite});renderSaved()}));
}

function renderMultiChips(rootId,items,active,onChange,mode='active'){
  const root=$(rootId);root.innerHTML=items.map(x=>`<button class="chip ${active.includes(x)?mode:''}" data-value="${escapeAttr(x)}" type="button"><span class="check">✓</span>${escapeHTML(pretty(x))}</button>`).join('');
  root.querySelectorAll('.chip').forEach(b=>b.addEventListener('click',()=>{b.classList.toggle(mode);onChange([...root.querySelectorAll(`.${mode}`)].map(x=>x.dataset.value))}));
}
function renderIngredientGroups(rootId,active,onChange,mode='active'){
  const root=$(rootId);root.innerHTML=Object.entries(INGREDIENT_GROUPS).map(([group,items])=>`<div class="ingredient-group"><h4>${escapeHTML(group)}</h4><div class="chip-grid">${items.map(x=>`<button class="chip ${active.includes(x)?mode:''}" data-value="${escapeAttr(x)}" type="button"><span class="check">✓</span>${escapeHTML(x)}</button>`).join('')}</div></div>`).join('');
  root.querySelectorAll('.chip').forEach(b=>b.addEventListener('click',()=>{b.classList.toggle(mode);onChange([...root.querySelectorAll(`.${mode}`)].map(x=>x.dataset.value))}));
}
function renderSinglePreset(rootId,values,current,label,onChange){
  const root=$(rootId);root.innerHTML=values.map(v=>{const selected=(v==null&&current==null)||(v!=null&&Number(current)===Number(v));return`<button class="chip ${selected?'active':''}" data-value="${v??''}" type="button"><span class="radio-dot"></span>${escapeHTML(label(v))}</button>`}).join('');
  root.querySelectorAll('.chip').forEach(b=>b.addEventListener('click',()=>{const raw=b.dataset.value,value=raw===''?null:Number(raw);onChange(value);renderSinglePreset(rootId,values,value,label,onChange)}));
}
function hydrateControls(){
  renderIngredientGroups('#tempExcludeChips',state.filters.tempExclude,v=>{state.filters.tempExclude=v;saveSessionFilters()},'exclude');
  renderIngredientGroups('#tempPreferChips',state.filters.tempPrefer,v=>{state.filters.tempPrefer=v;saveSessionFilters()},'active');
  renderIngredientGroups('#permanentExcludeChips',state.settings.permanentExclude,v=>state.settings.permanentExclude=v,'exclude');
  renderSinglePreset('#timePresetChips',TIME_PRESETS,state.filters.maxTime,v=>v==null?'Any':`≤ ${v} min`,v=>{state.filters.maxTime=v;saveSessionFilters()});
  renderSinglePreset('#pricePresetChips',PRICE_PRESETS,state.filters.maxPrice,v=>v==null?'Any':`≤ ${v.toFixed(v%1?1:0)} €`,v=>{state.filters.maxPrice=v;saveSessionFilters()});
  renderSinglePreset('#proteinPresetChips',PROTEIN_PRESETS,state.filters.minProtein,v=>v==null?'Any':`≥ ${v} g`,v=>{state.filters.minProtein=v;saveSessionFilters()});
  renderSinglePreset('#caloriePresetChips',CALORIE_PRESETS,state.filters.maxCalories,v=>v==null?'Any':`≤ ${v} kcal`,v=>{state.filters.maxCalories=v;saveSessionFilters()});
  renderSinglePreset('#defaultTimeChips',TIME_PRESETS,state.settings.defaultMaxTime,v=>v==null?'Any':`≤ ${v} min`,v=>state.settings.defaultMaxTime=v);
  renderMultiChips('#cuisineChips',CUISINES,state.filters.excludedCuisines,v=>{state.filters.excludedCuisines=v;saveSessionFilters()},'exclude');
  renderMultiChips('#methodChips',METHODS,state.filters.methods,v=>{state.filters.methods=v;saveSessionFilters()});
  renderMultiChips('#healthChips',HEALTH,state.filters.health,v=>{state.filters.health=v;saveSessionFilters()});
  renderMultiChips('#equipmentChips',[...new Set([...DEFAULT_EQUIPMENT,...state.settings.equipment])],state.settings.equipment,v=>state.settings.equipment=v);
}

async function runImport(){
  if(state.importing)return;if(!navigator.onLine){toast('Internet is required for the first recipe download.');return}
  state.importing=true;$('#importPanel').classList.remove('hidden');$('#setupBanner').classList.add('hidden');
  try{
    const result=await importModernRecipes(p=>{
      let pct=p.total?Math.min(100,p.processed/p.total*100):0;
      if(p.phase==='images')pct=2;if(p.phase==='download')pct=5;if(p.phase==='done')pct=100;
      $('#importProgress').style.width=`${pct}%`;$('#importCounter').textContent=`${Math.round(pct)}%`;
      $('#importTitle').textContent=p.message||'Building library…';
      $('#importDetail').textContent=p.phase==='import'?`${p.processed.toLocaleString()} source recipes checked · ${p.accepted.toLocaleString()} strict vegan main dishes with photos kept`:'Preparing the modern image-backed recipe library…';
    });
    toast(`${result.accepted.toLocaleString()} vegan main dishes ready`);await updateCounts();await rebuildQueue();
  }catch(e){console.error(e);$('#setupBanner').classList.remove('hidden');toast(`Import stopped: ${e.message}`)}finally{state.importing=false;$('#importPanel').classList.add('hidden');await updateCounts()}
}

async function cacheAllImages(){
  if(!navigator.onLine){toast('Go online to cache photos first.');return}
  const recipes=await getVeganRecipes(5000);if(!recipes.length){toast('Download recipes first.');return}
  const btn=$('#cacheImagesButton');btn.disabled=true;const old=btn.textContent;let done=0;
  try{
    const cache=await caches.open('veganswipe-recipe-images-v2');
    for(const r of recipes){
      try{if(!(await cache.match(r.imageURL))){const resp=await fetch(r.imageURL,{mode:'no-cors',cache:'force-cache'});await cache.put(r.imageURL,resp.clone())}}catch{}
      done++;if(done%10===0){btn.textContent=`Caching photos… ${done}/${recipes.length}`;await new Promise(res=>setTimeout(res,0))}
    }
    toast('Recipe photos cached for offline use');
  }finally{btn.disabled=false;btn.textContent=old}
}

function bindUI(){
  $$('.tab').forEach(b=>b.addEventListener('click',async()=>{$$('.tab').forEach(x=>x.classList.remove('active'));b.classList.add('active');$$('.view').forEach(v=>v.classList.remove('active'));$(`#${b.dataset.view}`).classList.add('active');if(b.dataset.view==='savedView')renderSaved();if(b.dataset.view==='settingsView')updateCounts()}));
  $('#rejectButton').onclick=()=>act('reject');$('#saveButton').onclick=()=>act('save');$('#laterButton').onclick=()=>act('later');
  $('#openFiltersFromEmpty').onclick=()=>$('.tab[data-view="filtersView"]').click();$('#startImportButton').onclick=runImport;$('#importMoreButton').onclick=runImport;$('#cacheImagesButton').onclick=cacheAllImages;$('#closeDialog').onclick=()=>$('#recipeDialog').close();
  $('#savedSearch').oninput=renderSaved;$('#savedSort').onchange=renderSaved;
  $('#gridMode').onclick=()=>{state.layout='grid';$('#gridMode').classList.add('active');$('#listMode').classList.remove('active');renderSaved()};
  $('#listMode').onclick=()=>{state.layout='list';$('#listMode').classList.add('active');$('#gridMode').classList.remove('active');renderSaved()};
  $('#filtersForm').onsubmit=async e=>{e.preventDefault();saveSessionFilters();await rebuildQueue();$('.tab[data-view="discoverView"]').click();toast('Filters applied')};
  $('#clearTempFilters').onclick=async()=>{state.filters={tempExclude:[],tempPrefer:[],excludedCuisines:[],methods:[],health:[],maxTime:null,maxPrice:null,minProtein:null,maxCalories:null};sessionStorage.removeItem('veganswipe.filters.v2');hydrateControls();await rebuildQueue();toast('Temporary filters cleared')};
  $('#addEquipmentButton').onclick=()=>{const v=$('#newEquipment').value.trim();if(!v)return;state.settings.equipment=[...new Set([...state.settings.equipment,v])];$('#newEquipment').value='';renderMultiChips('#equipmentChips',[...new Set([...DEFAULT_EQUIPMENT,...state.settings.equipment])],state.settings.equipment,v=>state.settings.equipment=v)};
  $('#saveSettingsButton').onclick=async()=>{state.settings.language='en';await Promise.all(Object.entries(state.settings).map(([k,v])=>setSetting(k,v)));await rebuildQueue();toast('Permanent settings saved')};
  $('#exportButton').onclick=async()=>{const data=await exportPersonalData(),blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`VeganSwipe-backup-${new Date().toISOString().slice(0,10)}.json`;a.click();URL.revokeObjectURL(a.href)};
  $('#backupInput').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{await restorePersonalData(JSON.parse(await f.text()));toast('Backup restored');setTimeout(()=>location.reload(),500)}catch{toast('Could not restore backup')}};
  window.addEventListener('online',updateOnline);window.addEventListener('offline',updateOnline);
}
function updateOnline(){const online=navigator.onLine;$('#offlineBadge span').textContent=online?'Online':'Offline';$('#offlineBadge').classList.toggle('offline',!online)}

async function init(){
  await openDB();
  const storedVersion=await getSetting('datasetVersion',null),existing=await countRecipes();
  if(existing&&storedVersion!==DATASET_VERSION){await clearRecipes();await setSetting('datasetVersion',null);await setSetting('sourceRowsScanned',0);await setSetting('eligibleCount',0)}
  const settings=await getAllSettings();state.settings={...state.settings,...settings,equipment:settings.equipment||[...DEFAULT_EQUIPMENT],permanentExclude:settings.permanentExclude||[]};
  try{state.filters={...state.filters,...JSON.parse(sessionStorage.getItem('veganswipe.filters.v2')||'{}')}}catch{}
  hydrateControls();bindUI();bindSwipe();updateOnline();
  const counts=await updateCounts();if(counts.vegan)await rebuildQueue();else showNext();
  if('serviceWorker'in navigator){try{const reg=await navigator.serviceWorker.register('./service-worker.js',{scope:'./'});reg.update()}catch(e){console.warn('Service worker registration failed',e)}}
}
init().catch(e=>{console.error(e);toast('App initialization failed')});
