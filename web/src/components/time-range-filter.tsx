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
import {
  useDayPicker,
  type DateRange,
  type MonthCaptionProps,
} from 'react-day-picker'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Calendar } from '@/components/ui/calendar'
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover'
import dayjs from '@/lib/dayjs'
import {
  isRangeWithinLimit,
  resolveCustomRange,
  resolvePresetRange,
  type TimeRange,
  type TimeRangeKey,
} from '@/lib/time-range'
import { cn } from '@/lib/utils'

// A stable id keeps repeated attempts collapsed into a single notice.
const RANGE_LIMIT_TOAST_ID = 'time-range-limit'

const RANGE_PRESETS: { key: TimeRangeKey; labelKey: string }[] = [
  { key: 'today', labelKey: 'Today' },
  { key: 'yesterday', labelKey: 'Yesterday' },
  { key: '7days', labelKey: 'Last 7 Days' },
  { key: '30days', labelKey: 'Last 30 Days' },
]

const FILTER_BUTTON_BASE =
  'cursor-pointer rounded-[6px] px-3.5 py-[7px] text-[13px] transition-colors'
const FILTER_BUTTON_ACTIVE = 'bg-[#ff5a5f] font-semibold text-white'
const FILTER_BUTTON_IDLE =
  'border border-[#e5e7eb] bg-white font-medium text-[#6b7280] hover:bg-[#f9fafb] dark:border-border dark:bg-card dark:text-muted-foreground dark:hover:bg-muted'

// The footer row is laid out to the design's pixel grid: 100px date chips and
// 56px time chips separated by 4px, a 20px lane for the arrow, then the two
// 68px actions 8px apart against the right gutter.
const DATE_CHIP_CLASS =
  'dark:bg-muted dark:text-foreground flex h-[34px] w-[100px] items-center justify-center rounded-[6px] bg-[#f5f5f7] text-[12px] text-[#3d4047]'
const TIME_INPUT_CLASS =
  'dark:text-foreground w-[18px] cursor-text bg-transparent text-center text-[12px] text-[#3d4047] outline-none'
const FOOTER_BUTTON_BASE =
  'h-[34px] w-[68px] cursor-pointer rounded-[6px] text-[12px] font-medium transition-colors'
const MONTH_NAV_CLASS =
  'dark:text-muted-foreground flex size-4 cursor-pointer items-center justify-center text-[#9ea3b0] transition-colors hover:text-[#3d4047] disabled:cursor-not-allowed disabled:opacity-40 dark:hover:text-foreground'

// Every month draws its own arrows, so the shared bar has nothing left to show.
// react-day-picker still requires a component for the slot, hence the empty one.
const EmptyNav = () => <nav hidden />

/**
 * The design puts a ‹ › pair inside each month's caption, where react-day-picker
 * ships a single nav bar above both grids. Both pairs move the same two-month
 * window, so whichever one is clicked the two captions stay a month apart.
 */
function MonthCaptionWithNav({
  calendarMonth: _calendarMonth,
  displayIndex: _displayIndex,
  children,
  ...divProps
}: MonthCaptionProps) {
  const { components, goToMonth, labels, nextMonth, previousMonth } =
    useDayPicker()
  return (
    <div {...divProps}>
      <button
        type='button'
        aria-label={labels.labelPrevious(previousMonth)}
        disabled={!previousMonth}
        className={MONTH_NAV_CLASS}
        onClick={() => previousMonth && goToMonth(previousMonth)}
      >
        <components.Chevron orientation='left' className='size-4' />
      </button>
      {children}
      <button
        type='button'
        aria-label={labels.labelNext(nextMonth)}
        disabled={!nextMonth}
        className={MONTH_NAV_CLASS}
        onClick={() => nextMonth && goToMonth(nextMonth)}
      >
        <components.Chevron orientation='right' className='size-4' />
      </button>
    </div>
  )
}

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
    <div className='dark:bg-muted flex h-[34px] w-[56px] items-center justify-center gap-px rounded-[6px] bg-[#f5f5f7]'>
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
      <span className='dark:text-foreground text-[12px] text-[#3d4047]'>:</span>
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
  range: TimeRange
  onRangeChange: (range: TimeRange) => void
  /** Widest selectable span, in days. Pass the cap of the endpoint you query. */
  maxRangeDays: number
}

