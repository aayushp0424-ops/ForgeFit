// Macro values are per 100g. Micronutrients are OPTIONAL: missing ≠ zero.
export const NUTRIENTS = {
  fiber: { label: 'Fiber', unit: 'g' },
  sugar: { label: 'Total sugars', unit: 'g' },
  sodium: { label: 'Sodium', unit: 'mg' },
  calcium: { label: 'Calcium', unit: 'mg' },
  iron: { label: 'Iron', unit: 'mg' },
  potassium: { label: 'Potassium', unit: 'mg' },
  vitaminC: { label: 'Vitamin C', unit: 'mg' },
  vitaminD: { label: 'Vitamin D', unit: 'mcg' },
} as const;
export type NutrientKey = keyof typeof NUTRIENTS;
export type Nutrients = Partial<Record<NutrientKey, number>>;
export const nutrientKeys = Object.keys(NUTRIENTS) as NutrientKey[];
export function scaledNutrients(source: Nutrients | undefined, factor: number): Nutrients | undefined {
  if (!source) return undefined;
  const result: Nutrients = {};
  for (const key of nutrientKeys) if (source[key] != null && Number.isFinite(source[key])) result[key] = Math.round(source[key]! * factor * 100) / 100;
  return Object.keys(result).length ? result : undefined;
}
export function sumNutrients(values: Array<Nutrients | undefined>): Nutrients {
  const result: Nutrients = {};
  for (const value of values) if (value) for (const key of nutrientKeys) if (value[key] != null && Number.isFinite(value[key])) result[key] = (result[key] ?? 0) + value[key]!;
  return result;
}

export type CatalogFood = {
  id: string; name: string; brand?: string; barcode?: string; source: 'Open Food Facts' | 'USDA' | 'Starter' | 'Custom';
  kcal100: number; protein100: number; carbs100: number; fat100: number; nutrients100?: Nutrients;
  servingGrams?: number; servingLabel?: string; cupGrams?: number; pieceGrams?: number; tbspGrams?: number; mlGrams?: number;
};
const clean = (value: unknown): number | null => {
  if (value === '' || value == null) return null;
  const v = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(v) && v >= 0 && v <= 100000 ? v : null;
};
const factor = (v: number, g: number) => Math.round(v * g / 100 * 10) / 10;
const base: Array<[string, string, number, number, number, number, number, string, number?, number?, number?]> = [
  ['egg','Large egg',144,12.6,0.8,9.6,50,'1 large egg',undefined,50],
  ['banana','Banana',89,1.1,22.9,.3,118,'1 medium banana',undefined,118],
  ['oats','Rolled oats, dry',375,12.5,67.5,7.5,40,'½ cup dry',80,undefined,5],
  ['chicken','Chicken breast, cooked',165,31,0,3.6,100,'100 g'],
  ['rice','White rice, cooked',130,2.7,28.5,.3,158,'1 cup cooked',158],
  ['yogurt','Plain Greek yogurt, nonfat',59,10,3.5,0,170,'170 g container',245],
  ['bread','Whole wheat bread',286,14.3,50,3.9,28,'1 slice',undefined,28],
  ['pb','Peanut butter',594,21.9,21.9,50,32,'2 tbsp',undefined,undefined,16],
  ['milk','2% milk',51,3.3,5,2,240,'1 cup',240,undefined,15],
  ['salmon','Salmon, cooked',206,22,0,12,100,'100 g'],
  ['apple','Apple, raw',52,.3,14,.2,182,'1 medium apple',undefined,182],
  ['broccoli','Broccoli, cooked',35,2.4,7.2,.4,156,'1 cup',156],
];
export const STARTER_FOODS: CatalogFood[] = base.map(([id,name,kcal,protein,carbs,fat,serving,servingLabel,cup,piece,tbsp]) => ({id:`starter:${id}`,name,source:'Starter',kcal100:kcal,protein100:protein,carbs100:carbs,fat100:fat,servingGrams:serving,servingLabel,cupGrams:cup,pieceGrams:piece,tbspGrams:tbsp,mlGrams:id==='milk'?1.03:undefined}));

