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
  Coins,
  Gauge,
  Hash,
  HelpCircle,
  Layers,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { IconBadge, type IconBadgeTone } from '@/components/ui/icon-badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { formatCompactNumber, formatNumber, formatQuota } from '@/lib/format'
import { cn } from '@/lib/utils'

import { safeDivide } from '../lib'
import type { UserLogMetrics } from '../types'

const PLACEHOLDER = '-'

interface KpiCardsProps {
  totals: { totalQuota: number; totalCount: number; totalTokens: number }
  totalsLoading: boolean
  metrics: UserLogMetrics | undefined
  rangeMinutes: number
}

interface KpiCardItem {
  key: string
  title: string
  tip: string
  icon: LucideIcon
  iconTone: IconBadgeTone
  value: string
  description: string
}

export function KpiCards({
  totals,
  totalsLoading,
  metrics,
  rangeMinutes,
}: KpiCardsProps) {
  const { t } = useTranslation()

  const { totalQuota, totalCount, totalTokens } = totals
  const avgRpm = safeDivide(totalCount, rangeMinutes, 2)
  const avgTpm = safeDivide(totalTokens, rangeMinutes, 2)
  const tokensPerRequest = totalCount > 0 ? totalTokens / totalCount : 0
  const avgCostPerRequest =
    totalCount > 0 ? formatQuota(totalQuota / totalCount) : PLACEHOLDER

  const attempted = metrics ? metrics.consume_count + metrics.error_count : 0
  const successRate =
    metrics && attempted > 0
      ? `${((metrics.consume_count / attempted) * 100).toFixed(1)}%`
      : PLACEHOLDER
  const errorsLine = metrics
    ? `${t('Errors')}: ${formatNumber(metrics.error_count)} / ${formatNumber(attempted)}`
    : `${t('Errors')}: ${PLACEHOLDER}`
  const avgResponse =
    metrics && metrics.consume_count > 0
      ? `${metrics.avg_use_time.toFixed(1)}s`
      : PLACEHOLDER
  const inOutLine = metrics
    ? `${t('In')}: ${formatCompactNumber(metrics.prompt_tokens)} / ${t('Out')}: ${formatCompactNumber(metrics.completion_tokens)}`
    : `${t('In')}: ${PLACEHOLDER} / ${t('Out')}: ${PLACEHOLDER}`

  const cards: KpiCardItem[] = [
    {
      key: 'requests',
      title: t('Requests'),
      tip: t('Total API requests completed in the selected period.'),
      icon: Hash,
      iconTone: 'info',
      value: formatNumber(totalCount),
      description: `${t('Avg RPM')}: ${formatNumber(avgRpm)} · ${formatCompactNumber(tokensPerRequest)} ${t('tok/req')}`,
    },
    {
      key: 'cost',
      title: t('Cost'),
      tip: t('Total spend based on tokens consumed at your rates.'),
      icon: Coins,
      iconTone: 'success',
      value: formatQuota(totalQuota),
      description: `${t('Avg')}: ${avgCostPerRequest}/${t('req')}`,
    },
    {
      key: 'tokens',
      title: t('Tokens'),
      tip: t('Total tokens processed, including both input and output.'),
      icon: Layers,
      iconTone: 'chart-4',
      value: formatCompactNumber(totalTokens),
      description: `${inOutLine} · ${formatCompactNumber(avgTpm)} TPM`,
    },
    {
      key: 'success-rate',
      title: t('Success Rate'),
      tip: t('Share of requests completed without error.'),
      icon: ShieldCheck,
      iconTone: 'chart-2',
      value: successRate,
      description: errorsLine,
    },
    {
      key: 'avg-response',
      title: t('Avg Response'),
      tip: t('Average end-to-end request latency.'),
      icon: Gauge,
      iconTone: 'warning',
      value: avgResponse,
      description: `P95: ${PLACEHOLDER}`,
    },
  ]

  return (
    <div className='overflow-hidden rounded-lg border'>
      <div className='divide-border/60 grid min-w-0 grid-cols-2 divide-x sm:grid-cols-3 lg:grid-cols-5'>
        {cards.map((card, index) => {
          const Icon = card.icon
          return (
            <div
              key={card.key}
              className={cn(
                'min-w-0 px-2.5 py-1.5 sm:px-5 sm:py-4',
                index === cards.length - 1 && 'col-span-2 sm:col-span-1'
              )}
            >
              <div className='flex items-center gap-1.5 sm:gap-2'>
                <IconBadge tone={card.iconTone} size='sm'>
                  <Icon />
                </IconBadge>
                <span className='text-muted-foreground truncate text-xs font-medium sm:text-sm'>
                  {card.title}
                </span>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <span className='text-muted-foreground/50 hover:text-muted-foreground hidden shrink-0 cursor-help sm:inline-flex' />
                    }
                  >
                    <HelpCircle className='size-3.5' />
                  </TooltipTrigger>
                  <TooltipContent className='max-w-56'>
                    {card.tip}
                  </TooltipContent>
                </Tooltip>
              </div>
              {totalsLoading ? (
                <>
                  <Skeleton className='mt-1 h-5 w-16 sm:mt-2 sm:h-7 sm:w-20' />
                  <Skeleton className='mt-1 hidden h-3.5 w-28 md:block' />
                </>
              ) : (
                <>
                  <div className='mt-1 truncate font-mono text-base font-semibold tracking-tight tabular-nums sm:mt-2 sm:text-2xl'>
                    {card.value}
                  </div>
                  <div className='text-muted-foreground/60 mt-1 hidden truncate text-xs md:block'>
                    {card.description}
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
