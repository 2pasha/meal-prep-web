import { dishMeta, formatQty } from '../lib/planner';
import { photoUrl } from '../data/photos';
import { isValidUrl } from '../lib/recipeDraft';
import { CloseIcon } from './Icons';

const hostOf = (url) => {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
};

const heading = 'mb-2 block text-[10px] font-bold tracking-[0.12em] text-muted';

export function RecipeDetail({ recipe, persons, onEdit, onClose }) {
  const facts = [dishMeta(recipe), recipe.mealType, recipe.vegetarian && 'Вегетаріанське'].filter(Boolean);
  const hasSource = !!recipe.sourceUrl && isValidUrl(recipe.sourceUrl); // only http(s) links are rendered
  const sourceHost = hasSource ? hostOf(recipe.sourceUrl) : '';

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 lg:items-center lg:p-4" onClick={onClose}>
      <article
        role="dialog" aria-label={recipe.name}
        className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-[28px] border border-ink bg-paper lg:rounded-[28px]"
        onClick={e => e.stopPropagation()}
      >
        <div
          className="relative h-48 shrink-0 border-b border-ink bg-ink/10 bg-cover bg-center lg:h-60"
          style={recipe.photo ? { backgroundImage: `url(${photoUrl(recipe.photo)})` } : undefined}
        >
          <button onClick={onClose} aria-label="Закрити" className="absolute right-3 top-3 rounded-full border border-ink bg-paper p-2 hover:bg-white"><CloseIcon /></button>
        </div>

        <div className="flex flex-col gap-5 overflow-y-auto px-6 py-5">
          <div>
            <h2 className="font-display text-4xl leading-[0.95]">{recipe.name.toUpperCase()}</h2>
            <p className="mt-2 text-xs font-semibold text-muted">{facts.join(' · ')}</p>
            {recipe.description && <p className="mt-3 font-serif text-xl leading-snug">{recipe.description}</p>}
            {recipe.tags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {recipe.tags.map(tag => <span key={tag} className="rounded-full border border-ink px-3 py-1 text-[11px] font-bold">{tag}</span>)}
              </div>
            )}
          </div>

          <section>
            <span className={heading}>ІНГРЕДІЄНТИ · НА {persons} ПОРЦ.</span>
            {recipe.ingredients.length === 0 ? (
              <p className="text-sm text-muted">Інгредієнтів поки немає.</p>
            ) : (
              <ul className="divide-y divide-ink/15 border-y border-ink/15">
                {recipe.ingredients.map((ing, i) => (
                  <li key={i} className="flex justify-between gap-3 py-2 font-serif text-lg">
                    <span>{ing.name}</span>
                    <span className="shrink-0 font-semibold">{formatQty(ing.amount * persons, ing.unit)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {recipe.steps.length > 0 && (
            <section>
              <span className={heading}>ПРИГОТУВАННЯ</span>
              <ol className="flex flex-col gap-3">
                {recipe.steps.map((step, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="w-6 shrink-0 font-head text-sm font-semibold">{i + 1}.</span>
                    <p className="font-serif text-lg leading-snug">{step}</p>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {hasSource && (
            <a href={recipe.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-royal hover:underline">
              Джерело: {sourceHost} ↗
            </a>
          )}
        </div>

        <div className="flex justify-end gap-3 border-t border-ink px-6 py-4">
          <button onClick={onClose} className="rounded-full border border-ink px-5 py-2.5 text-[13px] font-bold hover:bg-ink/5">Закрити</button>
          <button onClick={onEdit} className="rounded-full border border-ink bg-sun px-5 py-2.5 text-[13px] font-bold hover:brightness-95">Редагувати</button>
        </div>
      </article>
    </div>
  );
}
