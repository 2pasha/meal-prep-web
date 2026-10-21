# Smakota: product roadmap (MVP vs Future)

## Context
Smakota is a weekly meal planner plus shopping list: React 19 + Vite + Tailwind, Supabase backend, PWA shell. Today it is single-user, Ukrainian-only and requires Google sign-in. Recipes can only be added manually, photos come from 13 bundled images, and there are no recipe steps and no sharing. The plan is locked to the current week.

Decisions made: guest mode is local-only with import on signup. Sharing is a shared household. AI accepts text, URL, photo and pasted text, with AI-generated images. AI is a free quota, then paid. Ukrainian first, English later. Extras: week navigation and a smarter shopping list.

## MVP

### 1. Accounts + guest mode
- Keep Google sign-in. Consider adding email magic link, because Google-only is a barrier.
- Guest mode: full planner, recipes and shopping list stored on-device (IndexedDB), with no AI features. A banner says "data is only on this device".
- Sign-up from guest mode runs a one-time import of local data into the account. Idempotent and confirmed by the user.
- A storage abstraction so the UI doesn't care whether data is local or Supabase.

### 2. Recipe model upgrade (prerequisite for AI)
- Add: steps/instructions, servings per recipe, source URL, tags, image URL (Supabase Storage).
- Recipe search and filter in the Meals tab.
- Custom photo upload (the current picker only offers bundled images).

### 3. AI add-meal (signed-in only)
- One "Add recipe" entry with four inputs: dish name or free text, URL, photo, pasted messy text.
- The result is a **draft** in the existing recipe form, which the user edits and saves. AI never saves directly.
- Runs in Supabase Edge Functions so API keys stay server-side. Output is structured JSON matching the recipe schema, in Ukrainian.
- AI-generated preview image, stored in Storage, with the user able to regenerate or upload their own.
- Free monthly quota per user with a visible counter. Hard server-side rate limits.

### 4. Shared household
- Create a household, invite by link, join. Plan, shopping list and recipe book are shared.
- Moves data ownership from `user_id` to `household_id`, with RLS updated (the 0001 migration anticipated this).
- Realtime updates so a partner checking off items shows up live.
- Roles: owner and member only. Leave household, remove member.

### 5. Week navigation + copy week
- Browse previous and next weeks. Copy a week's plan forward. Shopping list per selected week.

### 6. Smarter shopping list
- Unit reconciliation (g/kg, ml/l, pcs). Merge duplicate ingredients reliably.
- Category detection that isn't a Ukrainian-only keyword heuristic (AI-assisted at recipe save time, stored on the ingredient).
- Share or export the list.

## Future
- English UI and AI output (real i18n, using the existing `locale` and jsonb names).
- Paid tier (subscription) lifting the AI quota, with a payment provider.
- AI weekly plan: fill the week from the recipe book, based on diet, allergies, calorie goals and the household's favorites.
- Dietary preferences and allergy profile. Nutrition (protein/fat/carbs) beyond kcal.
- Public read-only share links for a recipe or week plan, plus recipe sharing between households.
- Pantry tracking ("I already have this") and leftovers handling.
- Offline writes with a sync queue (the PWA only caches the shell today).
- Push or reminder notifications ("prep day", "shopping day").
- Aisle-order shopping list and grocery-store integrations.
- Multiple plans or households per user. Meal slots beyond breakfast, lunch and dinner (snacks).
- Recipe import from social video captions or the share sheet (PWA share target).
- Community or curated recipe collections.

## Open questions / risks
- **Guest + AI conflict:** AI needs an identity for quotas. MVP answer: AI requires sign-in, and guests see AI features as a prompt to sign up (a good conversion hook). Confirm this is acceptable.
- **AI cost:** vision plus image generation per recipe is the expensive path. Set the quota size before building, and consider generating images lazily (on save, not on every draft).
- **URL import:** scraping can be blocked by some sites. Fall back to "paste the text" if fetch fails.
- **Household migration:** moving ownership from user to household changes the schema and RLS. Needs a careful migration for existing data.
- **Guest-to-account import:** a duplicate-data risk if the user signs in on a second device that also has local data.
- **Testing:** only two lib test files exist today. Add tests around the import, storage abstraction and household RLS before they ship.

## Suggested build order
1. Recipe model upgrade (steps, servings, image upload).
2. Storage abstraction + guest mode + import on signup.
3. Week navigation + copy week.
4. AI add-meal (text first, then URL, then photo) with quota, then AI image.
5. Household sharing + realtime.
6. Smarter shopping list (can run in parallel with 4 or 5).

