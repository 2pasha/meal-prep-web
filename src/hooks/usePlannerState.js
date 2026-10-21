import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  INGREDIENT_CATEGORIES,
  normalizeRecipes,
  DAYS_OF_WEEK,
  MEAL_TYPES,
  getCategoryForIngredient,
} from '../lib/planner';
import { getWeekInfo } from '../lib/dates';
import { isStoragePhoto } from '../data/photos';
import { isValidUrl } from '../lib/recipeDraft';
import * as db from '../lib/db';
import { useRecipeForm } from './useRecipeForm';

export function usePlannerState(userId) {
  const week = useMemo(() => getWeekInfo(), []);
  const [persons, setPersons] = useState(2);
  const [recipesDb, setRecipesDb] = useState({});
  const [checkedItems, setCheckedItems] = useState({});
  const [extraItems, setExtraItems] = useState([]);
  const [plan, setPlan] = useState(db.emptyPlan);

  const recipes = useMemo(() => normalizeRecipes(recipesDb), [recipesDb]);

  // Modal States
  const [isAddRecipeModalOpen, setIsAddRecipeModalOpen] = useState(false);
  const [editingRecipeId, setEditingRecipeId] = useState(null); 
  const form = useRecipeForm();
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Custom Confirmation Modal State
  const [recipeToDelete, setRecipeToDelete] = useState(null);

  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await db.loadAll(week);
      setPersons(data.persons);
      setRecipesDb(data.recipesDb);
      setPlan(data.plan);
      setCheckedItems(data.checkedItems);
      setExtraItems(data.extraItems);
    } catch (error) {
      console.error('Error loading data:', error);
    }
    setLoading(false);
  }, [week]);

  useEffect(() => { load(); }, [load]);

  // Optimistic update: the UI changes at once; on a failed write we reload from the server.
  const persist = (write) => write().catch(error => {
    console.error('Save failed:', error);
    load();
  });

  const handlePersonsChange = (newPersons) => {
    const value = Math.max(1, newPersons);
    setPersons(value);
    persist(() => db.savePersons(userId, value));
  };

  const handleMealSelect = (day, mealType, recipeId) => {
    setPlan(prev => ({ ...prev, [day]: { ...prev[day], [mealType]: recipeId } }));
    persist(() => db.setPlanEntry(userId, week.days[DAYS_OF_WEEK.indexOf(day)].iso, mealType, recipeId));
  };

  const handleClearPlan = () => {
    setPlan(db.emptyPlan());
    setCheckedItems({});
    persist(() => db.clearWeek(week));
  };

  const handleOpenAddModal = () => {
    form.reset();
    setEditingRecipeId(null);
    setSaveError('');
    setIsAddRecipeModalOpen(true);
  };

  const handleOpenEditModal = (recipeId) => {
    const recipe = recipes[recipeId];
    if (!recipe) return;
    form.load(recipe);
    setEditingRecipeId(recipeId);
    setSaveError('');
    setIsAddRecipeModalOpen(true);
  };

  const confirmDeleteRecipe = () => {
    if (!recipeToDelete) return;
    const id = recipeToDelete;
    const photo = recipesDb[id]?.photo;

    setRecipesDb(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    // The DB cascades plan entries; mirror that locally.
    setPlan(prev => Object.fromEntries(DAYS_OF_WEEK.map(day => [day,
      Object.fromEntries(MEAL_TYPES.map(meal => [meal, prev[day][meal] === id ? '' : prev[day][meal]]))])));
    persist(() => db.deleteRecipe(id).then(() => dropStoragePhoto(photo)));

    setRecipeToDelete(null);
    setIsAddRecipeModalOpen(false);
    setEditingRecipeId(null);
  };

  // Best effort: a leftover file in Storage is harmless, a failed save is not.
  const dropStoragePhoto = (photo) => (isStoragePhoto(photo) ? db.removeRecipePhoto(photo).catch(() => {}) : undefined);

  const handleSaveRecipe = async () => {
    const { draft, original } = form;
    if (!draft.name.trim() || saving) return;
    if (!isValidUrl(draft.sourceUrl)) {
      setSaveError('Посилання на джерело має починатися з http:// або https://');
      return;
    }

    setSaving(true);
    setSaveError('');
    const recipe = form.toRecipe();
    let uploaded = null;
    try {
      if (draft.photoFile) {
        uploaded = await db.uploadRecipePhoto(userId, draft.photoFile);
        recipe.photo = uploaded;
      }
      let id = editingRecipeId;
      if (id) await db.updateRecipe(id, recipe);
      else id = await db.createRecipe(userId, recipe);
      setRecipesDb(prev => ({ ...prev, [id]: { favorite: false, ...prev[id], ...recipe } }));
      if (original?.photo && original.photo !== recipe.photo) dropStoragePhoto(original.photo);
      setIsAddRecipeModalOpen(false);
      setEditingRecipeId(null);
    } catch (error) {
      console.error('Save recipe failed:', error);
      if (uploaded) dropStoragePhoto(uploaded);
      setSaveError('Не вдалося зберегти страву. Спробуйте ще раз.');
    }
    setSaving(false);
  };

  const toggleFavorite = (recipeId) => {
    const next = !recipes[recipeId]?.favorite;
    setRecipesDb(prev => (prev[recipeId] ? { ...prev, [recipeId]: { ...prev[recipeId], favorite: next } } : prev));
    persist(() => db.setFavorite(recipeId, next));
  };

  const addExtraItem = async ({ name, amount, unit }) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const parsed = parseFloat(String(amount).replace(',', '.'));
    try {
      const item = await db.addExtra(userId, week.weekStart, { name: trimmed, amount: Number.isNaN(parsed) ? 1 : parsed, unit });
      setExtraItems(prev => [...prev, item]);
    } catch (error) {
      console.error('Add item failed:', error);
    }
  };

  const removeExtraItem = (extraId) => {
    setExtraItems(prev => prev.filter(item => item.id !== extraId));
    persist(() => db.removeExtra(extraId));
  };

  const toggleItemCheck = (key) => {
    const next = !checkedItems[key];
    setCheckedItems(prev => ({ ...prev, [key]: next }));
    persist(() => db.setItemChecked(userId, week.weekStart, key, next));
  };

  const shoppingListCategories = useMemo(() => {
    const list = {};
    Object.values(plan).forEach(dayMeals => {
      Object.values(dayMeals).forEach(recipeId => {
        if (recipeId && recipesDb[recipeId]) {
          recipesDb[recipeId].ingredients.forEach(ing => {
            const totalAmount = ing.amount * persons;
            const key = ing.name.trim().toLowerCase();
            if (list[key]) {
              list[key].amount += totalAmount;
            } else {
              list[key] = { name: ing.name, amount: totalAmount, unit: ing.unit, originalKey: key };
            }
          });
        }
      });
    });

    const categorizedList = {};
    Object.keys(INGREDIENT_CATEGORIES).forEach(cat => categorizedList[cat] = []);

    Object.values(list).forEach(item => {
      const category = getCategoryForIngredient(item.name);
      if (!categorizedList[category]) categorizedList[category] = [];
      categorizedList[category].push(item);
    });

    extraItems.forEach(item => {
      const category = item.category && categorizedList[item.category] ? item.category : getCategoryForIngredient(item.name);
      categorizedList[category].push({ name: item.name, amount: item.amount, unit: item.unit, originalKey: `extra:${item.id}`, extraId: item.id });
    });

    Object.keys(categorizedList).forEach(cat => categorizedList[cat].sort((a, b) => a.name.localeCompare(b.name)));
    return categorizedList;
  }, [plan, persons, recipesDb, extraItems]);

  const isShoppingListEmpty = useMemo(() => Object.values(shoppingListCategories).every(catList => catList.length === 0), [shoppingListCategories]);

  const shoppingItemsCount = useMemo(
    () => Object.values(shoppingListCategories).reduce((sum, items) => sum + items.length, 0),
    [shoppingListCategories]
  );

  const plannedCount = useMemo(
    () => DAYS_OF_WEEK.reduce((sum, day) => sum + MEAL_TYPES.filter(meal => recipesDb[plan[day]?.[meal]]).length, 0),
    [plan, recipesDb]
  );

  const planCounts = useMemo(() => {
    const counts = {};
    Object.values(plan).forEach(dayMeals => Object.values(dayMeals).forEach(id => { if (id) counts[id] = (counts[id] || 0) + 1; }));
    return counts;
  }, [plan]);

  return {
    loading, persons, plan, recipesDb: recipes, checkedItems, planCounts,
    toggleFavorite, addExtraItem, removeExtraItem,
    shoppingListCategories, isShoppingListEmpty, shoppingItemsCount, plannedCount,
    handlePersonsChange, handleMealSelect, handleClearPlan, toggleItemCheck,
    modal: {
      isAddRecipeModalOpen, setIsAddRecipeModalOpen, editingRecipeId,
      form, saving, saveError,
      handleOpenAddModal, handleOpenEditModal, handleSaveRecipe,
      recipeToDelete, setRecipeToDelete, confirmDeleteRecipe,
    },
  };
}
