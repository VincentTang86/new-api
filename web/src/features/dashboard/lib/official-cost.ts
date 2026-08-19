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
import type { ReferencePriceLanes } from '@/features/pricing/types'

/** Token splits accumulated for one usage-breakdown row. */
export interface OfficialCostUsage {
  promptTokens: number
  completionTokens: number
  cacheTokens: number
  cacheCreationTokens: number
}

const TOKENS_PER_MILLION = 1_000_000

function usablePrice(value: number | null | undefined): number | undefined {
  // A zero or negative list price would make the estimate dishonest.
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return undefined
  }
  return value
}

/**
 * Estimated cost of the same usage at the model developer's published rates,
 * in USD, or null when no honest estimate exists:
 *
 * - the model has no admin-configured official prices, or
 * - the row predates the token split columns (prompt + completion both 0
 *   while tokens were consumed), or
 * - a lane with usage has no price to bill it at.
 *
 * Cached prompt tokens are billed at the explicit cache-hit price, falling
 * back to the cached-input price, then the plain input price; cache-creation
 * tokens fall back from the explicit cache-write price to the input price.
 */
export function estimateOfficialCostUSD(
  usage: OfficialCostUsage,
  prices: ReferencePriceLanes | undefined
): number | null {
  if (!prices) return null
  if (usage.promptTokens <= 0 && usage.completionTokens <= 0) return null

  const input = usablePrice(prices.input)
  const output = usablePrice(prices.output)
  const cacheReadPrice =
    usablePrice(prices.cache_hit) ?? usablePrice(prices.cached_input) ?? input
  const cacheWritePrice = usablePrice(prices.cache_creation) ?? input

  // prompt_tokens includes the cached share (OpenAI/Claude usage convention).
  const cacheRead = Math.max(0, Math.min(usage.cacheTokens, usage.promptTokens))
  const uncachedPrompt = usage.promptTokens - cacheRead
  const cacheCreation = Math.max(0, usage.cacheCreationTokens)

  if (uncachedPrompt > 0 && input === undefined) return null
  if (cacheRead > 0 && cacheReadPrice === undefined) return null
  if (cacheCreation > 0 && cacheWritePrice === undefined) return null
  if (usage.completionTokens > 0 && output === undefined) return null

  const cost =
    uncachedPrompt * (input ?? 0) +
    cacheRead * (cacheReadPrice ?? 0) +
    cacheCreation * (cacheWritePrice ?? 0) +
    usage.completionTokens * (output ?? 0)
  return cost / TOKENS_PER_MILLION
}
