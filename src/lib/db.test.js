import { describe, expect, it, vi } from 'vitest'

vi.mock('./supabase', () => ({ supabase: {} }))

const { rowToRecipe, recipeToRow, planFromEntries, emptyPlan } = await import('./db')
const { getWeekInfo } = await import('./dates')

describe('rowToRecipe', () => {
  it('maps a DB row to the shape the UI uses', () => {
    const recipe = rowToRecipe({
      name: { uk: 'Борщ' },
      description: null,
      meal_type: 'lunch',
      minutes: 90,
      kcal: 340,
      vegetarian: false,
      favorite: true,
      photo: 'soup',
      recipe_ingredients: [
        { name: { uk: 'Буряк' }, amount: '80', unit: 'г', position: 1 },
        { name: { uk: 'Свинина' }, amount: '100', unit: 'г', position: 0 },
      ],
    })
    expect(recipe).toMatchObject({ name: 'Борщ', mealType: 'Обід', favorite: true, description: '' })
    expect(recipe.ingredients).toEqual([
      { name: 'Свинина', amount: 100, unit: 'г' },
      { name: 'Буряк', amount: 80, unit: 'г' },
    ])
  })

  it('falls back to another language and empty meal type', () => {
    const recipe = rowToRecipe({ name: { en: 'Soup' }, meal_type: null, recipe_ingredients: [] })
    expect(recipe.name).toBe('Soup')
    expect(recipe.mealType).toBe('')
  })
})

describe('recipe steps, source and tags', () => {
  it('reads them from a row', () => {
    const recipe = rowToRecipe({
      name: { uk: 'Омлет' }, meal_type: 'breakfast', recipe_ingredients: [],
      steps: { uk: ['Збити яйця', 'Смажити 3 хв'] }, source_url: 'https://example.com/omelet', tags: ['швидко'],
    })
    expect(recipe).toMatchObject({ steps: ['Збити яйця', 'Смажити 3 хв'], sourceUrl: 'https://example.com/omelet', tags: ['швидко'] })
  })

  it('defaults for rows created before the upgrade', () => {
    const recipe = rowToRecipe({ name: { uk: 'Борщ' }, meal_type: 'lunch', recipe_ingredients: [] })
    expect(recipe).toMatchObject({ steps: [], sourceUrl: '', tags: [] })
  })

  it('round-trips through recipeToRow', () => {
    const row = recipeToRow({ name: 'Омлет', mealType: 'Сніданок', steps: ['Збити яйця'], sourceUrl: 'https://example.com', tags: ['швидко'] })
    expect(row).toMatchObject({ steps: { uk: ['Збити яйця'] }, source_url: 'https://example.com', tags: ['швидко'] })
    expect(rowToRecipe({ ...row, recipe_ingredients: [] })).toMatchObject({ steps: ['Збити яйця'], sourceUrl: 'https://example.com' })
  })

  it('stores empty steps and source as null', () => {
    expect(recipeToRow({ name: 'X', mealType: '', steps: [], sourceUrl: '' })).toMatchObject({ steps: null, source_url: null, tags: [] })
  })
})

describe('planFromEntries', () => {
  const week = getWeekInfo(new Date(2026, 9, 14)) // Wed 14 Oct 2026

  it('places entries on the right day and meal', () => {
    const plan = planFromEntries([{ date: week.days[2].iso, meal: 'dinner', recipe_id: 'r1' }], week)
    expect(plan['Середа']['Вечеря']).toBe('r1')
    expect(plan['Середа']['Обід']).toBe('')
  })

  it('ignores entries outside the week', () => {
    expect(planFromEntries([{ date: '2020-01-01', meal: 'lunch', recipe_id: 'x' }], week)).toEqual(emptyPlan())
  })
})

describe('getWeekInfo', () => {
  it('starts on Monday and exposes ISO dates', () => {
    const week = getWeekInfo(new Date(2026, 9, 14))
    expect(week.weekStart).toBe('2026-10-12')
    expect(week.weekEnd).toBe('2026-10-18')
  })
})
