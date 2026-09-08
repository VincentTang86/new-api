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
import { BILLING_CACHE_VAR_MAP } from './billing-expr'

export const CACHE_MODE_TIMED = 'timed'
export const CACHE_MODE_GENERIC = 'generic'
export type CacheMode = typeof CACHE_MODE_TIMED | typeof CACHE_MODE_GENERIC

export type TierConditionInput = {
  var: 'p' | 'c' | 'len'
  op: '<' | '<=' | '>' | '>='
  value: number | string
}

export type VisualTier = {
  label: string
  conditions: TierConditionInput[]
  input_unit_cost: number
  output_unit_cost: number
  cache_mode: CacheMode
  cache_read_unit_cost?: number
  cache_read_explicit_unit_cost?: number
  cache_create_unit_cost?: number
  cache_create_1h_unit_cost?: number
  image_unit_cost?: number
  image_output_unit_cost?: number
  audio_input_unit_cost?: number
  audio_output_unit_cost?: number
  [field: string]: unknown
}

export type VisualConfig = {
  tiers: VisualTier[]
}

export function getTierCacheMode(
  tier: Partial<VisualTier> | null | undefined
): CacheMode {
  if (tier?.cache_mode === CACHE_MODE_TIMED) return CACHE_MODE_TIMED
  if (tier?.cache_mode === CACHE_MODE_GENERIC) return CACHE_MODE_GENERIC
  return Number(tier?.cache_create_1h_unit_cost) > 0
    ? CACHE_MODE_TIMED
    : CACHE_MODE_GENERIC
}

export function normalizeVisualTier(
  tier: Partial<VisualTier> = {}
): VisualTier {
  return {
    label: tier.label ?? '',
    input_unit_cost: Number(tier.input_unit_cost) || 0,
    output_unit_cost: Number(tier.output_unit_cost) || 0,
    cache_mode: getTierCacheMode(tier),
    conditions: Array.isArray(tier.conditions) ? tier.conditions : [],
    ...tier,
    cache_read_unit_cost: Number(tier.cache_read_unit_cost) || 0,
    cache_read_explicit_unit_cost:
      Number(tier.cache_read_explicit_unit_cost) || 0,
    cache_create_unit_cost: Number(tier.cache_create_unit_cost) || 0,
    cache_create_1h_unit_cost: Number(tier.cache_create_1h_unit_cost) || 0,
    image_unit_cost: Number(tier.image_unit_cost) || 0,
    image_output_unit_cost: Number(tier.image_output_unit_cost) || 0,
    audio_input_unit_cost: Number(tier.audio_input_unit_cost) || 0,
    audio_output_unit_cost: Number(tier.audio_output_unit_cost) || 0,
  }
}

export function createDefaultVisualConfig(): VisualConfig {
  return {
    tiers: [
      normalizeVisualTier({
        conditions: [],
        input_unit_cost: 0,
        output_unit_cost: 0,
        label: 'base',
        cache_mode: CACHE_MODE_GENERIC,
      }),
    ],
  }
}

export function normalizeVisualConfig(
  config: VisualConfig | null | undefined
): VisualConfig {
  if (!config || !Array.isArray(config.tiers) || config.tiers.length === 0) {
    return createDefaultVisualConfig()
  }
  return {
    ...config,
    tiers: config.tiers.map((tier) => normalizeVisualTier(tier)),
  }
}

function buildConditionStr(conditions: TierConditionInput[]): string {
  if (!conditions || conditions.length === 0) return ''
  return conditions
    .filter((c) => c.var && c.op && c.value != null && c.value !== '')
    .map((c) => `${c.var} ${c.op} ${c.value}`)
    .join(' && ')
}

function buildTierBodyExpr(tier: VisualTier): string {
  const parts: string[] = []
  const ic = Number(tier.input_unit_cost) || 0
  const oc = Number(tier.output_unit_cost) || 0
  parts.push(`p * ${ic}`)
  parts.push(`c * ${oc}`)
  for (const cv of BILLING_CACHE_VAR_MAP) {
    const v = Number((tier as Record<string, unknown>)[cv.field]) || 0
    if (v !== 0) parts.push(`${cv.exprVar} * ${v}`)
  }
  return parts.join(' + ')
}