// Open Food Facts data can be missing or incorrect. Missing macros aren't treated as zeros.
export function fromOpenFoodFacts(product: Record<string, unknown>): CatalogFood | null {
  const nut = (product.nutriments ?? {}) as Record<string, unknown>;
  const kcal = clean(nut['energy-kcal_100g']) ?? (clean(nut['energy-kj_100g']) != null ? (clean(nut['energy-kj_100g']) as number) / 4.184 : null);
  const protein = clean(nut.proteins_100g), carbs = clean(nut.carbohydrates_100g), fat = clean(nut.fat_100g);
  const name = String(product.product_name_en || product.product_name || '').trim();
  const barcode = String(product.code || '').trim();
  if (!name || kcal == null || protein == null || carbs == null || fat == null) return null;
  const serving = clean(product.serving_quantity);
  const label = String(product.serving_size || '').trim().slice(0,80);
  const servingGrams = serving && serving <= 2000 ? serving : undefined;
  // OFF reports nutrition values in grams per 100g, including mineral/vitamin values.
  // Convert minerals to milligrams and vitamin D to micrograms.
  const nutrients100: Nutrients = {};
  const fields: Array<[NutrientKey,string,number]> = [
    ['fiber','fiber_100g',1], ['sugar','sugars_100g',1], ['sodium','sodium_100g',1000],
    ['calcium','calcium_100g',1000], ['iron','iron_100g',1000], ['potassium','potassium_100g',1000],
    ['vitaminC','vitamin-c_100g',1000], ['vitaminD','vitamin-d_100g',1000000],
  ];
  for (const [key,field,multiplier] of fields) { const val=clean(nut[field]); if(val!=null) nutrients100[key]=Math.round(val*multiplier*100)/100; }
  return {id:`off:${barcode || name}`,name:name.slice(0,140),brand:String(product.brands || '').slice(0,75), barcode:barcode || undefined,
    source:'Open Food Facts',kcal100:kcal,protein100:protein,carbs100:carbs,fat100:fat,nutrients100,servingGrams,
    servingLabel:servingGrams ? (label || `${servingGrams} g serving`) : undefined};
}

// USDA FoodData Central's foodNutrients entries are normally reported per 100 g.
export function fromUSDA(food: Record<string, unknown>): CatalogFood | null {
  const nutrients = (Array.isArray(food.foodNutrients) ? food.foodNutrients : []) as Record<string, unknown>[];
  const nutrient = (ids: number[], numbers: string[]) => {
    const found = nutrients.find(n => ids.includes(Number(n.nutrientId ?? ((n.nutrient as Record<string,unknown>)?.id))) || numbers.includes(String(n.nutrientNumber ?? ((n.nutrient as Record<string,unknown>)?.number) ?? '')));
    return found ? clean(found.value ?? found.amount) : null;
  };
  const kcal = nutrient([1008,2047,2048],['208','957','958']);
  const protein = nutrient([1003],['203']);
  const carbs = nutrient([1005],['205']);
  const fat = nutrient([1004],['204']);
  const name = String(food.description || '').trim();
  if (!name || kcal == null || protein == null || carbs == null || fat == null) return null;
  const nutrients100: Nutrients = {};
  const nutrientTypes: Array<[NutrientKey,number[],string[]]> = [
    ['fiber',[1079],['291']], ['sugar',[2000],['269']], ['sodium',[1093],['307']],
    ['calcium',[1087],['301']], ['iron',[1089],['303']], ['potassium',[1092],['306']],
    ['vitaminC',[1162],['401']], ['vitaminD',[1114],['328']],
  ];
  for (const [key,ids,numbers] of nutrientTypes) { const val=nutrient(ids,numbers); if(val!=null) nutrients100[key]=val; }
  const servingSize = clean(food.servingSize);
  const unit = String(food.servingSizeUnit || '').toLowerCase();
  const servingGrams = unit === 'g' && servingSize && servingSize <= 2000 ? servingSize : undefined;
  const barcode = String(food.gtinUpc || '').trim();
  return {id:`usda:${String(food.fdcId)}`,name:name.slice(0,140),brand:String(food.brandOwner || food.brandName || '').slice(0,75),
    source:'USDA',barcode:barcode || undefined,kcal100:kcal,protein100:protein,carbs100:carbs,fat100:fat,nutrients100,
    servingGrams,servingLabel:servingGrams ? `${servingGrams} g serving` : undefined};
}
export function amountsFor(food: CatalogFood, grams: number) {
  return {calories:factor(food.kcal100,grams),protein:factor(food.protein100,grams),carbs:factor(food.carbs100,grams),fat:factor(food.fat100,grams),nutrients:scaledNutrients(food.nutrients100,grams/100)};
}
export function foodUnits(food: CatalogFood) {
  const units = [{id:'g',name:'grams (g)',grams:1},{id:'oz',name:'ounces (oz)',grams:28.349523125},{id:'100g',name:'100 grams',grams:100}];
  if (food.servingGrams) units.unshift({id:'serving',name:food.servingLabel || 'Label serving',grams:food.servingGrams});
  if (food.cupGrams) units.push({id:'cup',name:'cup',grams:food.cupGrams});
  if (food.mlGrams) { units.push({id:'ml',name:'milliliters (mL)',grams:food.mlGrams}); units.push({id:'floz',name:'fluid ounce (fl oz)',grams:food.mlGrams*29.5735}); }
  if (food.pieceGrams) units.push({id:'piece',name:'piece / slice',grams:food.pieceGrams});
  if (food.tbspGrams) { units.push({id:'tbsp',name:'tablespoon (tbsp)',grams:food.tbspGrams}); units.push({id:'tsp',name:'teaspoon (tsp)',grams:food.tbspGrams/3}); }
  return units;
}
