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

import { TOKEN_UNIT_DIVISORS } from '../constants'
import { BILLING_PRICING_VARS, type ParsedTier } from '../lib/billing-expr'
import {
  getDynamicPricingTiers,
  isDynamicPricingModel,
} from '../lib/dynamic-price'
import {
  getAvailableGroups,
  getConfiguredGroupRatio,
  isTokenBasedModel,
} from '../lib/model-helpers'
import { tokenPriceUSD } from '../lib/price'
import type {
  PriceType,
  PricingModel,
  ReferencePriceLanes,
  TokenUnit,
} from '../types'

/**
 * One priced quantity, rendered as a column. `staticType` reads the model's
 * ratio fields, `tierField` reads the parsed billing expression — a model uses
 * one source or the other, never both.
 */
interface PriceColumn {
  id: string
  label: string
  staticType?: PriceType
  tierField?: string
  /** Which reference-price lane states the same quantity, when one does. */
  referenceLane?: keyof ReferencePriceLanes
}

/**
 * Static (ratio-configured) models price the same quantities the billing
 * expression names, so both paths label their columns the same way.
 */
const STATIC_COLUMNS: readonly (PriceColumn & { staticType: PriceType })[] = [
  { id: 'input', label: 'Input', staticType: 'input', referenceLane: 'input' },
  {
    id: 'output',
    label: 'Output',
    staticType: 'output',
    referenceLane: 'output',
  },
  {
    id: 'cache',
    label: 'Cache Read',
    staticType: 'cache',
    referenceLane: 'cached_input',
  },
  {
    id: 'create_cache',
    label: 'Cache Write',
    staticType: 'create_cache',
    referenceLane: 'cache_creation',
  },
  { id: 'image', label: 'Image In', staticType: 'image' },
  { id: 'audio_input', label: 'Audio In', staticType: 'audio_input' },
  { id: 'audio_output', label: 'Audio Out', staticType: 'audio_output' },
]

/** Reference lane each expression variable states, where they line up. */
const TIER_FIELD_REFERENCE_LANES: Record<string, keyof ReferencePriceLanes> = {
  inputPrice: 'input',
  outputPrice: 'output',
  cacheReadPrice: 'cached_input',
  cacheCreatePrice: 'cache_creation',
}

/**
 * Time functions a billing expression uses to price by hour or weekday. Their
 * presence is what makes the peak-hours footnote true for a model.
 */
const TIME_AWARE_EXPR_PATTERN = /\b(?:hour|minute|weekday|month|day)\s*\(/

/** The single rate condition a model without a tiered expression bills on. */
const STANDARD_RATE_CONDITION: ParsedTier = { label: '', conditions: [] }

function referencePrice(
  lanes: ReferencePriceLanes | undefined,
  lane: keyof ReferencePriceLanes | undefined
): number {
  if (!lanes || !lane) return Number.NaN
  const value = lanes[lane]
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return Number.NaN
  }
  return value
}

/**
 * The model's prices, as the design lays them out: one table whose rows are
 * every plan the viewer can use crossed with every rate condition the billing
 * expression defines, closed by the external list prices the catalogue
 * compares against.
 *
 * Prices are stated in USD per token unit, like the catalogue table this drawer
 * opens from — the two must never disagree about the same model.
 */