const TIER_BODY_VARS = [
  'p',
  'c',
  ...BILLING_CACHE_VAR_MAP.map((cv) => cv.exprVar),
]
// Longest first so `cc1h` is not read as `cc` and `img_o` not as `img`.
const TIER_BODY_TERM_RE = new RegExp(
  `^\\s*(${[...TIER_BODY_VARS].sort((a, b) => b.length - a.length).join('|')})` +
    `\\s*\\*\\s*(-?(?:\\d+\\.?\\d*|\\.\\d+)(?:[eE][+-]?\\d+)?)\\s*`
)

// A tier body is a sum of `var * price` terms, and an author may write those
// terms in any order. Rewrite the body into the order the generator emits so
// a hand-written expression still round-trips into the visual editor. A body
// holding anything else (a function call, a per-request constant) is returned
// untouched and keeps the expression in the raw editor.
function orderTierBodyTerms(body: string): string {
  const prices = new Map<string, number>()
  let rest = body
  for (;;) {
    const term = rest.match(TIER_BODY_TERM_RE)
    if (!term || prices.has(term[1])) return body
    prices.set(term[1], Number(term[2]))
    rest = rest.slice(term[0].length)
    if (rest === '') break
    if (!rest.startsWith('+')) return body
    rest = rest.slice(1)
  }
  const terms = [`p * ${prices.get('p') ?? 0}`, `c * ${prices.get('c') ?? 0}`]
  for (const cv of BILLING_CACHE_VAR_MAP) {
    const price = prices.get(cv.exprVar)
    if (price) terms.push(`${cv.exprVar} * ${price}`)
  }
  return terms.join(' + ')
}

export function generateExprFromVisualConfig(
  config: VisualConfig | null | undefined
): string {
  if (!config || !config.tiers || config.tiers.length === 0) {
    return 'p * 0 + c * 0'
  }
  const tiers = config.tiers

  if (tiers.length === 1) {
    const tier = tiers[0]
    const label = tier.label || 'default'
    const body = `tier("${label}", ${buildTierBodyExpr(tier)})`
    const cond = buildConditionStr(tier.conditions)
    if (cond) {
      return `${cond} ? ${body} : p * 0 + c * 0`
    }
    return body
  }

  const parts: string[] = []
  for (let i = 0; i < tiers.length; i++) {
    const tier = tiers[i]
    const label = tier.label || `tier_${i + 1}`
    const body = `tier("${label}", ${buildTierBodyExpr(tier)})`
    const cond = buildConditionStr(tier.conditions)

    if (i < tiers.length - 1 && cond) {
      parts.push(`${cond} ? ${body}`)
    } else {
      parts.push(body)
    }
  }
  return parts.join(' : ')
}

