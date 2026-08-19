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
export type LandingProviderKey =
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'deepseek'
  | 'meta'
  | 'alibaba'
  | 'kimi'
  | 'zhipu'
  | 'minimax'
  | 'doubao'
  | 'xai'

/**
 * External price source the table compares the group price against — the
 * vendor's own list price or OpenRouter's. Both come from the admin-maintained
 * reference prices carried on `/api/pricing`.
 */
export type PricingBenchmark = 'official' | 'openrouter'

/**
 * One display row of the pricing table, fully derived from the backend
 * `/api/pricing` model (priced at the selected group's ratio) plus the
 * admin-maintained benchmark prices for the selected "Compare with" source.
 *
 * The adapter (`lib/build-pricing-rows.ts`) pre-formats every value to a string
 * so the table/accordion stay presentational. Missing figures (unconfigured
 * benchmark price, savings we cannot honestly claim) arrive as the placeholder
 * dash, never as an empty cell.
 */
export interface PricingRow {
  /** Backend model_name; also the /pricing/$modelId route param. */
  modelId: string
  /** Friendly name when the catalog provides one, else the model id. */
  name: string
  /** Resolved vendor for the row marker, or null for the neutral fallback. */
  provider: LandingProviderKey | null
  /** Vendor label backing the neutral fallback initial. */
  vendorLabel: string
  /** Per-request (按次) models price by call, not by token. */
  isPerRequest: boolean
  /** Formatted FR price at the selected group's ratio. Per-request rows carry
   * it in frInput. */
  frInput: string
  frOutput: string
  /** Selected benchmark's list price, or the placeholder dash. */
  officialInput: string
  officialOutput: string
  /** Savings vs the selected benchmark, or the placeholder dash. */
  savingsInput: string
  savingsOutput: string
}

export type LandingCodeLanguage =
  | 'curl'
  | 'python'
  | 'typescript'
  | 'javascript'

export interface LandingCodeSample {
  language: LandingCodeLanguage
  /** Tab label. Brand literal, never translated. */
  label: string
  snippet: string
}