## Platform decision: stay on Vite + React, don't move to Next.js
- The backend need is covered by **Supabase Edge Functions**: AI calls, quotas, URL fetching. They sit next to the DB, RLS and Storage, and API keys stay server-side.
- The app is an auth-gated, local-first PWA (guest mode on IndexedDB, offline shell). SSR/RSC add little here, and the service worker, IndexedDB and a server runtime pull in different directions.
- A rewrite would cost weeks and ship zero user-visible features (no router, one 278-line hook, hardcoded Ukrainian).
- **Reconsider when:** public SEO pages (shared recipes/plans with link previews) become a priority. Even then, a small Edge Function can serve OG meta for share links, or just that one surface can move. A Vercel `/api` function is the fallback if you want a TS backend without Next.

---

# Technical plan, Item 1: Recipe model upgrade

## Goal
Make recipes rich enough for AI import (steps, source, tags, real photos) and findable (search/filter), without breaking the shopping math or existing users' data.

## Current state (verified in code)
- `recipes` has: name/description (jsonb `{uk}`), meal_type, minutes, kcal, vegetarian, favorite, photo (`supabase/migrations/0001`, `0002`). No steps, source or tags.
- `photo` holds a bundled-image key. The recipe-photo consumers call `img(photo)` from `src/data/photos.js`: `RecipesView`, `DishCard`, `Thumb`, `TodayPanel` (the last two via `getMealView`). Hero and the favorites strips use fixed bundled images.
- Form state is split across `usePlannerState.js` (`newRecipeName`, `newRecipeIngredients`, `recipeMeta`, `smartText`) and passed to `RecipeModal` as one `modal` prop bag.
- Ingredients are stored **per 1 portion**. The shopping list multiplies by `profiles.persons` (`planner.js`, `usePlannerState`).
- `init_user_data()` copies seed recipes to each new user, listing columns explicitly. It must learn the new columns.
- There's no `supabase/config.toml`, so migrations are applied to the hosted project (CLI `supabase db push` or the dashboard SQL editor). Local Supabase isn't set up.

## Decisions
1. **No `servings` column.** Ingredients stay per-portion, so shopping math is untouched. URL/AI import (item 3) divides by the source servings at draft time. This avoids a second source of truth. (If you want to show "original: 4 servings", store it as informational text in the description later.)
2. **`photo` stays one column, two meanings.** A value containing `/` is a Storage path; otherwise it's a bundled key. One `photoUrl(photo)` helper resolves both. No data migration, and seed recipes keep working.
3. **Public Storage bucket, unguessable paths.** Private buckets would need signed URLs, which break SW caching and complicate household sharing. Write access is restricted by folder = `auth.uid()`.
4. **Steps use the existing i18n convention:** `steps jsonb` shaped `{"uk": ["...", "..."]}`, like name/description.
5. **Extract recipe form state into `useRecipeForm`** before adding fields. Item 3's AI draft needs to prefill the whole form via a single `setDraft(...)`. Doing the extraction now avoids touching the form twice.

## Steps

### A. Migration `supabase/migrations/0003_recipe_upgrade.sql`
- `alter table recipes add column steps jsonb, add column source_url text, add column tags text[] not null default '{}'`.
- Storage bucket `recipe-photos`: public, `file_size_limit` 2 MB, allowed mime `image/jpeg, image/png, image/webp`.
- Storage policies on `storage.objects`: insert/update/delete only where `bucket_id = 'recipe-photos'` and `(storage.foldername(name))[1] = auth.uid()::text`. Public read via the bucket.
- `create or replace function init_user_data()` to also copy `steps, source_url, tags`.
- Existing rows get null/empty defaults, so no backfill is needed.

### B. Data layer, `src/lib/db.js`
- `rowToRecipe`: add `steps` (array, default `[]`), `sourceUrl`, `tags`. Add a small `list()` helper next to `text()`.
- `recipeToRow`: write `steps: {uk: [...]}` (null if empty), `source_url`, `tags`.
- New `uploadRecipePhoto(userId, recipeId, blob)` returning the path (`{userId}/{recipeId}-{timestamp}.jpg`), and `removeRecipePhoto(path)`. Best-effort delete of the old object on replace and on `deleteRecipe`. Orphan cleanup is a future job.
- Selects use `*`, so the new columns come through with no query change.

### C. Photo helper, `src/data/photos.js`
- Add `photoUrl(photo)`: contains `/` → `supabase.storage.from('recipe-photos').getPublicUrl(photo).data.publicUrl`; otherwise the existing `img(photo)`.
- Replace `img(recipe.photo)` calls in `RecipesView.jsx`, `DishCard.jsx`, `Thumb.jsx`, `TodayPanel.jsx`. Keep `img()` for the fixed Hero/Favorites assets.
- Add `/storage/v1/object/public/` to the service worker runtime caching (StaleWhileRevalidate) in `vite.config.js`. The Supabase API is currently never cached, so the rule must target only the public image path.
- This is the seam item 2 extends so guest photos (Blobs in IndexedDB) resolve too.