export function TimeRangeFilter(props: TimeRangeFilterProps) {
  const { t } = useTranslation()
  const [pickerOpen, setPickerOpen] = useState(false)
  const [draft, setDraft] = useState<DateRange | undefined>()
  const [startHH, setStartHH] = useState('00')
  const [startMM, setStartMM] = useState('00')
  const [endHH, setEndHH] = useState('23')
  const [endMM, setEndMM] = useState('59')

  const customLabel =
    props.range.key === 'custom'
      ? `${dayjs.unix(props.range.start).format('MMM D')} – ${dayjs
          .unix(props.range.end)
          .format('MMM D')}`
      : t('Custom Range')

  const handleOpenChange = (open: boolean) => {
    if (open && props.range.key === 'custom') {
      const start = dayjs.unix(props.range.start)
      const end = dayjs.unix(props.range.end)
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

  // Only a closed pair is a range. While the calendar holds just the anchor
  // the footer still reads "End date", so applying then would commit a span
  // the picker never showed.
  const draftRange =
    draft?.from && draft.to
      ? resolveCustomRange(
          draft.from,
          draft.to,
          { hours: toTimePart(startHH, 0), minutes: toTimePart(startMM, 0) },
          { hours: toTimePart(endHH, 23), minutes: toTimePart(endMM, 59) },
          props.maxRangeDays
        )
      : null

  const draftTooLong =
    draftRange !== null && !isRangeWithinLimit(draftRange, props.maxRangeDays)

  const applyDraft = () => {
    if (!draftRange) return
    if (!isRangeWithinLimit(draftRange, props.maxRangeDays)) {
      toast.error(
        t('The time range cannot exceed {{count}} days', {
          count: props.maxRangeDays,
        }),
        { id: RANGE_LIMIT_TOAST_ID }
      )
      return
    }
    props.onRangeChange(draftRange)
    setPickerOpen(false)
  }

  // Once an anchor is picked the window travels with it, so the cap reads as
  // "30 days either side of this day" rather than a wall the click runs into.
  // Greying out is also what enforces it: an over-long pair is unclickable.
  const isDateDisabled = (date: Date) => {
    if (dayjs(date).isAfter(dayjs(), 'day')) return true
    if (draft?.from && !draft.to) {
      const span = Math.abs(dayjs(date).diff(dayjs(draft.from), 'day'))
      return span >= props.maxRangeDays
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
            props.range.key === preset.key
              ? FILTER_BUTTON_ACTIVE
              : FILTER_BUTTON_IDLE
          )}
          onClick={() =>
            props.onRangeChange(
              resolvePresetRange(preset.key, props.maxRangeDays)
            )
          }
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
                props.range.key === 'custom'
                  ? FILTER_BUTTON_ACTIVE
                  : FILTER_BUTTON_IDLE
              )}
            />
          }
        >
          <CalendarDays className='size-3.5' />
          {customLabel}
        </PopoverTrigger>
        <PopoverContent
          align='start'
          className='w-auto gap-0 rounded-[12px] px-6 py-5 shadow-[0_8px_12px_rgba(0,0,0,0.12)]'
        >
          <div className='dark:border-border border-b border-[#e6e8eb] pb-4'>
            <PopoverTitle className='dark:text-foreground text-[14px] font-semibold text-[#1c1f24]'>
              {t('Custom Range')}
            </PopoverTitle>
          </div>
          <Calendar
            mode='range'
            numberOfMonths={2}
            // The design shows each month holding its own days only. Dropping
            // the neighbouring-month padding also means a date is painted in
            // exactly one grid, so one day can never be two selections.
            showOutsideDays={false}
            // The first click sets only the anchor, so the second endpoint is
            // the user's to pick and `isDateDisabled` can grey out everything
            // beyond the cap around it. Without this the calendar closes a
            // same-day range on that first click.
            resetOnSelect
            // `max` counts whole days between the endpoints, so a 30-day
            // inclusive window is 29. It repeats the cap the greyed-out days
            // already express, for the paths `disabled` does not cover.
            max={props.maxRangeDays - 1}
            selected={draft}
            onSelect={setDraft}
            disabled={isDateDisabled}
            defaultMonth={draft?.from ?? dayjs().subtract(1, 'month').toDate()}
            className='dark:text-foreground p-0 pt-5 pb-4 text-[#3d4047] [--cell-radius:10px] [--cell-size:36px] [&_[data-day]]:text-[12px]'
            classNames={{
              // Both months are the same width, so the centre of the row is
              // the centre of the 32px gutter. Drawing the hairline as an
              // overlay there keeps the gutter exactly the width it specifies.
              months:
                'dark:before:bg-border relative flex flex-row items-stretch gap-8 before:absolute before:inset-y-0 before:left-1/2 before:w-px before:bg-[#e6e8eb]',
              month: 'flex w-[252px] flex-col gap-1',
              month_caption: 'flex h-5 w-full items-center justify-between',
              caption_label:
                'dark:text-foreground flex-1 text-center text-[13px] font-semibold text-[#1c1f24] select-none',
              weekday:
                'dark:text-muted-foreground flex h-6 flex-1 items-center justify-center text-[11px] font-medium text-[#9ea3b0] select-none',
              week: 'flex w-full',
            }}
            components={{ Nav: EmptyNav, MonthCaption: MonthCaptionWithNav }}
          />
          <div className='dark:border-border flex items-center gap-1 border-t border-[#e6e8eb] pt-3.5'>
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
            <span className='w-5 text-center text-[11px] text-[#9ea3b0]'>
              →
            </span>
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
            <div className='flex-1' />
            <div className='flex gap-2'>
              <button
                type='button'
                className={cn(
                  FOOTER_BUTTON_BASE,
                  'dark:border-border dark:bg-card dark:text-muted-foreground border border-[#e5e8eb] bg-white text-[#3d4047] hover:bg-[#f9fafb]'
                )}
                onClick={() => setPickerOpen(false)}
              >
                {t('Cancel')}
              </button>
              <button
                type='button'
                className={cn(
                  FOOTER_BUTTON_BASE,
                  'bg-[#ff5a5f] text-white hover:bg-[#e14b50] disabled:cursor-not-allowed disabled:opacity-50'
                )}
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
        </PopoverContent>
      </Popover>
    </div>
  )
}
