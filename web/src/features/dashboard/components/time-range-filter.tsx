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
import { CalendarDays } from 'lucide-react'
import { useState } from 'react'
import type { DateRange } from 'react-day-picker'
import { useTranslation } from 'react-i18next'

import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import dayjs from '@/lib/dayjs'
import { cn } from '@/lib/utils'

import { RANGE_PRESETS } from '../constants'
import { MAX_RANGE_DAYS, resolveCustomRange, resolvePresetRange } from '../lib'
import type { DashboardRange } from '../types'

const FILTER_BUTTON_BASE =
  'cursor-pointer rounded-[6px] px-3.5 py-[7px] text-[13px] transition-colors'
const FILTER_BUTTON_ACTIVE = 'bg-[#ff5a5f] font-semibold text-white'
const FILTER_BUTTON_IDLE =
  'border border-[#e5e7eb] bg-white font-medium text-[#6b7280] hover:bg-[#f9fafb] dark:border-border dark:bg-card dark:text-muted-foreground dark:hover:bg-muted'

interface TimeRangeFilterProps {
  range: DashboardRange
  onRangeChange: (range: DashboardRange) => void
}

export function TimeRangeFilter({
  range,
  onRangeChange,
}: TimeRangeFilterProps) {
  const { t } = useTranslation()
  const [pickerOpen, setPickerOpen] = useState(false)
  const [draft, setDraft] = useState<DateRange | undefined>()

  const customLabel =
    range.key === 'custom'
      ? `${dayjs.unix(range.start).format('MMM D')} – ${dayjs
          .unix(range.end)
          .format('MMM D')}`
      : t('Custom Range')

  const handleOpenChange = (open: boolean) => {
    if (open && range.key === 'custom') {
      setDraft({
        from: dayjs.unix(range.start).toDate(),
        to: dayjs.unix(range.end).toDate(),
      })
    } else if (open) {
      setDraft(undefined)
    }
    setPickerOpen(open)
  }

  const applyDraft = () => {
    if (!draft?.from) return
    onRangeChange(resolveCustomRange(draft.from, draft.to ?? draft.from))
    setPickerOpen(false)
  }

  // The self data endpoints reject spans over 30 days, so keep the
  // calendar selection inside that window around the draft start.
  const isDateDisabled = (date: Date) => {
    if (dayjs(date).isAfter(dayjs(), 'day')) return true
    if (draft?.from && !draft.to) {
      const span = Math.abs(dayjs(date).diff(dayjs(draft.from), 'day'))
      return span >= MAX_RANGE_DAYS
    }
    return false
  }

  return (
    <div className='flex flex-wrap items-center gap-2'>
      {RANGE_PRESETS.map((preset) => (
        <button
          key={preset.key}
          type='button'
          className={cn(
            FILTER_BUTTON_BASE,
            range.key === preset.key ? FILTER_BUTTON_ACTIVE : FILTER_BUTTON_IDLE
          )}
          onClick={() => onRangeChange(resolvePresetRange(preset.key))}
        >
          {t(preset.labelKey)}
        </button>
      ))}
      <Popover open={pickerOpen} onOpenChange={handleOpenChange}>
        <PopoverTrigger
          render={
            <button
              type='button'
              className={cn(
                FILTER_BUTTON_BASE,
                'flex items-center gap-[7px]',
                range.key === 'custom'
                  ? FILTER_BUTTON_ACTIVE
                  : FILTER_BUTTON_IDLE
              )}
            />
          }
        >
          <CalendarDays className='size-3.5' />
          {customLabel}
        </PopoverTrigger>
        <PopoverContent align='start' className='w-auto p-3'>
          <div className='space-y-3'>
            <Calendar
              mode='range'
              numberOfMonths={2}
              selected={draft}
              onSelect={setDraft}
              disabled={isDateDisabled}
              defaultMonth={
                draft?.from ?? dayjs().subtract(1, 'month').toDate()
              }
            />
            <div className='flex items-center justify-between'>
              <span className='text-muted-foreground text-xs'>
                {t('Up to {{count}} days', { count: MAX_RANGE_DAYS })}
              </span>
              <div className='flex gap-2'>
                <button
                  type='button'
                  className='dark:border-border dark:bg-card dark:text-muted-foreground cursor-pointer rounded-[6px] border border-[#e5e7eb] bg-white px-3.5 py-[6px] text-[13px] font-medium text-[#6b7280] transition-colors hover:bg-[#f9fafb]'
                  onClick={() => setPickerOpen(false)}
                >
                  {t('Cancel')}
                </button>
                <button
                  type='button'
                  className='cursor-pointer rounded-[6px] bg-[#ff5a5f] px-3.5 py-[6px] text-[13px] font-semibold text-white transition-colors hover:bg-[#e14b50] disabled:cursor-not-allowed disabled:opacity-50'
                  disabled={!draft?.from}
                  onClick={applyDraft}
                >
                  {t('Apply')}
                </button>
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