export function ModelDetailsPricingTable(props: {
  model: PricingModel
  groupRatio: Record<string, number>
  usableGroup: Record<string, { desc: string; ratio: number }>
  tokenUnit: TokenUnit
}) {
  const { t } = useTranslation()
  const model = props.model

  const groups = useMemo(
    () => getAvailableGroups(model, props.usableGroup || {}),
    [model, props.usableGroup]
  )
  const tiers = useMemo(
    () => (isDynamicPricingModel(model) ? getDynamicPricingTiers(model) : []),
    [model]
  )

  // Quantities the model does not price are dropped, so a model without cache
  // rates shows no cache columns rather than a column of dashes.
  const columns = useMemo<PriceColumn[]>(() => {
    if (tiers.length > 0) {
      return BILLING_PRICING_VARS.flatMap((variable) => {
        const field = variable.field
        if (!field) return []
        const priced = tiers.some((tier) => {
          const value = Number(tier[field])
          return Number.isFinite(value) && value > 0
        })
        if (!priced) return []
        return [
          {
            id: field,
            label: variable.shortLabel,
            tierField: field,
            referenceLane: TIER_FIELD_REFERENCE_LANES[field],
          },
        ]
      })
    }
    return STATIC_COLUMNS.filter((column) =>
      Number.isFinite(tokenPriceUSD(model, column.staticType, 1))
    )
  }, [model, tiers])

  const isTokenBased = isTokenBasedModel(model)
  const divisor = TOKEN_UNIT_DIVISORS[props.tokenUnit]
  const unitLabel = props.tokenUnit === 'K' ? '1K' : '1M'

  // A tiered expression the parser cannot break into tiers still bills; the
  // drawer must say so rather than render an empty table.
  if (isDynamicPricingModel(model) && tiers.length === 0) {
    return (
      <div className='rounded-[10px] border border-amber-200/70 bg-amber-50/70 p-3 dark:border-amber-500/20 dark:bg-amber-500/10'>
        <div className='text-sm font-medium text-amber-800 dark:text-amber-200'>
          {t('Special billing expression')}
        </div>
        <p className='mt-1 text-xs text-(--pd-muted-2)'>
          {t('Unable to parse structured pricing')}
        </p>
        <code className='mt-3 block max-h-28 overflow-auto rounded-md border border-(--pd-border) bg-(--pd-surface) px-2 py-1.5 font-mono text-xs break-all text-(--pd-muted-2)'>
          {model.billing_expr}
        </code>
      </div>
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

  const rateConditions = tiers.length > 0 ? tiers : [STANDARD_RATE_CONDITION]
  // 按张计费的图片输入费是在按次价之外叠加的，与分组倍率一同缩放。
  const imageInputPrice = model.image_input_price || 0
  const referenceRows = [
    {
      key: 'official',
      label: 'Direct First-Party API',
      lanes: model.official_price,
    },
    {
      key: 'openrouter',
      label: 'OpenRouter First-Party',
      lanes: model.openrouter_price,
    },
  ].filter((row) => Boolean(row.lanes))

  const headCellClass =
    'px-2.5 py-3 text-[11px] font-semibold whitespace-nowrap text-(--pd-muted-2)'
  const cellClass = 'px-2.5 py-3 align-middle'
  const priceCellClass = `${cellClass} text-right font-mono text-xs font-medium text-(--pd-ink)`

  const cellPrice = (column: PriceColumn, tier: ParsedTier, ratio: number) => {
    if (column.tierField) {
      const value = Number(tier[column.tierField])
      if (!Number.isFinite(value) || value <= 0) {
        return LANDING_PRICE_PLACEHOLDER
      }
      return formatLandingPrice((value * ratio) / divisor)
    }
    return formatLandingPrice(
      tokenPriceUSD(model, column.staticType as PriceType, ratio) / divisor
    )
  }

  return (
    <div className='overflow-x-auto rounded-[10px] border border-(--pd-border)'>
      <table className='w-full min-w-max border-collapse text-left'>
        <thead className='border-b border-(--pd-border) bg-(--pd-surface-muted)'>
          <tr>
            <th scope='col' className={headCellClass}>
              {t('Plan')}
            </th>
            {isTokenBased && (
              <th scope='col' className={headCellClass}>
                {t('Rate Conditions')}
              </th>
            )}
            {isTokenBased ? (
              columns.map((column) => (
                <th
                  key={column.id}
                  scope='col'
                  className={`${headCellClass} text-right`}
                >
                  {t(column.label)}/{unitLabel}
                </th>
              ))
            ) : (
              <th scope='col' className={`${headCellClass} text-right`}>
                {t('Price')}
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => {
            const ratio = getConfiguredGroupRatio(props.groupRatio, group)
            const known = lookupServiceTier(group)

            return rateConditions.map((tier, tierIndex) => (
              <tr
                key={`${group}-${tier.label || tierIndex}`}
                className={
                  tierIndex === 0
                    ? 'border-t border-(--pd-border) first:border-t-0'
                    : 'border-t border-(--pd-border-soft)'
                }
              >
                {tierIndex === 0 && (
                  <th
                    scope='row'
                    rowSpan={rateConditions.length}
                    className={`${cellClass} text-left text-xs font-medium whitespace-nowrap text-(--pd-ink)`}
                  >
                    {known ? t(known.label) : group}
                  </th>
                )}
                {isTokenBased && (
                  <td
                    className={`${cellClass} text-xs whitespace-nowrap text-(--pd-muted)`}
                  >
                    {tier.label || t('Standard')}
                  </td>
                )}
                {isTokenBased ? (
                  columns.map((column) => (
                    <td key={column.id} className={priceCellClass}>
                      {cellPrice(column, tier, ratio)}
                    </td>
                  ))
                ) : (
                  <td className={priceCellClass}>
                    <span className='flex flex-col items-end gap-0.5'>
                      <span>
                        {t('{{price}} / call', {
                          price: formatLandingPrice(
                            (model.model_price || 0) * ratio
                          ),
                        })}
                      </span>
                      {imageInputPrice > 0 && (
                        <span className='text-[10px] font-normal text-(--pd-muted-2)'>
                          {t('+ {{price}} / image', {
                            price: formatLandingPrice(imageInputPrice * ratio),
                          })}
                        </span>
                      )}
                    </span>
                  </td>
                )}
              </tr>
            ))
          })}

          {isTokenBased &&
            referenceRows.map((row) => (
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
                <td
                  className={`${cellClass} text-xs whitespace-nowrap text-(--pd-faint)`}
                >
                  {t('Standard')}
                </td>
                {columns.map((column) => (
                  <td
                    key={column.id}
                    className={`${cellClass} text-right font-mono text-xs text-(--pd-faint)`}
                  >
                    {formatLandingPrice(
                      referencePrice(row.lanes, column.referenceLane) / divisor
                    )}
                  </td>
                ))}
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  )
}

/**
 * The notes under the table. The time-of-day note only holds for a model whose
 * expression actually prices by time, so it is rendered from the expression
 * rather than stated unconditionally.
 */
export function ModelDetailsPricingNotes(props: {
  model: PricingModel
  tokenUnit: TokenUnit
}) {
  const { t } = useTranslation()
  const isTimeAware =
    isDynamicPricingModel(props.model) &&
    TIME_AWARE_EXPR_PATTERN.test(props.model.billing_expr || '')
  const hasReference = Boolean(
    props.model.official_price || props.model.openrouter_price
  )

  return (
    <div className='space-y-0.5 text-[11px] leading-relaxed text-(--pd-faint)'>
      <p>
        {t('Prices are shown in USD per {{unit}} tokens.', {
          unit: props.tokenUnit === 'K' ? '1K' : '1M',
        })}
      </p>
      {hasReference && (
        <p>
          {t(
            "Reference rates come from the source's public model listings and are not billed by this gateway."
          )}
        </p>
      )}
      {isTimeAware && (
        <p>
          {t(
            'This model prices by time of day; the rate condition that applies is decided when the request arrives.'
          )}
        </p>
      )}
    </div>
  )
}
