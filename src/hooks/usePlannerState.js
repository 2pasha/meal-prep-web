import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  INGREDIENT_CATEGORIES,
  normalizeRecipes,
  DAYS_OF_WEEK,
  MEAL_TYPES,
  getCategoryForIngredient,
  parseSmartText,
} from '../lib/planner';
import { getWeekInfo } from '../lib/dates';
import * as db from '../lib/db';

const EMPTY_META = { mealType: '', minutes: '', kcal: '', vegetarian: false, photo: null, description: '' };

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
  const [newRecipeName, setNewRecipeName] = useState('');
  const [newRecipeIngredients, setNewRecipeIngredients] = useState([{ name: '', amount: '', unit: 'г' }]);
  const [recipeMeta, setRecipeMeta] = useState(EMPTY_META);
  const [smartText, setSmartText] = useState('');
  const [smartError, setSmartError] = useState('');
  
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
    setNewRecipeName('');
    setNewRecipeIngredients([{ name: '', amount: '', unit: 'г' }]);
    setRecipeMeta(EMPTY_META);
    setEditingRecipeId(null);
    setSmartText('');
    setSmartError('');
    setIsAddRecipeModalOpen(true);
  };

  const handleOpenEditModal = (recipeId) => {
    const recipe = recipes[recipeId];
    if (!recipe) return;
    setRecipeMeta({
      mealType: recipe.mealType || '',
      minutes: recipe.minutes ?? '',
      kcal: recipe.kcal ?? '',
      vegetarian: !!recipe.vegetarian,
      photo: recipe.photo || null,
      description: recipe.description || '',
    });
    setNewRecipeName(recipe.name);
    setNewRecipeIngredients(recipe.ingredients.length > 0 ? [...recipe.ingredients] : [{ name: '', amount: '', unit: 'г' }]);
    setEditingRecipeId(recipeId);
    setSmartText('');
    setSmartError('');
    setIsAddRecipeModalOpen(true);
  };

  const confirmDeleteRecipe = () => {
    if (!recipeToDelete) return;
    const id = recipeToDelete;

    setRecipesDb(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    // The DB cascades plan entries; mirror that locally.
    setPlan(prev => Object.fromEntries(DAYS_OF_WEEK.map(day => [day,
      Object.fromEntries(MEAL_TYPES.map(meal => [meal, prev[day][meal] === id ? '' : prev[day][meal]]))])));
    persist(() => db.deleteRecipe(id));

    setRecipeToDelete(null);
    setIsAddRecipeModalOpen(false);
    setEditingRecipeId(null);
  };

  const handleSmartImport = () => {
    setSmartError('');
    const parsed = parseSmartText(smartText);
    if (parsed.length > 0) {
      const current = newRecipeIngredients.filter(ing => ing.name.trim() !== '' || ing.amount !== '');
      setNewRecipeIngredients([...current, ...parsed]);
      setSmartText('');
    } else {
      setSmartError('Не вдалося розпізнати інгредієнти. Перевірте текст.');
      setTimeout(() => setSmartError(''), 3000);
    }
  };

  const handleAddIngredientRow = () => setNewRecipeIngredients([...newRecipeIngredients, { name: '', amount: '', unit: 'г' }]);
  
  const handleIngredientChange = (index, field, value) => {
    const updated = [...newRecipeIngredients];
    updated[index][field] = value;
    setNewRecipeIngredients(updated);
  };

  const handleRemoveIngredientRow = (index) => setNewRecipeIngredients(newRecipeIngredients.filter((_, i) => i !== index));

  const handleSaveRecipe = async () => {
    if (!newRecipeName.trim()) return;
    const validIngredients = newRecipeIngredients.filter(ing => ing.name.trim() && ing.amount);
    const recipe = {
      name: newRecipeName.trim(),
      mealType: recipeMeta.mealType,
      minutes: recipeMeta.minutes === '' ? null : Number(recipeMeta.minutes),
      kcal: recipeMeta.kcal === '' ? null : Number(recipeMeta.kcal),
      vegetarian: recipeMeta.vegetarian,
      photo: recipeMeta.photo,
      description: recipeMeta.description.trim(),
      ingredients: validIngredients.map(ing => ({
        name: ing.name.trim(),
        amount: parseFloat(ing.amount),
        unit: ing.unit,
      })),
    };

    try {
      let id = editingRecipeId;
      if (id) await db.updateRecipe(id, recipe);
      else id = await db.createRecipe(userId, recipe);
      setRecipesDb(prev => ({ ...prev, [id]: { favorite: false, ...prev[id], ...recipe } }));
    } catch (error) {
      console.error('Save recipe failed:', error);
      load();
    }

    setIsAddRecipeModalOpen(false);
    setEditingRecipeId(null);
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
      newRecipeName, setNewRecipeName, newRecipeIngredients, recipeMeta, setRecipeMeta,
      smartText, setSmartText, smartError,
      handleOpenAddModal, handleOpenEditModal, handleSmartImport,
      handleAddIngredientRow, handleIngredientChange, handleRemoveIngredientRow, handleSaveRecipe,
      recipeToDelete, setRecipeToDelete, confirmDeleteRecipe,
    },
  };
}
