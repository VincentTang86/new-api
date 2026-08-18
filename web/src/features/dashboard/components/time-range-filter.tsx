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

import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import dayjs from '@/lib/dayjs'

import { RANGE_PRESETS } from '../constants'
import { MAX_RANGE_DAYS, resolveCustomRange, resolvePresetRange } from '../lib'
import type { DashboardRange } from '../types'

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
    <div className='flex flex-wrap items-center gap-1.5 sm:gap-2'>
      {RANGE_PRESETS.map((preset) => (
        <Button
          key={preset.key}
          type='button'
          size='sm'
          variant={range.key === preset.key ? 'default' : 'outline'}
          onClick={() => onRangeChange(resolvePresetRange(preset.key))}
        >
          {t(preset.labelKey)}
        </Button>
      ))}
      <Popover open={pickerOpen} onOpenChange={handleOpenChange}>
        <PopoverTrigger
          render={
            <Button
              type='button'
              size='sm'
              variant={range.key === 'custom' ? 'default' : 'outline'}
              className='gap-1.5'
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
                <Button
                  type='button'
                  size='sm'
                  variant='outline'
                  onClick={() => setPickerOpen(false)}
                >
                  {t('Cancel')}
                </Button>
                <Button
                  type='button'
                  size='sm'
                  disabled={!draft?.from}
                  onClick={applyDraft}
                >
                  {t('Apply')}
                </Button>
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
