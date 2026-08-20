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
import { useQuery } from '@tanstack/react-query'
import { Loader2, Search, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { FadeIn } from '@/components/page-transition'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { TimeGranularity } from '@/lib/time'
import type { TimeRange } from '@/lib/time-range'

import { getAllQuotaData } from '../api'
import { TIME_GRANULARITY_OPTIONS } from '../constants'
import type { ModelChartsFilters } from '../types'
import { ConsumptionDistributionChart } from './models/consumption-distribution-chart'
import { LogStatCards } from './models/log-stat-cards'
import { ModelCharts } from './models/model-charts'
import { PerformanceOverview } from './models/performance-overview'

interface ModelAnalyticsProps {
  range: TimeRange
  filters: ModelChartsFilters
  onFiltersChange: (filters: ModelChartsFilters) => void
}

export function ModelAnalytics(props: ModelAnalyticsProps) {
  const { t } = useTranslation()
  // The input is a draft; the query only refetches on an applied username so
  // typing does not fire one request per keystroke.
  const [usernameDraft, setUsernameDraft] = useState(props.filters.username)

  const timeRange = useMemo(
    () => ({
      start_timestamp: props.range.start,
      end_timestamp: props.range.end,
    }),
    [props.range.start, props.range.end]
  )
  const rangeMinutes =
    (timeRange.end_timestamp - timeRange.start_timestamp) / 60

  const username = props.filters.username.trim()
  const quotaQuery = useQuery({
    queryKey: ['admin-dashboard', 'models', timeRange, username],
    queryFn: () =>
      getAllQuotaData({
        ...timeRange,
        ...(username && { username }),
      }),
    select: (res) => (res.success ? res.data : []),
    staleTime: 60_000,
  })

  const data = quotaQuery.data ?? []
  const loading = quotaQuery.isLoading

  const applyUsername = (value: string) => {
    setUsernameDraft(value)
    props.onFiltersChange({ ...props.filters, username: value })
  }

  return (
    <div className='space-y-3 sm:space-y-4'>
      <div className='flex flex-wrap items-center gap-1.5 sm:gap-2'>
        <Tabs
          value={props.filters.timeGranularity}
          onValueChange={(value) =>
            props.onFiltersChange({
              ...props.filters,
              timeGranularity: value as TimeGranularity,
            })
          }
          className='shrink-0'
        >
          <TabsList>
            {TIME_GRANULARITY_OPTIONS.map((opt) => (
              <TabsTrigger
                key={opt.value}
                value={opt.value}
                className='px-2.5 text-xs'
              >
                {t(opt.labelKey)}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <form
          className='relative flex items-center'
          onSubmit={(event) => {
            event.preventDefault()
            applyUsername(usernameDraft.trim())
          }}
        >
          <Search
            className='text-muted-foreground pointer-events-none absolute left-2.5 size-3.5'
            aria-hidden='true'
          />
          <Input
            value={usernameDraft}
            onChange={(event) => setUsernameDraft(event.target.value)}
            onBlur={() => applyUsername(usernameDraft.trim())}
            placeholder={t('Filter by username')}
            aria-label={t('Filter by username')}
            className='h-8 w-44 pl-8 text-xs sm:w-52'
          />
          {username && (
            <Button
              type='button'
              variant='ghost'
              size='icon'
              className='text-muted-foreground hover:text-foreground absolute right-1 size-6'
              aria-label={t('Reset')}
              onClick={() => applyUsername('')}
            >
              <X className='size-3.5' />
            </Button>
          )}
        </form>

        {(loading || quotaQuery.isFetching) && (
          <Loader2 className='text-muted-foreground size-4 animate-spin' />
        )}
      </div>

      <FadeIn>
        <LogStatCards
          data={data}
          loading={loading}
          error={quotaQuery.isError}
          rangeMinutes={rangeMinutes}
        />
      </FadeIn>
      <FadeIn delay={0.05}>
        <PerformanceOverview />
      </FadeIn>
      <FadeIn delay={0.1}>
        <ConsumptionDistributionChart
          data={data}
          loading={loading}
          timeGranularity={props.filters.timeGranularity}
        />
      </FadeIn>
      <FadeIn delay={0.15}>
        <ModelCharts
          data={data}
          loading={loading}
          timeGranularity={props.filters.timeGranularity}
        />
      </FadeIn>
    </div>
  )
}
