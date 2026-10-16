import { CATEGORY_PALETTE, buildCategoryColorMap } from '../CategoryColors'

describe('CATEGORY_PALETTE', () => {
  it('holds 50 unique hex colours', () => {
    expect(CATEGORY_PALETTE).toHaveLength(50)
    expect(new Set(CATEGORY_PALETTE).size).toBe(50)

    for (const color of CATEGORY_PALETTE) {
      expect(color).toMatch(/^#[0-9a-f]{6}$/)
    }
  })
})

describe('buildCategoryColorMap', () => {
  it('assigns palette colours in alphabetical order', () => {
    const colors = buildCategoryColorMap(['Fuel', 'Alcohol', 'Zoo'])

    expect(colors.get('Alcohol')).toBe(CATEGORY_PALETTE[0])
    expect(colors.get('Fuel')).toBe(CATEGORY_PALETTE[1])
    expect(colors.get('Zoo')).toBe(CATEGORY_PALETTE[2])
  })

  it('is stable no matter what order the labels arrive in', () => {
    const first = buildCategoryColorMap(['Fuel', 'Alcohol', 'Zoo'])
    const second = buildCategoryColorMap(['Zoo', 'Fuel', 'Alcohol'])

    expect([...first.entries()]).toEqual([...second.entries()])
  })

  it('wraps around once the palette runs out', () => {
    const labels = Array.from(
      { length: 51 },
      (_, index) => `Category ${index.toString().padStart(2, '0')}`,
    )
    const colors = buildCategoryColorMap(labels)

    expect(colors.get('Category 50')).toBe(CATEGORY_PALETTE[0])
  })
})
