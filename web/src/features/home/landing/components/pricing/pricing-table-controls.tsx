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
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'

import type {
  PricingGroupOption,
  PricingProviderFilter,
  PricingProviderOption,
} from '../../lib/use-landing-pricing-rows'
import type { PricingBenchmark } from '../../types'

interface PricingTableControlsProps {
  groups: readonly PricingGroupOption[]
  selectedGroup: string
  onGroupChange: (group: string) => void
  benchmark: PricingBenchmark
  onBenchmarkChange: (benchmark: PricingBenchmark) => void
  providers: readonly PricingProviderOption[]
  providerFilter: PricingProviderFilter
  onProviderChange: (filter: PricingProviderFilter) => void
}

/**
 * The three selectors above the pricing table, from the design: a segmented
 * group (price tier) control, the vendor filter row, and the "Compare with"
 * benchmark toggle. Pure controls — all state lives in
 * `useLandingPricingRows`.
 */
export function PricingTableControls(props: PricingTableControlsProps) {
  const { t } = useTranslation()

  return (
    <div className='mb-6 flex flex-col gap-4'>
      {props.groups.length > 0 && (
        <div
          role='tablist'
          aria-label={t('Price tier')}
          className='no-scrollbar flex w-fit max-w-full items-start gap-0.5 overflow-x-auto rounded-lg border border-(--pd-border) bg-(--pd-surface-muted) p-[3px]'
        >
          {props.groups.map((group) => {
            const isActive = group.key === props.selectedGroup
            return (
              <button
                key={group.key}
                type='button'
                role='tab'
                aria-selected={isActive}
                onClick={() => props.onGroupChange(group.key)}
                className={cn(
                  'flex cursor-pointer items-center gap-2 rounded-md px-3.5 py-[7px] text-sm whitespace-nowrap transition-colors duration-150',
                  isActive
                    ? 'bg-(--pd-surface) font-semibold text-(--pd-primary) shadow-[0px_1px_2px_0px_rgba(0,0,0,0.06)]'
                    : 'font-medium text-(--pd-muted-2) hover:bg-(--pd-surface)/80'
                )}
              >
                {group.label}
                {group.lowerCost && (
                  <span className='rounded-full bg-(--pd-success-bg) px-2 py-0.5 text-[11px] font-medium whitespace-nowrap text-(--pd-success)'>
                    {t('Lower cost')}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}

      <div className='flex flex-wrap items-center justify-between gap-x-4 gap-y-3'>
        <div
          role='tablist'
          aria-label={t('Filter by vendor')}
          className='no-scrollbar flex max-w-full items-start overflow-x-auto rounded-lg border border-(--pd-border)'
        >
          <button
            type='button'
            role='tab'
            aria-selected={props.providerFilter === 'all'}
            onClick={() => props.onProviderChange('all')}
            className={cn(
              'cursor-pointer px-4 py-2 text-[13px] whitespace-nowrap transition-colors duration-150',
              props.providerFilter === 'all'
                ? 'bg-(--pd-accent-bg) font-semibold text-(--pd-primary)'
                : 'font-medium text-(--pd-muted-2) hover:bg-(--pd-accent-bg-hover)'
            )}
          >
            {t('All')}
          </button>
          {props.providers.map((provider) => {
            const isActive = props.providerFilter === provider.key
            return (
              <button
                key={provider.key}
                type='button'
                role='tab'
                aria-selected={isActive}
                onClick={() => props.onProviderChange(provider.key)}
                className={cn(
                  'cursor-pointer px-4 py-2 text-[13px] whitespace-nowrap transition-colors duration-150',
                  isActive
                    ? 'bg-(--pd-accent-bg) font-semibold text-(--pd-primary)'
                    : 'font-medium text-(--pd-muted-2) hover:bg-(--pd-accent-bg-hover)'
                )}
              >
                {provider.label}
              </button>
            )
          })}
        </div>

        <div className='flex items-center gap-2'>
          <p className='text-sm whitespace-nowrap text-(--pd-faint)'>
            {t('Compare with:')}
          </p>
          <div className='flex items-start'>
            {(
              [
                { key: 'official', label: t('Official API') },
                { key: 'openrouter', label: 'OpenRouter' },
              ] as const
            ).map((option) => {
              const isActive = props.benchmark === option.key
              return (
                <button
                  key={option.key}
                  type='button'
                  aria-pressed={isActive}
                  onClick={() => props.onBenchmarkChange(option.key)}
                  className={cn(
                    'cursor-pointer border-b-2 px-3.5 py-2 text-[13px] whitespace-nowrap transition-colors duration-150',
                    isActive
                      ? 'border-(--pd-primary) font-semibold text-(--pd-primary)'
                      : 'border-transparent font-medium text-(--pd-faint) hover:text-(--pd-muted-2)'
                  )}
                >
                  {option.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
