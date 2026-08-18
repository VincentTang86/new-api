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
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useTheme } from '@/context/theme-provider'
import { formatCompactNumber, formatQuota } from '@/lib/format'
import { formatChartTime } from '@/lib/time'
import { cn } from '@/lib/utils'
import { VCHART_OPTION } from '@/lib/vchart'

import { USAGE_METRIC_OPTIONS } from '../constants'
import type { QuotaDataItem, UsageGranularity, UsageMetric } from '../types'

let themeManagerPromise: Promise<
  (typeof import('@visactor/vchart'))['ThemeManager']
> | null = null

// Design palette (muted tones). Models are ranked by total usage and
// colored in order; the list cycles when there are more models.
const MODEL_COLORS = [
  '#6B798B',
  '#ADBCCC',
  '#E7DDD3',
  '#CFD8E4',
  '#E0E7DD',
  '#B7C4D1',
  '#D9CFC4',
  '#94A3B2',
  '#C9D6CB',
  '#E5D8E0',
]

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

  const { chartValues, modelOrder } = useMemo(() => {
    // Aggregate hourly buckets into (time bucket × model) cells for the
    // selected metric; day granularity collapses 24 buckets into one key.
    const byTime = new Map<string, Map<string, number>>()
    const modelTotals = new Map<string, number>()
    const timeOrder: string[] = []
    const sorted = [...data].sort(
      (a, b) => Number(a.created_at) - Number(b.created_at)
    )
    for (const item of sorted) {
      const timeKey = formatChartTime(Number(item.created_at), granularity)
      const model = item.model_name || t('Unknown')
      const value = metricValue(item, metric)
      let modelMap = byTime.get(timeKey)
      if (!modelMap) {
        modelMap = new Map()
        byTime.set(timeKey, modelMap)
        timeOrder.push(timeKey)
      }
      modelMap.set(model, (modelMap.get(model) ?? 0) + value)
      modelTotals.set(model, (modelTotals.get(model) ?? 0) + value)
    }
    const order = [...modelTotals.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([model]) => model)
    const values: { Time: string; Model: string; value: number }[] = []
    for (const timeKey of timeOrder) {
      for (const [model, value] of byTime.get(timeKey) ?? []) {
        values.push({ Time: timeKey, Model: model, value })
      }
    }
    return { chartValues: values, modelOrder: order }
  }, [data, granularity, metric, t])

  const spec = useMemo(
    () => ({
      type: 'bar' as const,
      data: [{ id: 'usage', values: chartValues }],
      xField: 'Time',
      yField: 'value',
      seriesField: 'Model',
      stack: true,
      color: {
        type: 'ordinal' as const,
        domain: modelOrder,
        range: MODEL_COLORS,
      },
      legends: {
        visible: true,
        orient: 'bottom' as const,
        item: {
          shape: { style: { symbolType: 'circle' as const, size: 8 } },
          label: { style: { fontSize: 12 } },
        },
      },
      axes: [
        {
          orient: 'left' as const,
          label: {
            style: { fontSize: 11 },
            formatMethod: (value: string | number) =>
              formatValue(Number(value) || 0),
          },
        },
        {
          orient: 'bottom' as const,
          sampling: true,
          label: {
            style: { fontSize: 11 },
            // Hour buckets are keyed "MM-DD HH:00" for cross-day rollup;
            // the axis shows only the clock part, as in the design.
            formatMethod: (value: string | number) =>
              granularity === 'hour'
                ? String(value).slice(-5)
                : String(value),
          },
        },
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
    [chartValues, formatValue, granularity, modelOrder, resolvedTheme, t]
  )

  const chartKey = [
    metric,
    granularity,
    loading ? 'loading' : 'ready',
    chartValues.length,
    resolvedTheme,
  ].join('-')

  return (
    <div className='dark:bg-card dark:border-border flex flex-col gap-[18px] rounded-xl border border-[#e5e7eb] bg-white p-[22px]'>
      <div className='flex flex-wrap items-center justify-between gap-2.5'>
        <span className='dark:text-foreground text-[15px] font-semibold text-[#111827]'>
          {t('Usage Overview')}
        </span>
        <div className='flex flex-wrap items-center gap-3.5'>
          <div className='dark:bg-muted flex items-center rounded-[8px] bg-[#f5f5f7] p-0.5'>
            {USAGE_METRIC_OPTIONS.map((option, index) => (
              <div key={option.value} className='flex items-center'>
                {index > 0 && (
                  <div className='dark:bg-border h-3.5 w-px bg-[#d1d6db]' />
                )}
                <button
                  type='button'
                  onClick={() => setMetric(option.value)}
                  className={cn(
                    'cursor-pointer rounded-[6px] px-3 py-[5px] text-xs transition-colors',
                    metric === option.value
                      ? 'bg-[#ff5a5f] font-semibold text-white'
                      : 'dark:text-muted-foreground font-medium text-[#666b78] hover:bg-[#e8e8eb] dark:hover:bg-white/10'
                  )}
                >
                  {t(option.labelKey)}
                </button>
              </div>
            ))}
          </div>
          <div className='dark:bg-border h-[18px] w-px bg-[#d9dee3]' />
          <div className='flex items-center gap-2.5'>
            {GRANULARITY_OPTIONS.map((option) => (
              <button
                key={option.value}
                type='button'
                onClick={() => onGranularityChange(option.value)}
                className={cn(
                  'cursor-pointer text-xs font-medium transition-colors',
                  granularity === option.value
                    ? 'dark:text-foreground text-[#111827]'
                    : 'dark:text-muted-foreground/60 text-[#999ea8] hover:text-[#6b7280]'
                )}
              >
                {t(option.labelKey)}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className='h-[240px]'>
        {themeReady && !loading && (
          <VChart key={chartKey} spec={spec} option={VCHART_OPTION} />
        )}
      </div>
    </div>
  )
}
