import { useEffect, useRef, useState } from 'react';
import { MEAL_TYPES } from '../lib/planner';
import { MAX_TAGS } from '../lib/recipeDraft';
import { resizeImage } from '../lib/image';
import { PHOTO_OPTIONS, img, photoUrl } from '../data/photos';
import { CloseIcon } from './Icons';

const input = 'rounded-full border border-ink bg-white/60 px-4 py-2 text-sm outline-none focus:bg-white';
const label = 'mb-1.5 block text-[10px] font-bold tracking-[0.12em] text-muted';
const chip = (active) => `rounded-full border border-ink px-3.5 py-1.5 text-xs font-bold ${active ? 'bg-ink text-sun' : 'hover:bg-ink/5'}`;
const smallBtn = 'shrink-0 rounded-full p-1.5 text-muted hover:text-ink disabled:opacity-30';

function useObjectUrl(blob) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    if (!blob) { setUrl(null); return undefined; }
    const objectUrl = URL.createObjectURL(blob);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [blob]);
  return url;
}

function PhotoField({ form }) {
  const { draft, patch } = form;
  const [error, setError] = useState('');
  const fileInput = useRef(null);
  const pendingUrl = useObjectUrl(draft.photoFile);
  const previewUrl = pendingUrl || (draft.photo ? photoUrl(draft.photo) : null);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError('');
    try {
      patch({ photoFile: await resizeImage(file), photo: null });
    } catch (err) {
      setError(err.message === 'too-large' ? 'Фото завелике (макс. 10 МБ).' : 'Не вдалося обробити фото.');
    }
  };

  return (
    <div>
      <span className={label}>ФОТО</span>
      <div className="flex items-center gap-3">
        <div
          className="h-20 w-20 shrink-0 rounded-2xl border border-ink bg-ink/5 bg-cover bg-center"
          style={previewUrl ? { backgroundImage: `url(${previewUrl})` } : undefined}
          aria-hidden
        />
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => fileInput.current?.click()} className={chip(false)}>
            {previewUrl ? 'Замінити фото' : 'Завантажити / зробити фото'}
          </button>
          {previewUrl && <button type="button" onClick={() => patch({ photo: null, photoFile: null })} className={chip(false)}>Прибрати</button>}
        </div>
        <input ref={fileInput} type="file" accept="image/*" onChange={handleFile} className="hidden" aria-label="Вибрати фото" />
      </div>
      {error && <p className="mt-1 text-xs font-semibold text-red-700">{error}</p>}

      <span className={`${label} mt-4`}>АБО ОБЕРІТЬ ПРИКЛАД</span>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {PHOTO_OPTIONS.map(p => {
          const active = draft.photo === p && !draft.photoFile;
          return (
            <button
              key={p} type="button" onClick={() => patch({ photo: p, photoFile: null })} aria-label={`Фото: ${p}`} aria-pressed={active}
              className={`h-14 w-14 shrink-0 rounded-full bg-cover bg-center ${active ? 'ring-2 ring-ink ring-offset-2 ring-offset-paper' : 'border border-ink'}`}
              style={{ backgroundImage: `url(${img(p)})` }}
            />
          );
        })}
      </div>
    </div>
  );
}

function StepsField({ steps }) {
  const list = steps.items;
  return (
    <div>
      <div className="mb-2 flex items-end justify-between">
        <span className="text-[10px] font-bold tracking-[0.12em] text-muted">КРОКИ ПРИГОТУВАННЯ</span>
        <button type="button" onClick={steps.add} className="text-xs font-bold text-royal hover:underline">+ Додати крок</button>
      </div>
      <ol className="flex flex-col gap-2">
        {list.map((step, index) => (
          <li key={index} className="flex items-start gap-2">
            <span className="w-5 shrink-0 pt-2 text-right font-head text-xs font-medium">{index + 1}.</span>
            <textarea
              rows={2} value={step} onChange={e => steps.change(index, e.target.value)} aria-label={`Крок ${index + 1}`}
              className="min-w-0 flex-1 resize-y rounded-2xl border border-ink bg-white/60 px-4 py-2 text-sm outline-none focus:bg-white"
            />
            <div className="flex shrink-0 flex-col">
              <button type="button" onClick={() => steps.move(index, -1)} disabled={index === 0} aria-label="Крок вище" className={smallBtn}>↑</button>
              <button type="button" onClick={() => steps.move(index, 1)} disabled={index === list.length - 1} aria-label="Крок нижче" className={smallBtn}>↓</button>
            </div>
            <button type="button" onClick={() => steps.remove(index)} aria-label="Видалити крок" className={`${smallBtn} mt-1`}><CloseIcon size={16} /></button>
          </li>
        ))}
      </ol>
    </div>
  );
}

