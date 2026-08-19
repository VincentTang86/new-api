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
import { getRouteApi, useNavigate } from '@tanstack/react-router'
import { Eye, EyeOff } from 'lucide-react'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { SectionPageLayout } from '@/components/layout'
import { FadeIn } from '@/components/page-transition'
import { TimeRangeFilter } from '@/components/time-range-filter'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { resolvePresetRange, type TimeRange } from '@/lib/time-range'

import { FlowCharts } from './components/flow-charts'
import { UserCharts } from './components/user-charts'
import { USAGE_ANALYTICS_MAX_RANGE_DAYS } from './constants'
import { defaultTimeGranularityForRange } from './lib'
import {
  USAGE_ANALYTICS_DEFAULT_SECTION,
  USAGE_ANALYTICS_SECTION_IDS,
  USAGE_ANALYTICS_SECTION_META,
  isUsageAnalyticsSectionId,
  type UsageAnalyticsSectionId,
} from './section-registry'
import type { UserChartsFilters } from './types'

const route = getRouteApi('/_authenticated/usage-analytics/$section')

// A day of flow data is close to empty on most deployments, so the page opens
// on a week rather than on today.
const INITIAL_RANGE_KEY = '7days'
const DEFAULT_TOP_USER_LIMIT = 10

export function UsageAnalytics() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const params = route.useParams()
  const section: UsageAnalyticsSectionId = isUsageAnalyticsSectionId(
    params.section
  )
    ? params.section
    : USAGE_ANALYTICS_DEFAULT_SECTION

  const [range, setRange] = useState<TimeRange>(() =>
    resolvePresetRange(INITIAL_RANGE_KEY, USAGE_ANALYTICS_MAX_RANGE_DAYS)
  )
  const [userFilters, setUserFilters] = useState<UserChartsFilters>(() => ({
    timeGranularity: defaultTimeGranularityForRange(
      resolvePresetRange(INITIAL_RANGE_KEY, USAGE_ANALYTICS_MAX_RANGE_DAYS)
    ),
    topUserLimit: DEFAULT_TOP_USER_LIMIT,
  }))
  // The Sankey labels every user, token and channel by name, so the page owns
  // a way to blank them out before sharing a screen.
  const [sensitiveVisible, setSensitiveVisible] = useState(true)

  const handleRangeChange = useCallback((next: TimeRange) => {
    setRange(next)
    // Reseed the bucket size: a quarter-long window on hourly buckets would
    // put tens of thousands of points into the trend chart.
    setUserFilters((prev) => ({
      ...prev,
      timeGranularity: defaultTimeGranularityForRange(next),
    }))
  }, [])

  const handleSectionChange = useCallback(
    (next: string) => {
      if (!isUsageAnalyticsSectionId(next)) return
      void navigate({
        to: '/usage-analytics/$section',
        params: { section: next },
      })
    },
    [navigate]
  )

  return (
    <SectionPageLayout stickyHeader={false}>
      <SectionPageLayout.Title>{t('Usage Analytics')}</SectionPageLayout.Title>
      <SectionPageLayout.Actions>
        {section === 'flow' && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant='ghost'
                    size='icon'
                    className='text-muted-foreground hover:text-foreground size-8'
                    aria-label={t(
                      sensitiveVisible
                        ? 'Hide sensitive data'
                        : 'Show sensitive data'
                    )}
                    onClick={() => setSensitiveVisible((prev) => !prev)}
                  />
                }
              >
                {sensitiveVisible ? (
                  <Eye className='size-4' />
                ) : (
                  <EyeOff className='size-4' />
                )}
              </TooltipTrigger>
              <TooltipContent>
                {t(
                  sensitiveVisible
                    ? 'Hide sensitive data'
                    : 'Show sensitive data'
                )}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </SectionPageLayout.Actions>
      <SectionPageLayout.Content>
        <div className='space-y-4 sm:space-y-5'>
          <FadeIn>
            <div className='flex flex-wrap items-center justify-between gap-3'>
              <Tabs value={section} onValueChange={handleSectionChange}>
                <TabsList className='max-w-full flex-wrap justify-start group-data-horizontal/tabs:h-auto'>
                  {USAGE_ANALYTICS_SECTION_IDS.map((id) => (
                    <TabsTrigger key={id} value={id}>
                      {t(USAGE_ANALYTICS_SECTION_META[id].titleKey)}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
              <TimeRangeFilter
                range={range}
                onRangeChange={handleRangeChange}
                maxRangeDays={USAGE_ANALYTICS_MAX_RANGE_DAYS}
              />
            </div>
          </FadeIn>
          <FadeIn delay={0.1}>
            {section === 'flow' ? (
              <FlowCharts range={range} sensitiveVisible={sensitiveVisible} />
            ) : (
              <UserCharts
                range={range}
                filters={userFilters}
                onFiltersChange={setUserFilters}
              />
            )}
          </FadeIn>
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
