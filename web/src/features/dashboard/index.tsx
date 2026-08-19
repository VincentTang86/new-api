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
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { SectionPageLayout } from '@/components/layout'
import { FadeIn } from '@/components/page-transition'
import { TimeRangeFilter } from '@/components/time-range-filter'
import {
  rangeSpanMinutes,
  resolvePresetRange,
  type TimeRange,
} from '@/lib/time-range'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'

import {
  getAllApiKeys,
  getSelfFlowQuotaDates,
  getSelfLogMetrics,
  getSelfQuotaDates,
} from './api'
import { AccountStatusCards } from './components/account-status-cards'
import { KpiCards } from './components/kpi-cards'
import { UsageBreakdownTable } from './components/usage-breakdown-table'
import { UsageOverviewChart } from './components/usage-overview-chart'
import { MAX_RANGE_DAYS } from './constants'
import { defaultGranularityForRange } from './lib'
import type { UsageGranularity } from './types'

const QUERY_STALE_TIME = 60 * 1000

export function Dashboard() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const user = useAuthStore((state) => state.auth.user)

  const [range, setRange] = useState<TimeRange>(() =>
    resolvePresetRange('today', MAX_RANGE_DAYS)
  )
  const [granularity, setGranularity] = useState<UsageGranularity>(() =>
    defaultGranularityForRange(resolvePresetRange('today', MAX_RANGE_DAYS))
  )

  const handleRangeChange = useCallback((next: TimeRange) => {
    setRange(next)
    setGranularity(defaultGranularityForRange(next))
  }, [])

  const rangeParams = {
    start_timestamp: range.start,
    end_timestamp: range.end,
  }

  const quotaQuery = useQuery({
    queryKey: ['dashboard', 'quota', range.start, range.end],
    queryFn: () => getSelfQuotaDates(rangeParams),
    staleTime: QUERY_STALE_TIME,
  })
  const flowQuery = useQuery({
    queryKey: ['dashboard', 'flow', range.start, range.end],
    queryFn: () => getSelfFlowQuotaDates(rangeParams),
    staleTime: QUERY_STALE_TIME,
  })
  const metricsQuery = useQuery({
    queryKey: ['dashboard', 'metrics', range.start, range.end],
    queryFn: () => getSelfLogMetrics(rangeParams),
    staleTime: QUERY_STALE_TIME,
    retry: false,
  })
  const apiKeysQuery = useQuery({
    queryKey: ['dashboard', 'api-keys'],
    queryFn: getAllApiKeys,
    staleTime: QUERY_STALE_TIME,
  })

  const quotaData = useMemo(
    () => (quotaQuery.data?.success ? (quotaQuery.data.data ?? []) : []),
    [quotaQuery.data]
  )
  const flowData = useMemo(
    () => (flowQuery.data?.success ? (flowQuery.data.data ?? []) : []),
    [flowQuery.data]
  )
  const metrics = metricsQuery.data?.success
    ? metricsQuery.data.data
    : undefined

  const refreshing =
    quotaQuery.isFetching ||
    flowQuery.isFetching ||
    metricsQuery.isFetching ||
    apiKeysQuery.isFetching
  const handleRefresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
  }, [queryClient])

  const displayName = user?.display_name || user?.username || ''

  // The breakdown card has to stand at least as tall as the overview chart
  // card, empty state included. That height is not a constant: the chart
  // header wraps on narrow viewports, so measure it instead of hardcoding.
  const overviewRef = useRef<HTMLDivElement>(null)
  const [overviewHeight, setOverviewHeight] = useState(0)
  useEffect(() => {
    const node = overviewRef.current
    if (!node) return
    const observer = new ResizeObserver(([entry]) => {
      setOverviewHeight(entry.contentRect.height)
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  return (
    <SectionPageLayout stickyHeader={false}>
      <SectionPageLayout.Title>
        {displayName
          ? t('Welcome back, {{name}}', { name: displayName })
          : t('Welcome back')}
      </SectionPageLayout.Title>
      <SectionPageLayout.Actions>
        <button
          type='button'
          onClick={handleRefresh}
          disabled={refreshing}
          className='dark:border-border dark:bg-card flex cursor-pointer items-center gap-[7px] rounded-[6px] border border-[#e5e7eb] bg-white px-3.5 py-[8px] transition-colors hover:bg-[#f9fafb] disabled:cursor-default dark:hover:bg-white/10'
        >
          <RefreshCw
            className={cn(
              'size-3.5',
              refreshing
                ? 'animate-spin text-[#ff5a5f]'
                : 'dark:text-muted-foreground text-[#6b7280]'
            )}
            style={refreshing ? { animationDuration: '0.7s' } : undefined}
          />
          <span
            className={cn(
              'text-[13px] font-semibold',
              refreshing
                ? 'text-[#ff5a5f]'
                : 'dark:text-foreground text-[#111827]'
            )}
          >
            {refreshing ? t('Refreshing…') : t('Refresh')}
          </span>
        </button>
      </SectionPageLayout.Actions>
      <SectionPageLayout.Content>
        <div className='space-y-6 sm:space-y-7'>
          <FadeIn>
            <p className='dark:text-muted-foreground text-[13px] text-[#6b7280]'>
              {t('Track your real-time LLM API routing and costs.')}
            </p>
          </FadeIn>
          <FadeIn>
            <AccountStatusCards
              apiKeys={apiKeysQuery.data}
              apiKeysLoading={apiKeysQuery.isLoading}
            />
          </FadeIn>
          <FadeIn delay={0.05}>
            <div className='flex flex-col gap-2.5'>
              <span className='text-xs font-semibold tracking-[0.5px] text-[#9ca3af] uppercase'>
                {t('Usage Analytics')}
              </span>
              <TimeRangeFilter
                range={range}
                onRangeChange={handleRangeChange}
                maxRangeDays={MAX_RANGE_DAYS}
              />
            </div>
          </FadeIn>
          <FadeIn delay={0.1}>
            <KpiCards
              metrics={metrics}
              metricsLoading={metricsQuery.isLoading}
              rangeMinutes={rangeSpanMinutes(range)}
            />
          </FadeIn>
          <FadeIn delay={0.15}>
            <div ref={overviewRef}>
              <UsageOverviewChart
                data={quotaData}
                loading={quotaQuery.isLoading}
                granularity={granularity}
                onGranularityChange={setGranularity}
              />
            </div>
          </FadeIn>
          <FadeIn delay={0.2}>
            <UsageBreakdownTable
              flowData={flowData}
              loading={flowQuery.isLoading}
              apiKeys={apiKeysQuery.data}
              minHeight={overviewHeight}
            />
          </FadeIn>
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
