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
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { SectionPageLayout } from '@/components/layout'
import { FadeIn } from '@/components/page-transition'
import { Button } from '@/components/ui/button'
import { getUserGroups } from '@/lib/api'
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
import { TimeRangeFilter } from './components/time-range-filter'
import { UsageBreakdownTable } from './components/usage-breakdown-table'
import { UsageOverviewChart } from './components/usage-overview-chart'
import {
  calculateDashboardStats,
  defaultGranularityForRange,
  rangeSpanMinutes,
  resolvePresetRange,
} from './lib'
import type { DashboardRange, UsageGranularity } from './types'

const QUERY_STALE_TIME = 60 * 1000

export function Dashboard() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const user = useAuthStore((state) => state.auth.user)

  const [range, setRange] = useState<DashboardRange>(() =>
    resolvePresetRange('today')
  )
  const [granularity, setGranularity] = useState<UsageGranularity>(() =>
    defaultGranularityForRange(resolvePresetRange('today'))
  )

  const handleRangeChange = useCallback((next: DashboardRange) => {
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
  const groupsQuery = useQuery({
    queryKey: ['dashboard', 'groups'],
    queryFn: getUserGroups,
    staleTime: 5 * 60 * 1000,
  })

  const quotaData = useMemo(
    () => (quotaQuery.data?.success ? (quotaQuery.data.data ?? []) : []),
    [quotaQuery.data]
  )
  const flowData = useMemo(
    () => (flowQuery.data?.success ? (flowQuery.data.data ?? []) : []),
    [flowQuery.data]
  )
  const totals = useMemo(() => calculateDashboardStats(quotaData), [quotaData])
  const metrics = metricsQuery.data?.success
    ? metricsQuery.data.data
    : undefined
  const groupNames = useMemo(() => {
    const groups = groupsQuery.data?.data
    if (!groups) return undefined
    const names: Record<string, string> = {}
    for (const [key, value] of Object.entries(groups)) {
      names[key] = value?.desc || key
    }
    return names
  }, [groupsQuery.data])

  const refreshing =
    quotaQuery.isFetching ||
    flowQuery.isFetching ||
    metricsQuery.isFetching ||
    apiKeysQuery.isFetching
  const handleRefresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
  }, [queryClient])

  const displayName = user?.display_name || user?.username || ''

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>{t('Dashboard')}</SectionPageLayout.Title>
      <SectionPageLayout.Actions>
        <Button
          type='button'
          variant='outline'
          size='sm'
          onClick={handleRefresh}
          disabled={refreshing}
        >
          <RefreshCw className={cn('size-3.5', refreshing && 'animate-spin')} />
          {refreshing ? t('Refreshing…') : t('Refresh')}
        </Button>
      </SectionPageLayout.Actions>
      <SectionPageLayout.Content>
        <div className='space-y-3 sm:space-y-4'>
          <FadeIn>
            <div className='flex flex-col gap-0.5'>
              <p className='text-lg font-semibold'>
                {displayName
                  ? t('Welcome back, {{name}}', { name: displayName })
                  : t('Welcome back')}
              </p>
              <p className='text-muted-foreground text-sm'>
                {t('Track your real-time LLM API routing and costs.')}
              </p>
            </div>
          </FadeIn>
          <FadeIn>
            <AccountStatusCards
              apiKeys={apiKeysQuery.data}
              apiKeysLoading={apiKeysQuery.isLoading}
            />
          </FadeIn>
          <FadeIn delay={0.05}>
            <div className='flex flex-col gap-2'>
              <span className='text-muted-foreground text-xs font-semibold tracking-wide uppercase'>
                {t('Usage Analytics')}
              </span>
              <TimeRangeFilter
                range={range}
                onRangeChange={handleRangeChange}
              />
            </div>
          </FadeIn>
          <FadeIn delay={0.1}>
            <KpiCards
              totals={totals}
              totalsLoading={quotaQuery.isLoading}
              metrics={metrics}
              rangeMinutes={rangeSpanMinutes(range)}
            />
          </FadeIn>
          <FadeIn delay={0.15}>
            <UsageOverviewChart
              data={quotaData}
              loading={quotaQuery.isLoading}
              granularity={granularity}
              onGranularityChange={setGranularity}
            />
          </FadeIn>
          <FadeIn delay={0.2}>
            <UsageBreakdownTable
              flowData={flowData}
              loading={flowQuery.isLoading}
              apiKeys={apiKeysQuery.data}
              groupNames={groupNames}
            />
          </FadeIn>
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
