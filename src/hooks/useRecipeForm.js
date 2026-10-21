import { useCallback, useState } from 'react';
import { parseSmartText } from '../lib/planner';
import { addTag, draftToRecipe, emptyDraft, emptyIngredient, recipeToDraft } from '../lib/recipeDraft';

const replaceAt = (list, index, value) => list.map((item, i) => (i === index ? value : item));

export function useRecipeForm() {
  const [draft, setDraft] = useState(emptyDraft);
  const [original, setOriginal] = useState(null); // the saved recipe being edited, if any
  const [smartText, setSmartText] = useState('');
  const [smartError, setSmartError] = useState('');

  const patch = useCallback((changes) => setDraft(d => ({ ...d, ...changes })), []);

  const reset = () => {
    setDraft(emptyDraft());
    setOriginal(null);
    setSmartText('');
    setSmartError('');
  };

  const load = (recipe) => {
    setDraft(recipeToDraft(recipe));
    setOriginal(recipe);
    setSmartText('');
    setSmartError('');
  };

  const importSmartText = () => {
    setSmartError('');
    const parsed = parseSmartText(smartText);
    if (parsed.length > 0) {
      const current = draft.ingredients.filter(ing => ing.name.trim() !== '' || ing.amount !== '');
      patch({ ingredients: [...current, ...parsed] });
      setSmartText('');
    } else {
      setSmartError('Не вдалося розпізнати інгредієнти. Перевірте текст.');
      setTimeout(() => setSmartError(''), 3000);
    }
  };

  const ingredients = {
    add: () => patch({ ingredients: [...draft.ingredients, emptyIngredient()] }),
    change: (index, field, value) => patch({ ingredients: replaceAt(draft.ingredients, index, { ...draft.ingredients[index], [field]: value }) }),
    remove: (index) => patch({ ingredients: draft.ingredients.filter((_, i) => i !== index) }),
  };

  const steps = {
    add: () => patch({ steps: [...draft.steps, ''] }),
    change: (index, value) => patch({ steps: replaceAt(draft.steps, index, value) }),
    remove: (index) => patch({ steps: draft.steps.length > 1 ? draft.steps.filter((_, i) => i !== index) : [''] }),
    move: (index, offset) => {
      const target = index + offset;
      if (target < 0 || target >= draft.steps.length) return;
      const next = [...draft.steps];
      [next[index], next[target]] = [next[target], next[index]];
      patch({ steps: next });
    },
  };

  const tags = {
    add: (raw) => patch({ tags: addTag(draft.tags, raw) }),
    remove: (tag) => patch({ tags: draft.tags.filter(t => t !== tag) }),
  };

  return {
    draft, original, patch, reset, load, toRecipe: () => draftToRecipe(draft),
    smartText, setSmartText, smartError, importSmartText,
    ingredients, steps, tags,
  };
}
