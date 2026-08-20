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
import { ChevronDown, HelpCircle } from 'lucide-react'
import { Fragment, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Skeleton } from '@/components/ui/skeleton'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  calculateSavingsRatio,
  formatSavingsPercent,
} from '@/features/home/landing/lib/pricing'
import type { ApiKey } from '@/features/keys/types'
import type { ReferencePriceLanes } from '@/features/pricing/types'
import { formatQuotaWithCurrency, getCurrencyDisplay } from '@/lib/currency'
import dayjs from '@/lib/dayjs'
import {
  formatCompactNumber,
  formatNumber,
  quotaUnitsToDollars,
} from '@/lib/format'
import { cn } from '@/lib/utils'

import { BREAKDOWN_PAGE_SIZES } from '../constants'
import { estimateOfficialCostUSD } from '../lib/official-cost'
import type { BreakdownTab, FlowQuotaDataItem } from '../types'
import { UsagePagination } from './usage-pagination'

const PLACEHOLDER = '-'

// Verbatim label agreed with product for usage that came from the playground
// rather than a real API key, so it is not translated.
const PLAYGROUND_KEY_LABEL = 'None(Playground)'

const TH_CLASS =
  'px-3.5 py-[11px] text-xs font-semibold text-[#6b7280] dark:text-muted-foreground'
const NUM_CELL = 'px-3.5 py-[13px] text-right text-[13px] tabular-nums'
const MUTED_NUM = cn(NUM_CELL, 'text-[#6b7280] dark:text-muted-foreground')
const GREEN_NUM = cn(NUM_CELL, 'font-semibold text-[#10b981]')
const DASH_NUM = cn(NUM_CELL, 'text-[#9ca3af] dark:text-muted-foreground/60')

/**
 * Amounts at or above this display value keep the site-wide four fraction
 * digits. Below it four digits leave too little resolution to tell the actual
 * and official cost columns apart, so those rows start at six — the resolution
 * the data is stored at, since one quota unit is $0.000002 at 500000 quota per
 * USD.
 */
const SMALL_COST_THRESHOLD = 0.001

/** Widest a cost cell goes; past the storage resolution the digits are noise. */
const MAX_COST_DIGITS = 6

/**
 * The savings column rounds to whole percent, so a ratio below this renders as
 * "0%" — two cost cells showing the same amount beside it are not a
 * contradiction, and must not drag the row wider.
 */
const VISIBLE_SAVINGS_RATIO = 0.005

/** Fraction digits a cost cell reads well at on its own. */
function costDigits(quota: number): number {
  const amount = Math.abs(quotaUnitsToDollars(quota))
  if (amount >= 1) return 2
  return amount > 0 && amount < SMALL_COST_THRESHOLD ? MAX_COST_DIGITS : 4
}

/**
 * Format a cost cell of this table at an exact width. Both cost columns go
 * through it so they always round on the same scale; the official estimate
 * arrives as USD and is converted to quota units by the caller.
 */
function formatCost(quota: number, digits: number): string {
  return formatQuotaWithCurrency(quota, {
    digitsLarge: digits,
    digitsSmall: digits,
    abbreviate: true,
  })
}

interface UsageBreakdownTableProps {
  flowData: FlowQuotaDataItem[]
  loading?: boolean
  apiKeys: ApiKey[] | undefined
  /** Official list prices per model, from `/api/pricing` reference pricing. */
  officialPrices?: Record<string, ReferencePriceLanes>
  /** Measured height of the usage overview card, in px. */
  minHeight?: number
}

interface UsageTotals {
  requests: number
  tokens: number
  quota: number
  promptTokens: number
  completionTokens: number
  cacheTokens: number
  cacheCreationTokens: number
}

interface ModelRow extends UsageTotals {
  model: string
  groups: ({ group: string } & UsageTotals)[]
}

interface ApiKeyRow extends UsageTotals {
  tokenId: number
  name: string
  accessedTime?: number
}

