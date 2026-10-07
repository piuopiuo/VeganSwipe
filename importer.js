import {putRecipes,clearRecipes,setSetting,getSetting} from './db.js';
import {normalizeDatasetRecipe} from './recipe-utils.js';

export const DATASET_VERSION='epicurious-image-main-v2';
export const SOURCE_ROW_COUNT=13582;
const REPO='kaveesh-kadirvel/Fridge2Fork';
const CSV_URL='https://raw.githubusercontent.com/kaveesh-kadirvel/Fridge2Fork/main/Food%20Ingredients%20and%20Recipe%20Dataset%20with%20Image%20Name%20Mapping.csv';
const TREE_URL=`https://api.github.com/repos/${REPO}/git/trees/main?recursive=1`;
const RAW_BASE=`https://raw.githubusercontent.com/${REPO}/main/`;
const IMAGE_PREFIX='Food Images/Food Images/';

function rawURL(path){return RAW_BASE+path.split('/').map(encodeURIComponent).join('/')}
function stem(name=''){return String(name).trim().toLowerCase().replace(/\.(jpe?g|png|webp)$/i,'')}
function cleanHeader(s=''){return String(s).replace(/^\ufeff/,'').trim()}

async function fetchImageIndex(){
  const response=await fetch(TREE_URL,{cache:'no-store',headers:{Accept:'application/vnd.github+json'}});
  if(!response.ok)throw new Error(`Image index could not be loaded (${response.status})`);
  const json=await response.json();
  const map=new Map();
  for(const item of json.tree||[]){
    if(item.type!=='blob'||!item.path?.startsWith(IMAGE_PREFIX))continue;
    if(!/\.(jpe?g|png|webp)$/i.test(item.path))continue;
    const base=item.path.split('/').pop();
    map.set(base.toLowerCase(),rawURL(item.path));
    map.set(stem(base),rawURL(item.path));
  }
  return map;
}

function resolveImage(imageName,index){
  const name=String(imageName??'').trim();
  if(!name||name==='#NAME?'||name.toLowerCase()==='nan')return null;
  return index.get(name.toLowerCase())||index.get(stem(name))||null;
}

function rowObject(headers,row){
  const obj={};
  for(let i=0;i<headers.length;i++)obj[headers[i]]=row[i]??'';
  return obj;
}

/** Robust CSV parser for quoted commas/newlines. Used by tests and the importer. */
export function parseCSVText(text){
  const rows=[];let row=[],field='',quoted=false;
  for(let i=0;i<text.length;i++){
    const ch=text[i];
    if(quoted){
      if(ch==='"'){
        if(text[i+1]==='"'){field+='"';i++}else quoted=false;
      }else field+=ch;
      continue;
    }
    if(ch==='"'){quoted=true;continue}
    if(ch===','){row.push(field);field='';continue}
    if(ch==='\n'){row.push(field.replace(/\r$/,''));field='';if(row.some(v=>v!==''))rows.push(row);row=[];continue}
    field+=ch;
  }
  if(field||row.length){row.push(field.replace(/\r$/,''));if(row.some(v=>v!==''))rows.push(row)}
  return rows;
}

export async function importModernRecipes(onProgress=()=>{}){
  const prior=await getSetting('datasetVersion',null);
  if(prior!==DATASET_VERSION){
    await clearRecipes();
    await setSetting('datasetVersion',DATASET_VERSION);
    await setSetting('sourceRowsScanned',0);
    await setSetting('eligibleCount',0);
  }

  onProgress({phase:'images',processed:0,total:SOURCE_ROW_COUNT,accepted:0,message:'Indexing recipe images…'});
  const imageIndex=await fetchImageIndex();
  if(imageIndex.size<1000)throw new Error('The recipe image library could not be indexed.');

  onProgress({phase:'download',processed:0,total:SOURCE_ROW_COUNT,accepted:0,message:'Downloading recipe data…'});
  const response=await fetch(CSV_URL,{cache:'no-store'});
  if(!response.ok)throw new Error(`Recipe data could not be loaded (${response.status})`);
  const text=await response.text();
  const rows=parseCSVText(text);
  if(rows.length<2)throw new Error('The recipe file was empty or invalid.');
  const headers=rows[0].map(cleanHeader);
  const imageColumn=headers.find(h=>h.toLowerCase()==='image_name');
  const titleColumn=headers.find(h=>h.toLowerCase()==='title');
  if(!imageColumn||!titleColumn)throw new Error('The recipe file format changed unexpectedly.');

  await clearRecipes();
  let processed=0,accepted=0,missingImage=0,rejected=0;
  let batch=[];
  const total=Math.max(SOURCE_ROW_COUNT,rows.length-1);
  for(let i=1;i<rows.length;i++){
    const raw=rowObject(headers,rows[i]);
    processed++;
    const imageURL=resolveImage(raw[imageColumn],imageIndex);
    if(!imageURL){missingImage++;continue}
    const recipe=normalizeDatasetRecipe(raw,imageURL);
    if(!recipe){rejected++;continue}
    batch.push(recipe);accepted++;
    if(batch.length>=150){
      await putRecipes(batch);batch=[];
      onProgress({phase:'import',processed,total,accepted,missingImage,rejected,message:'Keeping only strict vegan main dishes with images…'});
      await new Promise(r=>setTimeout(r,0));
    }
  }
  if(batch.length)await putRecipes(batch);

  await setSetting('datasetVersion',DATASET_VERSION);
  await setSetting('sourceRowsScanned',processed);
  await setSetting('eligibleCount',accepted);
  await setSetting('lastImportAt',Date.now());
  await setSetting('datasetSource','Food Ingredients and Recipes Dataset with Images (Epicurious-derived)');
  await setSetting('datasetLicense','CC BY-SA 3.0 (as declared by dataset publisher)');
  onProgress({phase:'done',processed,total:processed,accepted,missingImage,rejected,message:'Recipe library ready.'});
  return{processed,accepted,missingImage,rejected,imageEntries:imageIndex.size};
}