function TagsField({ tags, value }) {
  const [text, setText] = useState('');
  const commit = () => { if (text.trim()) tags.add(text); setText(''); };
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); commit(); }
    else if (e.key === 'Backspace' && !text && value.length) tags.remove(value[value.length - 1]);
  };
  return (
    <div>
      <label className={label} htmlFor="recipe-tags">ТЕГИ</label>
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-ink bg-white/60 px-3 py-2">
        {value.map(tag => (
          <span key={tag} className="flex items-center gap-1 rounded-full bg-ink px-3 py-1 text-xs font-bold text-sun">
            {tag}
            <button type="button" onClick={() => tags.remove(tag)} aria-label={`Прибрати тег ${tag}`}><CloseIcon size={12} /></button>
          </span>
        ))}
        {value.length < MAX_TAGS && (
          <input
            id="recipe-tags" type="text" value={text} onChange={e => setText(e.target.value)} onKeyDown={handleKeyDown} onBlur={commit}
            placeholder={value.length ? '' : 'Наприклад: швидко, святкове (Enter)'}
            className="min-w-[8rem] flex-1 bg-transparent py-1 text-sm outline-none"
          />
        )}
      </div>
    </div>
  );
}

export function RecipeModal({ modal }) {
  const { form } = modal;
  const { draft, patch } = form;
  const steps = { ...form.steps, items: draft.steps };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 lg:items-center lg:p-4" onClick={() => modal.setIsAddRecipeModalOpen(false)}>
      <div
        role="dialog" aria-label={modal.editingRecipeId ? 'Редагувати страву' : 'Додати нову страву'}
        className="flex max-h-[92vh] w-full max-w-2xl flex-col rounded-t-[28px] border border-ink bg-paper lg:rounded-[28px]"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-ink px-6 py-4">
          <h2 className="font-display text-3xl leading-none">{modal.editingRecipeId ? 'РЕДАГУВАТИ СТРАВУ' : 'НОВА СТРАВА'}</h2>
          <button onClick={() => modal.setIsAddRecipeModalOpen(false)} aria-label="Закрити" className="rounded-full p-2 hover:bg-ink/10"><CloseIcon /></button>
        </div>

        <div className="flex flex-col gap-5 overflow-y-auto px-6 py-5">
          <div>
            <label className={label} htmlFor="recipe-name">НАЗВА СТРАВИ</label>
            <input id="recipe-name" type="text" value={draft.name} onChange={e => patch({ name: e.target.value })} placeholder="Наприклад: Картопля по-селянськи" className={`${input} w-full font-serif text-xl`} />
          </div>

          <div>
            <span className={label}>ПРИЙОМ ЇЖІ</span>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => patch({ mealType: '' })} aria-pressed={!draft.mealType} className={chip(!draft.mealType)}>Будь-який</button>
              {MEAL_TYPES.map(m => <button key={m} onClick={() => patch({ mealType: m })} aria-pressed={draft.mealType === m} className={chip(draft.mealType === m)}>{m}</button>)}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div>
              <label className={label} htmlFor="recipe-minutes">ЧАС, ХВ</label>
              <input id="recipe-minutes" type="number" min="0" value={draft.minutes} onChange={e => patch({ minutes: e.target.value })} className={`${input} w-full`} />
            </div>
            <div>
              <label className={label} htmlFor="recipe-kcal">ККАЛ НА ПОРЦІЮ</label>
              <input id="recipe-kcal" type="number" min="0" value={draft.kcal} onChange={e => patch({ kcal: e.target.value })} className={`${input} w-full`} />
            </div>
            <label className="col-span-2 flex items-end gap-2 pb-2 text-sm font-bold sm:col-span-1">
              <input type="checkbox" checked={draft.vegetarian} onChange={e => patch({ vegetarian: e.target.checked })} className="h-5 w-5 accent-ink" />
              Вегетаріанська
            </label>
          </div>

          <div>
            <label className={label} htmlFor="recipe-desc">КОРОТКИЙ ОПИС</label>
            <textarea id="recipe-desc" rows={2} value={draft.description} onChange={e => patch({ description: e.target.value })} className="w-full resize-y rounded-2xl border border-ink bg-white/60 px-4 py-2 font-serif text-lg outline-none focus:bg-white" />
          </div>

          <PhotoField form={form} />

          <TagsField tags={form.tags} value={draft.tags} />

          <div className="rounded-2xl border border-ink bg-sun/50 p-3.5">
            <label className="mb-2 block text-xs font-bold" htmlFor="smart-text">✨ Розумне додавання — вставте скопійовані інгредієнти</label>
            <div className="flex gap-2">
              <textarea id="smart-text" value={form.smartText} onChange={e => form.setSmartText(e.target.value)} placeholder="Вставте текст тут..." rows={2} className="min-h-[42px] flex-1 resize-y rounded-2xl border border-ink bg-white px-3 py-2 text-sm outline-none" />
              <button onClick={form.importSmartText} disabled={!form.smartText.trim()} className="self-start whitespace-nowrap rounded-full border border-ink bg-sun px-4 py-2 text-xs font-bold disabled:opacity-40">Розпізнати</button>
            </div>
            {form.smartError && <p className="mt-1 text-xs font-semibold text-red-700">{form.smartError}</p>}
          </div>

          <div>
            <div className="mb-2 flex items-end justify-between">
              <span className="text-[10px] font-bold tracking-[0.12em] text-muted">ІНГРЕДІЄНТИ (НА 1 ПОРЦІЮ)</span>
              <button onClick={form.ingredients.add} className="text-xs font-bold text-royal hover:underline">+ Додати рядок</button>
            </div>
            <div className="flex flex-col gap-2">
              {draft.ingredients.map((ing, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input type="text" value={ing.name} onChange={e => form.ingredients.change(index, 'name', e.target.value)} placeholder="Назва продукту" aria-label="Назва продукту" className={`${input} min-w-0 flex-1`} />
                  <input type="number" value={ing.amount} onChange={e => form.ingredients.change(index, 'amount', e.target.value)} placeholder="К-ть" aria-label="Кількість" className={`${input} w-20 shrink-0`} />
                  <select value={ing.unit} onChange={e => form.ingredients.change(index, 'unit', e.target.value)} aria-label="Одиниця" className="w-[72px] shrink-0 rounded-full border border-ink bg-white/60 px-2 py-2 text-sm outline-none">
                    <option value="г">г</option><option value="мл">мл</option><option value="шт">шт</option><option value="ст.л">ст.л</option><option value="ч.л">ч.л</option>
                  </select>
                  <button onClick={() => form.ingredients.remove(index)} disabled={draft.ingredients.length === 1} aria-label="Видалити рядок" className={smallBtn}><CloseIcon size={16} /></button>
                </div>
              ))}
            </div>
          </div>

          <StepsField steps={steps} />

          <div>
            <label className={label} htmlFor="recipe-source">ДЖЕРЕЛО (ПОСИЛАННЯ)</label>
            <input id="recipe-source" type="url" inputMode="url" value={draft.sourceUrl} onChange={e => patch({ sourceUrl: e.target.value })} placeholder="https://…" className={`${input} w-full`} />
          </div>
        </div>

        {modal.saveError && <p role="alert" className="border-t border-ink px-6 pt-3 text-xs font-semibold text-red-700">{modal.saveError}</p>}
        <div className="flex items-center justify-between gap-3 border-t border-ink px-6 py-4">
          {modal.editingRecipeId
            ? <button onClick={() => modal.setRecipeToDelete(modal.editingRecipeId)} className="rounded-full px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-700/10">Видалити страву</button>
            : <span />}
          <div className="flex gap-3">
            <button onClick={() => modal.setIsAddRecipeModalOpen(false)} className="rounded-full border border-ink px-5 py-2.5 text-[13px] font-bold hover:bg-ink/5">Скасувати</button>
            <button onClick={modal.handleSaveRecipe} disabled={!draft.name.trim() || modal.saving} className="rounded-full border border-ink bg-sun px-5 py-2.5 text-[13px] font-bold hover:brightness-95 disabled:opacity-40">
              {modal.saving ? 'Збереження…' : 'Зберегти страву'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
