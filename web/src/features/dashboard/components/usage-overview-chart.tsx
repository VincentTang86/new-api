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
import { VChart } from '@visactor/react-vchart'
import { BarChart3 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { IconBadge } from '@/components/ui/icon-badge'
import { useTheme } from '@/context/theme-provider'
import { formatCompactNumber, formatQuota } from '@/lib/format'
import { formatChartTime } from '@/lib/time'
import { VCHART_OPTION } from '@/lib/vchart'

import { USAGE_METRIC_OPTIONS } from '../constants'
import type { QuotaDataItem, UsageGranularity, UsageMetric } from '../types'

let themeManagerPromise: Promise<
  (typeof import('@visactor/vchart'))['ThemeManager']
> | null = null

interface UsageOverviewChartProps {
  data: QuotaDataItem[]
  loading?: boolean
  granularity: UsageGranularity
  onGranularityChange: (granularity: UsageGranularity) => void
}

const GRANULARITY_OPTIONS: { value: UsageGranularity; labelKey: string }[] = [
  { value: 'hour', labelKey: 'Hourly' },
  { value: 'day', labelKey: 'Daily' },
]

function metricValue(item: QuotaDataItem, metric: UsageMetric): number {
  if (metric === 'tokens') return Number(item.token_used) || 0
  if (metric === 'cost') return Number(item.quota) || 0
  return Number(item.count) || 0
}

export function UsageOverviewChart({
  data,
  loading,
  granularity,
  onGranularityChange,
}: UsageOverviewChartProps) {
  const { t } = useTranslation()
  const { resolvedTheme } = useTheme()
  const [metric, setMetric] = useState<UsageMetric>('tokens')
  const [themeReady, setThemeReady] = useState(false)
  const themeManagerRef = useRef<
    (typeof import('@visactor/vchart'))['ThemeManager'] | null
  >(null)

  useEffect(() => {
    const updateTheme = async () => {
      setThemeReady(false)
      if (!themeManagerPromise) {
        themeManagerPromise = import('@visactor/vchart').then(
          (m) => m.ThemeManager
        )
      }
      const ThemeManager = await themeManagerPromise
      themeManagerRef.current = ThemeManager
      ThemeManager.setCurrentTheme(resolvedTheme === 'dark' ? 'dark' : 'light')
      setThemeReady(true)
    }
    void updateTheme()
  }, [resolvedTheme])

  const formatValue = useMemo(() => {
    if (metric === 'cost') return (value: number) => formatQuota(value)
    return (value: number) => formatCompactNumber(value)
  }, [metric])

  const chartValues = useMemo(() => {
    // Aggregate hourly buckets into (time bucket × model) cells for the
    // selected metric; day granularity collapses 24 buckets into one key.
    const byTime = new Map<string, Map<string, number>>()
    const timeOrder: string[] = []
    const sorted = [...data].sort(
      (a, b) => Number(a.created_at) - Number(b.created_at)
    )
    for (const item of sorted) {
      const timeKey = formatChartTime(Number(item.created_at), granularity)
      const model = item.model_name || t('Unknown')
      let modelMap = byTime.get(timeKey)
      if (!modelMap) {
        modelMap = new Map()
        byTime.set(timeKey, modelMap)
        timeOrder.push(timeKey)
      }
      modelMap.set(
        model,
        (modelMap.get(model) ?? 0) + metricValue(item, metric)
      )
    }
    const values: { Time: string; Model: string; value: number }[] = []
    for (const timeKey of timeOrder) {
      for (const [model, value] of byTime.get(timeKey) ?? []) {
        values.push({ Time: timeKey, Model: model, value })
      }
    }
    return values
  }, [data, granularity, metric, t])

  const spec = useMemo(
    () => ({
      type: 'bar' as const,
      data: [{ id: 'usage', values: chartValues }],
      xField: 'Time',
      yField: 'value',
      seriesField: 'Model',
      stack: true,
      legends: { visible: true, orient: 'bottom' as const },
      bar: { state: { hover: { stroke: '#000', lineWidth: 1 } } },
      axes: [
        {
          orient: 'left' as const,
          label: {
            formatMethod: (value: string | number) =>
              formatValue(Number(value) || 0),
          },
        },
        { orient: 'bottom' as const, sampling: true },
      ],
      tooltip: {
        dimension: {
          updateContent: (
            items:
              | { key?: string; value?: string | number; datum?: unknown }[]
              | undefined
          ) => {
            if (!items?.length) return items
            let total = 0
            for (const item of items) {
              const raw = Number(item.value) || 0
              total += raw
              item.value = formatValue(raw)
            }
            items.push({ key: t('Total:'), value: formatValue(total) })
            return items
          },
        },
      },
      theme: resolvedTheme === 'dark' ? 'dark' : 'light',
      background: 'transparent',
    }),
    [chartValues, formatValue, resolvedTheme, t]
  )

  const chartKey = [
    metric,
    granularity,
    loading ? 'loading' : 'ready',
    chartValues.length,
    resolvedTheme,
  ].join('-')

  return (
    <div className='overflow-hidden rounded-lg border'>
      <div className='flex w-full flex-col gap-1.5 border-b px-3 py-2 sm:gap-3 sm:px-5 sm:py-3 lg:flex-row lg:items-center lg:justify-between'>
        <div className='flex items-center gap-2'>
          <IconBadge tone='info' size='sm'>
            <BarChart3 />
          </IconBadge>
          <span className='text-sm font-semibold'>{t('Usage Overview')}</span>
        </div>
        <div className='flex flex-wrap items-center gap-2 sm:gap-3'>
          <div className='bg-muted/60 inline-flex h-7 overflow-x-auto rounded-lg border p-0.5 sm:h-8'>
            {USAGE_METRIC_OPTIONS.map((option) => (
              <button
                key={option.value}
                type='button'
                onClick={() => setMetric(option.value)}
                className={`inline-flex shrink-0 items-center rounded-md px-3 text-xs font-medium transition-colors ${
                  metric === option.value
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {t(option.labelKey)}
              </button>
            ))}
          </div>
          <div className='flex items-center gap-2'>
            {GRANULARITY_OPTIONS.map((option) => (
              <button
                key={option.value}
                type='button'
                onClick={() => onGranularityChange(option.value)}
                className={`text-xs font-medium transition-colors ${
                  granularity === option.value
                    ? 'text-foreground'
                    : 'text-muted-foreground/60 hover:text-muted-foreground'
                }`}
              >
                {t(option.labelKey)}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className='h-[260px] p-1.5 sm:h-80 sm:p-2'>
        {themeReady && !loading && (
          <VChart key={chartKey} spec={spec} option={VCHART_OPTION} />
        )}
      </div>
    </div>
  )
}
