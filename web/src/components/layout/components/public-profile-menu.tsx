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
import { useNavigate } from '@tanstack/react-router'
import {
  ChevronDown,
  KeyRound,
  LayoutDashboard,
  ListTodo,
  LogOut,
  ScrollText,
  Settings,
  Wallet,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { SignOutDialog } from '@/components/sign-out-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import useDialogState from '@/hooks/use-dialog'
import { useIsSidebarModuleVisible } from '@/hooks/use-sidebar-config'
import { useUserDisplay } from '@/hooks/use-user-display'
import { formatQuota } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'

const HOVER_CLOSE_DELAY_MS = 150

/**
 * Row rhythm from the design, shared by every navigational menu entry. The
 * `focus:**:` rule is not redundant: the menu-item primitive repaints every
 * descendant with the console's accent foreground on focus, which would drag
 * the icons out of the public palette.
 */
const MENU_ITEM_CLASS =
  'cursor-pointer gap-3 px-3 py-2.5 text-[13px] font-medium text-(--pd-ink) focus:bg-(--pd-surface-muted) focus:text-(--pd-ink) focus:**:text-(--pd-ink)'

/**
 * Signed-in account control for the public header, from the marketing design:
 * a white pill (gradient initials avatar + display name + chevron) that opens
 * a 240px menu on hover — console shortcuts on top, credits and account
 * settings below, sign-out last. Hover is progressive enhancement: the
 * underlying menu primitive keeps click and keyboard behavior for touch and
 * assistive tech. The console's shared `ProfileDropdown` is untouched.
 */
export function PublicProfileMenu(props: { className?: string }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [signOutOpen, setSignOutOpen] = useDialogState()
  const [open, setOpen] = useState(false)
  const closeTimer = useRef<number | null>(null)
  const user = useAuthStore((state) => state.auth.user)
  const { displayName, secondaryText, initials } = useUserDisplay(user)
  const isWalletVisible = useIsSidebarModuleVisible('/wallet')

  const cancelScheduledClose = useCallback(() => {
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current)
      closeTimer.current = null
    }
  }, [])

  const scheduleClose = useCallback(() => {
    cancelScheduledClose()
    closeTimer.current = window.setTimeout(() => {
      setOpen(false)
    }, HOVER_CLOSE_DELAY_MS)
  }, [cancelScheduledClose])

  const openNow = useCallback(() => {
    cancelScheduledClose()
    setOpen(true)
  }, [cancelScheduledClose])

  useEffect(() => cancelScheduledClose, [cancelScheduledClose])

  const goTo = useCallback(
    (to: string) => {
      navigate({ to })
    },
    [navigate]
  )

  const consoleItems = [
    { label: t('Console'), to: '/dashboard', Icon: LayoutDashboard },
    { label: t('API Keys'), to: '/keys', Icon: KeyRound },
    { label: t('Request Logs'), to: '/usage-logs', Icon: ScrollText },
    { label: t('Async Tasks'), to: '/usage-logs/task', Icon: ListTodo },
  ]

  return (
    <>
      <DropdownMenu modal={false} open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger
          render={
            <button
              type='button'
              onMouseEnter={openNow}
              onMouseLeave={scheduleClose}
              className={cn(
                'flex cursor-pointer items-center gap-2 rounded-full border border-(--pd-border) bg-(--pd-surface) px-2.5 py-1.5 drop-shadow-[0px_2px_4px_rgba(0,0,0,0.04)]',
                props.className
              )}
              aria-label={t('Account menu')}
            />
          }
        >
          {/* Squircle, not a circle — the pill's avatar is rounded-[12px] at
           * 24px in the design, while the one inside the menu is fully round. */}
          <span
            aria-hidden='true'
            className='flex size-6 shrink-0 items-center justify-center rounded-xl bg-linear-to-r from-(--pd-gradient-from) to-(--pd-gradient-to) text-[11px] font-semibold text-white'
          >
            {initials}
          </span>
          <span className='max-w-32 truncate text-sm font-medium text-(--pd-ink)'>
            {displayName}
          </span>
          <ChevronDown
            aria-hidden='true'
            className={cn(
              'size-4 text-(--pd-muted-2) transition-transform duration-200 ease-out',
              open && 'rotate-180'
            )}
          />
        </DropdownMenuTrigger>
        {/* The menu renders in a portal, outside the `.public-design` shell, so
         * it has to re-open that scope or every `--pd-*` token resolves to
         * nothing and the design's palette silently falls back to the
         * console's. */}
        <DropdownMenuContent
          align='end'
          sideOffset={10}
          className='public-design w-60 overflow-visible rounded-xl border border-(--pd-border) bg-(--pd-surface) p-1 shadow-[0px_8px_24px_-4px_rgba(0,0,0,0.08)] ring-0'
          onMouseEnter={openNow}
          onMouseLeave={scheduleClose}
        >
          <span
            aria-hidden='true'
            className='absolute -top-2 right-6 size-3.5 rotate-45 border-t border-l border-(--pd-border) bg-(--pd-surface)'
          />

          <div className='flex items-center gap-3 px-5 py-4'>
            <span
              aria-hidden='true'
              className='flex size-10 shrink-0 items-center justify-center rounded-full bg-linear-to-r from-(--pd-gradient-from) to-(--pd-gradient-to) text-sm font-semibold text-white'
            >
              {initials}
            </span>
            <div className='min-w-0'>
              <p className='truncate text-[15px] font-semibold text-(--pd-ink)'>
                {displayName}
              </p>
              {secondaryText && (
                <p className='truncate text-[13px] text-(--pd-muted-2)'>
                  {secondaryText}
                </p>
              )}
            </div>
          </div>

          <DropdownMenuSeparator className='bg-(--pd-border)' />

          {consoleItems.map((item) => (
            <DropdownMenuItem
              key={item.to}
              onClick={() => goTo(item.to)}
              className={MENU_ITEM_CLASS}
            >
              <item.Icon className='size-4 text-(--pd-muted-2)' />
              {item.label}
            </DropdownMenuItem>
          ))}

          <DropdownMenuSeparator className='bg-(--pd-border)' />

          {isWalletVisible && (
            <DropdownMenuItem
              onClick={() => goTo('/wallet')}
              className={MENU_ITEM_CLASS}
            >
              <Wallet className='size-4 text-(--pd-muted-2)' />
              <span className='flex-1'>{t('Credits')}</span>
              {typeof user?.quota === 'number' && (
                <span className='text-[13px] font-medium text-(--pd-muted-2)'>
                  {formatQuota(user.quota)} →
                </span>
              )}
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            onClick={() => goTo('/profile')}
            className={MENU_ITEM_CLASS}
          >
            <Settings className='size-4 text-(--pd-muted-2)' />
            {t('Account Settings')}
          </DropdownMenuItem>

          <DropdownMenuSeparator className='bg-(--pd-border)' />

          <DropdownMenuItem
            onClick={() => setSignOutOpen(true)}
            className='cursor-pointer gap-3 p-4 text-[13px] font-semibold text-(--pd-primary) focus:bg-(--pd-accent-bg) focus:text-(--pd-primary) focus:**:text-(--pd-primary)'
          >
            <LogOut className='size-4 text-(--pd-primary)' />
            {t('Sign out')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <SignOutDialog open={!!signOutOpen} onOpenChange={setSignOutOpen} />
    </>
  )
}
