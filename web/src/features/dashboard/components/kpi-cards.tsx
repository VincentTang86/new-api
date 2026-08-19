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
import { HelpCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Skeleton } from '@/components/ui/skeleton'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { formatCompactNumber, formatNumber, formatQuota } from '@/lib/format'

import { safeDivide } from '../lib'
import type { UserLogMetrics } from '../types'

const PLACEHOLDER = '-'

interface KpiCardsProps {
  metrics: UserLogMetrics | undefined
  metricsLoading: boolean
  rangeMinutes: number
}

interface KpiCardItem {
  key: string
  title: string
  tip: string
  value: string
  description: string
}

export function KpiCards({
  metrics,
  metricsLoading,
  rangeMinutes,
}: KpiCardsProps) {
  const { t } = useTranslation()

  // Every card reads the same consume/error log aggregate. Mixing in the
  // pre-aggregated quota_data here is what used to make the request count
  // disagree with the success-rate denominator, and the token headline
  // disagree with its own in/out breakdown.
  const totalQuota = metrics?.quota ?? 0
  const succeeded = metrics?.consume_count ?? 0
  const failed = metrics?.error_count ?? 0
  const attempted = succeeded + failed
  const totalTokens = metrics
    ? metrics.prompt_tokens + metrics.completion_tokens
    : 0

  const avgRpm = safeDivide(attempted, rangeMinutes, 2)
  // Averaged over the whole range (same rule as the legacy dashboard), a
  // long window with light traffic rounds to 0.00 — show a floor instead
  // of a misleading zero.
  const avgRpmDisplay =
    attempted > 0 && avgRpm < 0.01 ? '<0.01' : formatNumber(avgRpm)
  const avgTpm = safeDivide(totalTokens, rangeMinutes, 2)
  const tokensPerRequest = attempted > 0 ? totalTokens / attempted : 0
  const avgCostPerRequest =
    succeeded > 0 ? formatQuota(totalQuota / succeeded) : PLACEHOLDER

  const successRate =
    metrics && attempted > 0
      ? `${((succeeded / attempted) * 100).toFixed(1)}%`
      : PLACEHOLDER
  const errorsLine = metrics
    ? `${t('Errors')}: ${formatNumber(failed)} / ${formatNumber(attempted)}`
    : `${t('Errors')}: ${PLACEHOLDER}`
  const avgResponse =
    metrics && succeeded > 0
      ? `${metrics.avg_use_time.toFixed(1)}s`
      : PLACEHOLDER
  const inOutLine = metrics
    ? `${t('In')}: ${formatCompactNumber(metrics.prompt_tokens)} / ${t('Out')}: ${formatCompactNumber(metrics.completion_tokens)}`
    : `${t('In')}: ${PLACEHOLDER} / ${t('Out')}: ${PLACEHOLDER}`

  const cards: KpiCardItem[] = [
    {
      key: 'requests',
      title: t('Requests'),
      // Attempts, not completions: this is the same denominator the success
      // rate reports, so the two cards can never drift apart.
      tip: t('Total API requests attempted in the selected period.'),
      value: metrics ? formatNumber(attempted) : PLACEHOLDER,
      description: `${t('Avg RPM')}: ${avgRpmDisplay} · ${formatCompactNumber(tokensPerRequest)} ${t('tok/req')}`,
    },
    {
      key: 'cost',
      title: t('Cost'),
      tip: t('Total spend based on tokens consumed at your rates.'),
      value: metrics ? formatQuota(totalQuota) : PLACEHOLDER,
      description: `${t('Avg')}: ${avgCostPerRequest}/${t('req')}`,
    },
    {
      key: 'tokens',
      title: t('Tokens'),
      tip: t('Total tokens processed, including both input and output.'),
      value: metrics ? formatCompactNumber(totalTokens) : PLACEHOLDER,
      description: `${inOutLine} · ${formatCompactNumber(avgTpm)} TPM`,
    },
    {
      key: 'success-rate',
      title: t('Success Rate'),
      tip: t('Share of requests completed without error.'),
      value: successRate,
      description: errorsLine,
    },
    {
      key: 'avg-response',
      title: t('Avg Response'),
      tip: t('Average end-to-end request latency.'),
      value: avgResponse,
      description: `P95: ${PLACEHOLDER}`,
    },
  ]

  return (
    // Without a provider these tips inherit Base UI's 600ms rest delay; ours
    // defaults to zero so the tip tracks the pointer immediately.
    <TooltipProvider>
      <div className='flex flex-wrap gap-3'>
        {cards.map((card) => (
          <div
            key={card.key}
            className='dark:bg-card dark:border-border flex min-w-[150px] flex-1 flex-col gap-2.5 rounded-xl border border-[#e5e7eb] bg-white p-[18px]'
          >
            <div className='flex items-center gap-1.5'>
              <span className='dark:text-muted-foreground text-xs font-semibold whitespace-nowrap text-[#6b7280]'>
                {card.title}
              </span>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <span className='hover:text-muted-foreground shrink-0 cursor-help text-[#9ca3af]' />
                  }
                >
                  <HelpCircle className='size-3.5' />
                </TooltipTrigger>
                <TooltipContent className='max-w-56'>{card.tip}</TooltipContent>
              </Tooltip>
            </div>
            {metricsLoading ? (
              <>
                <Skeleton className='h-8 w-20' />
                <Skeleton className='h-3.5 w-28' />
              </>
            ) : (
              <>
                <div className='dark:text-foreground text-[26px] leading-tight font-bold tracking-tight text-[#111827] tabular-nums'>
                  {card.value}
                </div>
                <div className='dark:text-muted-foreground text-[11px] leading-relaxed text-[#6b7280]'>
                  {card.description}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </TooltipProvider>
  )
}
