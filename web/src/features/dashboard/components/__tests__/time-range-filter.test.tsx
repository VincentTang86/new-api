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
import { beforeAll, describe, expect, test, vi } from 'vitest'

import { Calendar } from '@/components/ui/calendar'

import { MAX_RANGE_DAYS } from '../../lib'
import type { DashboardRange } from '../../types'
import { TimeRangeFilter } from '../time-range-filter'

vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))

// The dashboard picker relies on these two Calendar props to keep an
// out-of-budget or ambiguous selection from ever being made. Driving the
// primitive directly keeps the assertions on the behaviour the picker buys,
// without standing up the popover.
function RangeCalendar() {
  const [selected, setSelected] = useState<DateRange | undefined>()
  return (
    <>
      <Calendar
        mode='range'
        numberOfMonths={2}
        max={MAX_RANGE_DAYS - 1}
        disableOutsideDays
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
 * react-day-picker labels each day "Weekday, Month Nth, YYYY", so match on the
 * date part only. With two months on screen the end of July is also painted as
 * August's leading outside row, so pick the cell that belongs to its own month.
 */
function dayButton(label: string): HTMLElement {
  const matches = screen.getAllByRole('button', {
    name: new RegExp(`${label}$`),
    hidden: true,
  })
  const owned = matches.filter(
    (button) => button.parentElement?.dataset.outside !== 'true'
  )
  expect(owned).toHaveLength(1)
  return owned[0]
}

describe('dashboard range calendar', () => {
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

  test('neighbouring-month days stay visible but are not selectable', async () => {
    const user = userEvent.setup()
    render(<RangeCalendar />)

    const outsideCells = document.querySelectorAll('[data-outside="true"]')
    expect(outsideCells.length).toBeGreaterThan(0)

    const outsideButtons = [...outsideCells].flatMap((cell) => [
      ...cell.querySelectorAll('button'),
    ])
    expect(outsideButtons.length).toBeGreaterThan(0)
    for (const button of outsideButtons) {
      expect(button).toBeDisabled()
    }

    await user.click(outsideButtons[0])
    expect(screen.getByTestId('selection')).toHaveTextContent('none / none')
  })
})

describe('dashboard time range filter', () => {
  beforeAll(() => {
    i18next.addResourceBundle('en', 'translation', {
      'Custom Range': 'Custom Range',
      Apply: 'Apply',
      'Up to {{count}} days': 'Up to {{count}} days',
      'The time range cannot exceed {{count}} days':
        'The time range cannot exceed {{count}} days',
      'Start date': 'Start date',
      'End date': 'End date',
    })
  })

  async function openPicker(onRangeChange = vi.fn()) {
    const user = userEvent.setup()
    const range: DashboardRange = {
      key: 'today',
      start: Math.floor(new Date(2026, 6, 20).getTime() / 1000),
      end: Math.floor(new Date(2026, 6, 20, 23, 59).getTime() / 1000),
    }
    render(<TimeRangeFilter range={range} onRangeChange={onRangeChange} />)
    await user.click(screen.getByRole('button', { name: 'Custom Range' }))
    return { user, onRangeChange }
  }

  test('advertises the limit next to the apply action', async () => {
    await openPicker()
    expect(screen.getByText('Up to 30 days')).toBeInTheDocument()
  })

  test('will not hand an over-long range to the queries', async () => {
    const { user, onRangeChange } = await openPicker()

    await user.click(dayButton('July 1st, 2026'))
    await user.click(dayButton('July 31st, 2026'))

    // The 31st is one day past the cap, so the calendar restarts from it
    // instead of closing the range on Jul 1.
    expect(screen.getByText('Jul 31, 2026')).toBeInTheDocument()
    expect(screen.getByText('End date')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Apply' }))

    // Either the calendar restarted the range or the apply guard rejected it;
    // what matters is that no 31-day span reaches the three range queries,
    // which is what produced three untranslated toasts.
    for (const [applied] of onRangeChange.mock.calls) {
      expect(applied.end - applied.start).toBeLessThanOrEqual(
        MAX_RANGE_DAYS * 86_400
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
      MAX_RANGE_DAYS * 86_400
    )
    expect(toast.error).not.toHaveBeenCalled()
  })
})