### D. Client image processing, `src/lib/image.js` (new)
- `resizeImage(file, maxSide = 1200, quality = 0.8) → Blob` via `createImageBitmap` + canvas, output JPEG. Rejects non-images and files over ~10 MB before decoding. Target is about 100–200 KB.

### E. Form refactor + new fields
- New `src/hooks/useRecipeForm.js` with `{ draft, setDraft, patch, reset, load(recipe), toRecipe() }`, covering name, meal type, minutes, kcal, vegetarian, description, photo, ingredients, steps, sourceUrl, tags, and the smart-text parse (move `handleSmartImport` here).
- Slim `usePlannerState.js`: remove the form state and hand-built meta, and call `useRecipeForm`. `handleSaveRecipe` becomes upload photo (if a new file is pending) → create/update → set path.
- `RecipeModal.jsx`: stop using the `modal` prop bag for form state and pass the form object. Add:
  - **Photo:** "Upload / take photo" button (`<input type="file" accept="image/*">`, which opens the camera on phones), a preview, and a remove button. Keep the bundled picker, relabelled "examples".
  - **Steps:** ordered list of textareas, add/remove, with move up/down.
  - **Source URL:** a text input, shown as a link in the detail view.
  - **Tags:** chip input (Enter/comma to add, × to remove), lowercase and trimmed, max 10.
- Save-time validation: a URL must be http(s), steps are trimmed with empties dropped, tags are deduped.

### F. Read-only recipe detail (new `RecipeDetail.jsx`)
- Steps need somewhere to be read. A sheet or modal showing photo, meta, tags, ingredients **scaled by `persons`**, numbered steps and the source link, with an Edit button. Open it from `DishCard` and from the picker's recipe preview.
- Before building, check what a `DishCard` click does today in `RecipesView.jsx` (likely opens the editor).
- Cooking mode (big text, keep screen awake) is future.

### G. Search + filter, `src/lib/planner.js` + `RecipesView.jsx`
- Pure `filterRecipes(recipesDb, { query, mealType, vegetarian, favorite, tag })`. Query matches name, tags and ingredient names, case-insensitive. All recipes are already loaded client-side, so there's no new request.
- UI: search box, meal-type chips, vegetarian/favorites toggles, tag chips (derived from existing recipes), and an empty state with a "clear filters" action.

## Critical files
- `supabase/migrations/0003_recipe_upgrade.sql` (new)
- `src/lib/db.js`, `src/data/photos.js`, `src/lib/image.js` (new), `src/lib/planner.js`
- `src/hooks/usePlannerState.js`, `src/hooks/useRecipeForm.js` (new)
- `src/components/RecipeModal.jsx`, `RecipesView.jsx`, `DishCard.jsx`, `Thumb.jsx`, `TodayPanel.jsx`, `RecipeDetail.jsx` (new)
- `vite.config.js` (SW rule)

## Reuse
- `text()` / `rowToRecipe` / `recipeToRow` patterns in `db.js`, `parseSmartText` in `planner.js`, the `check()` error helper, the existing optimistic-update + reload-on-error pattern in `usePlannerState`, and the existing Tailwind class tokens (`input`, `chip`, `label`) in `RecipeModal.jsx`.

## Tests (vitest, alongside `db.test.js` / `planner.test.js`)
- `rowToRecipe` / `recipeToRow` round-trip with steps, source URL and tags, plus null/legacy rows (no steps → `[]`).
- `photoUrl`: bundled key vs Storage path.
- `filterRecipes`: query over name, tag and ingredient, combined filters, empty result.
- `useRecipeForm`: `load → toRecipe` round-trip, validation (bad URL, empty steps, duplicate tags).
- Image resizing needs a real canvas, so it's covered manually.

## Verification
1. Apply `0003` to the hosted Supabase project (CLI `supabase db push` or the SQL editor). Confirm the bucket and policies exist.
2. `npm run lint && npm test && npm run build`.
3. `npm run dev`, then manually:
   - Create a recipe with an uploaded photo, 3 steps, a source URL and 2 tags. Reload and confirm everything persists. Check it renders on `DishCard`, `Thumb` and the Today panel.
   - Edit it: replace the photo and check the old Storage object is deleted. Delete the recipe and check the object is removed.
   - Try a user-B account and confirm they can't write into user A's folder (RLS check).
   - Search and filter: by name, ingredient, tag, vegetarian and favorites.
   - Existing seed recipes still load (null steps) and the shopping list totals are unchanged.
   - On a phone-width viewport, check the file picker/camera and the PWA install still work.
4. Verify the SW doesn't cache API calls (Network tab) but does cache photo URLs.

## Out of scope here (later roadmap items)
Guest/IndexedDB storage (item 2), AI draft and image generation (item 3), household ownership of recipes and photos (item 4), cooking mode, orphan-photo cleanup job.
