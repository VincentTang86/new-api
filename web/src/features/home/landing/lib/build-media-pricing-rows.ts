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
import { QUOTA_TYPE_VALUES } from '@/features/pricing/constants'
import {
  getConfiguredGroupRatio,
  isImageModel,
  isVideoModel,
} from '@/features/pricing/lib/model-helpers'
import type { ImageSizePrice, PricingModel } from '@/features/pricing/types'

import type { MediaPricingRow, PricingBenchmark } from '../types'
import { isModelInGroup, resolveProviderKey } from './build-pricing-rows'
import {
  LANDING_PRICE_PLACEHOLDER,
  calculateSavingsRatio,
  formatLandingPrice,
  formatSavingsPercent,
} from './pricing'

/** Which media catalogue to build: the Image tab or the Video tab. */
export type MediaPricingKind = 'image' | 'video'

interface BuildMediaPricingRowsParams {
  models: readonly PricingModel[]
  kind: MediaPricingKind
  language?: string
  /** Group tab the visitor selected; '' prices at ratio 1 with no filtering. */
  selectedGroup: string
  /** `group_ratio` map from /api/pricing. */
  groupRatio: Record<string, number>
  /** "Compare with" source the benchmark column shows. */
  benchmark: PricingBenchmark
}

function cheapest(
  prices: readonly ImageSizePrice[] | undefined
): ImageSizePrice | undefined {
  let best: ImageSizePrice | undefined
  for (const entry of prices ?? []) {
    if (!Number.isFinite(entry.price) || entry.price <= 0) continue
    if (!best || entry.price < best.price) best = entry
  }
  return best
}

/**
 * The Image and Video tabs' rows: every media model the selected group can
 * call, priced "from" its cheapest listed tier. The gateway's list prices
 * (kept beside the benchmark prices, at ratio 1) scale by the group ratio like
 * every other price on the page; a per-call model without such a list falls
 * back to its per-call price. The benchmark column states the same tier's
 * price from the selected source, so the saving compares like with like —
 * when the source does not list that tier, its cheapest price is shown but no
 * saving is claimed.
 *
 * Each row carries the unit its prices are stated in. A per-call video model
 * (MiniMax-H3, grok-imagine-video) prices the whole clip, so its row reads
 * "/ video": passing that figure off as a per-second price would understate it
 * by however many seconds the clip runs.
 */
export function buildMediaPricingRows(
  params: BuildMediaPricingRowsParams
): MediaPricingRow[] {
  const ratio = params.selectedGroup
    ? getConfiguredGroupRatio(params.groupRatio, params.selectedGroup)
    : 1
  const isVideo = params.kind === 'video'

  const rows = params.models
    .filter((model) => (isVideo ? isVideoModel(model) : isImageModel(model)))
    .filter((model) => isModelInGroup(model, params.selectedGroup))
    .map((model): MediaPricingRow => {
      const displayName = model.display_name?.trim()
      const base = {
        modelId: model.model_name,
        name: displayName || model.model_name,
        provider: resolveProviderKey(model.vendor_name, model.model_name),
        vendorLabel: model.vendor_name || displayName || model.model_name,
      }

      const listed = cheapest(
        isVideo ? model.video_prices : model.image_prices
      )
      let size = ''
      let unit: MediaPricingRow['unit'] = isVideo ? 'second' : 'image'
      let frUSD: number | undefined
      if (listed) {
        size = listed.size
        frUSD = listed.price * ratio
      } else if (
        model.quota_type === QUOTA_TYPE_VALUES.REQUEST &&
        (model.model_price ?? 0) > 0
      ) {
        frUSD = (model.model_price ?? 0) * ratio
        if (isVideo) unit = 'video'
      }

      const source =
        params.benchmark === 'official'
          ? model.official_price
          : model.openrouter_price
      const benchmarkList =
        (isVideo ? source?.per_second : source?.per_image) ?? []
      const sameSize = size
        ? benchmarkList.find((entry) => entry.size === size)
        : cheapest(benchmarkList)
      const benchmarkUSD = sameSize?.price ?? cheapest(benchmarkList)?.price

      let savings = LANDING_PRICE_PLACEHOLDER
      if (frUSD !== undefined && sameSize && sameSize.price > 0) {
        const saved = calculateSavingsRatio(frUSD, sameSize.price)
        if (saved !== null) {
          savings = formatSavingsPercent(saved, params.language)
        }
      }

      return {
        ...base,
        unit,
        size,
        frPrice: formatLandingPrice(frUSD),
        benchmarkPrice: formatLandingPrice(benchmarkUSD),
        savings,
      }
    })

  return rows.sort((a, b) =>
    a.name.localeCompare(b.name, 'en', { numeric: true, sensitivity: 'base' })
  )
}
