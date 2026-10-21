import { describe, expect, it } from 'vitest'
import { MAX_TAGS, addTag, draftToRecipe, emptyDraft, isValidUrl, recipeToDraft } from './recipeDraft'

const recipe = {
  name: 'Омлет', mealType: 'Сніданок', minutes: 15, kcal: null, vegetarian: true, description: 'Швидкий',
  photo: 'omelet', steps: ['Збити яйця', 'Смажити'], sourceUrl: 'https://example.com/o', tags: ['швидко'],
  ingredients: [{ name: 'Яйце', amount: 3, unit: 'шт' }],
}

describe('recipeToDraft / draftToRecipe', () => {
  it('round-trips a recipe', () => {
    expect(draftToRecipe(recipeToDraft(recipe))).toEqual(recipe)
  })

  it('gives an empty recipe one blank row of each list for the form', () => {
    const draft = recipeToDraft({ ...recipe, steps: [], ingredients: [], tags: undefined })
    expect(draft.steps).toEqual([''])
    expect(draft.ingredients).toHaveLength(1)
    expect(draft.tags).toEqual([])
  })

  it('trims text and drops blank steps and incomplete ingredients', () => {
    const draft = {
      ...emptyDraft(), name: '  Суп ', steps: [' варити ', '  ', ''], sourceUrl: ' https://a.b ',
      ingredients: [{ name: ' Вода ', amount: '500', unit: 'мл' }, { name: '', amount: '1', unit: 'г' }, { name: 'Сіль', amount: '', unit: 'г' }],
    }
    expect(draftToRecipe(draft)).toMatchObject({
      name: 'Суп', steps: ['варити'], sourceUrl: 'https://a.b', minutes: null,
      ingredients: [{ name: 'Вода', amount: 500, unit: 'мл' }],
    })
  })
})

describe('addTag', () => {
  it('normalizes, dedupes and ignores blanks', () => {
    let tags = addTag([], '  Швидко ')
    tags = addTag(tags, 'швидко')
    tags = addTag(tags, '   ')
    expect(tags).toEqual(['швидко'])
  })

  it('stops at the limit', () => {
    const full = Array.from({ length: MAX_TAGS }, (_, i) => `t${i}`)
    expect(addTag(full, 'extra')).toBe(full)
  })
})

describe('isValidUrl', () => {
  it('accepts empty and http(s) links only', () => {
    expect(isValidUrl('')).toBe(true)
    expect(isValidUrl('https://example.com/a?b=1')).toBe(true)
    expect(isValidUrl('http://example.com')).toBe(true)
    expect(isValidUrl('javascript:alert(1)')).toBe(false)
    expect(isValidUrl('example.com')).toBe(false)
  })
})
