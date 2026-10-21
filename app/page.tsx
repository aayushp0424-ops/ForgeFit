"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Activity, ArrowUpRight, CalendarDays, Check, Camera, Sparkles,
  ChevronLeft, ChevronRight, CircleHelp, Dumbbell, Flame, Home,
  Info, Leaf, Plus, Scale, Search, Settings, ShieldCheck,
  Target, Trash2, TrendingUp, UtensilsCrossed, X, Droplets, Footprints, Heart, BookOpen, Copy, Upload, BarChart3, HeartPulse, Smartphone, RefreshCw,
  type LucideIcon,
} from "lucide-react";
import BarcodeScanner from "./components/BarcodeScanner";
import { Brand, Pill, Ring, MetricBar, Empty, SectionHeader, ActionButton, n } from "./components/ui";
import { isHealthBridgeAvailable, requestAppleHealthAccess, fetchAppleHealthSteps } from "../lib/healthBridge";
import { STARTER_FOODS, NUTRIENTS, nutrientKeys, foodUnits, amountsFor, scaledNutrients, sumNutrients, type Nutrients, type CatalogFood } from "../lib/foods";

type Screen = "home" | "food" | "train" | "activity" | "coach" | "progress" | "settings";
type Meal = "Breakfast" | "Lunch" | "Dinner" | "Snacks";
type FoodItem = { id: string; name: string; detail: string; calories: number; protein: number; carbs: number; fat: number; nutrients?: Nutrients };
type FoodLog = FoodItem & { logId: string; meal: Meal; date: string; servings: number; loggedAt: number; portionLabel?: string; source?: string };
type WorkoutLog = { id: string; exercise: string; sets: number; reps: number; weight: number; date: string; loggedAt: number };
type WeightLog = { id: string; weight: number; date: string; loggedAt: number };
type Goals = { calories: number; protein: number; carbs: number; fat: number };
type WaterLog = { id: string; date: string; amountOz: number; loggedAt: number };
type ActivityPrefs = { waterOz: number; stepGoal: number; bodyWeightLb: number; creditStepCalories: boolean };
type RecipeIngredient = FoodItem & { grams: number };
type SavedRecipe = { id: string; name: string; yieldServings: number; ingredients: RecipeIngredient[]; createdAt: number };
type Store = { foods: FoodLog[]; workouts: WorkoutLog[]; weights: WeightLog[]; water: WaterLog[]; steps: Record<string, number>; stepSources: Record<string, "manual" | "csv" | "healthkit">; goals: Goals; activityPrefs: ActivityPrefs; healthSync: { enabled: boolean; lastSync?: string }; favoriteIds: string[]; favoriteSnapshots: FoodLog[]; recipes: SavedRecipe[] };

const DEFAULT_GOALS: Goals = { calories: 2300, protein: 160, carbs: 250, fat: 75 };
const DEFAULT_ACTIVITY_PREFS: ActivityPrefs = { waterOz: 80, stepGoal: 8000, bodyWeightLb: 0, creditStepCalories: true };
const INITIAL_STORE: Store = { foods: [], workouts: [], weights: [], water: [], steps: {}, stepSources: {}, goals: DEFAULT_GOALS, activityPrefs: DEFAULT_ACTIVITY_PREFS, healthSync: { enabled: false }, favoriteIds: [], favoriteSnapshots: [], recipes: [] };
const MEALS: Meal[] = ["Breakfast", "Lunch", "Dinner", "Snacks"];

const NAV: { id: Screen; label: string; icon: LucideIcon }[] = [
  { id: "home", label: "Home", icon: Home },
  { id: "food", label: "Food", icon: UtensilsCrossed },
  { id: "train", label: "Train", icon: Dumbbell },
  { id: "activity", label: "Activity", icon: Footprints },
  { id: "coach", label: "Coach", icon: Sparkles },
  { id: "progress", label: "Progress", icon: TrendingUp },
  { id: "settings", label: "Settings", icon: Settings },
];
const LABELS: Record<Screen, string> = {
  home: "Overview", food: "Food diary", train: "Workout tracker", activity: "Daily activity", coach: "Meal coach", progress: "Your progress", settings: "Settings",
};
const finite = (x: number, fallback = 0) => Number.isFinite(x) ? Math.max(0, x) : fallback;
const waterMl = (ounces: number) => Math.round(ounces * 29.5735);
// Estimate extra calories ABOVE resting metabolism from walking, assuming moderate pace.
// Rough baseline: 280 active kcal / 10,000 steps for a 154 lb (70 kg) walker.
// Body weight scales the estimate; pace, terrain, and stride are not measured.
const walkingActiveCalories = (steps: number, weightLb: number) =>
  weightLb > 0 ? Math.round(steps * 0.028 * (weightLb / 154)) : 0;
function dateKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
const uid = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
function sumFoods(logs: FoodLog[]) {
  return logs.reduce((s, f) => ({
    calories: s.calories + f.calories * f.servings,
    protein: s.protein + f.protein * f.servings,
    carbs: s.carbs + f.carbs * f.servings,
    fat: s.fat + f.fat * f.servings,
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 });
}
function loadStore(): Store {
  try {
    const raw = window.localStorage.getItem("forgefit:v1");
    if (!raw) return INITIAL_STORE;
    const obj: Partial<Store> = JSON.parse(raw);
    return {
      foods: Array.isArray(obj.foods) ? obj.foods : [],
      workouts: Array.isArray(obj.workouts) ? obj.workouts : [],
      weights: Array.isArray(obj.weights) ? obj.weights : [],
      water: Array.isArray(obj.water) ? obj.water : [],
      steps: obj.steps && typeof obj.steps === "object" && !Array.isArray(obj.steps) ? obj.steps : {},
      stepSources: obj.stepSources && typeof obj.stepSources === "object" && !Array.isArray(obj.stepSources) ? obj.stepSources : {},
      favoriteIds: Array.isArray(obj.favoriteIds) ? obj.favoriteIds.filter((v): v is string => typeof v === "string") : [],
      favoriteSnapshots: Array.isArray(obj.favoriteSnapshots) ? obj.favoriteSnapshots.filter((f): f is FoodLog => !!f && typeof f.name==='string' && typeof f.id==='string') : [],
      recipes: Array.isArray(obj.recipes) ? obj.recipes.filter((r): r is SavedRecipe => Boolean(r && typeof r.name === "string" && Array.isArray(r.ingredients) && r.yieldServings > 0)) : [],
      goals: { ...DEFAULT_GOALS, ...obj.goals },
      activityPrefs: { ...DEFAULT_ACTIVITY_PREFS, ...obj.activityPrefs },
      healthSync: { enabled: obj.healthSync?.enabled === true, lastSync: typeof obj.healthSync?.lastSync === "string" ? obj.healthSync.lastSync : undefined },
    };
  } catch { return INITIAL_STORE; }
}

export default function ForgeFit() {
  const [screen, setScreen] = useState<Screen>("home");
  const [data, setData] = useState<Store>(INITIAL_STORE);
  const [hydrated, setHydrated] = useState(false);
  const [search, setSearch] = useState("");
  const [meal, setMeal] = useState<Meal>("Breakfast");
  const [diaryDate,setDiaryDate] = useState(dateKey());
  const [catalogResults,setCatalogResults] = useState<CatalogFood[]>(STARTER_FOODS);
  const [searchHasRun,setSearchHasRun] = useState(false);
  const [foodLoading,setFoodLoading] = useState(false);
  const [catalogNotice,setCatalogNotice] = useState('Search Open Food Facts + USDA, or choose from starter foods.');
  const [scannerOpen,setScannerOpen] = useState(false);
  const [selectedFood,setSelectedFood] = useState<CatalogFood|null>(null);
  const [foodQuantity,setFoodQuantity] = useState('1');
  const [foodUnit,setFoodUnit] = useState('serving');
  const [coachQuestion,setCoachQuestion] = useState('What should I make for dinner that fits my macros?');
  const [coachIngredients,setCoachIngredients] = useState('');
  const [coachMeal,setCoachMeal] = useState<Meal>('Dinner');
  const [coachDiet,setCoachDiet] = useState('None');
  const [coachAvoid,setCoachAvoid] = useState('');
  const [recipeOpen,setRecipeOpen] = useState(false);
  const [recipeName,setRecipeName] = useState('');
  const [recipeYield,setRecipeYield] = useState('2');
  const [recipeDraft,setRecipeDraft] = useState<RecipeIngredient[]>([]);
  const [portionDestination,setPortionDestination] = useState<'diary'|'recipe'>('diary');
  const [quickList,setQuickList] = useState<'recent'|'favorites'>('recent');
  const [progressRange,setProgressRange] = useState<7|30|90>(30);
  const [coachLoading,setCoachLoading] = useState(false);
  const [coachAnswer,setCoachAnswer] = useState('');
  const [coachMode,setCoachMode] = useState<'ai'|'smart'|''>('');
  const [coachNotice,setCoachNotice] = useState('');

  const [showCustom, setShowCustom] = useState(false);
  const [custom, setCustom] = useState({ name: "", calories: "", protein: "", carbs: "", fat: "", fiber: "", sugar: "", sodium: "" });
  const [workout, setWorkout] = useState({ exercise: "", sets: "3", reps: "10", weight: "0" });
  const [weightInput, setWeightInput] = useState("");
  const [goalsInput, setGoalsInput] = useState(DEFAULT_GOALS);
  const [activityInput, setActivityInput] = useState(DEFAULT_ACTIVITY_PREFS);
  const [waterInput, setWaterInput] = useState("16.9");
  const [stepsInput, setStepsInput] = useState("");
  const [healthAvailable, setHealthAvailable] = useState(false);
  const [healthBusy, setHealthBusy] = useState(false);
  const [healthNotice, setHealthNotice] = useState("");
  const [toast, setToast] = useState("");
  const today = dateKey();

  useEffect(() => {
    const saved = loadStore();
    setData(saved);
    setGoalsInput(saved.goals);
    setActivityInput(saved.activityPrefs);
    setHealthAvailable(isHealthBridgeAvailable());
    const resolveHash = () => {
      const fragment = window.location.hash.slice(1);
      setScreen(NAV.some((item) => item.id === fragment) ? fragment as Screen : "home");
    };
    resolveHash();
    window.addEventListener("popstate", resolveHash);
    window.addEventListener("hashchange", resolveHash);
    setHydrated(true);
    return () => { window.removeEventListener("popstate", resolveHash); window.removeEventListener("hashchange", resolveHash); };
  }, []);
  useEffect(() => {
    if (!hydrated) return;
    try { window.localStorage.setItem("forgefit:v1", JSON.stringify(data)); } catch { /* browser storage disabled/full */ }
  }, [data, hydrated]);
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(""), 2900);
    return () => window.clearTimeout(t);
  }, [toast]);

  const todayFoods = useMemo(() => data.foods.filter((food) => food.date === today), [data.foods, today]);
  const diaryFoods = useMemo(()=> data.foods.filter(food=>food.date===diaryDate),[data.foods,diaryDate]);
  const diaryTotals = useMemo(()=>sumFoods(diaryFoods),[diaryFoods]);
  const totals = useMemo(() => sumFoods(todayFoods), [todayFoods]);
  const todayWorkouts = data.workouts.filter(w => w.date === today);
  const todaySteps = finite(Number(data.steps[today] ?? 0));
  const todayWaterLogs = data.water.filter(item => item.date === today);
  const todayWaterOz = todayWaterLogs.reduce((sum, item) => sum + finite(item.amountOz), 0);
  const latestWeight = data.weights.length ? [...data.weights].sort((a, b) => b.loggedAt - a.loggedAt)[0] : null;
  const estimateWeightLb = data.activityPrefs.bodyWeightLb || latestWeight?.weight || 0;
  const canEstimateSteps = estimateWeightLb > 0;
  const stepCalories = walkingActiveCalories(todaySteps, estimateWeightLb);
  const creditedStepCalories = data.activityPrefs.creditStepCalories ? stepCalories : 0;
  const netCalories = totals.calories - creditedStepCalories;
  const remaining = data.goals.calories - netCalories;
  const filteredFoods = searchHasRun ? catalogResults : STARTER_FOODS.filter(f => `${f.name} ${f.brand || ''}`.toLowerCase().includes(search.toLowerCase()));
  const selectedUnits = selectedFood ? foodUnits(selectedFood):[];
  const selectedGramFactor = selectedUnits.find(u=>u.id===foodUnit)?.grams || 1;
  const foodGrams = Math.max(0, Number(foodQuantity)||0)*selectedGramFactor;
  const previewMacros = selectedFood ? amountsFor(selectedFood,foodGrams):null;
  const go = (next: Screen) => {
    if (next !== screen) {
      window.history.pushState(null, "", next === "home" ? window.location.pathname : `#${next}`);
      setScreen(next);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };
  const addFood = (food: FoodItem) => {
    const log: FoodLog = { ...food, logId: uid(), date: diaryDate, meal, servings: 1, loggedAt: Date.now() };
    setData(d => ({ ...d, foods: [...d.foods, log] }));
    setToast(`${food.name} added to ${meal.toLowerCase()}`);
  };
  const selectCatalogFood = (food:CatalogFood, destination:'diary'|'recipe'='diary') => {
    setPortionDestination(destination);
    setSelectedFood(food);
    setFoodUnit(food.servingGrams ? 'serving':'g');
    setFoodQuantity(food.servingGrams ? '1':'100');
  };
  const logSelectedFood = (e:FormEvent) => {
    e.preventDefault();
    if(!selectedFood || !Number.isFinite(foodGrams) || foodGrams<=0 || foodGrams>10000) {setToast('Choose a portion between 0 and 10,000 g.');return;}
    const macros = amountsFor(selectedFood, foodGrams);
    const unitName=selectedUnits.find(u=>u.id===foodUnit)?.name || 'grams';
    const label=`${foodQuantity} ${unitName} (${n(foodGrams,1)} g)`;
    if (portionDestination === 'recipe') {
      setRecipeDraft(d=>[...d,{id:selectedFood.id,name:selectedFood.name,detail:label,grams:foodGrams,...macros}]);
      setToast(`${selectedFood.name} added to recipe`);
    } else {
      setData(d=>({...d,foods:[...d.foods,{id:selectedFood.id,name:selectedFood.name,detail:label,...macros,
        meal,date:diaryDate,servings:1,logId:uid(),loggedAt:Date.now(),portionLabel:label,source:selectedFood.source}]}));
      setToast(`${selectedFood.name} added to ${meal} on ${diaryDate}`);
    }
    setSelectedFood(null);
  };
  const searchCatalog = async (e?:FormEvent) => {
    e?.preventDefault();
    if(search.trim().length < 2) {setSearchHasRun(false);setCatalogResults(STARTER_FOODS);setCatalogNotice('Type at least 2 characters to search live sources.');return;}
    setSearchHasRun(true);setFoodLoading(true);setCatalogNotice('Searching food databases…');
    try {
      const response=await fetch(`/api/foods?q=${encodeURIComponent(search.trim())}`);
      const payload=await response.json() as {foods?:CatalogFood[];notices?:string[];error?:string};
      if(!response.ok) throw new Error(payload.error || 'Food search failed');
      setCatalogResults(payload.foods||[]);
      setCatalogNotice((payload.notices||[]).join(' ') || `${payload.foods?.length||0} results from Open Food Facts, USDA and starter catalog. Check nutrition labels.`);
    } catch {setCatalogNotice('Could not reach food databases. Showing matching starter foods.');setCatalogResults(STARTER_FOODS);}
    finally {setFoodLoading(false);}
  };
  const findBarcode = async (barcode:string) => {
    setScannerOpen(false);setScreen('food');
    setSearchHasRun(true);setFoodLoading(true);setSearch('');setCatalogNotice('Looking up barcode '+barcode+'…');
    try {
      const response=await fetch(`/api/foods?barcode=${encodeURIComponent(barcode)}`);
      const payload=await response.json() as {foods?:CatalogFood[];notices?:string[];error?:string};
      if(!response.ok) throw new Error(payload.error||'Invalid barcode');
      setCatalogResults(payload.foods || []);
      setCatalogNotice(payload.foods?.length ? `Barcode ${barcode} found. Verify product and serving details.` : `Barcode ${barcode} wasn't found with a complete label. Create a custom food or search by name.`);
      if(payload.foods?.[0]) selectCatalogFood(payload.foods[0]);
    } catch {setCatalogResults([]);setCatalogNotice('Barcode lookup failed. Check your connection or try searching by name.');}
    finally {setFoodLoading(false);}
  };
  const askCoach = async (e:FormEvent) => {
    e.preventDefault();if(!coachQuestion.trim())return;
    setCoachLoading(true);setCoachAnswer('');setCoachNotice('');
    try {
      const response=await fetch('/api/meal-coach',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({question:coachQuestion,ingredients:coachIngredients,avoid:coachAvoid,dietary:coachDiet,meal:coachMeal,
      remainingCalories:Math.max(0,remaining),remainingProtein:Math.max(0,data.goals.protein-totals.protein)})});
      const result=await response.json() as {answer?:string;mode?:'ai'|'smart';notice?:string;error?:string};
      if(!response.ok || !result.answer)throw new Error(result.error || 'Coach unavailable');
      setCoachAnswer(result.answer);setCoachMode(result.mode || 'smart');setCoachNotice(result.notice||'');
    }catch{setCoachNotice('The meal coach is temporarily unavailable. Please try again.');}
    finally{setCoachLoading(false);}
  };
  const addCustom = (e: FormEvent) => {
    e.preventDefault();
    if (!custom.name.trim()) return;
    const nutrients:Nutrients={};
    for(const key of (['fiber','sugar','sodium'] as const)) if(custom[key].trim())nutrients[key]=finite(Number(custom[key]));
    addFood({ id: uid(), name: custom.name.trim(), detail: "Custom entry · 1 serving", calories: finite(Number(custom.calories)), protein: finite(Number(custom.protein)), carbs: finite(Number(custom.carbs)), fat: finite(Number(custom.fat)),nutrients:Object.keys(nutrients).length?nutrients:undefined });
    setCustom({ name: "", calories: "", protein: "", carbs: "", fat: "", fiber: "", sugar: "", sodium: "" });
    setShowCustom(false);
  };
  const addWorkout = (e: FormEvent) => {
    e.preventDefault();
    if (!workout.exercise.trim()) return;
    const w: WorkoutLog = { id: uid(), exercise: workout.exercise.trim(), sets: Math.max(1, Math.floor(finite(Number(workout.sets), 1))), reps: Math.max(1, Math.floor(finite(Number(workout.reps), 1))), weight: finite(Number(workout.weight)), date: dateKey(), loggedAt: Date.now() };
    setData(d => ({ ...d, workouts: [w, ...d.workouts] }));
    setWorkout({ exercise: "", sets: "3", reps: "10", weight: "0" });
    setToast("Workout set added");
  };
  const addWeight = (e: FormEvent) => {
    e.preventDefault();
    const val = Number(weightInput);
    if (!Number.isFinite(val) || val <= 0) return;
    const log: WeightLog = { id: uid(), weight: val, date: dateKey(), loggedAt: Date.now() };
    setData(d => ({ ...d, weights: [log, ...d.weights] }));
    setWeightInput("");
    setToast("Weight saved");
  };
  const addWater = (amount: number) => {
    if (!Number.isFinite(amount) || amount <= 0 || amount > 128) { setToast("Enter 0.1–128 fl oz per drink"); return; }
    const item: WaterLog = { id: uid(), date: dateKey(), amountOz: Math.round(amount * 10) / 10, loggedAt: Date.now() };
    setData(d => ({ ...d, water: [...d.water, item] }));
    setToast(`${n(item.amountOz, 1)} fl oz added`);
  };
  const addCustomWater = (e: FormEvent) => {
    e.preventDefault();
    const amount = Number(waterInput);
    if (!Number.isFinite(amount) || amount <= 0) return;
    addWater(amount);
  };
  const deleteWater = (id: string) => setData(d => ({ ...d, water: d.water.filter(w => w.id !== id) }));
  // The native iOS container handles HealthKit. Safari/PWA never has this bridge.
  // Keep one step total per date so estimates and trends cannot double-count data sources.
  const syncAppleHealth = async (requestPermission: boolean) => {
    if (!isHealthBridgeAvailable()) { setHealthNotice('Apple Health requires the ForgeFit native iPhone app. Safari cannot access HealthKit.'); return; }
    if (healthBusy) return;
    setHealthBusy(true);
    setHealthNotice('');
    try {
      if (requestPermission) {
        await requestAppleHealthAccess();
        // HealthKit deliberately does not reveal whether read access was granted.
      }
      const dates = Array.from({ length: 7 }, (_, i) => {
        const day = new Date(); day.setHours(12, 0, 0, 0); day.setDate(day.getDate() - i);
        return dateKey(day);
      });
      const imported: Record<string, number> = {};
      for (const day of dates) {
        const steps = await fetchAppleHealthSteps(day);
        if (steps > 0) imported[day] = steps;
      }
      const count = Object.keys(imported).length;
      // A zero result can mean permission denied, no data, or genuinely zero steps.
      // Never overwrite an existing step count with that ambiguous zero.
      setData(d => ({
        ...d,
        steps: { ...d.steps, ...imported },
        stepSources: { ...d.stepSources, ...Object.fromEntries(Object.keys(imported).map(day => [day, 'healthkit' as const])) },
        healthSync: { enabled: true, lastSync: count > 0 ? new Date().toISOString() : d.healthSync.lastSync }
      }));
      if (imported[dateKey()] !== undefined) setStepsInput(String(imported[dateKey()]));
      setHealthNotice(count > 0
        ? `Synced ${count} days from Apple Health. Daily totals replace previous entries, never add to them.`
        : 'Apple Health returned no step data. Check access in iPhone Health settings, or try again after walking. Existing steps were kept.');
    } catch (error) {
      setHealthNotice(error instanceof Error ? error.message : 'Could not read Apple Health right now.');
    } finally { setHealthBusy(false); }
  };
  const disconnectHealth = () => {
    setData(d => ({ ...d, healthSync: { enabled: false } }));
    setHealthNotice('ForgeFit stopped syncing on this device. To revoke system-level access, use iPhone Settings → Privacy & Security → Health. Previously imported totals remain until you edit or delete them.');
  };
  const setTodaySteps = (e: FormEvent) => {
    e.preventDefault();
    const count = Number(stepsInput);
    if (!Number.isFinite(count) || !Number.isInteger(count) || count < 0 || count > 100000) { setToast("Enter 0–100,000 whole steps"); return; }
    setData(d => ({ ...d, steps: { ...d.steps, [dateKey()]: count }, stepSources: {...d.stepSources,[dateKey()]:"manual"} }));
    setStepsInput(String(count));
    setToast(`Completed steps saved: ${n(count)} (goal unchanged)`);
  };
  const setStepGoal = (e:FormEvent) => {
    e.preventDefault();
    const value=Number(activityInput.stepGoal);
    if(!Number.isInteger(value)||value<=0||value>100000){setToast('Step goal must be 1–100,000.');return;}
    setData(d=>({...d,activityPrefs:{...d.activityPrefs,stepGoal:value}}));
    setToast(`Step goal set to ${n(value)}. Completed steps unchanged.`);
  };
  const saveWalkingWeight = (e:FormEvent) => {
    e.preventDefault();
    const value=Number(activityInput.bodyWeightLb);
    if(!Number.isFinite(value)||value<=0||value>1500){setToast('Enter a valid weight in lb.');return;}
    setData(d=>({...d,activityPrefs:{...d.activityPrefs,bodyWeightLb:value}}));
    setToast('Walking estimate weight saved; Home calorie balance updated.');
  };
  const incrementSteps = (amount: number) => {
    const next = Math.min(100000, todaySteps + amount);
    setData(d => ({ ...d, steps: { ...d.steps, [dateKey()]: next }, stepSources: {...d.stepSources,[dateKey()]:"manual"} }));
    setStepsInput(String(next));
    setToast(`${n(amount)} steps added`);
  };
  const saveActivityPrefs = (e: FormEvent) => {
    e.preventDefault();
    const clean = {
      waterOz: Math.min(300, Math.max(1, finite(Number(activityInput.waterOz), 80))),
      stepGoal: Math.min(100000, Math.max(1, Math.round(finite(Number(activityInput.stepGoal), 8000)))),
      bodyWeightLb: activityInput.bodyWeightLb === 0 ? 0 : Math.min(1500, Math.max(1, finite(Number(activityInput.bodyWeightLb)))),
      creditStepCalories: Boolean(activityInput.creditStepCalories),
    };
    setData(d => ({ ...d, activityPrefs: clean }));
    setActivityInput(clean);
    setToast("Activity settings saved");
  };
  const saveGoals = (e: FormEvent) => {
    e.preventDefault();
    const clean = Object.fromEntries(Object.entries(goalsInput).map(([key, value]) => [key, Math.max(1, Math.round(finite(Number(value), 1)))])) as Goals;
    setData(d => ({ ...d, goals: clean }));
    setGoalsInput(clean);
    setToast("Daily goals updated");
  };
  // Store snapshots for one-tap re-logging; do not re-scale nutritional values.
  const quickFoods = useMemo(() => {
    const seen = new Set<string>();
    const candidates=quickList==='favorites'?[...data.favoriteSnapshots,...data.foods]:data.foods;
    return [...candidates].sort((a,b)=>b.loggedAt-a.loggedAt).filter(f=>{
      if(seen.has(f.id))return false;
      seen.add(f.id);
      return quickList==='recent' || data.favoriteIds.includes(f.id);
    }).slice(0,15);
  },[data.foods,data.favoriteIds,data.favoriteSnapshots,quickList]);
  const toggleFavorite=(id:string)=>setData(d=>{
    const already=d.favoriteIds.includes(id);
    const source=d.foods.find(f=>f.id===id)||d.favoriteSnapshots.find(f=>f.id===id);
    return {...d,favoriteIds:already?d.favoriteIds.filter(x=>x!==id):[...d.favoriteIds,id],favoriteSnapshots:already?d.favoriteSnapshots.filter(f=>f.id!==id):(source?[source,...d.favoriteSnapshots.filter(f=>f.id!==id)]:d.favoriteSnapshots)};
  });
  const logAgain=(f:FoodLog)=>{
    setData(d=>({...d,foods:[...d.foods,{...f,logId:uid(),date:diaryDate,meal,loggedAt:Date.now()}]}));
    setToast(`${f.name} added to ${meal}`);
  };
  const copyPreviousMeal=()=>{
    const date=new Date(`${diaryDate}T12:00:00`);date.setDate(date.getDate()-1);
    const previous=dateKey(date);
    const copied=data.foods.filter(f=>f.date===previous && f.meal===meal);
    if(!copied.length){setToast(`No ${meal.toLowerCase()} entries on ${previous}`);return;}
    setData(d=>({...d,foods:[...d.foods,...copied.map(f=>({...f,logId:uid(),date:diaryDate,loggedAt:Date.now()}))]}));
    setToast(`${copied.length} foods copied from ${previous}`);
  };
  const recipeNutrition=(ingredients:RecipeIngredient[])=>{
    const totals=ingredients.reduce((a,f)=>({calories:a.calories+f.calories,protein:a.protein+f.protein,carbs:a.carbs+f.carbs,fat:a.fat+f.fat}),{calories:0,protein:0,carbs:0,fat:0});
    return {...totals,nutrients:sumNutrients(ingredients.map(f=>f.nutrients))};
  };
  const saveRecipe=(e:FormEvent)=>{
    e.preventDefault();const servings=Number(recipeYield);
    if(!recipeName.trim()||recipeDraft.length===0||!Number.isInteger(servings)||servings<1||servings>100){setToast('Add ingredients, recipe name, and valid yield.');return;}
    const r:SavedRecipe={id:uid(),name:recipeName.trim().slice(0,100),yieldServings:servings,ingredients:[...recipeDraft],createdAt:Date.now()};
    setData(d=>({...d,recipes:[r,...d.recipes]}));
    setRecipeDraft([]);setRecipeName('');setRecipeYield('2');setRecipeOpen(false);setToast('Recipe saved — log it from your saved recipes');
  };
  const logSavedRecipe=(recipe:SavedRecipe)=>{
    const values=recipeNutrition(recipe.ingredients);const fraction=1/recipe.yieldServings;
    const food:FoodLog={id:`recipe:${recipe.id}`,logId:uid(),meal,date:diaryDate,loggedAt:Date.now(),source:'Recipe',name:recipe.name,detail:'Homemade recipe',portionLabel:`1 of ${recipe.yieldServings} recipe servings`,servings:1,
      calories:values.calories*fraction,protein:values.protein*fraction,carbs:values.carbs*fraction,fat:values.fat*fraction,nutrients:scaledNutrients(values.nutrients,fraction)};
    setData(d=>({...d,foods:[...d.foods,food]}));setToast(`${recipe.name} logged in ${meal}`);
  };
  const deleteRecipe=(id:string)=>{
    if(!window.confirm('Delete this saved recipe? Previously logged portions will remain.'))return;
    setData(d=>({...d,recipes:d.recipes.filter(r=>r.id!==id)}));
  };
  const importStepsCsv=async(file:File|undefined)=>{
    if(!file)return;
    if(file.size>1_000_000){setToast('Step CSV must be under 1 MB');return;}
    const rows=(await file.text()).split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
    const records:Record<string,number>={};
    for(const row of rows.slice(0,400)){
      const [date,steps]=row.split(',').map(v=>v.trim().replace(/^"|"$/g,''));
      if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||dateKey(new Date(`${date}T12:00:00`))!==date||!/^\d+$/.test(steps))continue;
      const count=Number(steps);if(count<=100000 && date<=today)records[date]=count;
    }
    const count=Object.keys(records).length;
    if(!count){setToast('CSV must contain date,steps rows (YYYY-MM-DD,integer).');return;}
    if(!window.confirm(`Import ${count} days of step totals? Matching dates will be replaced.`))return;
    setData(d=>({...d,steps:{...d.steps,...records},stepSources:{...d.stepSources,...Object.fromEntries(Object.keys(records).map(k=>[k,'csv' as const]))}}));
    setToast(`${count} daily step counts imported. This is not automatic HealthKit sync.`);
  };
  const removeFood = (logId: string) => setData(d => ({ ...d, foods: d.foods.filter(f => f.logId !== logId) }));
  const removeWorkout = (id: string) => setData(d => ({ ...d, workouts: d.workouts.filter(w => w.id !== id) }));
  const clearData = () => {
    if (!window.confirm("Delete all ForgeFit data (food, workouts, weight, water and steps) on this browser? This cannot be undone.")) return;
    setData(INITIAL_STORE); setGoalsInput(DEFAULT_GOALS); setActivityInput(DEFAULT_ACTIVITY_PREFS); setStepsInput(""); setToast("Local data cleared");
  };
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - (6 - i));
    const key = dateKey(d);
    return { key, label: d.toLocaleDateString("en-US", { weekday: "short" }), value: sumFoods(data.foods.filter(f => f.date === key)).calories };
  });
  const maxGraph = Math.max(data.goals.calories, ...days.map(d => d.value), 1);
  const microStats=nutrientKeys.map(key=>({key,...NUTRIENTS[key],value:diaryFoods.reduce((sum,f)=>sum+((f.nutrients?.[key]??0)*f.servings),0),covered:diaryFoods.filter(f=>f.nutrients?.[key]!=null).length}));
  const trendDays=Array.from({length:progressRange},(_,i)=>{
    const date=new Date();date.setHours(12,0,0,0);date.setDate(date.getDate()-(progressRange-1-i));
    const key=dateKey(date);const food=data.foods.filter(f=>f.date===key);const values=sumFoods(food);
    return {key,label:date.toLocaleDateString('en-US',{month:'short',day:'numeric'}),logged:food.length>0,...values,steps:data.steps[key],water:data.water.filter(w=>w.date===key).reduce((a,w)=>a+w.amountOz,0)};
  });
  const trackedDays=trendDays.filter(d=>d.logged);
  const avgOf=(field:'calories'|'protein')=>trackedDays.length?trackedDays.reduce((a,d)=>a+d[field],0)/trackedDays.length:0;
  const trackedStepDays=trendDays.filter(d=>d.steps!=null);
  const stepAverage=trackedStepDays.length?trackedStepDays.reduce((a,d)=>a+d.steps,0)/trackedStepDays.length:0;
  const weightsInRange=data.weights.filter(w=>w.date>=trendDays[0].key).sort((a,b)=>a.date.localeCompare(b.date)||a.loggedAt-b.loggedAt);
  const weightDelta=weightsInRange.length>=2?weightsInRange[weightsInRange.length-1].weight-weightsInRange[0].weight:null;
  const trendBuckets=Array.from({length:Math.ceil(trendDays.length/(progressRange===7?1:7))},(_,i)=>{
    const batch=trendDays.slice(i*(progressRange===7?1:7),(i+1)*(progressRange===7?1:7));
    const logged=batch.filter(d=>d.logged);
    return {label:batch[0].label,value:logged.length?logged.reduce((a,d)=>a+d.calories,0)/logged.length:0,logged:logged.length};
  });
  const trendMax=Math.max(data.goals.calories,...trendBuckets.map(x=>x.value),1);
  const activityDays = days.map(d => ({
    ...d,
    steps: finite(Number(data.steps[d.key] ?? 0)),
    water: data.water.filter(w => w.date === d.key).reduce((total, w) => total + finite(w.amountOz), 0),
  }));
  const maxSteps = Math.max(data.activityPrefs.stepGoal, ...activityDays.map(d => d.steps), 1);
  return <div className="app-shell">
    <aside className="sidebar">
      <Brand />
      <div className="side-group-label">YOUR SPACE</div>
      <nav className="side-nav" aria-label="Main navigation">
        {NAV.map(({ id, icon: Icon, label }) => <button key={id} type="button" onClick={() => go(id)} className={`side-link ${screen === id ? "selected" : ""}`} aria-current={screen === id ? "page" : undefined}><Icon size={19} />{label}{screen === id && <span className="side-dot" />}</button>)}
      </nav>
      <div className="sidebar-bottom"><span className="soft-icon"><ShieldCheck size={19} /></span><div><strong>Your space, your pace.</strong><small>Stored locally on this device.</small></div></div>
    </aside>

    <div className="main-column">
      <header className="topbar"><div className="mobile-brand"><Brand /></div><div className="top-location"><span className="live-dot" /> Personal fitness dashboard</div><div className="topbar-actions"><Pill kind="teal"><Activity size={13} /> ForgeFit v0.4</Pill><button className="circle-button" title="Settings" aria-label="Settings" onClick={() => go("settings")}><Settings size={18}/></button></div></header>
      <main className="main-content">
        <div key={screen} className="page-enter">
          {screen !== "home" && <button type="button" className="back-link" onClick={() => go("home")}><ChevronLeft size={17}/> Back to overview</button>}

          {screen === "home" && <>
            <section className="welcome"><div><div className="eyebrow"><span className="eyebrow-dot" /> YOUR DAILY OVERVIEW</div><h1>Build your <span>best self.</span></h1><p>Every meal, every rep, every day adds up.</p></div><div className="date-pill"><CalendarDays size={17} /> {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</div></section>
            <section className="dashboard-grid">
              <div className="panel nutrition-panel">
                <div className="panel-heading"><div><span className="panel-overline">TODAY'S NUTRITION</span><h2>Calorie overview</h2></div><span className="icon-square teal-bg"><Flame size={19}/></span></div>
                <div className="calorie-area"><Ring value={totals.calories} total={data.goals.calories} title={`${n(Math.round(totals.calories))}`} subtitle="eaten today"/><div className="calorie-stats"><span className="muted-label">Daily goal</span><strong>{n(data.goals.calories)} <small>kcal</small></strong><div className="hairline" /><span className="muted-label">Walking credit · {n(todaySteps)} steps</span><strong className="orange-text">{canEstimateSteps ? `−${n(creditedStepCalories)}` : "Needs weight"} <small>{canEstimateSteps ? "kcal" : ""}</small></strong><div className="hairline" /><span className="muted-label">Net calories</span><strong>{n(Math.round(netCalories))} <small>kcal</small></strong><div className="hairline" /><span className="muted-label">Remaining</span><strong className="teal-text">{n(Math.round(remaining))} <small>kcal</small></strong></div></div>
                <p className="calorie-explainer">Net = food eaten − estimated walking calories credited. {todaySteps > 0 && !canEstimateSteps ? "Add body weight in Activity, Progress, or Settings to estimate walking calories." : "Walking calories are approximate and can be turned off in Settings."}</p>
                <div className="metrics-grid"><MetricBar label="Protein" current={totals.protein} goal={data.goals.protein} color="var(--teal)"/><MetricBar label="Carbs" current={totals.carbs} goal={data.goals.carbs} color="var(--orange)"/><MetricBar label="Fat" current={totals.fat} goal={data.goals.fat} color="var(--lavender)"/></div>
              </div>
              <div className="panel quick-panel"><div className="panel-heading"><div><span className="panel-overline">KEEP IT MOVING</span><h2>Quick actions</h2></div><span className="icon-square orange-bg"><Target size={19}/></span></div>
                <button className="action-tile" onClick={() => go("food")}><span className="action-icon teal-bg"><UtensilsCrossed size={21}/></span><span><strong>Log a meal</strong><small>Track what fuels you</small></span><ChevronRight className="tile-chevron" size={19}/></button>
                <button className="action-tile" onClick={() => go("train")}><span className="action-icon orange-bg"><Dumbbell size={21}/></span><span><strong>Log a workout</strong><small>Record your training</small></span><ChevronRight className="tile-chevron" size={19}/></button>
                <button className="action-tile" onClick={() => go("activity")}><span className="action-icon teal-bg"><Droplets size={21}/></span><span><strong>Water & steps</strong><small>Hydration and walking</small></span><ChevronRight className="tile-chevron" size={19}/></button>
                <button className="action-tile" onClick={() => go("coach")}><span className="action-icon violet-bg"><Sparkles size={21}/></span><span><strong>Meal coach</strong><small>What should I eat?</small></span><ChevronRight className="tile-chevron" size={19}/></button>
                <button className="action-tile" onClick={() => go("progress")}><span className="action-icon violet-bg"><TrendingUp size={21}/></span><span><strong>Check progress</strong><small>See how far you've come</small></span><ChevronRight className="tile-chevron" size={19}/></button>
              </div>
            </section>
            <section className="mini-grid">
              <div className="stat-panel"><div className="stat-icon teal-bg"><UtensilsCrossed size={20}/></div><div><span>Meals logged today</span><strong>{todayFoods.length}</strong></div><ArrowUpRight size={17} className="soft-arrow"/></div>
              <div className="stat-panel"><div className="stat-icon orange-bg"><Dumbbell size={20}/></div><div><span>Exercises logged today</span><strong>{todayWorkouts.length}</strong></div><ArrowUpRight size={17} className="soft-arrow"/></div>
              <div className="stat-panel"><div className="stat-icon teal-bg"><Droplets size={20}/></div><div><span>Water today</span><strong>{n(todayWaterOz, 1)} <small>oz</small></strong></div><ArrowUpRight size={17} className="soft-arrow"/></div>
              <div className="stat-panel"><div className="stat-icon orange-bg"><Footprints size={20}/></div><div><span>Steps today</span><strong>{n(todaySteps)}</strong></div><ArrowUpRight size={17} className="soft-arrow"/></div>
              <div className="stat-panel"><div className="stat-icon violet-bg"><Scale size={20}/></div><div><span>Latest body weight</span><strong>{latestWeight ? `${n(latestWeight.weight, 1)} lb` : "—"}</strong></div><ArrowUpRight size={17} className="soft-arrow"/></div>
            </section>
            <div className="notice"><Info size={17}/><span>Prototype mode: your entries stay in this browser only. Steps can be entered manually or imported from CSV; Apple Health does not sync yet.</span></div>
          </>}

          {screen === "food" && <>
            <section className="page-heading"><div><div className="eyebrow">FUEL THE WORK</div><h1>Food <span>diary.</span></h1><p>Search real foods, scan barcodes, and log accurate portions.</p></div><Pill kind="teal">{n(diaryTotals.calories)} kcal logged</Pill></section>
            <section className="two-col-layout"><div className="panel">
              <SectionHeader title="Search the food databases" description="Packaged food from Open Food Facts and USDA. Manual lookup to respect API rate limits." action={<Pill>Live + fallback</Pill>}/>
              <form onSubmit={searchCatalog} className="search-line"><div className="input-with-icon"><Search size={19}/><input value={search} onChange={e=>{setSearch(e.target.value);setSearchHasRun(false)}} placeholder="Search branded foods, eggs, rice…" aria-label="Search food databases"/></div><button className="button button-primary" disabled={foodLoading} type="submit"><Search size={16}/>{foodLoading?'Searching…':'Search'}</button></form>
              <div className="food-tool-row"><button type="button" className="button button-outline" onClick={()=>setScannerOpen(true)}><Camera size={17}/> Scan barcode</button><button type="button" className="button button-outline" onClick={()=>{setCatalogResults(STARTER_FOODS);setSearchHasRun(false);setCatalogNotice('Showing local starter foods.');setSearch('')}}>Sample foods</button></div>
              <p className="tiny-muted food-notice" role="status">{catalogNotice}</p>
              <div className="field-row"><label className="field"><span>Add to meal</span><select value={meal} onChange={e=>setMeal(e.target.value as Meal)}>{MEALS.map(m=><option key={m}>{m}</option>)}</select></label><label className="field"><span>Diary date</span><input type="date" value={diaryDate} max={today} onChange={e=>setDiaryDate(e.target.value || today)}/></label></div>
              <div className="ff-quick" aria-label="Fast food logging">
                <div className="ff-between"><strong>Quick log</strong><div className="ff-tabs"><button type="button" className={quickList==='recent'?'ff-selected':''} onClick={()=>setQuickList('recent')}>Recent</button><button type="button" className={quickList==='favorites'?'ff-selected':''} onClick={()=>setQuickList('favorites')}>Favorites</button></div></div>
                <div className="ff-quick-list">{quickFoods.length ? quickFoods.map(f=><div key={f.id} className="ff-quick-row"><button className="ff-heart" onClick={()=>toggleFavorite(f.id)} title={data.favoriteIds.includes(f.id)?'Remove favorite':'Save favorite'} aria-label={`Favorite ${f.name}`}><Heart size={16} fill={data.favoriteIds.includes(f.id)?'currentColor':'none'}/></button><div className="food-info"><strong>{f.name}</strong><small>{f.portionLabel || f.detail} · {n(f.calories)} kcal</small></div><button type="button" className="button button-outline ff-small" onClick={()=>logAgain(f)}><Plus size={15}/> Log</button></div>) : <p className="tiny-muted">{quickList==='favorites'?'Tap a heart beside a logged food to save a favorite.':'Recently logged foods will appear here.'}</p>}</div>
                <button type="button" className="button button-outline full" onClick={copyPreviousMeal}><Copy size={16}/> Copy yesterday’s {meal.toLowerCase()}</button>
              </div>
              {recipeOpen && <p className="ff-helper"><BookOpen size={16}/> Recipe mode active: choose portions below to add ingredients to your recipe (not your diary).</p>}
              <div className="food-results">{filteredFoods.length ? filteredFoods.map(food=><div className="food-result" key={food.id}><span className="food-avatar"><Leaf size={19}/></span><div className="food-info"><strong>{food.name}</strong><small>{food.brand ? food.brand+' · ':''}{food.source} · {n(food.kcal100)} kcal / 100 g</small></div><button className="add-square" onClick={()=>selectCatalogFood(food,recipeOpen?'recipe':'diary')} aria-label={`Choose portion of ${food.name}`} title="Choose serving size"><Plus size={20}/></button></div>) : <Empty icon={Search} heading="No complete nutrition entry found" text="Try a broader name, another barcode, or create a custom food from its label."/>}</div>
              <button className="button button-outline full" onClick={()=>setShowCustom(true)}><Plus size={17}/> Create custom food</button>
              <p className="tiny-muted food-disclaimer">Community-submitted and public database values can be missing or wrong. Always check the product label. Cup/piece conversions appear only when a food has a known weight for that measure.</p>
            </div><div className="panel diary-panel"><SectionHeader title="Your food diary" description="Breakfast · Lunch · Dinner · Snacks" action={<Pill>{diaryDate===today?'Today':diaryDate}</Pill>}/>
              <div className="diary-summary"><strong>{n(diaryTotals.calories)} <small>kcal</small></strong><span>{n(diaryTotals.protein)}g protein · {n(diaryTotals.carbs)}g carbs · {n(diaryTotals.fat)}g fat</span></div>
              {MEALS.map(m=>{const logs=diaryFoods.filter(f=>f.meal===m);const amount=sumFoods(logs).calories;return <div className="meal-group" key={m}><div className="meal-heading"><strong>{m}</strong><span>{n(amount)} kcal</span></div>{logs.length ? logs.map(f=><div className="logged-food" key={f.logId}><span className="log-initial">{f.name.charAt(0).toUpperCase()}</span><div><strong>{f.name}</strong><small>{f.portionLabel || `${n(f.servings,2)} serving(s)`} · {n(f.calories*f.servings)} kcal</small></div><button aria-label={`${data.favoriteIds.includes(f.id)?'Unfavorite':'Favorite'} ${f.name}`} title="Toggle favorite" className="ff-heart" onClick={()=>toggleFavorite(f.id)}><Heart size={16} fill={data.favoriteIds.includes(f.id)?'currentColor':'none'}/></button><button aria-label={`Remove ${f.name}`} className="delete-button" onClick={()=>removeFood(f.logId)}><Trash2 size={17}/></button></div>) : <div className="meal-empty">Nothing logged yet</div>}</div>})}
            </div></section>
            <section className="panel ff-block">
              <SectionHeader title="Saved meals & recipe builder" description="Build from exact food portions; log one serving anytime." action={<button className="button button-outline" onClick={()=>setRecipeOpen(v=>!v)}><BookOpen size={16}/>{recipeOpen?'Close builder':'Create recipe'}</button>}/>
              {recipeOpen && <form onSubmit={saveRecipe} className="ff-recipe-form"><div className="settings-fields"><label className="field"><span>Recipe name</span><input required maxLength={100} value={recipeName} onChange={e=>setRecipeName(e.target.value)} placeholder="Chicken rice bowl"/></label><label className="field"><span>Total servings yielded</span><input required type="number" min="1" max="100" step="1" value={recipeYield} onChange={e=>setRecipeYield(e.target.value)}/></label></div><p className="tiny-muted">Search foods above and tap + to add each measured ingredient. Each saved serving gets 1 / yield of total nutrition.</p>{recipeDraft.length ? <div className="ff-recipe-items">{recipeDraft.map((item,i)=><div className="ff-quick-row" key={`${item.id}:${i}`}><span className="food-info"><strong>{item.name}</strong><small>{n(item.grams,1)}g · {n(item.calories)} kcal</small></span><button type="button" className="delete-button" aria-label={`Remove ${item.name} ingredient`} onClick={()=>setRecipeDraft(d=>d.filter((_,j)=>j!==i))}><Trash2 size={16}/></button></div>)}<div className="ff-between"><strong>Total recipe: {n(recipeNutrition(recipeDraft).calories)} kcal</strong><span>{n(recipeNutrition(recipeDraft).protein)}g protein</span></div></div>:<p className="ff-helper">No ingredients yet. Use the food search above.</p>}<button disabled={!recipeDraft.length} type="submit" className="button button-primary"><Check size={16}/> Save measured recipe</button></form>}
              {data.recipes.length ? <div className="ff-recipe-list">{data.recipes.map(r=>{const info=recipeNutrition(r.ingredients);return <div className="ff-recipe-card" key={r.id}><div><strong>{r.name}</strong><small>{r.ingredients.length} ingredients · {r.yieldServings} servings · {n(info.calories/r.yieldServings)} kcal & {n(info.protein/r.yieldServings)}g protein per serving</small></div><div className="ff-row"><button className="button button-outline ff-small" onClick={()=>logSavedRecipe(r)}><Plus size={15}/> Log serving</button><button className="delete-button" onClick={()=>deleteRecipe(r.id)} aria-label={`Delete recipe ${r.name}`}><Trash2 size={16}/></button></div></div>})}</div>:<p className="tiny-muted">No saved recipes yet. Build one using foods from the search catalog.</p>}
            </section>
            <section className="panel ff-block"><SectionHeader title="Micronutrients" description={`Nutrients for ${diaryDate}, where your food database provides values.`}/><div className="ff-micro-grid">{microStats.map(m=><div className="ff-micro" key={m.key}><span>{m.label}</span><strong>{m.covered>0?`${n(m.value,1)} ${m.unit}`:'Not available'}</strong><small>{m.covered} of {diaryFoods.length} logged foods have data</small></div>)}</div><p className="tiny-muted">Missing values do not mean zero consumed. Totals are partial whenever coverage is less than the number of foods logged. Starter and custom foods may have incomplete nutrient details.</p></section>
          </>}

          {screen === "train" && <>
            <section className="page-heading"><div><div className="eyebrow">SHOW UP STRONGER</div><h1>Train with <span>purpose.</span></h1><p>Track sets, reps, and weight as you go.</p></div><Pill kind="orange">{todayWorkouts.length} exercises today</Pill></section>
            <div className="two-col-layout"><section className="panel"><SectionHeader title="Log an exercise" description="Record one exercise at a time."/><form onSubmit={addWorkout} className="workout-form"><label className="field"><span>Exercise name</span><input required value={workout.exercise} onChange={e => setWorkout(w => ({ ...w, exercise: e.target.value }))} placeholder="e.g. Bench press" maxLength={80}/></label><div className="triple-fields"><label className="field"><span>Sets</span><input required type="number" min="1" max="100" step="1" value={workout.sets} onChange={e => setWorkout(w => ({ ...w, sets: e.target.value }))}/></label><label className="field"><span>Reps</span><input required type="number" min="1" max="1000" step="1" value={workout.reps} onChange={e => setWorkout(w => ({ ...w, reps: e.target.value }))}/></label><label className="field"><span>Weight (lb)</span><input required type="number" min="0" max="10000" step="0.5" value={workout.weight} onChange={e => setWorkout(w => ({ ...w, weight: e.target.value }))}/></label></div><button className="button button-primary full" type="submit"><Plus size={18}/> Add exercise</button></form><div className="tips-card"><Dumbbell size={18}/><span>Enter <strong>0 lb</strong> for bodyweight exercises. Exercises are recorded as completed sets.</span></div></section>
            <section className="panel"><SectionHeader title="Workout history" description="Your most recently logged exercises." action={<Pill>{data.workouts.length} total</Pill>}/>{data.workouts.length ? <div className="history-list">{[...data.workouts].sort((a,b) => b.loggedAt - a.loggedAt).map(w => <div className="history-item" key={w.id}><div className="history-icon"><Dumbbell size={18}/></div><div><strong>{w.exercise}</strong><small>{w.sets} sets × {w.reps} reps · {n(w.weight, 1)} lb</small><small>{w.date === today ? "Today" : w.date}</small></div><button className="delete-button" onClick={() => removeWorkout(w.id)} aria-label={`Delete ${w.exercise}`}><Trash2 size={17}/></button></div>)}</div> : <Empty icon={Dumbbell} heading="Your training starts here" text="Log your first exercise to start building a workout history."/>}</section></div>
          </>}

          {screen === "activity" && <>
            <section className="page-heading"><div><div className="eyebrow">EVERY DROP, EVERY STEP</div><h1>Daily <span>activity.</span></h1><p>Track your hydration and walking in one place.</p></div><Pill kind="teal"><Activity size={13}/> Today</Pill></section>
            <section className="activity-top-grid">
              <div className="panel activity-panel">
                <div className="panel-heading"><div><span className="panel-overline">STAY HYDRATED</span><h2>Water tracker</h2></div><span className="icon-square teal-bg"><Droplets size={19}/></span></div>
                <div className="activity-metric"><strong>{n(todayWaterOz, 1)} <small>fl oz</small></strong><span>{waterMl(todayWaterOz).toLocaleString("en-US")} mL drank today</span></div>
                <div className="activity-progress"><div style={{width: `${Math.min(100, todayWaterOz / data.activityPrefs.waterOz * 100)}%`}}/></div>
                <div className="activity-goal-row"><span>{n(Math.round(todayWaterOz / data.activityPrefs.waterOz * 100))}% of daily goal</span><strong>{n(data.activityPrefs.waterOz, 1)} fl oz goal</strong></div>
                <div className="quick-add-row"><button onClick={() => addWater(8)} type="button"><Plus size={14}/> 8 oz</button><button onClick={() => addWater(12)} type="button"><Plus size={14}/> 12 oz</button><button onClick={() => addWater(16.9)} type="button"><Plus size={14}/> 16.9 oz</button></div>
                <form onSubmit={addCustomWater} className="activity-entry"><label className="field"><span>Custom amount (fl oz)</span><input required min="0.1" max="128" step="0.1" type="number" value={waterInput} onChange={e => setWaterInput(e.target.value)}/></label><button type="submit" className="button button-primary"><Plus size={17}/> Add water</button></form>
                <div className="activity-log"><div className="meal-heading"><strong>Today's drinks</strong><span>{todayWaterLogs.length} entries</span></div>{todayWaterLogs.length ? [...todayWaterLogs].sort((a,b) => b.loggedAt - a.loggedAt).map(w => <div key={w.id} className="activity-log-item"><Droplets size={16}/><span>{n(w.amountOz, 1)} fl oz · {n(waterMl(w.amountOz))} mL</span><button className="delete-button" onClick={() => deleteWater(w.id)} aria-label={`Remove ${n(w.amountOz, 1)} fl oz water`}><Trash2 size={16}/></button></div>) : <p className="tiny-muted activity-empty">No water logged today. Tap a quick-add amount to start.</p>}</div>
              </div>
              <div className="panel activity-panel">
                <div className="panel-heading"><div><span className="panel-overline">KEEP WALKING</span><h2>Step tracker</h2></div><span className="icon-square orange-bg"><Footprints size={19}/></span></div>
                <div className="activity-metric"><strong>{n(todaySteps)} <small>steps</small></strong><span>Today's total · {data.stepSources[today] === 'healthkit' ? 'Apple Health' : data.stepSources[today] === 'csv' ? 'CSV import' : data.stepSources[today] === 'manual' ? 'Manual entry' : 'No source yet'}</span></div>
                <div className="activity-progress orange-progress"><div style={{width: `${Math.min(100, todaySteps / data.activityPrefs.stepGoal * 100)}%`}}/></div>
                <div className="activity-goal-row"><span>{n(Math.round(todaySteps / data.activityPrefs.stepGoal * 100))}% of daily goal</span><strong>{n(data.activityPrefs.stepGoal)} step goal</strong></div>
                <div className="step-burn"><div className="step-burn-icon"><Flame size={20}/></div><div><span>Estimated extra walking burn</span><strong>{canEstimateSteps ? `~${n(stepCalories)} kcal` : "Add body weight to estimate"}</strong><small>{data.activityPrefs.creditStepCalories ? "Applied to your net calorie balance" : "Not applied to your calorie balance"}</small></div></div>
                                 <div className="ff-health-connections" aria-label="Phone health connections">
                   <div className="ff-between"><strong><HeartPulse size={18}/> Phone health connections</strong><Pill kind={healthAvailable ? 'teal' : 'orange'}>{healthAvailable ? 'Native bridge available' : 'Native app required'}</Pill></div>
                   <div className="ff-health-provider"><div><strong><Smartphone size={16}/> Apple Health · iPhone</strong><p className="tiny-muted">Read daily step totals only, with your permission. No health data is sent to a ForgeFit server. Your calorie balance recalculates from the updated step total.</p></div>
                     {healthAvailable ? <div className="ff-health-actions">
                       <button className="button button-primary" type="button" disabled={healthBusy} onClick={()=>{void syncAppleHealth(true);}}><Heart size={16}/>{healthBusy?'Syncing…':data.healthSync.enabled?'Request access again':'Connect Apple Health'}</button>
                       {data.healthSync.enabled && <button className="button button-outline" type="button" disabled={healthBusy} onClick={()=>{void syncAppleHealth(false);}}><RefreshCw size={16}/> Sync last 7 days</button>}
                       {data.healthSync.enabled && <button className="button button-outline" type="button" disabled={healthBusy} onClick={disconnectHealth}>Stop syncing</button>}
                     </div> : <p className="tiny-muted ff-health-explainer">You're using ForgeFit in a web browser or Home Screen web app. Apple only allows HealthKit inside a native iOS app. The native integration is included in the source, but it must be built and installed on an iPhone using Xcode before this control can connect.</p>}
                   </div>
                   <div className="ff-health-provider"><strong><Smartphone size={16}/> Health Connect · Android</strong><p className="tiny-muted">Android Health Connect access will require a separate native Android integration. It is not active in this web release.</p></div>
                   {data.healthSync.lastSync && <p className="tiny-muted">Last successful Apple Health import: {new Date(data.healthSync.lastSync).toLocaleString()}.</p>}
                   {healthNotice && <p className="ff-health-message" role="status">{healthNotice}</p>}
                 </div>
<div className="ff-health-import"><div className="ff-between"><strong><Upload size={16}/> Import step totals from CSV</strong><Pill>Manual import</Pill></div><p className="tiny-muted">Optional CSV with columns <code>date,steps</code> (example: <code>2026-10-20,8250</code>). This can import daily totals exported from another app. It does not connect to Apple Health or sync automatically.</p><label className="button button-outline ff-file-label">Choose CSV<input type="file" accept=".csv,text/csv" onChange={e=>{void importStepsCsv(e.target.files?.[0]);e.target.value='';}}/></label><p className="tiny-muted">Apple Health automatic sync requires a native iPhone app and permission. Source today: {data.stepSources[today]||'manual / not recorded'}.</p></div>
                <div className="step-edit-grid">
                  <form onSubmit={setTodaySteps} className="step-edit-card"><h3>Steps completed today</h3><p>The current number on your watch or phone. This replaces the day's total, NOT your goal.</p><label className="field"><span>Today's completed steps</span><input required type="number" min="0" max="100000" step="1" placeholder={String(todaySteps)} value={stepsInput} onChange={e=>setStepsInput(e.target.value)}/></label><button type="submit" className="button button-primary full"><Check size={17}/> Save steps walked</button></form>
                  <form onSubmit={setStepGoal} className="step-edit-card"><h3>Daily step GOAL</h3><p>Your target. Saving it does not count as completed steps.</p><label className="field"><span>Goal steps per day</span><input required type="number" min="1" max="100000" step="1" value={activityInput.stepGoal} onChange={e=>setActivityInput(v=>({...v,stepGoal:Number(e.target.value)}))}/></label><button type="submit" className="button button-outline full"><Target size={17}/> Save step goal</button></form>
                </div>
                <p className="tiny-muted activity-help">Or add to the number you've already walked:</p><div className="quick-add-row"><button onClick={()=>incrementSteps(500)} type="button"><Plus size={14}/> 500</button><button onClick={()=>incrementSteps(1000)} type="button"><Plus size={14}/> 1,000</button><button onClick={()=>incrementSteps(2000)} type="button"><Plus size={14}/> 2,000</button></div>
                <form onSubmit={saveWalkingWeight} className="walking-weight-box"><label className="field"><span>Body weight for walking calories (lb)</span><input required type="number" min="1" max="1500" step="0.1" placeholder="Enter weight to calculate burn" value={activityInput.bodyWeightLb || ''} onChange={e=>setActivityInput(v=>({...v,bodyWeightLb:Number(e.target.value)}))}/></label><button type="submit" className="button button-outline"><Check size={17}/> Save weight</button><p className="tiny-muted">{latestWeight ? `If you leave this blank, the latest Progress weigh-in (${n(latestWeight.weight,1)} lb) is used. `:''}Walking credit: {canEstimateSteps ? `${n(creditedStepCalories)} kcal`:'weight needed'}. Home balance updates automatically. Turn calorie credits on/off in Settings.</p></form>
                <div className="step-balance-preview"><span>Food today <b>{n(totals.calories)} kcal</b></span><span>Walking credit <b>−{n(creditedStepCalories)} kcal</b></span><strong>Net today <b>{n(netCalories)} kcal</b></strong></div>
              </div>
            </section>
            <div className="notice"><Info size={17}/><span>Calorie estimates depend on weight and assume moderate, level walking. They are not measured calories. If your calorie goal already accounts for your usual walking, applying these credits may double count activity. You can disable credits in Settings.</span></div>
          </>}

          {screen === "coach" && <>
            <section className="page-heading"><div><div className="eyebrow">MAKE MEALS EASIER</div><h1>ForgeFit <span>meal coach.</span></h1><p>Ask for meal ideas built around your remaining nutrition goals and preferences.</p></div><Pill kind="teal"><Sparkles size={13}/> Personalized</Pill></section>
            <section className="two-col-layout"><div className="panel">
              <SectionHeader title="What should I make?" description="Uses your food diary totals and goals; no personal information is needed to get ideas."/>
              <div className="coach-context"><div><span>Calories left</span><strong>{n(Math.max(0,remaining))}</strong></div><div><span>Protein left</span><strong>{n(Math.max(0,data.goals.protein-totals.protein))} g</strong></div><div><span>Meals logged</span><strong>{todayFoods.length}</strong></div></div>
              <form onSubmit={askCoach} className="coach-form"><div className="settings-fields"><label className="field"><span>Meal</span><select value={coachMeal} onChange={e=>setCoachMeal(e.target.value as Meal)}>{MEALS.map(m=><option key={m}>{m}</option>)}</select></label><label className="field"><span>Dietary preference</span><select value={coachDiet} onChange={e=>setCoachDiet(e.target.value)}>{['None','Vegetarian','Vegan','Dairy-free'].map(v=><option key={v}>{v}</option>)}</select></label></div><label className="field"><span>Ingredients on hand (comma-separated; only these will be used)</span><input value={coachIngredients} maxLength={300} onChange={e=>setCoachIngredients(e.target.value)} placeholder="Chicken, rice, broccoli…"/></label><label className="field"><span>Exclude / avoid these foods (comma-separated)</span><input value={coachAvoid} maxLength={200} onChange={e=>setCoachAvoid(e.target.value)} placeholder="Peanuts, dairy, mushrooms…"/><small className="tiny-muted">Recipe filters are not an allergy-safety guarantee; always check ingredients.</small></label><label className="field"><span>Ask your coach</span><textarea required rows={4} maxLength={500} value={coachQuestion} onChange={e=>setCoachQuestion(e.target.value)} placeholder="What can I make for dinner that's high protein?"/></label><ActionButton type="submit" disabled={coachLoading} variant="primary" fullWidth><Sparkles size={18}/>{coachLoading?'Building ideas…':'Get meal ideas'}</ActionButton></form>
            </div><div className="panel coach-answer"><SectionHeader title="Your meal ideas" description="Suggestions update when you submit a new question." action={coachMode?<Pill kind={coachMode==='ai'?'teal':'orange'}>{coachMode==='ai'?'AI-powered':'Built-in smart coach'}</Pill>:undefined}/>
              {coachAnswer ? <div className="coach-response">{coachAnswer.split(/\n/).map((line,i)=><p key={i}>{line.split(/(\*\*[^*]+\*\*)/g).map((part,j)=>part.startsWith('**')&&part.endsWith('**')?<strong key={j}>{part.slice(2,-2)}</strong>:<span key={j}>{part}</span>)}</p>)}</div> : <Empty icon={Sparkles} heading="A meal idea for your goals" text="Tell ForgeFit what you're craving, what ingredients you have, and any dietary preferences."/>}
              {coachNotice && <div className="notice"><Info size={17}/>{coachNotice}</div>}
              <div className="notice"><Info size={17}/><span>When you enter ingredients, ForgeFit uses a strict built-in recipe builder so no unlisted core foods appear. With no pantry list, it can offer general meal ideas (or optional paid AI if you configure an API key on the server). Recipe nutrition is not verified: check portions and allergens before logging.</span></div>
            </div></section>
          </>}

          {screen === "progress" && <>
            <section className="page-heading"><div><div className="eyebrow">CONSISTENCY COUNTS</div><h1>Every step <span>forward.</span></h1><p>Your activity, nutrition trends, and weigh-ins.</p></div><Pill kind="teal"><TrendingUp size={13}/> 7–90 day insights</Pill></section>
            <section className="panel ff-block"><SectionHeader title="Trend analytics" description="Compare logged nutrition and activity over different periods." action={<div className="ff-tabs">{([7,30,90] as const).map(days=><button key={days} type="button" className={progressRange===days?'ff-selected':''} onClick={()=>setProgressRange(days)}>{days}d</button>)}</div>}/><div className="ff-analytics"><div><small>Days with food logged</small><strong>{trackedDays.length} / {progressRange}</strong></div><div><small>Avg intake / logged day</small><strong>{trackedDays.length?`${n(avgOf('calories'))} kcal`:'—'}</strong></div><div><small>Avg protein / logged day</small><strong>{trackedDays.length?`${n(avgOf('protein'))} g`:'—'}</strong></div><div><small>Avg steps / reported day</small><strong>{trackedStepDays.length?n(stepAverage):'—'}</strong></div><div><small>Weight change / interval</small><strong>{weightDelta==null?'2 weigh-ins needed':`${weightDelta>=0?'+':''}${n(weightDelta,1)} lb`}</strong></div></div><div className="ff-trend-chart" role="img" aria-label={`Food calorie history across ${progressRange} days; bars are averages of recorded days only`}>{trendBuckets.map((b,i)=><div className="ff-trend-col" key={i}><div className="ff-trend-bar-wrap"><div className="ff-trend-bar" style={{height:b.logged?`${Math.max(3,b.value/trendMax*100)}%`:'0%',opacity:b.logged?1:.2}} title={b.logged?`${b.label}: ${n(b.value)} kcal average across ${b.logged} logged day(s)`:`${b.label}: no logs`}/></div><small>{b.label}</small></div>)}</div><p className="tiny-muted">Averages exclude unlogged days. For 30/90 days, bars group roughly one week. Unlogged meals can make calorie averages incomplete; weight change is not a smoothed trend.</p></section>
            <section className="mini-grid progress-mini"><div className="stat-panel"><div className="stat-icon teal-bg"><Flame size={20}/></div><div><span>Total food entries</span><strong>{data.foods.length}</strong></div></div><div className="stat-panel"><div className="stat-icon orange-bg"><Dumbbell size={20}/></div><div><span>Exercises tracked</span><strong>{data.workouts.length}</strong></div></div><div className="stat-panel"><div className="stat-icon violet-bg"><Scale size={20}/></div><div><span>Latest weight</span><strong>{latestWeight ? `${n(latestWeight.weight, 1)} lb` : "—"}</strong></div></div></section>
            <section className="panel activity-history"><SectionHeader title="Activity over the last 7 days" description="Daily steps and water you've entered."/><div className="activity-history-grid"><div><div className="activity-history-head"><strong>Steps</strong><span>Goal {n(data.activityPrefs.stepGoal)} / day</span></div><div className="activity-bars">{activityDays.map(d => <div key={d.key} className="activity-bar-day"><span className="activity-bar" title={`${d.label}: ${n(d.steps)} steps`} style={{height: `${Math.max(2, d.steps / maxSteps * 100)}%`, opacity: d.steps ? 1 : .17 }}/><small>{d.label}</small></div>)}</div></div><div><div className="activity-history-head"><strong>Water</strong><span>Goal {n(data.activityPrefs.waterOz)} oz / day</span></div><div className="activity-bars">{activityDays.map(d => <div key={d.key} className="activity-bar-day"><span className="activity-bar teal-bar" title={`${d.label}: ${n(d.water, 1)} fl oz`} style={{height: `${Math.max(2, d.water / Math.max(data.activityPrefs.waterOz, ...activityDays.map(x => x.water), 1) * 100)}%`, opacity: d.water ? 1 : .17 }}/><small>{d.label}</small></div>)}</div></div></div><p className="tiny-muted">Unlogged days are blank, not necessarily zero activity.</p></section>
            <section className="two-col-layout"><div className="panel chart-panel"><SectionHeader title="Daily calorie intake" description="Intake logged over the past week."/><div className="chart-wrap"><div className="chart-grid"><div className="goal-line" style={{ bottom: `${data.goals.calories / maxGraph * 100}%` }}><span>Goal</span></div>{days.map((day) => <div className="chart-column" key={day.key}><div className="bar-box"><span className="chart-bar" title={`${day.label}: ${n(day.value)} kcal`} style={{ height: day.value ? `${Math.max(3, day.value / maxGraph * 100)}%` : "3px", opacity: day.value ? 1 : .22 }}/></div><span className="chart-label">{day.label}</span></div>)}</div></div><div className="chart-legend"><span><i className="legend-dot"/> Logged calories</span><span><i className="legend-line"/> Daily goal ({n(data.goals.calories)})</span></div><p className="tiny-muted">A zero-height bar means no logged calories, not necessarily zero consumed.</p></div>
            <div className="panel"><SectionHeader title="Body weight" description="Track your trend in pounds."/><form className="weight-form" onSubmit={addWeight}><label className="field"><span>Today's weight (lb)</span><input required type="number" min="1" max="2000" step="0.1" placeholder="e.g. 175.5" value={weightInput} onChange={e => setWeightInput(e.target.value)}/></label><button type="submit" className="button button-primary"><Plus size={17}/> Save</button></form>{data.weights.length ? <div className="weight-history">{[...data.weights].sort((a,b) => b.loggedAt - a.loggedAt).slice(0, 8).map((item, i) => <div key={item.id} className="weight-row"><span><Scale size={15}/> {item.date === today ? "Today" : item.date}</span><strong>{n(item.weight, 1)} lb</strong>{i === 0 && <Pill kind="teal">Latest</Pill>}</div>)}</div> : <Empty icon={Scale} heading="No weigh-ins yet" text="Save your first weight to begin tracking."/>}</div></section>
          </>}

          {screen === "settings" && <>
            <section className="page-heading"><div><div className="eyebrow">MAKE IT YOURS</div><h1>Your <span>settings.</span></h1><p>Personalize nutrition and daily activity goals.</p></div><Pill kind="teal"><ShieldCheck size={13}/> Local mode</Pill></section>
            <div className="two-col-layout"><section className="panel"><SectionHeader title="Daily nutrition goals" description="These targets are placeholders until you choose your own."/><form onSubmit={saveGoals}><div className="settings-fields">{(["calories", "protein", "carbs", "fat"] as const).map(key => <label className="field" key={key}><span>{key.charAt(0).toUpperCase() + key.slice(1)} ({key === "calories" ? "kcal" : "g"})</span><input required type="number" min="1" max="100000" step="1" value={goalsInput[key]} onChange={e => setGoalsInput(g => ({ ...g, [key]: Number(e.target.value) }))}/></label>)}</div><ActionButton type="submit" variant="primary"><Check size={17}/> Save goals</ActionButton></form></section>
            <section className="panel"><SectionHeader title="Your data" description="Important information about this starter app."/><div className="settings-note"><ShieldCheck size={20}/><div><strong>Saved on this browser only</strong><p>Entries are stored in localStorage. There is no login, cloud backup, or cross-device sync in v0.4. Clearing this browser's data will remove your entries.</p></div></div><div className="settings-note"><CircleHelp size={20}/><div><strong>Health sync status</strong><p>Manual and CSV step entry work in the browser. The Apple Health connection panel is under Activity; direct step sync requires the native iPhone wrapper and your permission. Android Health Connect needs its own native integration.</p></div></div><ActionButton variant="danger" onClick={clearData}><Trash2 size={16}/> Delete all local data</ActionButton></section></div>
            <section className="panel settings-activity-panel"><SectionHeader title="Water, steps & calorie credits" description="Choose daily goals and the weight used for walking estimates."/><form onSubmit={saveActivityPrefs}><div className="settings-fields"><label className="field"><span>Water goal (fl oz per day)</span><input required type="number" min="1" max="300" step="0.1" value={activityInput.waterOz} onChange={e => setActivityInput(v => ({...v, waterOz: Number(e.target.value)}))}/></label><label className="field"><span>Step goal (steps per day)</span><input required type="number" min="1" max="100000" step="1" value={activityInput.stepGoal} onChange={e => setActivityInput(v => ({...v, stepGoal: Number(e.target.value)}))}/></label><label className="field"><span>Walking estimate weight (lb, optional)</span><input type="number" min="0" max="1500" step="0.1" value={activityInput.bodyWeightLb || ""} placeholder="Enter your body weight" onChange={e => setActivityInput(v => ({...v, bodyWeightLb: Number(e.target.value)}))}/><small className="tiny-muted">This weight takes priority over weigh-ins from Progress. Clear it to use the latest Progress weigh-in.</small></label></div><label className="activity-checkbox"><input type="checkbox" checked={activityInput.creditStepCalories} onChange={e => setActivityInput(v => ({...v, creditStepCalories: e.target.checked}))}/><span><strong>Apply walking calories to net daily calories</strong><small>Turn off if your daily calorie target already includes your usual activity, or if you prefer not to earn calories back.</small></span></label><button type="submit" className="button button-primary"><Check size={17}/> Save activity settings</button></form></section>
          </>}
        </div>
      </main>
      <footer className="footer">© ForgeFit · Built to move with you <span>v0.4 local preview</span></footer>
    </div>
    <nav className="bottom-nav" aria-label="Mobile navigation">{NAV.map(({ id, icon: Icon, label }) => <button key={id} type="button" onClick={() => go(id)} className={screen === id ? "active" : ""} aria-current={screen === id ? "page" : undefined}><Icon size={21} strokeWidth={screen === id ? 2.6 : 1.8}/><span>{label}</span></button>)}</nav>

    {scannerOpen && <BarcodeScanner onFound={findBarcode} onClose={()=>setScannerOpen(false)}/>}
    {selectedFood && <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setSelectedFood(null)}}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="portion-title"><div className="modal-head"><div><span className="panel-overline">PORTION & MACROS</span><h2 id="portion-title">{selectedFood.name}</h2></div><button className="circle-button" onClick={()=>setSelectedFood(null)} aria-label="Close portion picker"><X size={19}/></button></div><p className="tiny-muted">{selectedFood.brand ? selectedFood.brand+' · ':''}{selectedFood.source} · values per 100 grams</p><form className="custom-form" onSubmit={logSelectedFood}><div className="portion-controls"><label className="field"><span>Amount</span><input required type="number" min="0.01" max="10000" step="any" value={foodQuantity} onChange={e=>setFoodQuantity(e.target.value)}/></label><label className="field"><span>Serving size</span><select value={foodUnit} onChange={e=>setFoodUnit(e.target.value)}>{selectedUnits.map(unit=><option key={unit.id} value={unit.id}>{unit.name}</option>)}</select></label></div><div className="portion-macros"><span>Total weight <b>{n(foodGrams,1)} g</b></span><span>Calories <b>{n(previewMacros?.calories||0,1)} kcal</b></span><span>Protein <b>{n(previewMacros?.protein||0,1)} g</b></span><span>Carbs <b>{n(previewMacros?.carbs||0,1)} g</b></span><span>Fat <b>{n(previewMacros?.fat||0,1)} g</b></span></div><p className="tiny-muted">Serving sizes are based on the product label when available. The app won't guess the weight of a cup or piece for unknown foods.</p><button type="submit" className="button button-primary full"><Plus size={18}/> {portionDestination==='recipe'?'Add measured ingredient to recipe':`Log to ${meal} · ${diaryDate}`}</button></form></div></div>}
    {showCustom && <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setShowCustom(false); }}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="custom-title"><div className="modal-head"><div><span className="panel-overline">PERSONALIZE YOUR DIARY</span><h2 id="custom-title">Create custom food</h2></div><button onClick={() => setShowCustom(false)} className="circle-button" aria-label="Close custom food"><X size={19}/></button></div><form onSubmit={addCustom} className="custom-form"><label className="field"><span>Food name</span><input autoFocus required maxLength={100} placeholder="e.g. Homemade protein smoothie" value={custom.name} onChange={e => setCustom(c => ({ ...c, name: e.target.value }))}/></label><div className="custom-grid">{(["calories", "protein", "carbs", "fat"] as const).map(key => <label className="field" key={key}><span>{key.charAt(0).toUpperCase() + key.slice(1)} ({key === "calories" ? "kcal" : "g"})</span><input required type="number" min="0" max="100000" step="0.1" value={custom[key]} placeholder="0" onChange={e => setCustom(c => ({ ...c, [key]: e.target.value }))}/></label>)}</div><div className="custom-grid">{(['fiber','sugar','sodium'] as const).map(key=><label className="field" key={key}><span>{key==='sodium'?'Sodium (mg)':`${key.charAt(0).toUpperCase()+key.slice(1)} (g)`} · optional</span><input type="number" min="0" max="100000" step="0.1" value={custom[key]} placeholder="Unknown" onChange={e=>setCustom(c=>({...c,[key]:e.target.value}))}/></label>)}</div><div className="notice modal-notice"><Info size={16}/> Values are for one serving. Unknown nutrients may be left blank. Added to {meal}.</div><button className="button button-primary full" type="submit"><Plus size={18}/> Add to diary</button></form></div></div>}
    {toast && <div className="toast" role="status"><Check size={17}/>{toast}</div>}
  </div>;
}
