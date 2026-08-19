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
import { toast } from 'sonner'

import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import dayjs from '@/lib/dayjs'
import { cn } from '@/lib/utils'

import { RANGE_PRESETS } from '../constants'
import {
  MAX_RANGE_DAYS,
  isRangeWithinLimit,
  resolveCustomRange,
  resolvePresetRange,
} from '../lib'
import type { DashboardRange } from '../types'

// A stable id keeps repeated attempts collapsed into a single notice.
const RANGE_LIMIT_TOAST_ID = 'dashboard-range-limit'

const FILTER_BUTTON_BASE =
  'cursor-pointer rounded-[6px] px-3.5 py-[7px] text-[13px] transition-colors'
const FILTER_BUTTON_ACTIVE = 'bg-[#ff5a5f] font-semibold text-white'
const FILTER_BUTTON_IDLE =
  'border border-[#e5e7eb] bg-white font-medium text-[#6b7280] hover:bg-[#f9fafb] dark:border-border dark:bg-card dark:text-muted-foreground dark:hover:bg-muted'

const DATE_CHIP_CLASS =
  'dark:bg-muted dark:text-foreground min-w-24 rounded-[6px] bg-[#f5f5f7] px-2.5 py-1.5 text-center text-xs text-[#3d4047]'
const TIME_INPUT_CLASS =
  'dark:text-foreground w-5 cursor-text bg-transparent text-center text-xs text-[#3d4047] outline-none'

function sanitizeTimePart(raw: string, max: number): string {
  const digits = raw.replaceAll(/\D/g, '').slice(0, 2)
  if (digits === '') return ''
  return Number(digits) > max ? String(max) : digits
}

function toTimePart(value: string, fallback: number): number {
  return value === '' ? fallback : Number(value)
}

interface TimeFieldProps {
  hours: string
  minutes: string
  onHoursChange: (value: string) => void
  onMinutesChange: (value: string) => void
  hoursLabel: string
  minutesLabel: string
}

function TimeField({
  hours,
  minutes,
  onHoursChange,
  onMinutesChange,
  hoursLabel,
  minutesLabel,
}: TimeFieldProps) {
  return (
    <div className='dark:bg-muted flex items-center gap-px rounded-[6px] bg-[#f5f5f7] px-2 py-1.5'>
      <input
        type='text'
        inputMode='numeric'
        maxLength={2}
        placeholder='00'
        aria-label={hoursLabel}
        value={hours}
        onChange={(e) => onHoursChange(sanitizeTimePart(e.target.value, 23))}
        onBlur={() =>
          onHoursChange(hours === '' ? '00' : hours.padStart(2, '0'))
        }
        className={TIME_INPUT_CLASS}
      />
      <span className='dark:text-foreground text-xs text-[#3d4047]'>:</span>
      <input
        type='text'
        inputMode='numeric'
        maxLength={2}
        placeholder='00'
        aria-label={minutesLabel}
        value={minutes}
        onChange={(e) => onMinutesChange(sanitizeTimePart(e.target.value, 59))}
        onBlur={() =>
          onMinutesChange(minutes === '' ? '00' : minutes.padStart(2, '0'))
        }
        className={TIME_INPUT_CLASS}
      />
    </div>
  )
}

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
  const [startHH, setStartHH] = useState('00')
  const [startMM, setStartMM] = useState('00')
  const [endHH, setEndHH] = useState('23')
  const [endMM, setEndMM] = useState('59')

  const customLabel =
    range.key === 'custom'
      ? `${dayjs.unix(range.start).format('MMM D')} – ${dayjs
          .unix(range.end)
          .format('MMM D')}`
      : t('Custom Range')

  const handleOpenChange = (open: boolean) => {
    if (open && range.key === 'custom') {
      const start = dayjs.unix(range.start)
      const end = dayjs.unix(range.end)
      setDraft({ from: start.toDate(), to: end.toDate() })
      setStartHH(start.format('HH'))
      setStartMM(start.format('mm'))
      setEndHH(end.format('HH'))
      setEndMM(end.format('mm'))
    } else if (open) {
      setDraft(undefined)
      setStartHH('00')
      setStartMM('00')
      setEndHH('23')
      setEndMM('59')
    }
    setPickerOpen(open)
  }

  const draftRange = draft?.from
    ? resolveCustomRange(
        draft.from,
        draft.to ?? draft.from,
        { hours: toTimePart(startHH, 0), minutes: toTimePart(startMM, 0) },
        { hours: toTimePart(endHH, 23), minutes: toTimePart(endMM, 59) }
      )
    : null

  const draftTooLong = draftRange !== null && !isRangeWithinLimit(draftRange)

  const applyDraft = () => {
    if (!draftRange) return
    if (!isRangeWithinLimit(draftRange)) {
      toast.error(
        t('The time range cannot exceed {{count}} days', {
          count: MAX_RANGE_DAYS,
        }),
        { id: RANGE_LIMIT_TOAST_ID }
      )
      return
    }
    onRangeChange(draftRange)
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
              // `max` counts whole days between the endpoints, so a 30-day
              // inclusive window is 29. Unlike `disabled` it also guards the
              // "extend an already complete range" path.
              max={MAX_RANGE_DAYS - 1}
              disableOutsideDays
              selected={draft}
              onSelect={setDraft}
              disabled={isDateDisabled}
              defaultMonth={
                draft?.from ?? dayjs().subtract(1, 'month').toDate()
              }
            />
            <div className='dark:border-border flex flex-wrap items-center gap-2 border-t border-[#e6e8eb] pt-3'>
              <div className={DATE_CHIP_CLASS}>
                {draft?.from
                  ? dayjs(draft.from).format('MMM D, YYYY')
                  : t('Start date')}
              </div>
              <TimeField
                hours={startHH}
                minutes={startMM}
                onHoursChange={setStartHH}
                onMinutesChange={setStartMM}
                hoursLabel={t('Start time')}
                minutesLabel={t('Start time')}
              />
              <span className='text-xs text-[#9ea3b0]'>→</span>
              <div className={DATE_CHIP_CLASS}>
                {draft?.to
                  ? dayjs(draft.to).format('MMM D, YYYY')
                  : t('End date')}
              </div>
              <TimeField
                hours={endHH}
                minutes={endMM}
                onHoursChange={setEndHH}
                onMinutesChange={setEndMM}
                hoursLabel={t('End time')}
                minutesLabel={t('End time')}
              />
              <span className='dark:text-muted-foreground text-[11px] text-[#9ea3b0]'>
                {t('Up to {{count}} days', { count: MAX_RANGE_DAYS })}
              </span>
              <div className='flex-1' />
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
                  disabled={
                    !draftRange ||
                    draftRange.end <= draftRange.start ||
                    draftTooLong
                  }
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
