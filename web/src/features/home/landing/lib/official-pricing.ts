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
 * Hand-maintained supplement to the backend pricing feed.
 *
 * The pricing table is driven by `/api/pricing`, which gives us the model list
 * and every billing ratio, but has NO vendor list price and NO context-window
 * data. Those two facts live in `web/public/official-pricing.json`, keyed by
 * the backend `model_name` (exact match — a model shipped under a variant name
 * such as `kimi/kimi-k3` needs its own entry). The adapter
 * (`lib/build-pricing-rows.ts`) merges the parsed map onto each backend model:
 *
 *   - official* → the vendor's public list price, USD per 1M tokens
 *     (officialRequestPrice for 按次 / per-request models).
 *   - openrouter* → OpenRouter's public list price for the same model, used
 *     when the visitor flips the "Compare with" toggle to OpenRouter.
 *   Savings are computed as (benchmark − FR) / benchmark against whichever
 *   benchmark is selected, so a model with no entry for that source simply
 *   shows a dash in the benchmark + savings columns.
 *   - context → context-window label, e.g. '128K'. Brand literal.
 *   - displayName → friendly name; falls back to the model_name when absent.
 *
 * A model that is NOT in the file still appears in the table (the product
 * decision is to list every model the backend serves) — it just shows FR price
 * only, with dashes for official / savings / context.
 *
 * The JSON ships as a static asset, so editing it is a data change rather than
 * a code change — but it is copied into `web/dist` at build time and embedded
 * into the Go binary, so a price update still needs a frontend rebuild and a
 * redeploy.
 *
 * TODO(product): keep the file in step with the vendors' published pricing
 * pages. Only official list prices and context windows belong there; never our
 * own prices — those are always derived live from the backend ratios.
 */

/** Static asset served from `web/public/`, embedded into the binary at build. */
const OFFICIAL_PRICING_URL = '/official-pricing.json'

export interface OfficialPricingEntry {
  displayName?: string
  /** Vendor list price, USD per 1M tokens (token / 按 Token models). */
  officialInput?: number
  officialOutput?: number
  /** Vendor list price, USD per call (按次 / per-request models). */
  officialRequestPrice?: number
  /** OpenRouter list price, USD per 1M tokens (token / 按 Token models). */
  openrouterInput?: number
  openrouterOutput?: number
  /** OpenRouter list price, USD per call (按次 / per-request models). */
  openrouterRequestPrice?: number
  /** Context-window label, e.g. '128K'. */
  context?: string
}

export type OfficialPricingMap = Record<string, OfficialPricingEntry>

function readPrice(value: unknown): number | undefined {
  // A zero or negative "list price" would either be meaningless or make the
  // savings maths dishonest, so it is dropped rather than rendered.
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return undefined
  }
  return value
}

function readLabel(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

/**
 * Validate the shipped JSON into the map the pricing adapter consumes.
 *
 * This is the trust boundary for a hand-edited data file on a public marketing
 * page: a malformed entry must degrade to a dash, never throw and never reach
 * the savings calculation. Unknown keys are ignored, bad fields are dropped
 * field by field, and a structurally broken file yields an empty map.
 */
export function parseOfficialPricing(raw: unknown): OfficialPricingMap {
  if (typeof raw !== 'object' || raw === null) return {}
  const models = (raw as { models?: unknown }).models
  if (typeof models !== 'object' || models === null || Array.isArray(models)) {
    return {}
  }

  const parsed: OfficialPricingMap = {}
  for (const [modelName, value] of Object.entries(models)) {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      continue
    }
    const source = value as Record<string, unknown>
    const entry: OfficialPricingEntry = {}

    const displayName = readLabel(source.displayName)
    if (displayName !== undefined) entry.displayName = displayName
    const context = readLabel(source.context)
    if (context !== undefined) entry.context = context

    const officialInput = readPrice(source.officialInput)
    if (officialInput !== undefined) entry.officialInput = officialInput
    const officialOutput = readPrice(source.officialOutput)
    if (officialOutput !== undefined) entry.officialOutput = officialOutput
    const officialRequestPrice = readPrice(source.officialRequestPrice)
    if (officialRequestPrice !== undefined) {
      entry.officialRequestPrice = officialRequestPrice
    }

    const openrouterInput = readPrice(source.openrouterInput)
    if (openrouterInput !== undefined) entry.openrouterInput = openrouterInput
    const openrouterOutput = readPrice(source.openrouterOutput)
    if (openrouterOutput !== undefined) {
      entry.openrouterOutput = openrouterOutput
    }
    const openrouterRequestPrice = readPrice(source.openrouterRequestPrice)
    if (openrouterRequestPrice !== undefined) {
      entry.openrouterRequestPrice = openrouterRequestPrice
    }

    parsed[modelName] = entry
  }
  return parsed
}

/**
 * Load the official price supplement. Never rejects: a missing, unreachable or
 * malformed file leaves the official / savings columns showing dashes while the
 * table keeps rendering our own prices from `/api/pricing`.
 *
 * `cache: 'no-cache'` is deliberate — the backend serves every static asset with
 * `Cache-Control: max-age=604800` (middleware/cache.go), so without forced
 * revalidation a returning visitor would keep last week's list prices.
 */
export async function fetchOfficialPricing(): Promise<OfficialPricingMap> {
  try {
    const response = await fetch(OFFICIAL_PRICING_URL, { cache: 'no-cache' })
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
    return parseOfficialPricing(await response.json())
  } catch (error) {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.warn(`Failed to load ${OFFICIAL_PRICING_URL}`, error)
    }
    return {}
  }
}
