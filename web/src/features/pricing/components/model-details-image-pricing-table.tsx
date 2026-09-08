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
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import {
  formatLandingPrice,
  LANDING_PRICE_PLACEHOLDER,
} from '@/features/home/landing/lib/pricing'
import { lookupServiceTier } from '@/lib/service-tier'

import { QUOTA_TYPE_VALUES } from '../constants'
import {
  getAvailableGroups,
  getConfiguredGroupRatio,
} from '../lib/model-helpers'
import { tryParsePerRequestConfig } from '../lib/per-request-expr'
import type { ImageSizePrice, PricingModel } from '../types'

/**
 * The /Pic view of an image model's prices, as the design lays it out: one
 * column per listed size, one row per plan the viewer can use, closed by the
 * external list prices for the same sizes.
 *
 * The gateway's per-image list (kept beside the benchmark prices, at ratio 1)
 * scales by each plan's group ratio, exactly like the per-token table. A
 * per-call image model without such a list states its per-call price as a
 * single "per image" column. A model that charges for input images (xAI's
 * "media input") opens with that per-image charge: the gateway's from its
 * admin-maintained row, else straight from its per-request expression; the
 * reference sources' from their rows.
 */
export function ModelDetailsImagePricingTable(props: {
  model: PricingModel
  groupRatio: Record<string, number>
  usableGroup: Record<string, { desc: string; ratio: number }>
}) {
  const { t } = useTranslation()
  const model = props.model

  const groups = useMemo(
    () => getAvailableGroups(model, props.usableGroup || {}),
    [model, props.usableGroup]
  )

  // The admin-entered gateway charge wins; otherwise only the canonical
  // per-request form carries a readable input-image charge, and a
  // hand-written expression contributes nothing.
  const inputImageUSD = useMemo(() => {
    const listed = model.image_input_price
    if (typeof listed === 'number' && listed > 0) return listed
    if (model.billing_mode !== 'tiered_expr' || !model.billing_expr) {
      return undefined
    }
    const price = Number(
      tryParsePerRequestConfig(model.billing_expr)?.inputImagePrice
    )
    return Number.isFinite(price) && price > 0 ? price : undefined
  }, [model.image_input_price, model.billing_mode, model.billing_expr])

  const listed = (model.image_prices ?? []).filter(
    (entry) => Number.isFinite(entry.price) && entry.price > 0
  )
  const isPerCall =
    model.quota_type === QUOTA_TYPE_VALUES.REQUEST &&
    (model.model_price ?? 0) > 0
  const gatewayPrices: ImageSizePrice[] =
    listed.length > 0 || !isPerCall
      ? listed
      : [{ size: t('Per image'), price: model.model_price ?? 0 }]

  if (gatewayPrices.length === 0) {
    return (
      <p className='text-sm text-(--pd-muted-2)'>
        {t('No per-image prices are configured for this model.')}
      </p>
    )
  }

  if (groups.length === 0) {
    return (
      <p className='text-sm text-(--pd-muted-2)'>
        {t(
          'This model is not available in any group, or no group pricing information is configured.'
        )}
      </p>
    )
  }

  const referenceRows = [
    {
      key: 'official',
      label: 'Direct First-Party API',
      prices: model.official_price?.per_image,
      inputPrice: model.official_price?.per_image_input,
    },
    {
      key: 'openrouter',
      label: 'OpenRouter First-Party',
      prices: model.openrouter_price?.per_image,
      inputPrice: model.openrouter_price?.per_image_input,
    },
  ].flatMap((row) =>
    row.prices && row.prices.length > 0 ? [{ ...row, prices: row.prices }] : []
  )
  const showInputImage =
    inputImageUSD !== undefined ||
    referenceRows.some(
      (row) => typeof row.inputPrice === 'number' && row.inputPrice > 0
    )

  const headCellClass =
    'px-2.5 py-3 text-[11px] font-semibold whitespace-nowrap text-(--pd-muted-2)'
  const cellClass = 'px-2.5 py-3 align-middle'

  return (
    <div className='overflow-x-auto rounded-[10px] border border-(--pd-border)'>
      <table className='w-full min-w-max border-collapse text-left'>
        <thead className='border-b border-(--pd-border) bg-(--pd-surface-muted)'>
          <tr>
            <th scope='col' className={headCellClass}>
              {t('Service')}
            </th>
            {showInputImage && (
              <th scope='col' className={`${headCellClass} text-right`}>
                {t('Input image')}
              </th>
            )}
            {gatewayPrices.map((entry) => (
              <th
                key={entry.size}
                scope='col'
                className={`${headCellClass} text-right`}
              >
                {entry.size}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => {
            const ratio = getConfiguredGroupRatio(props.groupRatio, group)
            const known = lookupServiceTier(group)
            return (
              <tr
                key={group}
                className='border-t border-(--pd-border) first:border-t-0'
              >
                <th
                  scope='row'
                  className={`${cellClass} text-left text-xs font-medium whitespace-nowrap text-(--pd-ink)`}
                >
                  {known ? t(known.label) : group}
                </th>
                {showInputImage && (
                  <td
                    className={`${cellClass} text-right font-mono text-xs font-medium text-(--pd-ink)`}
                  >
                    {inputImageUSD === undefined
                      ? LANDING_PRICE_PLACEHOLDER
                      : formatLandingPrice(inputImageUSD * ratio)}
                  </td>
                )}
                {gatewayPrices.map((entry) => (
                  <td
                    key={entry.size}
                    className={`${cellClass} text-right font-mono text-xs font-medium text-(--pd-ink)`}
                  >
                    {formatLandingPrice(entry.price * ratio)}
                  </td>
                ))}
              </tr>
            )
          })}

          {referenceRows.map((row) => {
            // Matched by size label, so a source that lists a size the
            // gateway does not (or vice versa) shows a dash, never a
            // neighbouring size's price.
            const bySize = new Map(
              row.prices.map((entry) => [entry.size, entry.price])
            )
            return (
              <tr
                key={row.key}
                className='border-t border-(--pd-border) bg-(--pd-surface-alt)'
              >
                <th
                  scope='row'
                  className={`${cellClass} text-left font-normal`}
                >
                  <span className='flex flex-col'>
                    <span className='text-xs font-medium whitespace-nowrap text-(--pd-muted)'>
                      {t(row.label)}
                    </span>
                    <span className='text-[9px] text-(--pd-faint)'>
                      {t('Reference')}
                    </span>
                  </span>
                </th>
                {showInputImage && (
                  <td
                    className={`${cellClass} text-right font-mono text-xs text-(--pd-faint)`}
                  >
                    {typeof row.inputPrice === 'number' && row.inputPrice > 0
                      ? formatLandingPrice(row.inputPrice)
                      : LANDING_PRICE_PLACEHOLDER}
                  </td>
                )}
                {gatewayPrices.map((entry) => {
                  const price = bySize.get(entry.size)
                  return (
                    <td
                      key={entry.size}
                      className={`${cellClass} text-right font-mono text-xs text-(--pd-faint)`}
                    >
                      {price === undefined
                        ? LANDING_PRICE_PLACEHOLDER
                        : formatLandingPrice(price)}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
