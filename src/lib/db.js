import { supabase } from './supabase';
import { DAYS_OF_WEEK, MEAL_TYPES } from './planner';

// The UI still keys plans by Ukrainian day/meal names; the DB uses dates and enums.
const MEAL_TO_DB = { 'Сніданок': 'breakfast', 'Обід': 'lunch', 'Вечеря': 'dinner' };
const MEAL_FROM_DB = Object.fromEntries(Object.entries(MEAL_TO_DB).map(([ui, db]) => [db, ui]));

const localized = (json, fallback) => json?.uk ?? Object.values(json ?? {})[0] ?? fallback;
const text = (json) => localized(json, '');
const list = (json) => localized(json, []);

const PHOTO_BUCKET = 'recipe-photos';

export const emptyPlan = () =>
  Object.fromEntries(DAYS_OF_WEEK.map(day => [day, Object.fromEntries(MEAL_TYPES.map(meal => [meal, '']))]));

export const rowToRecipe = (row) => ({
  name: text(row.name),
  description: text(row.description),
  mealType: MEAL_FROM_DB[row.meal_type] ?? '',
  minutes: row.minutes,
  kcal: row.kcal,
  vegetarian: row.vegetarian,
  favorite: row.favorite,
  photo: row.photo,
  steps: list(row.steps),
  sourceUrl: row.source_url ?? '',
  tags: row.tags ?? [],
  ingredients: [...(row.recipe_ingredients ?? [])]
    .sort((a, b) => a.position - b.position)
    .map(i => ({ name: text(i.name), amount: Number(i.amount), unit: i.unit })),
});

export const recipeToRow = (recipe) => ({
  name: { uk: recipe.name },
  description: recipe.description ? { uk: recipe.description } : null,
  meal_type: MEAL_TO_DB[recipe.mealType] ?? null,
  minutes: recipe.minutes,
  kcal: recipe.kcal,
  vegetarian: recipe.vegetarian,
  photo: recipe.photo,
  steps: recipe.steps?.length ? { uk: recipe.steps } : null,
  source_url: recipe.sourceUrl || null,
  tags: recipe.tags ?? [],
});

const ingredientRows = (recipeId, ingredients) =>
  ingredients.map((ing, position) => ({ recipe_id: recipeId, name: { uk: ing.name }, amount: ing.amount, unit: ing.unit, position }));

const check = ({ error }) => { if (error) throw error; };

export const planFromEntries = (entries, week) => {
  const plan = emptyPlan();
  const dayByDate = Object.fromEntries(week.days.map(d => [d.iso, d.name]));
  entries.forEach(e => {
    const day = dayByDate[e.date];
    if (day) plan[day][MEAL_FROM_DB[e.meal]] = e.recipe_id;
  });
  return plan;
};

export async function loadAll(week) {
  check(await supabase.rpc('init_user_data'));
  const [profile, recipes, plan, checks, extras] = await Promise.all([
    supabase.from('profiles').select('persons').single(),
    supabase.from('recipes').select('*, recipe_ingredients(*)').not('user_id', 'is', null),
    supabase.from('plan_entries').select('date, meal, recipe_id').gte('date', week.weekStart).lte('date', week.weekEnd),
    supabase.from('shopping_checks').select('item_key').eq('week_start', week.weekStart),
    supabase.from('shopping_extras').select('*').eq('week_start', week.weekStart).order('created_at'),
  ].map(p => Promise.resolve(p).then(r => { check(r); return r.data; })));

  return {
    persons: profile.persons,
    recipesDb: Object.fromEntries(recipes.map(r => [r.id, rowToRecipe(r)])),
    plan: planFromEntries(plan, week),
    checkedItems: Object.fromEntries(checks.map(c => [c.item_key, true])),
    extraItems: extras.map(e => ({ id: e.id, name: e.name, amount: Number(e.amount), unit: e.unit, category: e.category })),
  };
}

export const savePersons = async (userId, persons) =>
  check(await supabase.from('profiles').update({ persons }).eq('id', userId));

export const setPlanEntry = async (userId, date, mealType, recipeId) => {
  const meal = MEAL_TO_DB[mealType];
  if (!recipeId) return check(await supabase.from('plan_entries').delete().match({ user_id: userId, date, meal }));
  return check(await supabase.from('plan_entries').upsert({ user_id: userId, date, meal, recipe_id: recipeId }));
};

export const clearWeek = async (week) => {
  check(await supabase.from('plan_entries').delete().gte('date', week.weekStart).lte('date', week.weekEnd));
  check(await supabase.from('shopping_checks').delete().eq('week_start', week.weekStart));
};

export async function createRecipe(userId, recipe) {
  const { data, error } = await supabase.from('recipes').insert({ ...recipeToRow(recipe), user_id: userId }).select('id').single();
  if (error) throw error;
  if (recipe.ingredients.length) check(await supabase.from('recipe_ingredients').insert(ingredientRows(data.id, recipe.ingredients)));
  return data.id;
}

export async function updateRecipe(id, recipe) {
  check(await supabase.from('recipes').update(recipeToRow(recipe)).eq('id', id));
  check(await supabase.from('recipe_ingredients').delete().eq('recipe_id', id));
  if (recipe.ingredients.length) check(await supabase.from('recipe_ingredients').insert(ingredientRows(id, recipe.ingredients)));
}

export const deleteRecipe = async (id) => check(await supabase.from('recipes').delete().eq('id', id));

export async function uploadRecipePhoto(userId, blob) {
  const path = `${userId}/${crypto.randomUUID()}.jpg`;
  check(await supabase.storage.from(PHOTO_BUCKET).upload(path, blob, { contentType: 'image/jpeg', cacheControl: '31536000' }));
  return path;
}

export const removeRecipePhoto = async (path) => check(await supabase.storage.from(PHOTO_BUCKET).remove([path]));

export const setFavorite = async (id, favorite) => check(await supabase.from('recipes').update({ favorite }).eq('id', id));

export const setItemChecked = async (userId, weekStart, itemKey, checked) => {
  if (checked) return check(await supabase.from('shopping_checks').upsert({ user_id: userId, week_start: weekStart, item_key: itemKey }));
  return check(await supabase.from('shopping_checks').delete().match({ user_id: userId, week_start: weekStart, item_key: itemKey }));
};

export async function addExtra(userId, weekStart, { name, amount, unit }) {
  const { data, error } = await supabase.from('shopping_extras')
    .insert({ user_id: userId, week_start: weekStart, name, amount, unit }).select().single();
  if (error) throw error;
  return { id: data.id, name: data.name, amount: Number(data.amount), unit: data.unit };
}

export const removeExtra = async (id) => check(await supabase.from('shopping_extras').delete().eq('id', id));
