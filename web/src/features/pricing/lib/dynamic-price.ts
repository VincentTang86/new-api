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
import { formatBillingCurrencyFromUSD } from '@/lib/currency'

import { TOKEN_UNIT_DIVISORS } from '../constants'
import type { PricingModel, TokenUnit } from '../types'
import {
  MATCH_EQ,
  MATCH_GTE,
  MATCH_LT,
  MATCH_RANGE,
  parseTiersFromExpr,
  splitBillingExprAndRequestRules,
  tryParseRequestRuleExpr,
  type ParsedTier,
  type TimeCondition,
  type TimeFunc,
} from './billing-expr'
import { getDisplayGroupRatio } from './model-helpers'

type DynamicPriceOptions = {
  tokenUnit: TokenUnit
  showRechargePrice?: boolean
  priceRate?: number
  usdExchangeRate?: number
  groupRatioMultiplier?: number
}

export function isDynamicPricingModel(model: PricingModel): boolean {
  return model.billing_mode === 'tiered_expr' && Boolean(model.billing_expr)
}

export function getDynamicDisplayGroupRatio(
  model: PricingModel,
  selectedGroup?: string
): number {
  return getDisplayGroupRatio(model, selectedGroup)
}

function applyRechargeRate(
  price: number,
  showWithRecharge: boolean,
  priceRate: number,
  usdExchangeRate: number
): number {
  if (!showWithRecharge) return price
  return (price * priceRate) / usdExchangeRate
}

export function formatDynamicUnitPrice(
  valuePerMillionTokens: number,
  options: DynamicPriceOptions
): string {
  const groupRatio = options.groupRatioMultiplier ?? 1
  const priceRate = options.priceRate ?? 1
  const usdExchangeRate = options.usdExchangeRate ?? 1
  const priceUSD =
    (valuePerMillionTokens * groupRatio) /
    TOKEN_UNIT_DIVISORS[options.tokenUnit]
  const displayPrice = applyRechargeRate(
    priceUSD,
    options.showRechargePrice ?? false,
    priceRate,
    usdExchangeRate
  )

  return formatBillingCurrencyFromUSD(displayPrice, {
    digitsLarge: 4,
    digitsSmall: 6,
    abbreviate: false,
  })
}

export function getDynamicPricingTiers(model: PricingModel): ParsedTier[] {
  if (!isDynamicPricingModel(model)) return []
  const { billingExpr } = splitBillingExprAndRequestRules(
    model.billing_expr || ''
  )
  return parseTiersFromExpr(billingExpr)
}

export function hasDynamicRequestRules(model: PricingModel): boolean {
  if (!isDynamicPricingModel(model)) return false
  const { requestRuleExpr } = splitBillingExprAndRequestRules(
    model.billing_expr || ''
  )
  return Boolean(tryParseRequestRuleExpr(requestRuleExpr || '')?.length)
}

// ---------------------------------------------------------------------------
// Time-conditional rate variants (peak / off-peak pricing)
// ---------------------------------------------------------------------------

type Translate = (key: string) => string

/**
 * One price row a time-conditional multiplier produces: the base rate
 * (multiplier 1, no windows) or a surcharged/discounted rate that applies
 * inside the listed time windows.
 */
export type TimeRateVariant = {
  /** i18n key naming the rate ('Peak Hours' / 'Off-Peak Hours' / 'Standard') */
  labelKey: string
  multiplier: number
  /**
   * Two same-labeled variants ("Peak Hours ×2" vs "×3") must state their
   * multiplier to stay distinguishable; a lone one reads cleaner without it.
   */
  showMultiplier: boolean
  /** Time windows this multiplier applies in; empty for the base rate. */
  windows: TimeCondition[][]
}

/**
 * Materializes purely time-conditional request rules ("×2 on weekday
 * mornings") as displayable rate rows, the way the design states peak and
 * off-peak prices. Returns [] when the model has no request rules or when any
 * rule also reads request params/headers — such a rule cannot be stated as a
 * price row because it varies per request, so callers fall back to the
 * generic time-aware footnote.
 */
export function getTimeRateVariants(model: PricingModel): TimeRateVariant[] {
  if (!isDynamicPricingModel(model)) return []
  const { requestRuleExpr } = splitBillingExprAndRequestRules(
    model.billing_expr || ''
  )
  const groups = tryParseRequestRuleExpr(requestRuleExpr || '')
  if (!groups || groups.length === 0) return []

  const windowsByMultiplier = new Map<number, TimeCondition[][]>()
  for (const group of groups) {
    const conditions = group.conditions || []
    if (conditions.length === 0) return []
    if (!conditions.every((c) => c.source === 'time')) return []
    const multiplier = Number(group.multiplier)
    if (!Number.isFinite(multiplier) || multiplier <= 0) return []
    if (multiplier === 1) continue
    const windows = windowsByMultiplier.get(multiplier) || []
    windows.push(conditions as TimeCondition[])
    windowsByMultiplier.set(multiplier, windows)
  }
  if (windowsByMultiplier.size === 0) return []

  const multipliers = [...windowsByMultiplier.keys()]
  const surchargeCount = multipliers.filter((m) => m > 1).length
  const discountCount = multipliers.filter((m) => m < 1).length

  const variants: TimeRateVariant[] = multipliers.map((multiplier) => ({
    labelKey: multiplier > 1 ? 'Peak Hours' : 'Off-Peak Hours',
    multiplier,
    showMultiplier: (multiplier > 1 ? surchargeCount : discountCount) > 1,
    windows: windowsByMultiplier.get(multiplier) as TimeCondition[][],
  }))
  // The base rate is what the windows are priced against: it is the off-peak
  // rate when every window surcharges, the peak rate when every window
  // discounts, and just "Standard" in the mixed case.
  let baseLabelKey = 'Standard'
  if (discountCount === 0) baseLabelKey = 'Off-Peak Hours'
  else if (surchargeCount === 0) baseLabelKey = 'Peak Hours'
  variants.push({
    labelKey: baseLabelKey,
    multiplier: 1,
    showMultiplier: false,
    windows: [],
  })
  // Most expensive first, the way the design orders Peak above Off-Peak.
  variants.sort((a, b) => b.multiplier - a.multiplier)
  return variants
}

