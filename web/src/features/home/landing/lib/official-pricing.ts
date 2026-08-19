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
/**
 * Benchmark catalogue for the pricing table.
 *
 * The pricing table is driven by `/api/pricing`, which now also carries the
 * admin-maintained external list prices (`official_price` / `openrouter_price`
 * per model, edited in System Settings → Billing → Benchmark Prices and stored
 * in the backend `reference_pricings` table). This module reshapes those
 * fields into the map the row adapter (`lib/build-pricing-rows.ts`) consumes:
 *
 *   - official* → the vendor's public list price, USD per 1M tokens.
 *   - openrouter* → OpenRouter's public list price for the same model, used
 *     when the visitor flips the "Compare with" toggle to OpenRouter.
 *   Savings are computed as (benchmark − FR) / benchmark against whichever
 *   benchmark is selected, so a model with no configured price for that source
 *   simply shows a dash in the benchmark + savings columns.
 *
 * A model with NO reference prices still appears in the table (the product
 * decision is to list every model the backend serves) — it just shows FR price
 * only, with dashes for the benchmark / savings columns.
 */
import type {
  PricingModel,
  ReferencePriceLanes,
} from '@/features/pricing/types'

export interface OfficialPricingEntry {
  /** Friendly name; falls back to the model_name when absent. Not currently
   * populated by the backend feed — kept for the row adapter's contract. */
  displayName?: string
  /** Vendor list price, USD per 1M tokens (token / 按 Token models). */
  officialInput?: number
  officialOutput?: number
  /** Vendor list price, USD per call (按次 / per-request models). Not part of
   * the admin-maintained reference pricing yet. */
  officialRequestPrice?: number
  /** OpenRouter list price, USD per 1M tokens (token / 按 Token models). */
  openrouterInput?: number
  openrouterOutput?: number
  /** OpenRouter list price, USD per call (按次 / per-request models). */
  openrouterRequestPrice?: number
}

export type OfficialPricingMap = Record<string, OfficialPricingEntry>

function readPrice(value: number | null | undefined): number | undefined {
  // A zero or negative "list price" would either be meaningless or make the
  // savings maths dishonest, so it is dropped rather than rendered.
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return undefined
  }
  return value
}

/**
 * Reshape the per-model reference prices from `/api/pricing` into the
 * benchmark catalogue. This is the trust boundary for admin-entered numbers on
 * a public marketing page: an unusable price must degrade to a dash, never
 * reach the savings calculation. Models without any usable price are omitted.
 */
export function buildOfficialPricingCatalog(
  models: readonly PricingModel[]
): OfficialPricingMap {
  const catalog: OfficialPricingMap = {}
  for (const model of models) {
    const entry: OfficialPricingEntry = {}
    const official: ReferencePriceLanes = model.official_price ?? {}
    const openrouter: ReferencePriceLanes = model.openrouter_price ?? {}

    const officialInput = readPrice(official.input)
    if (officialInput !== undefined) entry.officialInput = officialInput
    const officialOutput = readPrice(official.output)
    if (officialOutput !== undefined) entry.officialOutput = officialOutput
    const openrouterInput = readPrice(openrouter.input)
    if (openrouterInput !== undefined) entry.openrouterInput = openrouterInput
    const openrouterOutput = readPrice(openrouter.output)
    if (openrouterOutput !== undefined) {
      entry.openrouterOutput = openrouterOutput
    }

    if (Object.keys(entry).length > 0) {
      catalog[model.model_name] = entry
    }
  }
  return catalog
}
