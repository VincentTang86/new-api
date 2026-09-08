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
import {
  buildRequestConditionExpr,
  tryParseRequestConditions,
  unwrapOuterParens,
  type RequestCondition,
} from './billing-expr'
import {
  generateExprFromVisualConfig,
  tryParseVisualConfig,
  type VisualConfig,
} from './tier-expr'

// ---------------------------------------------------------------------------
// Per-request (per-image) pricing: a price in USD per request chosen by
// request fields instead of token counts. The visual editor stores this
// config; the expression it generates is the canonical form the parser
// below recognises, so stored expressions round-trip into the editor.
// ---------------------------------------------------------------------------

export const PER_REQUEST_KIND = 'per_request'

export type PerRequestRuleCondition = {
  id: string
  condition: RequestCondition
}

export type PerRequestRule = {
  id: string
  label: string
  // USD per request, kept as the typed text so drafts like "0.0" survive.
  price: string
  conditions: PerRequestRuleCondition[]
}

export type PerRequestConfig = {
  kind: typeof PER_REQUEST_KIND
  defaultLabel: string
  defaultPrice: string
  // Multiply by the request's `n` (image count); absent n counts as 1.
  countByN: boolean
  // USD per input image on edits, counted from `images` or a single `image`.
  // Empty or 0 disables the surcharge.
  inputImagePrice: string
  rules: PerRequestRule[]
}

export type AnyVisualConfig = VisualConfig | PerRequestConfig

let idCounter = 0
export function nextPerRequestId(): string {
  idCounter += 1
  return `pr_${idCounter}`
}

export function isPerRequestConfig(
  config: AnyVisualConfig | null | undefined
): config is PerRequestConfig {
  return !!config && (config as PerRequestConfig).kind === PER_REQUEST_KIND
}

export function createPerRequestRule(
  partial: Partial<Omit<PerRequestRule, 'id'>> = {}
): PerRequestRule {
  return {
    id: nextPerRequestId(),
    label: partial.label ?? '',
    price: partial.price ?? '',
    conditions: partial.conditions ?? [],
  }
}

export function createPerRequestCondition(
  condition: RequestCondition
): PerRequestRuleCondition {
  return { id: nextPerRequestId(), condition }
}

export function createDefaultPerRequestConfig(): PerRequestConfig {
  return {
    kind: PER_REQUEST_KIND,
    defaultLabel: 'image',
    defaultPrice: '0.04',
    countByN: true,
    inputImagePrice: '',
    rules: [],
  }
}

const COUNT_PREFIX = '(param("n") == nil ? 1 : param("n")) * '
const INPUT_IMAGE_SUFFIX =
  ' + (param("images.#") == nil ? (param("image") != nil ? 1 : 0) : param("images.#")) * '

// Expression constants are USD × 1,000,000 per request.
function priceToUnits(price: string): number | null {
  const text = String(price ?? '').trim()
  if (text === '') return null
  const value = Number(text)
  if (!Number.isFinite(value) || value < 0) return null
  return Math.round(value * 1_000_000)
}

function unitsToPrice(units: number): string {
  return String(units / 1_000_000)
}

function buildRuleConditionExpr(rule: PerRequestRule): string {
  const parts = rule.conditions
    .map((item) => buildRequestConditionExpr(item.condition))
    .filter(Boolean)
  if (parts.length === 0) return ''
  if (parts.length === 1) return parts[0]
  return parts.map((e) => (e.includes(' || ') ? `(${e})` : e)).join(' && ')
}

export function generateExprFromPerRequestConfig(
  config: PerRequestConfig
): string {
  const fallback = `tier(${JSON.stringify(config.defaultLabel || 'default')}, ${priceToUnits(config.defaultPrice) ?? 0})`
  const chain: string[] = []
  config.rules.forEach((rule, index) => {
    const cond = buildRuleConditionExpr(rule)
    const units = priceToUnits(rule.price)
    if (!cond || units === null) return
    const label = JSON.stringify(rule.label || `rule_${index + 1}`)
    chain.push(`${cond} ? tier(${label}, ${units})`)
  })
  let expr = chain.length ? `(${[...chain, fallback].join(' : ')})` : fallback
  if (config.countByN) expr = `${COUNT_PREFIX}${expr}`
  const inputUnits = priceToUnits(config.inputImagePrice)
  if (inputUnits) expr += `${INPUT_IMAGE_SUFFIX}${inputUnits}`
  return expr
}

const TIER_RE = /^tier\("([^"]*)", (\d+)\)$/
const RULE_TAIL_RE = /^tier\("([^"]*)", (\d+)\) : ([\s\S]+)$/
const RULE_SEPARATOR = ' ? tier("'

export function tryParsePerRequestConfig(
  exprStr: string | null | undefined
): PerRequestConfig | null {
  if (!exprStr) return null
  let body = exprStr.trim()
  const versionMatch = body.match(/^v\d+:([\s\S]*)$/)
  if (versionMatch) body = versionMatch[1].trim()
  const original = body

  let inputImagePrice = ''
  const suffixIndex = body.lastIndexOf(INPUT_IMAGE_SUFFIX)
  if (suffixIndex !== -1) {
    const units = body.slice(suffixIndex + INPUT_IMAGE_SUFFIX.length)
    if (!/^\d+$/.test(units)) return null
    inputImagePrice = unitsToPrice(Number(units))
    body = body.slice(0, suffixIndex)
  }

  let countByN = false
  if (body.startsWith(COUNT_PREFIX)) {
    countByN = true
    body = body.slice(COUNT_PREFIX.length)
  }
  body = unwrapOuterParens(body)

  const rules: PerRequestRule[] = []
  let rest = body
  let fallback: RegExpMatchArray | null = null
  while (rest) {
    fallback = rest.match(TIER_RE)
    if (fallback) break
    const separator = rest.indexOf(RULE_SEPARATOR)
    if (separator === -1) return null
    const conditions = tryParseRequestConditions(rest.slice(0, separator))
    if (!conditions) return null
    const tail = rest.slice(separator + 3).match(RULE_TAIL_RE)
    if (!tail) return null
    rules.push(
      createPerRequestRule({
        label: tail[1],
        price: unitsToPrice(Number(tail[2])),
        conditions: conditions.map(createPerRequestCondition),
      })
    )
    rest = tail[3]
  }
  if (!fallback) return null

  const config: PerRequestConfig = {
    kind: PER_REQUEST_KIND,
    defaultLabel: fallback[1],
    defaultPrice: unitsToPrice(Number(fallback[2])),
    countByN,
    inputImagePrice,
    rules,
  }
  const regenerated = generateExprFromPerRequestConfig(config)
  if (regenerated.replaceAll(/\s+/g, '') !== original.replaceAll(/\s+/g, '')) {
    return null
  }
  return config
}

// ---------------------------------------------------------------------------
// Either visual config kind
// ---------------------------------------------------------------------------

export function tryParseAnyVisualConfig(
  exprStr: string | null | undefined
): AnyVisualConfig | null {
  return tryParseVisualConfig(exprStr) ?? tryParsePerRequestConfig(exprStr)
}

export function generateExprFromAnyVisualConfig(
  config: AnyVisualConfig | null | undefined
): string {
  if (isPerRequestConfig(config)) {
    return generateExprFromPerRequestConfig(config)
  }
  return generateExprFromVisualConfig(config)
}
