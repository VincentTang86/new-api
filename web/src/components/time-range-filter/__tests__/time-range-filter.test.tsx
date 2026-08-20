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
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18next from 'i18next'
import { useState } from 'react'
import type { DateRange } from 'react-day-picker'
import { toast } from 'sonner'
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from 'vitest'

import { Calendar } from '@/components/ui/calendar'
import type { TimeRange } from '@/lib/time-range'

import { TimeRangeFilter } from '../../time-range-filter'

// The dashboard's self endpoints cap at 30 days; the admin usage-analytics
// page passes a wider one. Both values are exercised here.
const SELF_MAX_DAYS = 30
const ADMIN_MAX_DAYS = 90

vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))

// The dashboard picker relies on these Calendar props to keep an out-of-budget
// or ambiguous selection from ever being made. Driving the primitive directly
// keeps the assertions on the behaviour the picker buys, without standing up
// the popover.
function RangeCalendar(props: { maxDays?: number }) {
  const [selected, setSelected] = useState<DateRange | undefined>()
  const maxDays = props.maxDays ?? SELF_MAX_DAYS
  return (
    <>
      <Calendar
        mode='range'
        numberOfMonths={2}
        showOutsideDays={false}
        resetOnSelect
        max={maxDays - 1}
        selected={selected}
        onSelect={setSelected}
        defaultMonth={new Date(2026, 6, 1)}
      />
      <output data-testid='selection'>
        {selected?.from ? selected.from.toDateString() : 'none'}
        {' / '}
        {selected?.to ? selected.to.toDateString() : 'none'}
      </output>
    </>
  )
}

/**
 * react-day-picker labels each day "Weekday, Month Nth, YYYY", and appends
 * ", selected" once it is part of the range, so match on the date part and
 * allow anything after it. The length check is load-bearing: with two months on
 * screen, painting either one's padding days would give a date two cells, and
 * clicking the wrong one selects a day the caller never sees.
 */
function dayButton(label: string): HTMLElement {
  const matches = screen.getAllByRole('button', {
    name: new RegExp(`${label}(,|$)`),
    hidden: true,
  })
  expect(matches).toHaveLength(1)
  return matches[0]
}

describe('time range calendar', () => {
  test('the first click opens the range instead of closing it on one day', async () => {
    const user = userEvent.setup()
    render(<RangeCalendar />)

    await user.click(dayButton('July 1st, 2026'))

    // The end stays open so the second endpoint is the user's to pick, and so
    // the picker knows which day to measure its window from.
    expect(screen.getByTestId('selection')).toHaveTextContent(
      'Wed Jul 01 2026 / none'
    )
  })

  test('a single day is still selectable, by clicking it twice', async () => {
    const user = userEvent.setup()
    render(<RangeCalendar />)

    await user.click(dayButton('July 1st, 2026'))
    await user.click(dayButton('July 1st, 2026'))

    expect(screen.getByTestId('selection')).toHaveTextContent(
      'Wed Jul 01 2026 / Wed Jul 01 2026'
    )
  })

  test('a 31-day span restarts the range instead of selecting it', async () => {
    const user = userEvent.setup()
    render(<RangeCalendar />)

    await user.click(dayButton('July 1st, 2026'))
    await user.click(dayButton('July 31st, 2026'))

    // Jul 1 -> Jul 31 is 30 whole days apart, one past the cap, so
    // react-day-picker restarts from the clicked day rather than closing a
    // range the endpoints would reject.
    expect(screen.getByTestId('selection')).toHaveTextContent(
      'Fri Jul 31 2026 / none'
    )
  })

  test('a 30-day span still completes', async () => {
    const user = userEvent.setup()
    render(<RangeCalendar />)

    await user.click(dayButton('July 1st, 2026'))
    await user.click(dayButton('July 30th, 2026'))

    expect(screen.getByTestId('selection')).toHaveTextContent(
      'Wed Jul 01 2026 / Thu Jul 30 2026'
    )
  })

  test('an already complete range cannot be stretched past the cap', async () => {
    const user = userEvent.setup()
    render(<RangeCalendar />)

    await user.click(dayButton('July 1st, 2026'))
    await user.click(dayButton('July 10th, 2026'))
    // Reopening a saved range used to re-enable every date, which is how a
    // 31-day span reached the queries and produced three error toasts.
    await user.click(dayButton('August 5th, 2026'))

    expect(screen.getByTestId('selection')).not.toHaveTextContent(
      'Wed Jul 01 2026 / Wed Aug 05 2026'
    )
  })

  test('a month paints its own days only, so no date has two cells', () => {
    render(<RangeCalendar />)

    // The padding cells stay in the grid to keep the columns aligned, but they
    // hold no day, so every date is clickable in exactly one month.
    const padding = [...document.querySelectorAll('[data-outside="true"]')]
    expect(padding.length).toBeGreaterThan(0)
    const paddingButtons = padding.flatMap((cell) => [
      ...cell.querySelectorAll('button'),
    ])
    expect(paddingButtons).toHaveLength(0)
    // July 31st is the date that used to double up, as August's leading row.
    expect(dayButton('July 31st, 2026')).toBeInTheDocument()
  })
})

