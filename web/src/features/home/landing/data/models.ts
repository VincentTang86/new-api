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
import type { LandingPricingTable } from '../types'

/**
 * PLACEHOLDER DATA — carried over verbatim from the design mock.
 *
 * TODO(product): before launch, replace every row with the models we actually
 * sell, our real discounted prices, and vendor list prices taken from a source
 * we can cite. Then bump `updatedAt` and point `source` at that citation.
 *
 * This table is maintained by hand and is NOT connected to billing. The backend
 * stores internal ratios only (`model.Pricing`) and has no upstream list price,
 * no context-window column, and no per-model availability state, so none of the
 * official-price, context, or status values here can be verified automatically.
 * Every price change must be mirrored here manually, and `updatedAt` bumped, or
 * the page will quietly advertise stale numbers.
 */
export const LANDING_PRICING_TABLE: LandingPricingTable = {
  updatedAt: '2026-08-04',
  source: {
    label: 'models.dev',
    href: 'https://models.dev',
  },
  rows: [
    {
      name: 'GPT-4o',
      modelId: 'gpt-4o',
      provider: 'openai',
      inputPrice: 1.25,
      outputPrice: 5,
      officialInputPrice: 2.5,
      officialOutputPrice: 10,
      context: '128K',
      status: 'available',
    },
    {
      name: 'GPT-4o mini',
      modelId: 'gpt-4o-mini',
      provider: 'openai',
      inputPrice: 0.075,
      outputPrice: 0.3,
      officialInputPrice: 0.15,
      officialOutputPrice: 0.6,
      context: '128K',
      status: 'available',
    },
    {
      name: 'Claude 3.5 Sonnet',
      modelId: 'claude-3-5-sonnet',
      provider: 'anthropic',
      inputPrice: 1.5,
      outputPrice: 7.5,
      officialInputPrice: 3,
      officialOutputPrice: 15,
      context: '200K',
      status: 'available',
    },
    {
      name: 'Claude 3 Haiku',
      modelId: 'claude-3-haiku',
      provider: 'anthropic',
      inputPrice: 0.1,
      outputPrice: 0.5,
      officialInputPrice: 0.25,
      officialOutputPrice: 1.25,
      context: '200K',
      status: 'available',
    },
    {
      name: 'Gemini 1.5 Pro',
      modelId: 'gemini-1.5-pro',
      provider: 'google',
      inputPrice: 1.75,
      outputPrice: 10.5,
      officialInputPrice: 3.5,
      officialOutputPrice: 21,
      context: '2M',
      status: 'available',
    },
    {
      name: 'Gemini 1.5 Flash',
      modelId: 'gemini-1.5-flash',
      provider: 'google',
      inputPrice: 0.19,
      outputPrice: 0.75,
      officialInputPrice: 0.35,
      officialOutputPrice: 1.05,
      context: '1M',
      status: 'high-latency',
    },
    {
      name: 'DeepSeek V3',
      modelId: 'deepseek-v3',
      provider: 'deepseek',
      inputPrice: 0.14,
      outputPrice: 0.28,
      officialInputPrice: 0.27,
      officialOutputPrice: 1.1,
      context: '64K',
      status: 'available',
    },
    {
      name: 'DeepSeek R1',
      modelId: 'deepseek-r1',
      provider: 'deepseek',
      inputPrice: 0.55,
      outputPrice: 2.19,
      officialInputPrice: 0.55,
      officialOutputPrice: 2.19,
      context: '64K',
      status: 'available',
    },
    {
      name: 'Llama 3.1 405B',
      modelId: 'llama-3.1-405b',
      provider: 'meta',
      inputPrice: 0.8,
      outputPrice: 0.8,
      officialInputPrice: 1.79,
      officialOutputPrice: 1.79,
      context: '128K',
      status: 'maintenance',
    },
    {
      name: 'Qwen2.5 72B',
      modelId: 'qwen2.5-72b',
      provider: 'alibaba',
      inputPrice: 0.23,
      outputPrice: 0.69,
      officialInputPrice: 0.4,
      officialOutputPrice: 1.2,
      context: '128K',
      status: 'available',
    },
  ],
}
