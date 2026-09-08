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
} from '@/features/pricing/lib/model-helpers'
import type { ImageSizePrice, PricingModel } from '@/features/pricing/types'

import type { ImagePricingRow, PricingBenchmark } from '../types'
import { isModelInGroup, resolveProviderKey } from './build-pricing-rows'
import {
  LANDING_PRICE_PLACEHOLDER,
  calculateSavingsRatio,
  formatLandingPrice,
  formatSavingsPercent,
} from './pricing'

interface BuildImagePricingRowsParams {
  models: readonly PricingModel[]
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
 * The Image tab's rows: every image model the selected group can call, priced
 * "from" its cheapest listed size. The gateway's per-image list prices (kept
 * beside the benchmark prices, at ratio 1) scale by the group ratio like every
 * other price on the page; a per-call image model without such a list falls
 * back to its per-call price. The benchmark column states the same size's
 * price from the selected source, so the saving compares like with like —
 * when the source does not list that size, its cheapest price is shown but no
 * saving is claimed.
 */
export function buildImagePricingRows(
  params: BuildImagePricingRowsParams
): ImagePricingRow[] {
  const ratio = params.selectedGroup
    ? getConfiguredGroupRatio(params.groupRatio, params.selectedGroup)
    : 1

  const rows = params.models
    .filter((model) => isImageModel(model))
    .filter((model) => isModelInGroup(model, params.selectedGroup))
    .map((model): ImagePricingRow => {
      const base = {
        modelId: model.model_name,
        name: model.model_name,
        provider: resolveProviderKey(model.vendor_name, model.model_name),
        vendorLabel: model.vendor_name || model.model_name,
      }

      const listed = cheapest(model.image_prices)
      let size = ''
      let frUSD: number | undefined
      if (listed) {
        size = listed.size
        frUSD = listed.price * ratio
      } else if (
        model.quota_type === QUOTA_TYPE_VALUES.REQUEST &&
        (model.model_price ?? 0) > 0
      ) {
        frUSD = (model.model_price ?? 0) * ratio
      }

      const source =
        params.benchmark === 'official'
          ? model.official_price
          : model.openrouter_price
      const benchmarkList = source?.per_image ?? []
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
