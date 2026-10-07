export const CUISINES=['Italian','Indian','Mexican','Mediterranean','Middle Eastern','Japanese','Chinese','Thai','Korean','American','French','Greek','Spanish','Other'];
export const METHODS=['Pan','Oven','Air Fryer','Boil','Steam','Grill','No Cook','One Pot'];
export const HEALTH=['Vegetable-rich','High protein','High fiber','Whole grain','Low sugar','Low saturated fat','Calorie-light','Minimally processed'];
export const DEFAULT_EQUIPMENT=['Stovetop','Oven','Air Fryer','Microwave','Blender','Immersion Blender','Multicooker','Steamer','Grill'];
export const INGREDIENT_GROUPS={
  'Vegetables':['Bell pepper','Mushrooms','Tomato','Onion','Garlic','Zucchini','Eggplant','Broccoli','Cauliflower','Spinach','Kale','Carrot','Potato','Sweet potato','Pumpkin / squash','Cucumber','Corn','Peas','Green beans','Cabbage','Celery','Asparagus','Avocado'],
  'Protein & legumes':['Tofu','Tempeh','Seitan','Lentils','Chickpeas','Black beans','Kidney beans','White beans','Edamame'],
  'Grains & starches':['Rice','Pasta','Noodles','Quinoa','Couscous','Bread','Tortilla','Oats','Polenta'],
  'Flavor & extras':['Coconut milk','Peanut butter','Tahini','Soy sauce','Miso','Olives','Coriander / cilantro','Nuts','Sesame','Chili','Ginger','Lemon','Lime']
};

