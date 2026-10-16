import { createContext, useContext, useMemo } from 'react'
import type { ReactNode } from 'react'

/**
 * 50 evenly-spaced hues around the colour wheel (7.2° apart) at a fixed
 * saturation and lightness, so every category can have its own colour while
 * the palette stays visually even.
 */
export const CATEGORY_PALETTE: Array<string> = Array.from(
  { length: 50 },
  (_, index) => hslToHex(index * (360 / 50), 70, 55),
)

export type CategoryColorMap = Map<string, string>

/**
 * Assigns palette colours to category labels in alphabetical order, so a
 * category keeps the same colour on every render. Adding or removing a
 * category shifts the ones after it; that is the price of a sorted mapping.
 */
export function buildCategoryColorMap(
  labels: Iterable<string>,
): CategoryColorMap {
  const sorted = [...new Set(labels)].sort((a, b) => a.localeCompare(b))

  return new Map(
    sorted.map((label, index) => [
      label,
      CATEGORY_PALETTE[index % CATEGORY_PALETTE.length],
    ]),
  )
}

const CategoryColorsContext = createContext<CategoryColorMap>(new Map())

type CategoryColorsProviderProps = {
  /** Every category label in the app; order does not matter. */
  labels: Array<string>
  children: ReactNode
}

export function CategoryColorsProvider({
  labels,
  children,
}: CategoryColorsProviderProps) {
  const colors = useMemo(() => buildCategoryColorMap(labels), [labels])

  return (
    <CategoryColorsContext.Provider value={colors}>
      {children}
    </CategoryColorsContext.Provider>
  )
}

export function useCategoryColors(): CategoryColorMap {
  return useContext(CategoryColorsContext)
}

/** The colour one label maps to, or undefined outside a provider. */
export function useCategoryColor(label?: string): string | undefined {
  const colors = useCategoryColors()
  return label ? colors.get(label) : undefined
}

function hslToHex(hue: number, saturation: number, lightness: number): string {
  const s = saturation / 100
  const l = lightness / 100
  const a = s * Math.min(l, 1 - l)
  const channel = (n: number) => {
    const k = (n + hue / 30) % 12
    const value = l - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)))
    return Math.round(255 * value)
  }

  return `#${[channel(0), channel(8), channel(4)]
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('')}`
}
