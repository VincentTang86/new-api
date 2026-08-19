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
import { ChevronDown } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'

import { BREAKDOWN_PAGE_SIZES } from '../constants'

const ELLIPSIS = '…'
type EllipsisSlot = 'ellipsis-start' | 'ellipsis-end'

const NAV_BUTTON_CLASS =
  'dark:text-muted-foreground flex size-7 cursor-pointer items-center justify-center rounded-[6px] text-[15px] leading-none font-semibold text-[#475569] transition-colors hover:bg-[#f3f4f6] disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-white/10'

/**
 * Page window used by the demo: every page while there are at most 7 of them,
 * otherwise first, last and the current page with one neighbour on each side.
 * Deliberately not `getPageNumbers` from `@/lib/utils` — that one caps the
 * window at 4 entries and renders a visibly different control.
 */
function pageWindow(page: number, totalPages: number) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1)
  }
  const pages: (number | EllipsisSlot)[] = [1]
  if (page > 3) pages.push('ellipsis-start')
  for (
    let current = Math.max(2, page - 1);
    current <= Math.min(totalPages - 1, page + 1);
    current++
  ) {
    pages.push(current)
  }
  if (page < totalPages - 2) pages.push('ellipsis-end')
  pages.push(totalPages)
  return pages
}

interface UsagePaginationProps {
  page: number
  totalPages: number
  total: number
  pageSize: number
  onPage: (page: number) => void
  onPageSize: (size: number) => void
}

export function UsagePagination({
  page,
  totalPages,
  total,
  pageSize,
  onPage,
  onPageSize,
}: UsagePaginationProps) {
  const { t } = useTranslation()
  const [pageSizeOpen, setPageSizeOpen] = useState(false)

  const rangeStart = Math.min((page - 1) * pageSize + 1, total)
  const rangeEnd = Math.min(page * pageSize, total)

  return (
    <div className='dark:border-border flex flex-wrap items-center justify-between gap-2 border-t border-[#e5e7eb] px-4 py-3'>
      <div className='dark:text-muted-foreground flex items-center gap-2.5 text-xs text-[#6b7280]'>
        <span>{t('Rows per page')}</span>
        <Popover open={pageSizeOpen} onOpenChange={setPageSizeOpen}>
          <PopoverTrigger
            render={
              <button
                type='button'
                className='dark:border-border dark:bg-card dark:text-foreground flex cursor-pointer items-center gap-[5px] rounded-[6px] border border-[#e5e7eb] bg-white px-2 py-1 text-xs font-semibold text-[#374151] transition-colors hover:bg-[#f9fafb] dark:hover:bg-white/10'
              />
            }
          >
            <span className='tabular-nums'>{pageSize}</span>
            <ChevronDown
              aria-hidden='true'
              className={cn(
                'size-3 shrink-0 transition-transform',
                pageSizeOpen && 'rotate-180'
              )}
            />
          </PopoverTrigger>
          <PopoverContent
            side='top'
            align='start'
            sideOffset={6}
            className='dark:border-border w-auto min-w-[var(--anchor-width)] gap-0 rounded-[7px] border border-[#e5e7eb] p-[3px] shadow-[0_8px_20px_rgba(15,23,42,0.14)] ring-0'
          >
            {BREAKDOWN_PAGE_SIZES.map((size) => (
              <button
                key={size}
                type='button'
                onClick={() => {
                  onPageSize(size)
                  setPageSizeOpen(false)
                }}
                className={cn(
                  'flex w-full cursor-pointer items-center rounded-[4px] px-2 py-[5px] text-left text-xs tabular-nums transition-colors',
                  size === pageSize
                    ? 'dark:bg-primary/15 bg-[#fff0f0] font-semibold text-[#ff5a5f]'
                    : 'dark:text-muted-foreground text-[#475569] hover:bg-[#f7f7f8] dark:hover:bg-white/10'
                )}
              >
                {size}
              </button>
            ))}
          </PopoverContent>
        </Popover>
        <span className='tabular-nums'>
          {rangeStart}–{rangeEnd} / {total}
        </span>
      </div>
      <div className='flex items-center gap-1'>
        <button
          type='button'
          aria-label={t('Go to first page')}
          className={NAV_BUTTON_CLASS}
          disabled={page <= 1}
          onClick={() => onPage(1)}
        >
          «
        </button>
        <button
          type='button'
          aria-label={t('Go to previous page')}
          className={NAV_BUTTON_CLASS}
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
        >
          ‹
        </button>
        {pageWindow(page, totalPages).map((entry) =>
          typeof entry === 'string' ? (
            <span
              key={entry}
              className='dark:text-muted-foreground/60 flex size-7 items-center justify-center text-xs text-[#9ca3af]'
            >
              {ELLIPSIS}
            </span>
          ) : (
            <button
              key={entry}
              type='button'
              aria-label={t('Go to page {{page}}', { page: entry })}
              aria-current={entry === page ? 'page' : undefined}
              className={cn(
                'flex size-7 cursor-pointer items-center justify-center rounded-[6px] text-xs tabular-nums transition-colors',
                entry === page
                  ? 'bg-[#ff5a5f] font-semibold text-white'
                  : 'dark:text-muted-foreground text-[#6b7280] hover:bg-[#f3f4f6] dark:hover:bg-white/10'
              )}
              onClick={() => onPage(entry)}
            >
              {entry}
            </button>
          )
        )}
        <button
          type='button'
          aria-label={t('Go to next page')}
          className={NAV_BUTTON_CLASS}
          disabled={page >= totalPages}
          onClick={() => onPage(page + 1)}
        >
          ›
        </button>
        <button
          type='button'
          aria-label={t('Go to last page')}
          className={NAV_BUTTON_CLASS}
          disabled={page >= totalPages}
          onClick={() => onPage(totalPages)}
        >
          »
        </button>
      </div>
    </div>
  )
}