function usePagination<T>(rows: T[]) {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(BREAKDOWN_PAGE_SIZES[0])
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const pageRows = rows.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  )
  return {
    pageRows,
    page: currentPage,
    pageSize,
    totalPages,
    total: rows.length,
    setPage,
    setPageSize: (size: number) => {
      setPageSize(size)
      setPage(1)
    },
  }
}

function addTotals(target: UsageTotals, item: FlowQuotaDataItem) {
  target.requests += Number(item.count) || 0
  target.tokens += Number(item.token_used) || 0
  target.quota += Number(item.quota) || 0
  target.promptTokens += Number(item.prompt_tokens) || 0
  target.completionTokens += Number(item.completion_tokens) || 0
  target.cacheTokens += Number(item.cache_tokens) || 0
  target.cacheCreationTokens += Number(item.cache_creation_tokens) || 0
}

function emptyTotals(): UsageTotals {
  return {
    requests: 0,
    tokens: 0,
    quota: 0,
    promptTokens: 0,
    completionTokens: 0,
    cacheTokens: 0,
    cacheCreationTokens: 0,
  }
}

export function UsageBreakdownTable({
  flowData,
  loading,
  apiKeys,
  officialPrices,
  minHeight,
}: UsageBreakdownTableProps) {
  const { t, i18n } = useTranslation()
  const [tab, setTab] = useState<BreakdownTab>('model')
  const [expandedModels, setExpandedModels] = useState<Set<string>>(
    () => new Set()
  )

  const modelRows = useMemo<ModelRow[]>(() => {
    const byModel = new Map<string, ModelRow>()
    for (const item of flowData) {
      const model = item.model_name || t('Unknown')
      let row = byModel.get(model)
      if (!row) {
        row = { model, groups: [], ...emptyTotals() }
        byModel.set(model, row)
      }
      addTotals(row, item)
      const groupKey = item.use_group || ''
      let groupRow = row.groups.find((entry) => entry.group === groupKey)
      if (!groupRow) {
        groupRow = { group: groupKey, ...emptyTotals() }
        row.groups.push(groupRow)
      }
      addTotals(groupRow, item)
    }
    const rows = [...byModel.values()]
    rows.sort((a, b) => b.quota - a.quota)
    for (const row of rows) row.groups.sort((a, b) => b.quota - a.quota)
    return rows
  }, [flowData, t])

  const apiKeyRows = useMemo<ApiKeyRow[]>(() => {
    const keyById = new Map<number, ApiKey>()
    for (const key of apiKeys ?? []) keyById.set(key.id, key)
    const byToken = new Map<number, ApiKeyRow>()
    for (const item of flowData) {
      const tokenId = Number(item.token_id) || 0
      let row = byToken.get(tokenId)
      if (!row) {
        let name: string
        if (item.is_playground) {
          name = PLAYGROUND_KEY_LABEL
        } else if (item.token_name) {
          name = item.token_name
        } else if (tokenId > 0) {
          // Deleted tokens come back with an empty name on purpose; the
          // backend leaves the label decision to the frontend.
          name = `${t('Deleted')} (${tokenId})`
        } else {
          name = t('Unknown')
        }
        row = {
          tokenId,
          name,
          ...emptyTotals(),
          // Playground runs on a token that is never persisted, so it has no
          // `accessed_time`; the backend derives its last use from the logs.
          accessedTime:
            keyById.get(tokenId)?.accessed_time ?? item.last_used_time,
        }
        byToken.set(tokenId, row)
      }
      addTotals(row, item)
    }
    return [...byToken.values()].sort((a, b) => b.quota - a.quota)
  }, [apiKeys, flowData, t])

  const modelPagination = usePagination(modelRows)
  const apiKeyPagination = usePagination(apiKeyRows)

  const toggleModel = (model: string) => {
    setExpandedModels((prev) => {
      const next = new Set(prev)
      if (next.has(model)) next.delete(model)
      else next.add(model)
      return next
    })
  }

  // Tier rows show the raw group name; group descriptions are display
  // copy managed elsewhere and can drift from the name.
  const groupLabel = (group: string) => group || t('Unknown')

  // The official cells dash together when no honest estimate exists: model
  // without configured official prices, or rows from before the token split
  // columns. The actual cost is always known.
  const costCells = (model: string, totals: UsageTotals) => {
    const estUsd = estimateOfficialCostUSD(
      {
        promptTokens: totals.promptTokens,
        completionTokens: totals.completionTokens,
        cacheTokens: totals.cacheTokens,
        cacheCreationTokens: totals.cacheCreationTokens,
        totalTokens: totals.tokens,
      },
      officialPrices?.[model]
    )
    if (estUsd === null) {
      return {
        actual: formatCost(totals.quota, costDigits(totals.quota)),
        est: PLACEHOLDER,
        savings: PLACEHOLDER,
      }
    }

    const { quotaPerUnit } = getCurrencyDisplay().config
    const estQuota = estUsd * quotaPerUnit
    const ratio = calculateSavingsRatio(totals.quota / quotaPerUnit, estUsd)

    let actual = formatCost(totals.quota, costDigits(totals.quota))
    let est = formatCost(estQuota, costDigits(estQuota))

    // Rounding can collapse both columns onto the same number while the
    // savings percentage, taken from the raw values, still claims a
    // difference. Widen the pair a digit at a time until they read apart —
    // only these rows change width, so a row whose two costs are orders of
    // magnitude apart keeps each cell at its natural precision.
    let digits = Math.max(costDigits(totals.quota), costDigits(estQuota))
    const savingsIsVisible = ratio !== null && ratio >= VISIBLE_SAVINGS_RATIO
    while (savingsIsVisible && actual === est && digits < MAX_COST_DIGITS) {
      digits += 1
      actual = formatCost(totals.quota, digits)
      est = formatCost(estQuota, digits)
    }

    return {
      actual,
      est,
      savings:
        ratio === null
          ? PLACEHOLDER
          : formatSavingsPercent(ratio, i18n.language),
    }
  }

  const formatLastUsed = (accessedTime?: number) => {
    if (!accessedTime || accessedTime <= 0) return PLACEHOLDER
    return dayjs.unix(accessedTime).fromNow()
  }

  return (
    <div
      className='dark:bg-card dark:border-border flex flex-col overflow-hidden rounded-xl border border-[#e5e7eb] bg-white'
      style={minHeight ? { minHeight } : undefined}
    >
      <div className='flex items-center justify-between gap-2 px-[22px] py-[18px]'>
        <span className='dark:text-foreground text-[15px] font-semibold text-[#111827]'>
          {t('Usage Breakdown')}
        </span>
        <div className='dark:bg-muted flex items-center rounded-[8px] bg-[#f5f5f7] p-0.5'>
          {(
            [
              { value: 'model', labelKey: 'By Model' },
              { value: 'apikey', labelKey: 'By API Key' },
            ] as const
          ).map((option, index) => (
            <div key={option.value} className='flex items-center'>
              {index > 0 && (
                <div className='dark:bg-border h-3.5 w-px bg-[#d1d6db]' />
              )}
              <button
                type='button'
                onClick={() => setTab(option.value)}
                className={cn(
                  'cursor-pointer rounded-[6px] px-3 py-[5px] text-xs font-medium transition-colors',
                  tab === option.value
                    ? 'bg-[#ff5a5f] font-semibold text-white'
                    : 'dark:text-muted-foreground text-[#666b78] hover:bg-[#e8e8eb] dark:hover:bg-white/10'
                )}
              >
                {t(option.labelKey)}
              </button>
            </div>
          ))}
        </div>
      </div>

      {loading && (
        <div className='flex-1 space-y-2 p-4'>
          <Skeleton className='h-8 w-full' />
          <Skeleton className='h-8 w-full' />
          <Skeleton className='h-8 w-full' />
        </div>
      )}
      {!loading && tab === 'model' && (
        <>
          <div className='flex-1 overflow-x-auto'>
            <table className='w-full min-w-[760px] border-collapse'>
              <thead>
                <tr className='dark:bg-muted/50 bg-[#f9fafb]'>
                  <th className={cn(TH_CLASS, 'text-left')}>{t('Model')}</th>
                  <th className={cn(TH_CLASS, 'text-right')}>
                    {t('Requests')}
                  </th>
                  <th className={cn(TH_CLASS, 'text-right')}>{t('Tokens')}</th>
                  <th className={cn(TH_CLASS, 'text-right')}>
                    {t('Avg Tok/Req')}
                  </th>
                  <th className={cn(TH_CLASS, 'text-right')}>
                    {t('Actual Cost')}
                  </th>
                  <th className={cn(TH_CLASS, 'text-right')}>
                    <span className='inline-flex items-center justify-end gap-1'>
                      {t('Est. Cost at Official Rates')}
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <span className='hover:text-muted-foreground shrink-0 cursor-help text-[#9ca3af]' />
                            }
                          >
                            <HelpCircle className='size-3.5' />
                          </TooltipTrigger>
                          <TooltipContent className='max-w-64'>
                            {t(
                              'Estimated cost for the same usage based on the model developer’s published API rates.'
                            )}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </span>
                  </th>
                  <th className={cn(TH_CLASS, 'text-right')}>{t('Savings')}</th>
                </tr>
              </thead>
              <tbody>
                {modelPagination.pageRows.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className='dark:text-muted-foreground h-24 text-center text-sm text-[#6b7280]'
                    >
                      {t('No data available')}
                    </td>
                  </tr>
                )}
                {modelPagination.pageRows.map((row) => {
                  const modelCells = costCells(row.model, row)
                  return (
                    <Fragment key={row.model}>
                      <tr
                        className='dark:border-border cursor-pointer border-b border-[#e5e7eb] transition-colors hover:bg-[#fafafa] dark:hover:bg-white/5'
                        onClick={() => toggleModel(row.model)}
                      >
                        <td className='px-3.5 py-[13px]'>
                          <span className='flex items-center gap-1.5'>
                            <ChevronDown
                              className={cn(
                                'size-3.5 text-[#99a1ab] transition-transform',
                                !expandedModels.has(row.model) && '-rotate-90'
                              )}
                            />
                            <span className='dark:text-foreground text-[13px] font-semibold text-[#111827]'>
                              {row.model}
                            </span>
                          </span>
                        </td>
                        <td className={MUTED_NUM}>
                          {formatNumber(row.requests)}
                        </td>
                        <td className={MUTED_NUM}>
                          {formatCompactNumber(row.tokens)}
                        </td>
                        <td className={MUTED_NUM}>
                          {row.requests > 0
                            ? formatNumber(
                                Math.round(row.tokens / row.requests)
                              )
                            : PLACEHOLDER}
                        </td>
                        <td className={GREEN_NUM}>{modelCells.actual}</td>
                        <td
                          className={
                            modelCells.est === PLACEHOLDER
                              ? DASH_NUM
                              : MUTED_NUM
                          }
                        >
                          {modelCells.est}
                        </td>
                        <td
                          className={
                            modelCells.savings === PLACEHOLDER
                              ? DASH_NUM
                              : GREEN_NUM
                          }
                        >
                          {modelCells.savings}
                        </td>
                      </tr>
                      {expandedModels.has(row.model) &&
                        row.groups.map((groupRow) => {
                          const groupCells = costCells(row.model, groupRow)
                          return (
                            <tr
                              key={`${row.model}-${groupRow.group}`}
                              className='dark:border-border border-b border-[#e5e7eb] bg-[#fbfcfd] dark:bg-white/2'
                            >
                              <td className='px-3.5 py-[9px] pl-9'>
                                <span className='dark:text-muted-foreground text-xs text-[#9ca3af]'>
                                  {groupLabel(groupRow.group)}
                                </span>
                              </td>
                              <td className={cn(MUTED_NUM, 'py-[9px] text-xs')}>
                                {formatNumber(groupRow.requests)}
                              </td>
                              <td className={cn(MUTED_NUM, 'py-[9px] text-xs')}>
                                {formatCompactNumber(groupRow.tokens)}
                              </td>
                              <td className={cn(MUTED_NUM, 'py-[9px] text-xs')}>
                                {groupRow.requests > 0
                                  ? formatNumber(
                                      Math.round(
                                        groupRow.tokens / groupRow.requests
                                      )
                                    )
                                  : PLACEHOLDER}
                              </td>
                              <td className={cn(GREEN_NUM, 'py-[9px] text-xs')}>
                                {groupCells.actual}
                              </td>
                              <td
                                className={cn(
                                  groupCells.est === PLACEHOLDER
                                    ? DASH_NUM
                                    : MUTED_NUM,
                                  'py-[9px] text-xs'
                                )}
                              >
                                {groupCells.est}
                              </td>
                              <td
                                className={cn(
                                  groupCells.savings === PLACEHOLDER
                                    ? DASH_NUM
                                    : GREEN_NUM,
                                  'py-[9px] text-xs'
                                )}
                              >
                                {groupCells.savings}
                              </td>
                            </tr>
                          )
                        })}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
          <UsagePagination
            page={modelPagination.page}
            totalPages={modelPagination.totalPages}
            total={modelPagination.total}
            pageSize={modelPagination.pageSize}
            onPage={modelPagination.setPage}
            onPageSize={modelPagination.setPageSize}
          />
        </>
      )}
      {!loading && tab === 'apikey' && (
        <>
          <div className='flex-1 overflow-x-auto'>
            <table className='w-full min-w-[560px] border-collapse'>
              <thead>
                <tr className='dark:bg-muted/50 bg-[#f9fafb]'>
                  <th className={cn(TH_CLASS, 'text-left')}>{t('API Keys')}</th>
                  <th className={cn(TH_CLASS, 'text-right')}>
                    {t('Requests')}
                  </th>
                  <th className={cn(TH_CLASS, 'text-right')}>{t('Tokens')}</th>
                  <th className={cn(TH_CLASS, 'text-right')}>{t('Cost')}</th>
                  <th className={cn(TH_CLASS, 'text-right')}>
                    {t('Last Used')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {apiKeyPagination.pageRows.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className='dark:text-muted-foreground h-24 text-center text-sm text-[#6b7280]'
                    >
                      {t('No data available')}
                    </td>
                  </tr>
                )}
                {apiKeyPagination.pageRows.map((row) => (
                  <tr
                    key={row.tokenId}
                    className='dark:border-border border-b border-[#e5e7eb] transition-colors hover:bg-[#fafafa] dark:hover:bg-white/5'
                  >
                    <td className='dark:text-foreground px-3.5 py-[13px] text-[13px] font-semibold text-[#111827]'>
                      {row.name}
                    </td>
                    <td className={MUTED_NUM}>{formatNumber(row.requests)}</td>
                    <td className={MUTED_NUM}>
                      {formatCompactNumber(row.tokens)}
                    </td>
                    <td className={GREEN_NUM}>
                      {formatCost(row.quota, costDigits(row.quota))}
                    </td>
                    <td className={MUTED_NUM}>
                      {formatLastUsed(row.accessedTime)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <UsagePagination
            page={apiKeyPagination.page}
            totalPages={apiKeyPagination.totalPages}
            total={apiKeyPagination.total}
            pageSize={apiKeyPagination.pageSize}
            onPage={apiKeyPagination.setPage}
            onPageSize={apiKeyPagination.setPageSize}
          />
        </>
      )}
    </div>
  )
}
