import { describe, expect, it } from 'vitest'
import { getCategoryForIngredient, parseSmartText, formatQty } from './planner'

describe('parseSmartText', () => {
  it('returns nothing for blank input', () => {
    expect(parseSmartText('   ')).toEqual([])
  })

  it('splits concatenated "name amount unit" items on capital letters', () => {
    expect(parseSmartText('Картопля 200 г Морква 2 шт')).toEqual([
      { name: 'Картопля', amount: 200, unit: 'г' },
      { name: 'Морква', amount: 2, unit: 'шт' },
    ])
  })

  it('parses "name amount unit" lines', () => {
    expect(parseSmartText('Морква 2 шт')).toEqual([{ name: 'Морква', amount: 2, unit: 'шт' }])
  })

  it('converts kg and l to g and ml', () => {
    expect(parseSmartText('Борошно 1,5 кг')[0]).toMatchObject({ amount: 1500, unit: 'г' })
    expect(parseSmartText('Молоко 2 л')[0]).toMatchObject({ amount: 2000, unit: 'мл' })
  })

  it('handles multiple lines', () => {
    expect(parseSmartText('Сир 100 г\nОлія 50 мл')).toHaveLength(2)
  })
})

describe('getCategoryForIngredient', () => {
  it.each([
    ['Свинина', "М'ясо та птиця"],
    ['Лосось', 'Риба та морепродукти'],
    ['Морква', 'Овочі, фрукти та зелень'],
    ['Сир пармезан', 'Молочні продукти та яйця'],
    ['Рис (довгозернистий)', 'Бакалія (крупи, макарони)'],
    ['Невідомий продукт', 'Інше'],
  ])('%s -> %s', (name, category) => {
    expect(getCategoryForIngredient(name)).toBe(category)
  })
})

describe('formatQty', () => {
  it('returns a non-empty string', () => {
    expect(formatQty(150, 'г')).toEqual(expect.any(String))
  })
})