export function timeRateVariantLabel(
  variant: TimeRateVariant,
  t: Translate
): string {
  const label = t(variant.labelKey)
  return variant.showMultiplier ? `${label} ×${variant.multiplier}` : label
}

// ---------------------------------------------------------------------------
// Time-window formatting ("Mon–Fri 09:00–12:00 (Asia/Shanghai)")
// ---------------------------------------------------------------------------

const TIME_FUNC_ORDER: TimeFunc[] = [
  'weekday',
  'month',
  'day',
  'hour',
  'minute',
]
const TIME_FUNC_LABEL_KEYS: Record<TimeFunc, string> = {
  hour: 'Hour',
  minute: 'Minute',
  weekday: 'Weekday',
  month: 'Month',
  day: 'Day',
}
const WEEKDAY_LABEL_KEYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const TIME_OP_SYMBOLS: Record<string, string> = {
  [MATCH_EQ]: '=',
  [MATCH_GTE]: '≥',
  [MATCH_LT]: '<',
}

function hourText(value: string): string {
  const n = Number(value)
  return Number.isFinite(n) ? `${String(n).padStart(2, '0')}:00` : `${value}:00`
}

function weekdayText(value: number, t: Translate): string {
  const key = WEEKDAY_LABEL_KEYS[value]
  return key ? t(key) : String(value)
}

/** The literal condition, for window shapes with no friendlier reading. */
function describeTimeCondition(cond: TimeCondition, t: Translate): string {
  const label = t(TIME_FUNC_LABEL_KEYS[cond.timeFunc] || cond.timeFunc)
  if (cond.mode === MATCH_RANGE) {
    return `${label} ${cond.rangeStart}~${cond.rangeEnd}`
  }
  return `${label} ${TIME_OP_SYMBOLS[cond.mode] || '='} ${cond.value}`
}

/**
 * One window's conditions as a phrase: weekday bounds become a day range,
 * hour bounds a clock range, so `weekday ≥ 1 && weekday < 6 && hour ≥ 9 &&
 * hour < 12` reads "Mon–Fri 09:00–12:00". Shapes with no such reading keep
 * their literal form rather than being dropped.
 */
export function formatTimeWindow(
  conditions: TimeCondition[],
  t: Translate
): string {
  const byFunc = new Map<TimeFunc, TimeCondition[]>()
  for (const cond of conditions) {
    const list = byFunc.get(cond.timeFunc) || []
    list.push(cond)
    byFunc.set(cond.timeFunc, list)
  }

  const parts: string[] = []
  for (const func of TIME_FUNC_ORDER) {
    const conds = byFunc.get(func)
    if (!conds) continue
    const single = conds.length === 1 ? conds[0] : null
    const gte = conds.find((c) => c.mode === MATCH_GTE)
    const lt = conds.find((c) => c.mode === MATCH_LT)

    if (func === 'hour') {
      if (single?.mode === MATCH_EQ) {
        parts.push(hourText(single.value))
        continue
      }
      if (single?.mode === MATCH_RANGE) {
        parts.push(
          `${hourText(single.rangeStart)}–${hourText(single.rangeEnd)}`
        )
        continue
      }
      if (conds.length === 2 && gte && lt) {
        parts.push(`${hourText(gte.value)}–${hourText(lt.value)}`)
        continue
      }
    }
    if (func === 'weekday') {
      if (single?.mode === MATCH_EQ) {
        parts.push(weekdayText(Number(single.value), t))
        continue
      }
      if (conds.length === 2 && gte && lt) {
        const first = Number(gte.value)
        const last = Number(lt.value) - 1
        if (WEEKDAY_LABEL_KEYS[first] && WEEKDAY_LABEL_KEYS[last]) {
          parts.push(
            first === last
              ? weekdayText(first, t)
              : `${weekdayText(first, t)}–${weekdayText(last, t)}`
          )
          continue
        }
      }
    }
    parts.push(conds.map((c) => describeTimeCondition(c, t)).join(' '))
  }
  return parts.join(' ')
}

/** All of a variant's windows, timezone stated once when they agree on it. */
export function formatTimeWindows(
  windows: TimeCondition[][],
  t: Translate
): string {
  const body = windows
    .map((w) => formatTimeWindow(w, t))
    .filter(Boolean)
    .join(', ')
  const timezones = new Set(
    windows
      .flat()
      .map((c) => c.timezone)
      .filter(Boolean)
  )
  if (!body || timezones.size !== 1) return body
  return `${body} (${[...timezones][0]})`
}
