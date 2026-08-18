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
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  TableProperties,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { IconBadge } from '@/components/ui/icon-badge'
import { NativeSelect } from '@/components/ui/native-select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { ApiKey } from '@/features/keys/types'
import dayjs from '@/lib/dayjs'
import { formatCompactNumber, formatNumber, formatQuota } from '@/lib/format'
import { cn } from '@/lib/utils'

import { BREAKDOWN_PAGE_SIZES } from '../constants'
import type { BreakdownTab, FlowQuotaDataItem } from '../types'

const PLACEHOLDER = '-'

interface UsageBreakdownTableProps {
  flowData: FlowQuotaDataItem[]
  loading?: boolean
  apiKeys: ApiKey[] | undefined
  groupNames: Record<string, string> | undefined
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
    <div className='flex items-center justify-between gap-2 border-t px-3 py-2 sm:px-5'>
      <div className='text-muted-foreground flex items-center gap-2 text-xs'>
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
        <span className='text-muted-foreground text-xs'>
          {t('{{page}} of {{totalPages}}', {
            page: props.page,
            totalPages: props.totalPages,
          })}
        </span>
        <Button
          type='button'
          variant='outline'
          size='icon'
          className='size-7'
          disabled={props.page <= 1}
          onClick={() => props.onPage(props.page - 1)}
        >
          <ChevronLeft className='size-4' />
        </Button>
        <Button
          type='button'
          variant='outline'
          size='icon'
          className='size-7'
          disabled={props.page >= props.totalPages}
          onClick={() => props.onPage(props.page + 1)}
        >
          <ChevronRight className='size-4' />
        </Button>
      </div>
    </div>
  )
}

