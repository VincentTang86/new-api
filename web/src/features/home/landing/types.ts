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
export type LandingModelStatus = 'available' | 'high-latency' | 'maintenance'

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

export interface LandingModelRow {
  /** Vendor product name. Brand literal, never translated. */
  name: string
  /** API model id, also the /pricing/$modelId route param. */
  modelId: string
  provider: LandingProviderKey
  /** Our discounted price, USD per 1M tokens. */
  inputPrice: number
  outputPrice: number
  /** Vendor list price, USD per 1M tokens. */
  officialInputPrice: number
  officialOutputPrice: number
  /** Pre-formatted context window label, e.g. '128K'. Brand literal. */
  context: string
  status: LandingModelStatus
}

export interface LandingPricingTable {
  /**
   * ISO 8601 date the prices below were last verified. Rendered through
   * toIntlLocale() so ja/zh visitors do not see an English date.
   */
  updatedAt: string
  rows: readonly LandingModelRow[]
}

export type LandingCodeLanguage = 'python' | 'javascript' | 'curl'

export interface LandingCodeSample {
  language: LandingCodeLanguage
  /** Tab label. Brand literal, never translated. */
  label: string
  snippet: string
}