export function tryParseVisualConfig(
  exprStr: string | null | undefined
): VisualConfig | null {
  if (!exprStr) return null
  try {
    let body = exprStr
    const versionMatch = body.match(/^v\d+:([\s\S]*)$/)
    if (versionMatch) body = versionMatch[1]
    body = body.replaceAll(
      /tier\("([^"]*)",([^()]*)\)/g,
      (_full, label: string, tierBody: string) =>
        `tier("${label}", ${orderTierBodyTerms(tierBody)})`
    )
    const cacheVarNames = BILLING_CACHE_VAR_MAP.map((cv) => cv.exprVar)
    const optCacheStr = cacheVarNames
      .map((v) => `(?:\\s*\\+\\s*${v}\\s*\\*\\s*([\\d.eE+-]+))?`)
      .join('')

    const bodyPat = `p\\s*\\*\\s*([\\d.eE+-]+)\\s*\\+\\s*c\\s*\\*\\s*([\\d.eE+-]+)${optCacheStr}`

    const singleRe = new RegExp(`^tier\\("([^"]*)",\\s*${bodyPat}\\)$`)
    const simple = body.match(singleRe)
    if (simple) {
      const tier: Record<string, unknown> = {
        conditions: [],
        input_unit_cost: Number(simple[2]),
        output_unit_cost: Number(simple[3]),
        label: simple[1],
      }
      BILLING_CACHE_VAR_MAP.forEach((cv, i) => {
        const val = simple[4 + i]
        if (val != null) tier[cv.field] = Number(val)
      })
      return normalizeVisualConfig({
        tiers: [normalizeVisualTier(tier as Partial<VisualTier>)],
      })
    }

    const condGroup =
      `((?:(?:p|c|len)\\s*(?:<|<=|>|>=)\\s*[\\d.eE+]+)` +
      `(?:\\s*&&\\s*(?:p|c|len)\\s*(?:<|<=|>|>=)\\s*[\\d.eE+]+)*)`
    const tierRe = new RegExp(
      `(?:${condGroup}\\s*\\?\\s*)?tier\\("([^"]*)",\\s*${bodyPat}\\)`,
      'g'
    )
    const tiers: VisualTier[] = []
    let match: RegExpExecArray | null
    while ((match = tierRe.exec(body)) !== null) {
      const condStr = match[1] || ''
      const conditions: TierConditionInput[] = []
      if (condStr) {
        for (const cp of condStr.split(/\s*&&\s*/)) {
          const cm = cp.trim().match(/^(p|c|len)\s*(<|<=|>|>=)\s*([\d.eE+]+)$/)
          if (cm) {
            conditions.push({
              var: cm[1] as TierConditionInput['var'],
              op: cm[2] as TierConditionInput['op'],
              value: Number(cm[3]),
            })
          }
        }
      }
      const tier: Record<string, unknown> = {
        conditions,
        input_unit_cost: Number(match[3]),
        output_unit_cost: Number(match[4]),
        label: match[2],
      }
      const m = match
      BILLING_CACHE_VAR_MAP.forEach((cv, i) => {
        const val = m[5 + i]
        if (val != null) tier[cv.field] = Number(val)
      })
      tiers.push(normalizeVisualTier(tier as Partial<VisualTier>))
    }
    if (tiers.length === 0) return null

    const cfg = normalizeVisualConfig({ tiers })
    const regenerated = generateExprFromVisualConfig(cfg)
    if (regenerated.replaceAll(/\s+/g, '') !== body.replaceAll(/\s+/g, '')) {
      return null
    }
    return cfg
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Local cost evaluator (for the estimator preview)
// ---------------------------------------------------------------------------

const ESTIMATOR_VARS = [
  { var: 'cr', stateKey: 'cacheReadTokens' },
  { var: 'crx', stateKey: 'cacheReadExplicitTokens' },
  { var: 'cc', stateKey: 'cacheCreateTokens' },
  { var: 'cc1h', stateKey: 'cacheCreate1hTokens' },
  { var: 'img', stateKey: 'imageTokens' },
  { var: 'img_o', stateKey: 'imageOutputTokens' },
  { var: 'ai', stateKey: 'audioInputTokens' },
  { var: 'ao', stateKey: 'audioOutputTokens' },
] as const

export type ExtraTokenValues = Record<
  (typeof ESTIMATOR_VARS)[number]['stateKey'],
  number
>

export type EvalResult = {
  cost: number
  matchedTier: string
  error: string | null
}

// Sample request the estimator feeds to param() / header(), mirroring the
// server-side RequestInput so request-aware expressions can be previewed.
export type EstimatorRequest = {
  body?: unknown
  headers?: Record<string, string>
}

const REQUEST_PROBE_FUNCS = [
  'param',
  'header',
  'hour',
  'minute',
  'weekday',
  'month',
  'day',
]

export function exprUsesRequestProbe(exprStr: string): boolean {
  if (!exprStr) return false
  return new RegExp(`\\b(${REQUEST_PROBE_FUNCS.join('|')})\\s*\\(`).test(
    exprStr
  )
}

// gjson subset used by billing expressions: dotted object keys, numeric
// array indexes and a trailing "#" for array length. Missing paths are nil.
function lookupJsonPath(body: unknown, path: string): unknown {
  const trimmed = path.trim()
  if (!trimmed || body == null) return null
  let current: unknown = body
  for (const segment of trimmed.split('.')) {
    if (current == null) return null
    if (segment === '#') {
      return Array.isArray(current) ? current.length : null
    }
    if (Array.isArray(current)) {
      const index = Number(segment)
      if (!Number.isInteger(index) || index < 0 || index >= current.length) {
        return null
      }
      current = current[index]
      continue
    }
    if (typeof current !== 'object') return null
    if (!Object.hasOwn(current, segment)) return null
    current = (current as Record<string, unknown>)[segment]
  }
  return current ?? null
}

function timeInZone(tz: string): Date {
  const zone = tz.trim() || 'UTC'
  try {
    return new Date(new Date().toLocaleString('en-US', { timeZone: zone }))
  } catch {
    return new Date(new Date().toLocaleString('en-US', { timeZone: 'UTC' }))
  }
}

export function evalExprLocally(
  exprStr: string,
  promptTokens: number,
  completionTokens: number,
  extraTokenValues: ExtraTokenValues,
  request: EstimatorRequest = {}
): EvalResult {
  try {
    if (!exprStr || !exprStr.trim()) {
      return { cost: 0, matchedTier: '', error: null }
    }
    let matchedTier = ''
    const tierFn = (name: string, value: number) => {
      matchedTier = name
      return value
    }
    const cacheReadTokens = extraTokenValues.cacheReadTokens || 0
    const cacheReadExplicitTokens =
      extraTokenValues.cacheReadExplicitTokens || 0
    const cacheCreateTokens = extraTokenValues.cacheCreateTokens || 0
    const cacheCreate1hTokens = extraTokenValues.cacheCreate1hTokens || 0
    const len =
      promptTokens +
      cacheReadTokens +
      cacheReadExplicitTokens +
      cacheCreateTokens +
      cacheCreate1hTokens
    const headers: Record<string, string> = {}
    for (const [key, value] of Object.entries(request.headers || {})) {
      headers[key.trim().toLowerCase()] = value.trim()
    }
    const env: Record<string, unknown> = {
      p: promptTokens,
      c: completionTokens,
      len,
      nil: null,
      tier: tierFn,
      max: Math.max,
      min: Math.min,
      abs: Math.abs,
      ceil: Math.ceil,
      floor: Math.floor,
      param: (path: string) => lookupJsonPath(request.body, path),
      header: (name: string) => headers[name.trim().toLowerCase()] ?? '',
      has: (source: unknown, substr: string) =>
        source != null && substr !== '' && String(source).includes(substr),
      hour: (tz: string) => timeInZone(tz).getHours(),
      minute: (tz: string) => timeInZone(tz).getMinutes(),
      weekday: (tz: string) => timeInZone(tz).getDay(),
      month: (tz: string) => timeInZone(tz).getMonth() + 1,
      day: (tz: string) => timeInZone(tz).getDate(),
    }
    for (const field of ESTIMATOR_VARS) {
      env[field.var] = extraTokenValues[field.stateKey] || 0
    }
    const fn = new Function(
      ...Object.keys(env),
      `"use strict"; return (${exprStr});`
    )
    const cost = Number(fn(...Object.values(env))) || 0
    return { cost, matchedTier, error: null }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return { cost: 0, matchedTier: '', error: message }
  }
}

export function exprUsesExtraVars(exprStr: string): boolean {
  if (!exprStr) return false
  const varNames = ESTIMATOR_VARS.map((f) => f.var).join('|')
  return new RegExp(`\\b(${varNames})\\b`).test(exprStr)
}

export const ESTIMATOR_EXTRA_FIELDS = ESTIMATOR_VARS