export function UsageBreakdownTable({
  flowData,
  loading,
  apiKeys,
  groupNames,
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

  const groupLabel = (group: string) => {
    if (!group) return t('Unknown')
    return groupNames?.[group] ?? group
  }

  const formatLastUsed = (accessedTime?: number) => {
    if (!accessedTime || accessedTime <= 0) return PLACEHOLDER
    return dayjs.unix(accessedTime).fromNow()
  }

  const numericCell = 'text-right font-mono text-xs tabular-nums sm:text-sm'

  return (
    <div className='overflow-hidden rounded-lg border'>
      <div className='flex w-full items-center justify-between gap-2 border-b px-3 py-2 sm:px-5 sm:py-3'>
        <div className='flex items-center gap-2'>
          <IconBadge tone='success' size='sm'>
            <TableProperties />
          </IconBadge>
          <span className='text-sm font-semibold'>{t('Usage Breakdown')}</span>
        </div>
        <div className='bg-muted/60 inline-flex h-7 rounded-lg border p-0.5 sm:h-8'>
          {(
            [
              { value: 'model', labelKey: 'By Model' },
              { value: 'apikey', labelKey: 'By API Key' },
            ] as const
          ).map((option) => (
            <button
              key={option.value}
              type='button'
              onClick={() => setTab(option.value)}
              className={`inline-flex shrink-0 items-center rounded-md px-3 text-xs font-medium transition-colors ${
                tab === option.value
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t(option.labelKey)}
            </button>
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
            <Table className='min-w-[720px]'>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('Model')}</TableHead>
                  <TableHead className='text-right'>{t('Requests')}</TableHead>
                  <TableHead className='text-right'>{t('Tokens')}</TableHead>
                  <TableHead className='text-right'>
                    {t('Avg Tok/Req')}
                  </TableHead>
                  <TableHead className='text-right'>
                    {t('Actual Cost')}
                  </TableHead>
                  <TableHead className='text-right'>
                    {t('Standard Cost')}
                  </TableHead>
                  <TableHead className='text-right'>{t('Savings')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {modelPagination.pageRows.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className='text-muted-foreground h-24 text-center text-sm'
                    >
                      {t('No data available')}
                    </TableCell>
                  </TableRow>
                )}
                {modelPagination.pageRows.map((row) => (
                  <>
                    <TableRow
                      key={row.model}
                      className='cursor-pointer'
                      onClick={() => toggleModel(row.model)}
                    >
                      <TableCell className='font-medium'>
                        <span className='flex items-center gap-1.5'>
                          <ChevronDown
                            className={cn(
                              'text-muted-foreground size-3.5 transition-transform',
                              !expandedModels.has(row.model) && '-rotate-90'
                            )}
                          />
                          {row.model}
                        </span>
                      </TableCell>
                      <TableCell className={numericCell}>
                        {formatNumber(row.requests)}
                      </TableCell>
                      <TableCell className={numericCell}>
                        {formatCompactNumber(row.tokens)}
                      </TableCell>
                      <TableCell className={numericCell}>
                        {row.requests > 0
                          ? formatNumber(Math.round(row.tokens / row.requests))
                          : PLACEHOLDER}
                      </TableCell>
                      <TableCell className={cn(numericCell, 'text-success')}>
                        {formatQuota(row.quota)}
                      </TableCell>
                      <TableCell
                        className={cn(numericCell, 'text-muted-foreground')}
                      >
                        {PLACEHOLDER}
                      </TableCell>
                      <TableCell
                        className={cn(numericCell, 'text-muted-foreground')}
                      >
                        {PLACEHOLDER}
                      </TableCell>
                    </TableRow>
                    {expandedModels.has(row.model) &&
                      row.groups.map((groupRow) => (
                        <TableRow
                          key={`${row.model}-${groupRow.group}`}
                          className='bg-muted/30'
                        >
                          <TableCell className='text-muted-foreground pl-10 text-xs'>
                            {groupLabel(groupRow.group)}
                          </TableCell>
                          <TableCell className={numericCell}>
                            {formatNumber(groupRow.requests)}
                          </TableCell>
                          <TableCell className={numericCell}>
                            {formatCompactNumber(groupRow.tokens)}
                          </TableCell>
                          <TableCell className={numericCell}>
                            {groupRow.requests > 0
                              ? formatNumber(
                                  Math.round(
                                    groupRow.tokens / groupRow.requests
                                  )
                                )
                              : PLACEHOLDER}
                          </TableCell>
                          <TableCell
                            className={cn(numericCell, 'text-success')}
                          >
                            {formatQuota(groupRow.quota)}
                          </TableCell>
                          <TableCell
                            className={cn(numericCell, 'text-muted-foreground')}
                          >
                            {PLACEHOLDER}
                          </TableCell>
                          <TableCell
                            className={cn(numericCell, 'text-muted-foreground')}
                          >
                            {PLACEHOLDER}
                          </TableCell>
                        </TableRow>
                      ))}
                  </>
                ))}
              </TableBody>
            </Table>
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
            <Table className='min-w-[560px]'>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('API Keys')}</TableHead>
                  <TableHead className='text-right'>{t('Requests')}</TableHead>
                  <TableHead className='text-right'>{t('Tokens')}</TableHead>
                  <TableHead className='text-right'>{t('Cost')}</TableHead>
                  <TableHead className='text-right'>{t('Last Used')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {apiKeyPagination.pageRows.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className='text-muted-foreground h-24 text-center text-sm'
                    >
                      {t('No data available')}
                    </TableCell>
                  </TableRow>
                )}
                {apiKeyPagination.pageRows.map((row) => (
                  <TableRow key={row.tokenId}>
                    <TableCell className='font-medium'>{row.name}</TableCell>
                    <TableCell className={numericCell}>
                      {formatNumber(row.requests)}
                    </TableCell>
                    <TableCell className={numericCell}>
                      {formatCompactNumber(row.tokens)}
                    </TableCell>
                    <TableCell className={cn(numericCell, 'text-success')}>
                      {formatQuota(row.quota)}
                    </TableCell>
                    <TableCell
                      className={cn(numericCell, 'text-muted-foreground')}
                    >
                      {formatLastUsed(row.accessedTime)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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
