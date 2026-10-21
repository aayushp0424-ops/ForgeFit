import { NextRequest, NextResponse } from 'next/server';
import { CatalogFood, fromOpenFoodFacts, fromUSDA, STARTER_FOODS } from '../../../lib/foods';

export const runtime = 'nodejs';
const CACHE = new Map<string, { until: number; data: object }>();
const HEADERS = { 'User-Agent': process.env.OPEN_FOOD_FACTS_USER_AGENT || 'ForgeFit/0.4 (local-prototype; configure contact before public deployment)', 'Accept': 'application/json' };
async function jsonFrom(url: string, timeout = 7500) {
  const response = await fetch(url, {headers:HEADERS, cache:'no-store',signal:AbortSignal.timeout(timeout)});
  if (!response.ok) throw new Error(`Provider error ${response.status}`);
  return response.json() as Promise<Record<string,unknown>>;
}
export async function GET(req:NextRequest) {
  const barcode = (req.nextUrl.searchParams.get('barcode') || '').trim();
  const q = (req.nextUrl.searchParams.get('q') || '').trim().slice(0,90);
  if (barcode && !/^\d{8,14}$/.test(barcode)) return NextResponse.json({error:'Barcode must contain 8–14 digits.'},{status:400});
  if (!barcode && q.length < 2) return NextResponse.json({error:'Enter at least two characters.'},{status:400});
  const key = barcode ? `barcode:${barcode}` : `search:${q.toLowerCase()}`;
  const cached = CACHE.get(key);
  if (cached && cached.until > Date.now()) return NextResponse.json(cached.data);
  const list: CatalogFood[] = [];
  const notices: string[] = [];
  const fields = 'code,product_name,product_name_en,brands,nutriments,serving_quantity,serving_size';
  if (barcode) {
    try {
      const data = await jsonFrom(`https://world.openfoodfacts.org/api/v2/product/${barcode}.json?fields=${fields}`);
      const rawProduct = data.product;
      const food = rawProduct && typeof rawProduct === 'object' && !Array.isArray(rawProduct)
        ? fromOpenFoodFacts(rawProduct as Record<string,unknown>)
        : null;
      if (food) list.push(food);
      else notices.push('No complete nutrition label found for this barcode in Open Food Facts.');
    } catch {notices.push('Open Food Facts barcode lookup is temporarily unavailable.');}
  } else {
    try {
      // v1 full-text search; v2 currently does not support search_terms.
      const url = `https://world.openfoodfacts.org/cgi/search.pl?search_simple=1&action=process&json=1&search_terms=${encodeURIComponent(q)}&page_size=15&fields=${fields}`;
      const data = await jsonFrom(url);
      for (const raw of (Array.isArray(data.products) ? data.products : []) as Record<string,unknown>[]) {
        const food = fromOpenFoodFacts(raw); if (food) list.push(food);
      }
    } catch { notices.push('Open Food Facts food search is unavailable right now.'); }
  }
  const usdaKey = process.env.USDA_API_KEY || 'DEMO_KEY';
  // USDA's DEMO_KEY is heavily rate-limited; your own key is recommended.
  if (list.length < (barcode ? 1 : 7)) {
    try {
      const query = barcode || q;
      const url = `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${encodeURIComponent(usdaKey)}&query=${encodeURIComponent(query)}&pageSize=15`;
      const data = await jsonFrom(url);
      const foods = Array.isArray(data.foods) ? data.foods : [];
      for (const raw of foods as Record<string,unknown>[]) {
        if (barcode && String(raw.gtinUpc || '').replace(/^0+/, '') !== barcode.replace(/^0+/, '')) continue;
        const food = fromUSDA(raw); if (food) list.push(food);
      }
    } catch { notices.push('USDA lookup is unavailable or rate-limited.'); }
  }
  const unique = Array.from(new Map(list.map(f=>[f.barcode ? `bc:${f.barcode}` : f.id,f])).values()).slice(0,24);
  // Sample catalog works offline when provider services are unavailable.
  const sample = barcode ? [] : STARTER_FOODS.filter(f=>f.name.toLowerCase().includes(q.toLowerCase()));
  const foods = [...unique, ...sample.filter(f=>!unique.some(x=>x.name.toLowerCase()===f.name.toLowerCase()))].slice(0,25);
  const result = {foods, notices, found:foods.length>0};
  if (CACHE.size > 150) CACHE.clear();
  CACHE.set(key,{until:Date.now()+(barcode ? 60*60*1000 : 5*60*1000),data:result});
  return NextResponse.json(result,{headers:{'Cache-Control':'private, max-age=60'}});
}