// The picker opens on `today - 1 month`, so which months are on screen — and
// which days are disabled as future — depend on the clock. Pin it so the
// hardcoded July/August dates below mean the same thing on any run date.
beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(new Date('2026-08-19T12:00:00'))
})

afterEach(() => {
  vi.useRealTimers()
})

beforeAll(() => {
  i18next.addResourceBundle('en', 'translation', {
    'Custom Range': 'Custom Range',
    Apply: 'Apply',
    'The time range cannot exceed {{count}} days':
      'The time range cannot exceed {{count}} days',
    'Start date': 'Start date',
    'End date': 'End date',
  })
})

async function openPicker(
  onRangeChange = vi.fn(),
  maxRangeDays = SELF_MAX_DAYS
) {
  const user = userEvent.setup()
  const range: TimeRange = {
    key: 'today',
    start: Math.floor(new Date(2026, 6, 20).getTime() / 1000),
    end: Math.floor(new Date(2026, 6, 20, 23, 59).getTime() / 1000),
  }
  render(
    <TimeRangeFilter
      range={range}
      onRangeChange={onRangeChange}
      maxRangeDays={maxRangeDays}
    />
  )
  await user.click(screen.getByRole('button', { name: 'Custom Range' }))
  return { user, onRangeChange }
}

describe('time range filter', () => {
  test('the window travels with the anchor and reaches both ways', async () => {
    const { user } = await openPicker()

    await user.click(dayButton('July 1st, 2026'))

    // The anchor alone is not a range yet, so the footer still asks for the
    // other end rather than reporting a one-day span nobody chose.
    expect(screen.getByText('Jul 1, 2026')).toBeInTheDocument()
    expect(screen.getByText('End date')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Apply' })).toBeDisabled()

    // Forwards, the last day inside a 30-day window is Jul 30.
    expect(dayButton('July 30th, 2026')).toBeEnabled()
    expect(dayButton('July 31st, 2026')).toBeDisabled()

    // Close this range, then re-anchor: a complete range frees every past day
    // again, and the next click starts a fresh window around the day clicked.
    await user.click(dayButton('July 2nd, 2026'))
    await user.click(dayButton('August 10th, 2026'))

    // Backwards from the new anchor the window reaches just as far.
    expect(dayButton('July 12th, 2026')).toBeEnabled()
    expect(dayButton('July 11th, 2026')).toBeDisabled()
  })

  test('will not hand an over-long range to the queries', async () => {
    const { user, onRangeChange } = await openPicker()

    await user.click(dayButton('July 1st, 2026'))
    await user.click(dayButton('July 31st, 2026'))

    // The 31st is out of the window, so the click cannot close a range on it.
    expect(screen.getByText('End date')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Apply' }))

    // No 31-day span reaches the three range queries, which is what produced
    // three untranslated toasts.
    for (const [applied] of onRangeChange.mock.calls) {
      expect(applied.end - applied.start).toBeLessThanOrEqual(
        SELF_MAX_DAYS * 86_400
      )
    }
    expect(vi.mocked(toast.error).mock.calls.length).toBeLessThanOrEqual(1)
  })

  test('applies an in-budget range', async () => {
    const { user, onRangeChange } = await openPicker()

    await user.click(dayButton('July 1st, 2026'))
    await user.click(dayButton('July 10th, 2026'))
    await user.click(screen.getByRole('button', { name: 'Apply' }))

    expect(onRangeChange).toHaveBeenCalledTimes(1)
    const [applied] = onRangeChange.mock.calls[0]
    expect(applied.key).toBe('custom')
    expect(applied.end - applied.start).toBeLessThanOrEqual(
      SELF_MAX_DAYS * 86_400
    )
    expect(toast.error).not.toHaveBeenCalled()
  })
})

describe('time range filter honours a wider cap', () => {
  test('the window opens to the cap it was given, not a hardcoded 30', async () => {
    const { user } = await openPicker(vi.fn(), ADMIN_MAX_DAYS)

    await user.click(dayButton('July 1st, 2026'))

    // The dashboard's 30-day cap would have stopped at Jul 30.
    expect(dayButton('August 18th, 2026')).toBeEnabled()
  })

  test('a 48-day range applies intact under a 90-day cap', async () => {
    const { user, onRangeChange } = await openPicker(vi.fn(), ADMIN_MAX_DAYS)

    await user.click(dayButton('July 1st, 2026'))
    await user.click(dayButton('August 18th, 2026'))
    await user.click(screen.getByRole('button', { name: 'Apply' }))

    expect(onRangeChange).toHaveBeenCalledTimes(1)
    const [applied] = onRangeChange.mock.calls[0]
    // The dashboard's cap would have clamped this to 30 days.
    expect(applied.end - applied.start).toBeGreaterThan(SELF_MAX_DAYS * 86_400)
    expect(applied.end - applied.start).toBeLessThanOrEqual(
      ADMIN_MAX_DAYS * 86_400
    )
    expect(toast.error).not.toHaveBeenCalled()
  })
})
