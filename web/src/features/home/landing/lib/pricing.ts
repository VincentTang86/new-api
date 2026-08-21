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

/** Decimals every price keeps, however round it is — "$75.00", not "$75". */
const MIN_PRICE_DECIMALS = 2

/**
 * Decimals a price is stated to. The admin form snaps what it stores to twelve
 * (`system-settings/models/pricing-format.ts`), so rounding here reproduces the
 * configured number exactly while absorbing the drift a ratio x 2 x group-ratio
 * product picks up — a rate entered as 0.7875 reads back as "$0.7875", not
 * "$0.7875000000000001".
 */
const MAX_PRICE_DECIMALS = 12

/** Stands in for a rate too fine even for that, so it never reads free. */
const BELOW_RESOLUTION_PRICE = `<$${(10 ** -MAX_PRICE_DECIMALS).toFixed(
  MAX_PRICE_DECIMALS
)}`

/**
 * The savings columns round to whole percent, so a ratio below this renders as
 * "0%" — a claim the two prices beside it contradict.
 */
export const VISIBLE_SAVINGS_RATIO = 0.005

/**
 * Price in USD per 1M tokens, or the placeholder when there is no usable
 * number.
 *
 * This is a USD comparison table by design ("USD / 1M Tokens", vendor list
 * prices are USD), so prices are formatted in USD here rather than through the
 * console's display-currency helper.
 *
 * Every configured digit survives: the table states the rate an admin entered
 * rather than a rounded stand-in for it, so 0.7875 renders as "$0.7875" and
 * 0.000016 as "$0.000016". Only zeros past the two-decimal floor are dropped,
 * which is what keeps 0.16 from padding out to "$0.160".
 */
export function formatLandingPrice(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value) || value < 0) {
    return LANDING_PRICE_PLACEHOLDER
  }

  const [whole, fraction = ''] = value.toFixed(MAX_PRICE_DECIMALS).split('.')
  const trimmed = fraction.replace(/0+$/, '').padEnd(MIN_PRICE_DECIMALS, '0')
  const price = `${whole}.${trimmed}`
  // A free model reads "$0.00"; a rate too fine to state must not.
  if (value > 0 && Number.parseFloat(price) === 0) return BELOW_RESOLUTION_PRICE
  return `$${price}`
}

/**
 * Fraction saved against the vendor list price, or null when no honest claim
 * can be made — no baseline to compare against, we are not actually cheaper, or
 * the gap is too thin to survive rounding to whole percent. Returning null
 * rather than a number keeps a negative or "0%" saving from ever reaching the
 * page.
 */
export function calculateSavingsRatio(
  ourPrice: number,
  officialPrice: number
): number | null {
  if (!Number.isFinite(ourPrice) || !Number.isFinite(officialPrice)) return null
  if (ourPrice < 0 || officialPrice <= 0) return null

  const ratio = (officialPrice - ourPrice) / officialPrice
  if (ratio < VISIBLE_SAVINGS_RATIO) return null
  return ratio
}

export function formatSavingsPercent(ratio: number, language?: string): string {
  if (!Number.isFinite(ratio) || ratio <= 0) return LANDING_PRICE_PLACEHOLDER
  return new Intl.NumberFormat(toIntlLocale(language), {
    style: 'percent',
    maximumFractionDigits: 0,
  }).format(ratio)
}