export function norm(s=''){return String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[’‘]/g,"'").replace(/[^a-z0-9äöüßæœ\s'-]/gi,' ').replace(/\s+/g,' ').trim()}
export function cleanText(s=''){return String(s??'').replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'").replace(/&lt;/gi,'<').replace(/&gt;/gi,'>').replace(/\u00a0/g,' ').replace(/[\t\r]+/g,' ').replace(/\s{2,}/g,' ').trim()}
export function cleanTitle(s=''){let t=cleanText(s).replace(/^recipe\s*[:\-]\s*/i,'').replace(/^[\"']+|[\"']+$/g,'').replace(/\s+[|–—-]\s+(epicurious|bon app[eé]tit).*$/i,'').replace(/\s+/g,' ').trim();return t.length>110?t.slice(0,107).trim()+'…':t}

export function parseListField(input=''){
  const s=String(input??'').trim();
  if(!s)return[];
  if(!(s.startsWith('[')&&s.endsWith(']')))return s.split(/\n|\s*;\s*/).map(cleanText).filter(Boolean);
  const out=[];let buf='',quote=null,esc=false;
  for(let i=1;i<s.length-1;i++){
    const ch=s[i];
    if(esc){buf+=ch;esc=false;continue}
    if(ch==='\\'){esc=true;continue}
    if(quote){if(ch===quote){quote=null}else buf+=ch;continue}
    if(ch==='"'||ch==="'"){quote=ch;continue}
    if(ch===','){const v=cleanText(buf);if(v)out.push(v);buf='';continue}
    buf+=ch;
  }
  const v=cleanText(buf);if(v)out.push(v);
  return [...new Set(out.map(x=>x.replace(/^['"]|['"]$/g,'').trim()).filter(Boolean))];
}

export function splitInstructions(s=''){
  const text=cleanText(s);
  if(!text)return[];
  const raw=text.split(/(?<=[.!?])\s+(?=[A-Z0-9])/).map(x=>x.trim()).filter(x=>x.length>8);
  const steps=[];let current='';
  for(const sentence of raw){
    if(!current)current=sentence;
    else if((current.length+sentence.length)<220)current+=' '+sentence;
    else{steps.push(current);current=sentence}
  }
  if(current)steps.push(current);
  return steps.slice(0,30);
}

const safeAnimalWordPhrases=[
  'almond milk','oat milk','soy milk','soya milk','coconut milk','rice milk','cashew milk','hemp milk','plant milk','plant-based milk','vegan milk','non-dairy milk','dairy-free milk',
  'peanut butter','almond butter','cashew butter','sunflower butter','seed butter','apple butter','pumpkin butter','cocoa butter','butter bean','butter beans','vegan butter','plant butter','dairy-free butter','cream of tartar',
  'vegan cheese','plant-based cheese','dairy-free cheese','vegan cream','coconut cream','oat cream','soy cream','cashew cream',
  'vegan mayo','vegan mayonnaise','egg-free mayonnaise','vegan pesto','dairy-free pesto','vegan worcestershire',
  'eggplant','eggplants','oyster mushroom','oyster mushrooms','king oyster mushroom','king oyster mushrooms','chicken of the woods','beefsteak tomato','beefsteak tomatoes'
];
const animalPatterns=[
  /\b(beef|veal|steak|brisket|ground beef|corned beef)\b/,
  /\b(pork|bacon|ham|prosciutto|pancetta|salami|pepperoni|sausage|chorizo|lard|suet|tallow)\b/,
  /\b(chicken|turkey|duck|goose|poultry|quail|pheasant)\b/,
  /\b(lamb|mutton|goat|venison|rabbit|bison|buffalo)\b/,
  /\b(fish|salmon|tuna|cod|haddock|halibut|trout|sardine|anchov(?:y|ies)|mackerel|tilapia|snapper|swordfish)\b/,
  /\b(shrimp|prawn|crab|lobster|clam|mussel|oyster|scallop|squid|calamari|octopus|shellfish)\b/,
  /\b(egg|eggs|egg white|egg whites|egg yolk|egg yolks|mayonnaise|mayo)\b/,
  /\b(milk|buttermilk|butter|ghee|cream|half and half|half-and-half|cheese|parmesan|pecorino|mozzarella|cheddar|feta|ricotta|mascarpone|yogurt|yoghurt|whey|casein|caseinate|lactose)\b/,
  /\b(honey|bee pollen|royal jelly|gelatin|gelatine|isinglass|carmine|cochineal|shellac)\b/,
  /\b(chicken stock|chicken broth|beef stock|beef broth|fish stock|fish broth|bone broth|meat stock|meat broth)\b/,
  /\b(fish sauce|oyster sauce|worcestershire sauce|shrimp paste)\b/,
  /\b(pesto)\b/,
  /\b(marshmallow|marshmallows)\b/
];
function scrubSafePhrases(s){let t=` ${norm(s)} `;for(const p of safeAnimalWordPhrases)t=t.replaceAll(` ${norm(p)} `,' __SAFE__ ');return t}
export function strictVeganCheck(ingredients=[],title='',instructions=''){
  if(!ingredients.length)return false;
  const segments=[...ingredients,title,instructions].map(scrubSafePhrases);
  for(const seg of segments)for(const re of animalPatterns)if(re.test(seg))return false;
  return true;
}

export function isEnglishFriendlyTitle(title=''){
  const t=cleanTitle(title);if(t.length<4||t.length>110)return false;
  if(/[\u0400-\u04ff\u0370-\u03ff\u4e00-\u9fff\u3040-\u30ff\u0600-\u06ff]/.test(t))return false;
  const letters=[...t].filter(c=>/\p{L}/u.test(c));if(!letters.length)return false;
  const latin=letters.filter(c=>/[A-Za-zÀ-ÖØ-öø-ÿ]/.test(c)).length;
  return latin/letters.length>.88;
}

const negativeMealTitle=/(cocktail|mocktail|smoothie|juice|lemonade|punch|latte|coffee|tea\b|hot chocolate|milkshake|drink\b|beverage|spritzer|martini|margarita|sangria|cake\b|cupcake|cookie|brownie|blondie|cheesecake|pudding|ice cream|sorbet|gelato|candy|fudge|truffle|caramel|macaron|macaroon|donut|doughnut|muffin|scone|waffle|pancake|crepe|granola|jam\b|jelly\b|marmalade|syrup|vinaigrette|dressing\b|marinade|seasoning|spice mix|sauce\b|dip\b|spread\b|condiment|pickle|relish|cracker|chips\b|popcorn|snack\b|appetizer|starter\b|hors d|canap|bread\b|loaf\b|rolls?\b|biscuit|frosting|icing)/i;
const mainKeywords=/(curry|stew|soup|chili\b|dal\b|dhal\b|pasta|spaghetti|linguine|penne|rigatoni|lasagna|gnocchi|noodles?|ramen|udon|soba|risotto|rice bowl|grain bowl|bowl\b|casserole|tagine|paella|biryani|pilaf|burger|sandwich|wrap\b|taco|burrito|enchilada|quesadilla|fajita|pizza|flatbread|stir[- ]?fry|skillet|one[- ]?pot|traybake|sheet[- ]pan|stuffed|roast(ed)?\b|pot pie|shepherd|ratatouille|tofu|tempeh|seitan|lentil|chickpea|beans?\b|falafel|meatballs?)/i;
const proteinRe=/(tofu|tempeh|seitan|lentil|chickpea|garbanzo|black bean|kidney bean|white bean|cannellini|pinto bean|edamame|split pea|black-eyed pea|textured vegetable protein|tvp)/i;
const carbRe=/(rice|pasta|noodle|quinoa|couscous|bulgur|barley|farro|potato|sweet potato|bread|tortilla|polenta|millet|buckwheat)/i;
const vegRe=/(tomato|pepper|broccoli|cauliflower|spinach|kale|carrot|zucchini|eggplant|aubergine|cabbage|mushroom|squash|pumpkin|onion|leek|asparagus|green bean|peas|corn|chard|celery|artichoke)/i;
export function isMainDish(title,ingredients,instructions=''){
  const t=cleanTitle(title);const n=norm(t);const ing=ingredients.join(' ');
  if(negativeMealTitle.test(t)){
    if(!/(sandwich|burger|wrap|pizza|flatbread|pot pie)/i.test(t))return false;
  }
  if(/\bsalad\b/i.test(t) && !(proteinRe.test(ing)||/(quinoa|farro|barley|couscous|rice|potato)/i.test(ing)))return false;
  let score=0;
  if(mainKeywords.test(t))score+=3;
  if(proteinRe.test(ing))score+=2;
  if(carbRe.test(ing))score+=1;
  if(vegRe.test(ing))score+=1;
  if(ingredients.length>=7)score+=1;
  if(cleanText(instructions).length>=180)score+=1;
  if(/\b(dinner|main course|entree|entrée|supper)\b/i.test(`${t} ${instructions}`))score+=2;
  if(/\b(side dish|side|garnish|topping)\b/i.test(t))score-=3;
  return score>=4;
}

export function inferCuisine(recipe){
  const t=norm(`${recipe.title} ${recipe.ingredients.join(' ')}`);
  const rules=[
    ['Indian',/(curry|masala|garam masala|dal\b|dhal|chana|tikka|turmeric|cumin.*coriander)/],
    ['Mexican',/(taco|burrito|enchilada|fajita|tostada|salsa|chipotle|tortilla|poblano|jalapeno)/],
    ['Italian',/(pasta|spaghetti|linguine|penne|rigatoni|risotto|gnocchi|polenta|marinara|basil.*tomato)/],
    ['Japanese',/(miso|ramen|udon|soba|teriyaki|dashi|nori|mirin|sushi)/],
    ['Chinese',/(sichuan|szechuan|mapo|hoisin|five spice|stir fry|chow mein|lo mein)/],
    ['Thai',/(thai|pad thai|lemongrass|galangal|kaffir|red curry|green curry)/],
    ['Korean',/(korean|gochujang|gochugaru|bibimbap|bulgogi|kimchi)/],
    ['Middle Eastern',/(falafel|hummus|tahini|zaatar|za'atar|shawarma|harissa|sumac|freekeh)/],
    ['Greek',/(greek|spanakopita|oregano.*lemon)/],
    ['Spanish',/(paella|spanish|romesco|gazpacho)/],
    ['French',/(french|ratatouille|provence|provençal|cassoulet)/],
    ['American',/(barbecue|bbq|buffalo|cajun|creole|sloppy joe|mac and cheese)/],
    ['Mediterranean',/(mediterranean|couscous|olive.*tomato|chickpea.*lemon)/]
  ];
  for(const [name,re] of rules)if(re.test(t))return name;
  return 'Other';
}

export function inferMethods(recipe){const t=norm(`${recipe.title} ${recipe.instructions.join(' ')}`);const out=[];if(/fry|saute|sauté|skillet|pan\b/.test(t))out.push('Pan');if(/bake|roast|oven/.test(t))out.push('Oven');if(/air fryer/.test(t))out.push('Air Fryer');if(/boil|simmer|poach/.test(t))out.push('Boil');if(/steam/.test(t))out.push('Steam');if(/grill|broil|barbecue/.test(t))out.push('Grill');if(/no cook|uncooked|raw/.test(t))out.push('No Cook');if(/one pot|one-pot/.test(t))out.push('One Pot');return [...new Set(out)]}
export function estimateTime(recipe){const text=norm(recipe.instructions.join(' '));let explicit=0;for(const m of text.matchAll(/(\d+)\s*(minutes?|mins?|hours?|hrs?)/g)){let v=Number(m[1]);if(m[2].startsWith('hour')||m[2].startsWith('hr'))v*=60;if(v<=240)explicit+=v}const active=10+recipe.ingredients.length*1.3+recipe.instructions.length*2.3;let method=0;if(/bake|roast|oven/.test(text))method+=15;if(/simmer|stew|braise/.test(text))method+=18;if(/chop|dice|mince|peel/.test(text))method+=7;const calculated=Math.round(active+method);return Math.max(15,Math.min(240,Math.round(Math.max(calculated,explicit?explicit+10:0)/5)*5))}

const PRICE={rice:3.2,pasta:2.6,noodle:4,quinoa:8,couscous:4,potato:1.8,'sweet potato':3.2,lentil:4,beans:4,chickpea:4.5,tofu:7,tempeh:12,seitan:12,tomato:4,'bell pepper':5,pepper:5,broccoli:4,onion:1.8,garlic:7,carrot:1.8,zucchini:3.5,eggplant:4,mushroom:6,spinach:7,'coconut milk':4,'olive oil':10,oil:6,oats:2.2,bread:4,tortilla:6,avocado:7};
const NUTRI={tofu:[144,17,2],tempeh:[193,20,7],seitan:[141,25,1],lentil:[116,9,8],chickpea:[164,9,8],beans:[127,9,7],rice:[130,2.7,.4],quinoa:[120,4.4,2.8],pasta:[157,5.8,1.8],potato:[77,2,2.2],'sweet potato':[86,1.6,3],broccoli:[34,2.8,2.6],spinach:[23,2.9,2.2],tomato:[18,.9,1.2],oats:[389,17,10.6]};
function amountKg(line){const n=norm(line);let m=n.match(/(\d+(?:\.\d+)?)\s*(kg|g|ml|l|tbsp|tsp|cups?)/);if(!m)return .10;let v=Number(m[1]);const u=m[2];if(u==='kg'||u==='l')return v;if(u==='g'||u==='ml')return v/1000;if(u==='tbsp')return v*.015;if(u==='tsp')return v*.005;if(u.startsWith('cup'))return v*.18;return .10}
function lookup(obj,line){const n=norm(line);return Object.keys(obj).sort((a,b)=>b.length-a.length).find(k=>n.includes(k))}
export function estimateNutritionAndPrice(recipe){let price=0,known=0,cal=0,protein=0,fiber=0;for(const line of recipe.ingredients){const kg=amountKg(line);const pk=lookup(PRICE,line);if(pk){price+=PRICE[pk]*kg;known++}const nk=lookup(NUTRI,line);if(nk){const factor=kg*10;cal+=NUTRI[nk][0]*factor;protein+=NUTRI[nk][1]*factor;fiber+=NUTRI[nk][2]*factor}}const servings=recipe.servings||4;return{estimatedPrice:known>=Math.max(2,recipe.ingredients.length*.22)?Number(price.toFixed(2)):null,pricePerServing:known>=2?Number((price/servings).toFixed(2)):null,calories:protein?Math.round(cal/servings):null,protein:protein?Number((protein/servings).toFixed(1)):null,fiber:fiber?Number((fiber/servings).toFixed(1)):null}}
export function healthyScore(recipe){const t=norm(recipe.ingredients.join(' '));let s=48;for(const w of ['lentil','beans','chickpea','broccoli','spinach','kale','cabbage','tomato','carrot','zucchini','vegetable','oats','whole grain','quinoa'])if(t.includes(w))s+=4;if(/olive oil|rapeseed|canola|nuts|seeds|avocado/.test(t))s+=4;if(/sugar|corn syrup|agave syrup/.test(t))s-=7;if(/deep fry|deep-fry/.test(norm(recipe.instructions.join(' '))))s-=10;if(/coconut oil|coconut cream/.test(t))s-=3;if(recipe.ingredients.length>=8)s+=3;return Math.max(0,Math.min(100,s))}

export function normalizeDatasetRecipe(row,imageURL){
  const title=cleanTitle(row.Title||row.title||'');
  const ingredients=parseListField(row.Cleaned_Ingredients||row.Ingredients||row.ingredients||'');
  const instructions=splitInstructions(row.Instructions||row.instructions||'');
  if(!imageURL||!isEnglishFriendlyTitle(title)||ingredients.length<4||instructions.length<1)return null;
  if(!strictVeganCheck(ingredients,title,instructions.join(' ')))return null;
  if(!isMainDish(title,ingredients,instructions.join(' ')))return null;
  const rawId=row['Unnamed: 0']??row['']??row.id??simpleHash(`${title}|${ingredients.join('|')}`);
  const base={id:`epi:${rawId}`,source:'Epicurious image recipe dataset',sourceURL:'https://www.kaggle.com/datasets/pes12017000148/food-ingredients-and-recipe-dataset-with-images',license:'CC BY-SA 3.0 (dataset declaration)',title,titleLower:norm(title),imageURL,mealType:'Main dish',ingredients,instructions,servings:4,importedAt:Date.now(),vegan:1};
  base.culture=inferCuisine(base);base.methods=inferMethods(base);base.realisticTime=estimateTime(base);Object.assign(base,estimateNutritionAndPrice(base));base.healthyScore=healthyScore(base);return base;
}
function simpleHash(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return(h>>>0).toString(36)}

const INGREDIENT_ALIASES={
  'Bell pepper':['bell pepper','red pepper','green pepper','yellow pepper','sweet pepper','capsicum'],
  'Mushrooms':['mushroom','mushrooms'],Tomato:['tomato','tomatoes'],Onion:['onion','onions','shallot'],Garlic:['garlic'],Zucchini:['zucchini','courgette'],Eggplant:['eggplant','aubergine'],Broccoli:['broccoli'],Cauliflower:['cauliflower'],Spinach:['spinach'],Kale:['kale'],Carrot:['carrot'],Potato:['potato','potatoes'],'Sweet potato':['sweet potato','sweet potatoes'],'Pumpkin / squash':['pumpkin','squash'],Cucumber:['cucumber'],Corn:['corn'],Peas:['peas','pea'], 'Green beans':['green bean','green beans'],Cabbage:['cabbage'],Celery:['celery'],Asparagus:['asparagus'],Avocado:['avocado'],Tofu:['tofu'],Tempeh:['tempeh'],Seitan:['seitan'],Lentils:['lentil','lentils'],Chickpeas:['chickpea','chickpeas','garbanzo'], 'Black beans':['black beans','black bean'], 'Kidney beans':['kidney beans','kidney bean'], 'White beans':['white beans','cannellini','navy beans'],Edamame:['edamame'],Rice:['rice'],Pasta:['pasta','spaghetti','penne','linguine','rigatoni'],Noodles:['noodle','noodles','ramen','udon','soba'],Quinoa:['quinoa'],Couscous:['couscous'],Bread:['bread','baguette','pita'],Tortilla:['tortilla'],Oats:['oats','oatmeal'],Polenta:['polenta'], 'Coconut milk':['coconut milk'], 'Peanut butter':['peanut butter'],Tahini:['tahini'],'Soy sauce':['soy sauce','tamari'],Miso:['miso'],Olives:['olive','olives'],'Coriander / cilantro':['coriander','cilantro'],Nuts:['almond','walnut','cashew','pecan','hazelnut','pistachio'],Sesame:['sesame'],Chili:['chili','chilli','jalapeno','cayenne'],Ginger:['ginger'],Lemon:['lemon'],Lime:['lime']
};
export function ingredientMatches(line,label){const n=norm(line);const aliases=INGREDIENT_ALIASES[label]||[label];return aliases.some(a=>n.includes(norm(a)))}
const optionalRe=/\b(optional|to serve|for serving|garnish|if desired|or substitute|or use|as needed|to taste)\b/i;
export function requiredIngredientMatches(lines,label){return lines.some(line=>!optionalRe.test(line)&&ingredientMatches(line,label))}
export function passesFilters(r,f){const excludes=[...(f.permanentExclude||[]),...(f.tempExclude||[])];if(excludes.some(x=>requiredIngredientMatches(r.ingredients,x)))return false;if(f.maxTime&&r.realisticTime>f.maxTime)return false;if(f.maxPrice&&r.pricePerServing!=null&&r.pricePerServing>f.maxPrice)return false;if(f.minProtein&&r.protein!=null&&r.protein<f.minProtein)return false;if(f.maxCalories&&r.calories!=null&&r.calories>f.maxCalories)return false;if(f.excludedCuisines?.includes(r.culture))return false;if(f.methods?.length&&!r.methods.some(m=>f.methods.includes(m)))return false;const eq=f.equipment||[];if(r.methods.includes('Air Fryer')&&!eq.includes('Air Fryer'))return false;if(r.methods.includes('Oven')&&!eq.includes('Oven'))return false;if(r.methods.includes('Grill')&&!eq.includes('Grill'))return false;return true}
export function recommendationScore(r,profile,f){let score=r.healthyScore*.13+Math.random()*12;if(profile.cuisines[r.culture])score+=profile.cuisines[r.culture]*8;for(const line of r.ingredients){const n=norm(line);for(const [k,v] of Object.entries(profile.ingredients))if(n.includes(k))score+=v*1.6}for(const p of f.tempPrefer||[])if(r.ingredients.some(x=>ingredientMatches(x,p)))score+=9;for(const h of f.health||[]){if(h==='High protein'&&r.protein>=15)score+=8;if(h==='High fiber'&&r.fiber>=6)score+=8;if(h==='Calorie-light'&&r.calories&&r.calories<500)score+=6;if(h==='Vegetable-rich'&&vegRe.test(r.ingredients.join(' ')))score+=6;if(h==='Whole grain'&&/(whole grain|whole wheat|oats|brown rice|farro|barley)/i.test(r.ingredients.join(' ')))score+=6;if(h==='Low sugar'&&!/(sugar|syrup)/i.test(r.ingredients.join(' ')))score+=4;if(h==='Low saturated fat'&&!/(coconut oil|coconut cream)/i.test(r.ingredients.join(' ')))score+=3;if(h==='Minimally processed'&&!/(vegan cheese|meat substitute|protein powder|ready-made|packaged)/i.test(r.ingredients.join(' ')))score+=4}return score}
export function buildProfile(recipesById,actions){const profile={ingredients:{},cuisines:{}};for(const a of actions){const r=recipesById.get(a.id);if(!r)continue;const weight=a.saved?1:a.disliked?-.3:0;if(!weight)continue;profile.cuisines[r.culture]=(profile.cuisines[r.culture]||0)+weight;for(const line of r.ingredients.slice(0,12)){const words=norm(line).split(' ').filter(w=>w.length>3).slice(-2);for(const w of words)profile.ingredients[w]=(profile.ingredients[w]||0)+weight*.2}}return profile}
