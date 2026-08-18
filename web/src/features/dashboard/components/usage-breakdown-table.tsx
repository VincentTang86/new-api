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
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { Fragment, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { NativeSelect } from '@/components/ui/native-select'
import { Skeleton } from '@/components/ui/skeleton'
import type { ApiKey } from '@/features/keys/types'
import dayjs from '@/lib/dayjs'
import { formatCompactNumber, formatNumber, formatQuota } from '@/lib/format'
import { cn } from '@/lib/utils'

import { BREAKDOWN_PAGE_SIZES } from '../constants'
import type { BreakdownTab, FlowQuotaDataItem } from '../types'

const PLACEHOLDER = '-'

const TH_CLASS =
  'px-3.5 py-[11px] text-xs font-semibold text-[#6b7280] dark:text-muted-foreground'
const NUM_CELL = 'px-3.5 py-[13px] text-right text-[13px] tabular-nums'
const MUTED_NUM = cn(NUM_CELL, 'text-[#6b7280] dark:text-muted-foreground')
const GREEN_NUM = cn(NUM_CELL, 'font-semibold text-[#10b981]')
const DASH_NUM = cn(NUM_CELL, 'text-[#9ca3af] dark:text-muted-foreground/60')

interface UsageBreakdownTableProps {
  flowData: FlowQuotaDataItem[]
  loading?: boolean
  apiKeys: ApiKey[] | undefined
}

interface UsageTotals {
  requests: number
  tokens: number
  quota: number
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

function addTotals(target: UsageTotals, item: FlowQuotaDataItem) {
  target.requests += Number(item.count) || 0
  target.tokens += Number(item.token_used) || 0
  target.quota += Number(item.quota) || 0
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

function PaginationFooter(props: {
  page: number
  totalPages: number
  total: number
  pageSize: number
  onPage: (page: number) => void
  onPageSize: (size: number) => void
}) {
  const { t } = useTranslation()
  return (
    <div className='dark:border-border flex items-center justify-between gap-2 border-t border-[#e5e7eb] px-3.5 py-2'>
      <div className='dark:text-muted-foreground flex items-center gap-2 text-xs text-[#6b7280]'>
        <span>{t('Rows per page')}</span>
        <NativeSelect
          className='h-7 w-16 text-xs'
          value={String(props.pageSize)}
          onChange={(event) => props.onPageSize(Number(event.target.value))}
        >
          {BREAKDOWN_PAGE_SIZES.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </NativeSelect>
      </div>
      <div className='flex items-center gap-1.5'>
        <span className='dark:text-muted-foreground text-xs text-[#6b7280]'>
          {t('{{page}} of {{totalPages}}', {
            page: props.page,
            totalPages: props.totalPages,
          })}
        </span>
        <button
          type='button'
          className='dark:border-border dark:bg-card flex size-7 cursor-pointer items-center justify-center rounded-[6px] border border-[#e5e7eb] bg-white text-[#6b7280] transition-colors hover:bg-[#f9fafb] disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-white/10'
          disabled={props.page <= 1}
          onClick={() => props.onPage(props.page - 1)}
        >
          <ChevronLeft className='size-4' />
        </button>
        <button
          type='button'
          className='dark:border-border dark:bg-card flex size-7 cursor-pointer items-center justify-center rounded-[6px] border border-[#e5e7eb] bg-white text-[#6b7280] transition-colors hover:bg-[#f9fafb] disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-white/10'
          disabled={props.page >= props.totalPages}
          onClick={() => props.onPage(props.page + 1)}
        >
          <ChevronRight className='size-4' />
        </button>
      </div>
    </div>
  )
}

export function UsageBreakdownTable({
  flowData,
  loading,
  apiKeys,
}: UsageBreakdownTableProps) {
  const { t } = useTranslation()
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
        row = { model, requests: 0, tokens: 0, quota: 0, groups: [] }
        byModel.set(model, row)
      }
      addTotals(row, item)
      const groupKey = item.use_group || ''
      let groupRow = row.groups.find((entry) => entry.group === groupKey)
      if (!groupRow) {
        groupRow = { group: groupKey, requests: 0, tokens: 0, quota: 0 }
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
        if (item.token_name) {
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
          requests: 0,
          tokens: 0,
          quota: 0,
          accessedTime: keyById.get(tokenId)?.accessed_time,
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

  const formatLastUsed = (accessedTime?: number) => {
    if (!accessedTime || accessedTime <= 0) return PLACEHOLDER
    return dayjs.unix(accessedTime).fromNow()
  }

  return (
    <div className='dark:bg-card dark:border-border flex flex-col overflow-hidden rounded-xl border border-[#e5e7eb] bg-white'>
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
        <div className='space-y-2 p-4'>
          <Skeleton className='h-8 w-full' />
          <Skeleton className='h-8 w-full' />
          <Skeleton className='h-8 w-full' />
        </div>
      )}
      {!loading && tab === 'model' && (
        <>
          <div className='overflow-x-auto'>
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
                    {t('Standard Cost')}
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
                {modelPagination.pageRows.map((row) => (
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
                          ? formatNumber(Math.round(row.tokens / row.requests))
                          : PLACEHOLDER}
                      </td>
                      <td className={GREEN_NUM}>{formatQuota(row.quota)}</td>
                      <td className={DASH_NUM}>{PLACEHOLDER}</td>
                      <td className={DASH_NUM}>{PLACEHOLDER}</td>
                    </tr>
                    {expandedModels.has(row.model) &&
                      row.groups.map((groupRow) => (
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
                            {formatQuota(groupRow.quota)}
                          </td>
                          <td className={cn(DASH_NUM, 'py-[9px] text-xs')}>
                            {PLACEHOLDER}
                          </td>
                          <td className={cn(DASH_NUM, 'py-[9px] text-xs')}>
                            {PLACEHOLDER}
                          </td>
                        </tr>
                      ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
          <PaginationFooter
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
          <div className='overflow-x-auto'>
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
                    <td className={GREEN_NUM}>{formatQuota(row.quota)}</td>
                    <td className={MUTED_NUM}>
                      {formatLastUsed(row.accessedTime)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <PaginationFooter
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
