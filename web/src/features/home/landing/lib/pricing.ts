/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { toIntlLocale } from '@/i18n/languages'

/** Rendered wherever a price or saving cannot be stated honestly. */
export const LANDING_PRICE_PLACEHOLDER = '—'

/**
 * Price in USD per 1M tokens, fixed-point.
 *
 * This is a USD comparison table by design ("USD / 1M Tokens", vendor list
 * prices are USD), so prices are formatted in USD here rather than through the
 * console's display-currency helper. Input prices keep three decimals below a
 * dollar so sub-cent rates stay legible ("$0.075"), two decimals from a dollar
 * up ("$1.00"). Matches the design's own rule.
 */
export function formatInputPrice(value: number): string {
  if (!Number.isFinite(value) || value < 0) return LANDING_PRICE_PLACEHOLDER
  return `$${value.toFixed(value < 1 ? 3 : 2)}`
}

/**
 * Output price, USD per 1M tokens. Always two decimals — output rates never
 * fall far below a cent, so the extra digit only adds noise.
 */
export function formatOutputPrice(value: number): string {
  if (!Number.isFinite(value) || value < 0) return LANDING_PRICE_PLACEHOLDER
  return `$${value.toFixed(2)}`
}

/**
 * Fraction saved against the vendor list price, or null when no honest claim
 * can be made — no baseline to compare against, or we are not actually
 * cheaper. Returning null rather than a number keeps a negative "saving" from
 * ever reaching the page.
 */
export function calculateSavingsRatio(
  ourPrice: number,
  officialPrice: number
): number | null {
  if (!Number.isFinite(ourPrice) || !Number.isFinite(officialPrice)) return null
  if (ourPrice < 0 || officialPrice <= 0) return null

  const ratio = (officialPrice - ourPrice) / officialPrice
  if (ratio <= 0) return null
  return ratio
}

export function formatSavingsPercent(ratio: number, language?: string): string {
  if (!Number.isFinite(ratio) || ratio <= 0) return LANDING_PRICE_PLACEHOLDER
  return new Intl.NumberFormat(toIntlLocale(language), {
    style: 'percent',
    maximumFractionDigits: 0,
  }).format(ratio)
}
