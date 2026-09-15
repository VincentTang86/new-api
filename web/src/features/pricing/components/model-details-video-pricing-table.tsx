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

import { QUOTA_TYPE_VALUES, TOKEN_UNIT_DIVISORS } from '../constants'
import {
  getAvailableGroups,
  getConfiguredGroupRatio,
} from '../lib/model-helpers'
import {
  priceAt,
  resolveVideoGrid,
  VIDEO_RATE_CONDITION_LABELS,
} from '../lib/video-grid'
import type {
  ImageSizePrice,
  PricingModel,
  TokenUnit,
  VideoRateCondition,
} from '../types'

/**
 * The /Sec and /Token views of a video model's prices, as the design lays
 * them out: one column per resolution, and under every service one row per
 * rate condition the admin split the grid on (or a single row when none), the
 * plans first, then the external list prices for the same cells.
 *
 * Both views read the same admin-entered grid; only the unit differs. The
 * gateway's prices (kept beside the benchmark prices, at ratio 1) scale by
 * each plan's group ratio, the reference sources' never do, and a cell nobody
 * has priced shows a dash — never a figure borrowed from another cell or
 * inferred from our own billing multipliers. A per-call model without listed
 * prices states its clip price as a single "per video" column, since a clip's
 * price is not a per-second price.
 */
export function ModelDetailsVideoPricingTable(props: {
  model: PricingModel
  groupRatio: Record<string, number>
  usableGroup: Record<string, { desc: string; ratio: number }>
  unit: 'second' | 'token'
  /** The token unit the /Token view divides by; ignored per second. */
  tokenUnit?: TokenUnit
}) {
  const { t } = useTranslation()
  const model = props.model
  const perSecond = props.unit === 'second'

  const groups = useMemo(
    () => getAvailableGroups(model, props.usableGroup || {}),
    [model, props.usableGroup]
  )
  const grid = useMemo(() => resolveVideoGrid(model), [model])

  const showConditions = grid.conditions.length > 0
  const conditions: readonly (VideoRateCondition | '')[] = showConditions
    ? grid.conditions
    : ['']

  let columns = grid.resolutions
  let gatewayPrices: readonly ImageSizePrice[] =
    (perSecond ? model.video_prices : model.video_token_prices) ?? []
  const isPerCall =
    model.quota_type === QUOTA_TYPE_VALUES.REQUEST &&
    (model.model_price ?? 0) > 0
  if (perSecond && columns.length === 0 && isPerCall) {
    const label = t('Per video')
    columns = [label]
    gatewayPrices = [{ size: label, price: model.model_price ?? 0 }]
  }

  if (columns.length === 0) {
    return (
      <p className='text-sm text-(--pd-muted-2)'>
        {perSecond
          ? t('No per-second prices are configured for this model.')
          : t('No per-token prices are configured for this model.')}
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

  const divisor = perSecond ? 1 : TOKEN_UNIT_DIVISORS[props.tokenUnit ?? 'M']
  const referenceRows = [
    {
      key: 'official',
      label: 'Direct First-Party API',
      prices: perSecond
        ? model.official_price?.per_second
        : model.official_price?.per_token,
    },
    {
      key: 'openrouter',
      label: 'OpenRouter First-Party',
      prices: perSecond
        ? model.openrouter_price?.per_second
        : model.openrouter_price?.per_token,
    },
  ].flatMap((row) =>
    row.prices && row.prices.length > 0 ? [{ ...row, prices: row.prices }] : []
  )

  const headCellClass =
    'px-2.5 py-3 text-[11px] font-semibold whitespace-nowrap text-(--pd-muted-2)'
  const cellClass = 'px-2.5 py-3 align-middle'
  const conditionCellClass = `${cellClass} text-xs whitespace-nowrap text-(--pd-muted-2)`

  const priceCell = (price: number | undefined, ratio: number) =>
    price === undefined
      ? LANDING_PRICE_PLACEHOLDER
      : formatLandingPrice((price * ratio) / divisor)

  return (
    <div className='overflow-x-auto rounded-[10px] border border-(--pd-border)'>
      <table className='w-full min-w-max border-collapse text-left'>
        <thead className='border-b border-(--pd-border) bg-(--pd-surface-muted)'>
          <tr>
            <th scope='col' className={headCellClass}>
              {t('Service')}
            </th>
            {showConditions && (
              <th scope='col' className={headCellClass}>
                {t('Rate Conditions')}
              </th>
            )}
            {columns.map((resolution) => (
              <th
                key={resolution}
                scope='col'
                className={`${headCellClass} text-right`}
              >
                {resolution}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => {
            const ratio = getConfiguredGroupRatio(props.groupRatio, group)
            const known = lookupServiceTier(group)
            return conditions.map((condition, index) => (
              <tr
                key={`${group}-${condition}`}
                className={
                  index === 0
                    ? 'border-t border-(--pd-border) first:border-t-0'
                    : ''
                }
              >
                {index === 0 && (
                  <th
                    scope='row'
                    rowSpan={conditions.length}
                    className={`${cellClass} text-left text-xs font-medium whitespace-nowrap text-(--pd-ink)`}
                  >
                    {known ? t(known.label) : group}
                  </th>
                )}
                {condition && (
                  <td className={conditionCellClass}>
                    {t(VIDEO_RATE_CONDITION_LABELS[condition])}
                  </td>
                )}
                {columns.map((resolution) => (
                  <td
                    key={resolution}
                    className={`${cellClass} text-right font-mono text-xs font-medium text-(--pd-ink)`}
                  >
                    {priceCell(
                      priceAt(gatewayPrices, resolution, condition),
                      ratio
                    )}
                  </td>
                ))}
              </tr>
            ))
          })}

          {referenceRows.map((row) =>
            conditions.map((condition, index) => (
              <tr
                key={`${row.key}-${condition}`}
                className={`bg-(--pd-surface-alt) ${
                  index === 0 ? 'border-t border-(--pd-border)' : ''
                }`}
              >
                {index === 0 && (
                  <th
                    scope='row'
                    rowSpan={conditions.length}
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
                )}
                {condition && (
                  <td className={conditionCellClass}>
                    {t(VIDEO_RATE_CONDITION_LABELS[condition])}
                  </td>
                )}
                {columns.map((resolution) => (
                  <td
                    key={resolution}
                    className={`${cellClass} text-right font-mono text-xs text-(--pd-faint)`}
                  >
                    {priceCell(priceAt(row.prices, resolution, condition), 1)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
