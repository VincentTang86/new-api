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
import type {
  ImageSizePrice,
  PricingModel,
  VideoGrid,
  VideoRateCondition,
} from '../types'

/** The conditions a video model's prices may split on, in display order. */
export const VIDEO_RATE_CONDITIONS = [
  'without_video',
  'with_video',
] as const satisfies readonly VideoRateCondition[]

/** i18n keys of the condition labels, shared by the drawer and the settings matrix. */
export const VIDEO_RATE_CONDITION_LABELS: Record<VideoRateCondition, string> = {
  without_video: 'Input without video',
  with_video: 'Input with video',
}

export function isVideoRateCondition(
  value: string
): value is VideoRateCondition {
  return (VIDEO_RATE_CONDITIONS as readonly string[]).includes(value)
}

/** The entries of a listed price stated under one condition ('' = unconditioned). */
export function pricesUnder(
  prices: readonly ImageSizePrice[] | undefined,
  condition: string
): ImageSizePrice[] {
  return (prices ?? []).filter(
    (entry) => (entry.condition ?? '') === condition
  )
}

/**
 * The listed price of one grid cell, matched exactly by size and condition —
 * a neighbouring resolution's or the other condition's price is never
 * borrowed, or the comparison would set unlike figures side by side.
 */
export function priceAt(
  prices: readonly ImageSizePrice[] | undefined,
  size: string,
  condition: string
): number | undefined {
  const entry = pricesUnder(prices, condition).find((item) => item.size === size)
  if (!entry || !Number.isFinite(entry.price) || entry.price <= 0) {
    return undefined
  }
  return entry.price
}

/**
 * The grid a video model's /Sec and /Token tables share. The admin-defined
 * layout wins when one is stored; a model priced before grids existed derives
 * its columns from the gateway's listed prices (the reference sources' when
 * the gateway has none) and gains a condition column only when some price is
 * stated under one.
 */
export function resolveVideoGrid(model: PricingModel): VideoGrid {
  if (model.video_grid) {
    const stored = model.video_grid
    return {
      conditions: VIDEO_RATE_CONDITIONS.filter((condition) =>
        stored.conditions.includes(condition)
      ),
      resolutions: stored.resolutions,
    }
  }
  const gatewayLists = [model.video_prices, model.video_token_prices]
  const referenceLists = [
    model.official_price?.per_second,
    model.official_price?.per_token,
    model.openrouter_price?.per_second,
    model.openrouter_price?.per_token,
  ]
  const conditions = new Set<VideoRateCondition>()
  const resolutions: string[] = []
  for (const list of [...gatewayLists, ...referenceLists]) {
    for (const entry of list ?? []) {
      if (entry.condition && isVideoRateCondition(entry.condition)) {
        conditions.add(entry.condition)
      }
    }
  }
  const columnSource = gatewayLists.some((list) => list?.length)
    ? gatewayLists
    : referenceLists
  for (const list of columnSource) {
    for (const entry of list ?? []) {
      if (!resolutions.includes(entry.size)) resolutions.push(entry.size)
    }
  }
  return {
    conditions: VIDEO_RATE_CONDITIONS.filter((condition) =>
      conditions.has(condition)
    ),
    resolutions,
  }
}

/**
 * Whether the drawer has a per-token grid to show for a video model: an
 * admin-defined layout, or per-token prices from any source. Without either
 * the ordinary token table reads better than an empty grid.
 */
export function hasVideoTokenPrices(model: PricingModel): boolean {
  if (model.video_grid) return true
  return [
    model.video_token_prices,
    model.official_price?.per_token,
    model.openrouter_price?.per_token,
  ].some((list) => (list?.length ?? 0) > 0)
}
