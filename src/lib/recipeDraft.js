// Pure helpers for the recipe form: the editable "draft" and its conversion to/from a recipe.
// Kept free of React so the AI import (roadmap item 3) can build a draft the same way.

export const MAX_TAGS = 10;

export const emptyIngredient = () => ({ name: '', amount: '', unit: 'г' });

export const emptyDraft = () => ({
  name: '',
  mealType: '',
  minutes: '',
  kcal: '',
  vegetarian: false,
  description: '',
  photo: null,       // bundled key, Storage path, or null
  photoFile: null,   // resized Blob waiting to be uploaded on save
  ingredients: [emptyIngredient()],
  steps: [''],
  sourceUrl: '',
  tags: [],
});

export const recipeToDraft = (recipe) => ({
  ...emptyDraft(),
  name: recipe.name,
  mealType: recipe.mealType || '',
  minutes: recipe.minutes ?? '',
  kcal: recipe.kcal ?? '',
  vegetarian: !!recipe.vegetarian,
  description: recipe.description || '',
  photo: recipe.photo || null,
  ingredients: recipe.ingredients.length ? recipe.ingredients.map(i => ({ ...i })) : [emptyIngredient()],
  steps: recipe.steps?.length ? [...recipe.steps] : [''],
  sourceUrl: recipe.sourceUrl || '',
  tags: [...(recipe.tags ?? [])],
});

export const normalizeTag = (raw) => raw.trim().toLowerCase().replace(/\s+/g, ' ');

export const addTag = (tags, raw) => {
  const tag = normalizeTag(raw);
  if (!tag || tags.includes(tag) || tags.length >= MAX_TAGS) return tags;
  return [...tags, tag];
};

export const isValidUrl = (value) => {
  if (!value.trim()) return true;
  try {
    const { protocol } = new URL(value.trim());
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
};

export const draftToRecipe = (draft) => ({
  name: draft.name.trim(),
  mealType: draft.mealType,
  minutes: draft.minutes === '' ? null : Number(draft.minutes),
  kcal: draft.kcal === '' ? null : Number(draft.kcal),
  vegetarian: draft.vegetarian,
  photo: draft.photo,
  description: draft.description.trim(),
  ingredients: draft.ingredients
    .filter(ing => ing.name.trim() && ing.amount)
    .map(ing => ({ name: ing.name.trim(), amount: parseFloat(ing.amount), unit: ing.unit })),
  steps: draft.steps.map(s => s.trim()).filter(Boolean),
  sourceUrl: draft.sourceUrl.trim(),
  tags: draft.tags,
});
