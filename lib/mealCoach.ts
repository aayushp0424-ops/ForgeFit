/** Ingredient-locked meal suggestions. Never introduce a food not present in the pantry. */
type Ingredient = {key:string; label:string; pattern:RegExp};
const DICTIONARY:Ingredient[] = [
  {key:'chicken',label:'chicken',pattern:/\bchicken(?:\s+(?:breast|thigh|tenders|meat))?\b/i},
  {key:'turkey',label:'turkey',pattern:/\bturkey\b/i},
  {key:'salmon',label:'salmon',pattern:/\bsalmon\b/i},
  {key:'tuna',label:'tuna',pattern:/\btuna\b/i},
  {key:'beef',label:'beef',pattern:/\b(?:beef|steak|ground beef)\b/i},
  {key:'pork',label:'pork',pattern:/\b(?:pork|pork chop)\b/i},
  {key:'tofu',label:'tofu',pattern:/\btofu\b/i},
  {key:'eggs',label:'eggs',pattern:/\beggs?\b/i},
  {key:'chickpeas',label:'chickpeas',pattern:/\b(?:chickpeas?|garbanzo beans?)\b/i},
  {key:'lentils',label:'lentils',pattern:/\blentils?\b/i},
  {key:'beans',label:'beans',pattern:/\b(?:(?:black|kidney|pinto|white|red)\s+)?beans?\b/i},
  {key:'yogurt',label:'yogurt',pattern:/\byogurt\b/i},
  {key:'rice',label:'rice',pattern:/\b(?:rice|brown rice|jasmine rice)\b/i},
  {key:'quinoa',label:'quinoa',pattern:/\bquinoa\b/i},
  {key:'pasta',label:'pasta',pattern:/\b(?:pasta|penne|spaghetti|macaroni|noodles?)\b/i},
  {key:'tortilla',label:'tortilla',pattern:/\b(?:tortillas?|wraps?)\b/i},
  {key:'bread',label:'bread',pattern:/\b(?:bread|toast)\b/i},
  {key:'potato',label:'potato',pattern:/\bpotatoes?\b(?!\s+(?:salad|chips))/i},
  {key:'oats',label:'oats',pattern:/\b(?:oats?|oatmeal)\b/i},
  {key:'broccoli',label:'broccoli',pattern:/\bbroccoli\b/i},
  {key:'spinach',label:'spinach',pattern:/\bspinach\b/i},
  {key:'tomato',label:'tomato',pattern:/\btomatoes?\b/i},
  {key:'lettuce',label:'lettuce',pattern:/\blettuce\b/i},
  {key:'onion',label:'onion',pattern:/\bonions?\b/i},
  {key:'pepper',label:'bell pepper',pattern:/\b(?:bell peppers?|capsicum)\b/i},
  {key:'mushrooms',label:'mushrooms',pattern:/\bmushrooms?\b/i},
  {key:'carrots',label:'carrots',pattern:/\bcarrots?\b/i},
  {key:'zucchini',label:'zucchini',pattern:/\bzucchini\b/i},
  {key:'cucumber',label:'cucumber',pattern:/\bcucumbers?\b/i},
  {key:'asparagus',label:'asparagus',pattern:/\basparagus\b/i},
  {key:'avocado',label:'avocado',pattern:/\bavocados?\b/i},
  {key:'banana',label:'banana',pattern:/\bbananas?\b/i},
  {key:'berries',label:'berries',pattern:/\b(?:berries|blueberries|strawberries|raspberries)\b/i},
  {key:'apple',label:'apple',pattern:/\bapples?\b/i},
  {key:'milk',label:'milk',pattern:/\b(?:milk|almond milk|soy milk|oat milk)\b/i},
  {key:'cheese',label:'cheese',pattern:/\b(?:cheese|cheddar|mozzarella)\b/i},
  {key:'salsa',label:'salsa',pattern:/\bsalsa\b/i},
  {key:'olive_oil',label:'olive oil',pattern:/\b(?:olive oil|cooking oil|vegetable oil)\b/i},
  {key:'salt',label:'salt',pattern:/\bsalt\b/i},
  {key:'black_pepper',label:'black pepper',pattern:/\b(?:black pepper|ground pepper)\b/i},
  {key:'garlic',label:'garlic',pattern:/\bgarlic\b/i},
  {key:'lemon',label:'lemon',pattern:/\blemons?\b/i},
];
const byKey = new Map(DICTIONARY.map(x => [x.key, x]));
const PROTEINS = ['chicken','turkey','salmon','tuna','beef','pork','tofu','eggs','chickpeas','lentils','beans','yogurt'];
const VEGETABLES = ['broccoli','spinach','tomato','lettuce','onion','pepper','mushrooms','carrots','zucchini','cucumber','asparagus','avocado'];
const STARCHES = ['rice','quinoa','pasta','potato','tortilla','bread'];
const FOODS = [...PROTEINS,...VEGETABLES,...STARCHES,'oats','banana','berries','apple','milk','cheese','salsa'];
const BANNED_VEGAN = new Set(['chicken','turkey','salmon','tuna','beef','pork','eggs','yogurt','milk','cheese']);
const BANNED_VEGETARIAN = new Set(['chicken','turkey','salmon','tuna','beef','pork']);
const BANNED_DAIRY = new Set(['yogurt','milk','cheese']);
const titleCase = (s:string) => s.charAt(0).toUpperCase() + s.slice(1);
function pantryKeys(input:string) {
  const keys = new Set<string>();
  // Restrict matching to the actual pantry field, not the user's free-form question.
  const entries = input.split(/[,;\n]+|\s+\+\s+|\s+and\s+/i).map(x=>x.trim()).filter(Boolean);
  for (const item of entries) {
    // "Chicken stock" is not a substitute for actual chicken.
    if (/^chicken\s+(?:broth|stock)\b/i.test(item)) continue;
    // "Peanut butter" should not match a dairy item, etc.
    for (const candidate of DICTIONARY) if (candidate.pattern.test(item)) keys.add(candidate.key);
  }
  return keys;
}
type Recipe = {name:string; use:string[]; directions:string; score:number};
export function buildIngredientLockedIdeas(ingredients:string,dietary:string,meal:string,calories:number,protein:number,avoid:string="") {
  const raw=pantryKeys(ingredients);
  const disallowed = dietary==='Vegan'?BANNED_VEGAN:dietary==='Vegetarian'?BANNED_VEGETARIAN:dietary==='Dairy-free'?BANNED_DAIRY:new Set<string>();
  const exclusions=pantryKeys(avoid);
  for(const key of exclusions)disallowed.add(key);
  const have = new Set([...raw].filter(x=>!disallowed.has(x)));
  const label=(key:string)=>byKey.get(key)?.label || key;
  const pick=(options:string[])=>options.find(x=>have.has(x));
  const all:Recipe[]=[];
  const add=(name:string,use:string[],directions:string,score=0)=>{
    if(use.every(x=>have.has(x)) && !all.some(x=>x.name===name)) all.push({name,use,directions,score});
  };
  const prepared=(p:string)=> {
    if(p==='chicken' || p==='turkey') return `Cook ${label(p)} fully (165°F/74°C in the thickest part).`;
    if(p==='salmon' || p==='tuna') return `Cook ${label(p)} thoroughly (fish to 145°F/63°C when applicable).`;
    if(p==='eggs') return 'Scramble the eggs in a nonstick pan until fully set.';
    if(p==='beans'||p==='chickpeas'||p==='lentils') return `Heat the cooked ${label(p)} until steaming. If dried, cook them safely according to the package first.`;
    if(p==='yogurt') return 'Spoon the yogurt into a bowl.';
    return `Cook the ${label(p)} thoroughly in a nonstick pan.`;
  };
  const grainPrep=(s:string)=> ['rice','quinoa','pasta'].includes(s) ? `Prepare the ${label(s)} according to its package directions using water.` : s==='potato' ? 'Cook the potato until soft throughout.' : '';
  const primary=pick(PROTEINS);
  const vegetables=VEGETABLES.filter(x=>have.has(x));
  const starches=STARCHES.filter(x=>have.has(x));
  if(primary){
    const p=primary; const v=vegetables[0]; const s=starches[0];
    if(s && v && s!=='bread' && s!=='tortilla') add(`${titleCase(label(p))}, ${label(s)} & ${label(v)} bowl`,[p,s,v],`${grainPrep(s)} ${prepared(p)} Chop and cook the ${label(v)} as needed, then combine everything in a bowl.`,9);
    if(s && s!=='bread' && s!=='tortilla') add(`${titleCase(label(p))} & ${label(s)} bowl`,[p,s],`${grainPrep(s)} ${prepared(p)} Slice or portion the ${label(p)} and serve it over the ${label(s)}.`,7);
    if(v) add(`${titleCase(label(p))} & ${label(v)} skillet`,[p,v],`${prepared(p)} Add the ${label(v)} to the pan and cook until tender. Serve together.`,8);
    if(have.has('tortilla')) add(`${titleCase(label(p))} wrap`,[p,'tortilla',...(v?[v]:[])],`${prepared(p)} Warm the tortilla, add the ${label(p)}${v?` and ${label(v)}`:''}, then roll it up.`,7);
    if(have.has('bread')) add(`${titleCase(label(p))} toast`,[p,'bread'],`${prepared(p)} Toast the bread and serve it topped with the ${label(p)}.`,6);
    if(vegetables.length>1) add(`${titleCase(label(p))} with mixed vegetables`,[p,vegetables[0],vegetables[1]],`${prepared(p)} Cook the ${label(vegetables[0])} and ${label(vegetables[1])} in the same pan, adding a splash of water if needed.`,7);
    if(p==='eggs'&&have.has('oats')) add('Savory eggs and oats',[p,'oats'],`Cook oats with water. ${prepared(p)} Serve the eggs over the oats.`,6);
    if(p==='yogurt'&&have.has('berries')) add('Berry yogurt bowl',[p,'berries'],`Spoon yogurt into a bowl and top with berries.`,10);
    if(p==='yogurt'&&have.has('banana')) add('Banana yogurt bowl',[p,'banana'],`Slice the banana and combine with yogurt.`,8);
    add(`Simple ${label(p)} plate`,[p],`${prepared(p)} Portion it for your appetite and calorie budget.`,2);
  }
  if(have.has('oats')){
    if(have.has('banana')) add('Banana oatmeal',['oats','banana'],`Prepare oats with water. Slice banana and mix in.`,8);
    if(have.has('berries')) add('Berry oatmeal',['oats','berries'],`Prepare oats with water and stir in berries.`,8);
    if(have.has('milk')) add('Creamy oatmeal',['oats','milk'],`Simmer oats in milk until tender.`,6);
    add('Warm oats',['oats'],`Prepare oats with water according to the package.`,2);
  }
  if(!primary && vegetables.length){
    if(starches.length) add(`${titleCase(label(starches[0]))} & vegetables`,[starches[0],vegetables[0]],`${grainPrep(starches[0])} Prepare ${label(vegetables[0])} and combine.`,6);
    add('Simple vegetable sauté',vegetables.slice(0,Math.min(3,vegetables.length)),`Slice ${vegetables.slice(0,3).map(label).join(', ')}. Cook in a nonstick pan with a splash of water until tender.`,3);
  }
  const fruits=['banana','berries','apple'].filter(x=>have.has(x));
  if(!primary && fruits.length) add('Fresh fruit bowl',fruits,`Wash as needed, cut up ${fruits.map(label).join(', ')} and combine in a bowl.`,2);
  // Prioritize substantial meals over snack-like options, and favor breakfast foods when appropriate.
  all.sort((a,b)=>{
    const breakfast=(meal==='Breakfast');
    const bonus=(r:Recipe)=>breakfast && /oat|egg|yogurt|fruit/i.test(r.name)?4:0;
    return (b.score+bonus(b)+b.use.length*0.15)-(a.score+bonus(a)+a.use.length*0.15);
  });
  const selected=all.slice(0,3);
  if(!selected.length){
    const dietNote=raw.size&&!have.size?' Your dietary preference excludes the foods I recognized.':'';
    return `I can't recommend a reliable recipe from only those listed ingredients.${dietNote} Try entering the individual foods you have (for example: chicken, rice, broccoli). I won't invent missing main ingredients.`;
  }
  const header=`**Using only your listed ingredients** (${meal.toLowerCase()}). Every required food in the recipes below comes from your pantry list.${avoid.trim()?' Excluded listed foods are not used.':''}`;
  const ideas=selected.map((r,i)=>`${i+1}. **${r.name}**\nIngredients: ${r.use.map(label).join(', ')}\nHow: ${r.directions}`).join('\n\n');
  const budget=`\n\nYour diary shows about ${Math.max(0,Math.round(calories))} kcal and ${Math.max(0,Math.round(protein))} g protein remaining today. Portions and nutrition depend on the actual amounts you use; I haven't invented macro numbers. Use the recipe builder with measured foods for calculated nutrition.`;
  return `${header}\n\n${ideas}${budget}\n\nWater for cooking is assumed; no oil, spices, condiments, or other groceries are required.`;
}
export function genericMealIdeas(meal:string,dietary:string){
  const options=[
    {name:'Chicken and rice bowl',contains:['chicken','rice','spinach'],diet:'regular'},
    {name:'Tofu and broccoli bowl',contains:['tofu','broccoli','rice'],diet:'vegan'},
    {name:'Egg and spinach wrap',contains:['eggs','spinach','tortilla'],diet:'vegetarian'},
    {name:'Chickpea and cucumber salad',contains:['chickpeas','cucumber','tomato'],diet:'vegan'},
    {name:'Salmon and potato plate',contains:['salmon','potato','asparagus'],diet:'regular'},
    {name:'Banana oatmeal',contains:['oats','banana'],diet:'vegan'},
  ].filter(x=>!(dietary==='Vegan'&&x.diet!=='vegan')&&!(dietary==='Vegetarian'&&x.diet==='regular')&&!(dietary==='Dairy-free'&&x.name.toLowerCase().includes('yogurt')));
  return `**General ${meal.toLowerCase()} ideas (no pantry list given)**\n\n${options.slice(0,3).map((x,i)=>`${i+1}. **${x.name}**\nYou'd need: ${x.contains.map(key=>byKey.get(key)?.label||key).join(', ')}`).join('\n\n')}\n\nEnter your actual ingredients to get strictly ingredient-matched recipes, with simple cooking instructions. Nutrition is not estimated without measured portions.`;
}
export function parsedKnownIngredients(input:string){return [...pantryKeys(input)].filter(x=>FOODS.includes(x))}
