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
import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import { Menu, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Dialog } from '@/components/dialog'
import { LanguageSwitcher } from '@/components/language-switcher'
import { NotificationPopover } from '@/components/notification-popover'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useNotifications } from '@/hooks/use-notifications'
import { useSystemConfig } from '@/hooks/use-system-config'
import { useTopNavLinks } from '@/hooks/use-top-nav-links'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'

import { defaultTopNavLinks } from '../config/top-nav.config'
import type { TopNavLink } from '../types'
import { HeaderLogo } from './header-logo'

const AUTH_PROMPT_SECONDS = 5

/** The design's icon-button chrome, shared by the language and theme triggers. */
const ICON_TRIGGER_CLASS =
  'size-8 rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-900 [&_svg]:size-[15px]'

type AuthPromptTarget = {
  title: string
  href: string
}

export interface PublicHeaderProps {
  navLinks?: TopNavLink[]
  mobileLinks?: TopNavLink[]
  navContent?: React.ReactNode
  showThemeSwitch?: boolean
  showLanguageSwitcher?: boolean
  logo?: React.ReactNode
  siteName?: string
  homeUrl?: string
  leftContent?: React.ReactNode
  rightContent?: React.ReactNode
  showNavigation?: boolean
  showAuthButtons?: boolean
  showNotifications?: boolean
  className?: string
}

export function PublicHeader(props: PublicHeaderProps) {
  const {
    navLinks = defaultTopNavLinks,
    showThemeSwitch = true,
    showLanguageSwitcher = true,
    logo: customLogo,
    siteName: customSiteName,
    homeUrl = '/',
    showAuthButtons = true,
    showNotifications = true,
  } = props

  const { t } = useTranslation()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [authPromptTarget, setAuthPromptTarget] =
    useState<AuthPromptTarget | null>(null)
  const [authPromptSecondsLeft, setAuthPromptSecondsLeft] =
    useState(AUTH_PROMPT_SECONDS)
  const { auth } = useAuthStore()
  const {
    systemName,
    logo: systemLogo,
    loading,
    logoLoaded,
  } = useSystemConfig()
  const dynamicLinks = useTopNavLinks()
  const notifications = useNotifications()
  const routerState = useRouterState()
  const pathname = routerState.location.pathname

  const user = auth.user
  const isAuthenticated = !!user
  const displaySiteName = customSiteName || systemName
  const links = dynamicLinks.length > 0 ? dynamicLinks : navLinks

  useEffect(() => {
    if (!authPromptTarget) return

    const intervalId = window.setInterval(() => {
      setAuthPromptSecondsLeft((seconds) => Math.max(seconds - 1, 0))
    }, 1000)

    const timeoutId = window.setTimeout(() => {
      const redirect = authPromptTarget.href
      setAuthPromptTarget(null)
      navigate({ to: '/sign-in', search: { redirect } })
    }, AUTH_PROMPT_SECONDS * 1000)

    return () => {
      window.clearInterval(intervalId)
      window.clearTimeout(timeoutId)
    }
  }, [authPromptTarget, navigate])

  const closeAuthPrompt = useCallback(() => {
    setAuthPromptTarget(null)
    setAuthPromptSecondsLeft(AUTH_PROMPT_SECONDS)
  }, [])

  const navigateToSignIn = useCallback(() => {
    const redirect = authPromptTarget?.href || '/'
    setAuthPromptTarget(null)
    navigate({ to: '/sign-in', search: { redirect } })
  }, [authPromptTarget?.href, navigate])

  const handleNavLinkClick = useCallback(
    (
      event: React.MouseEvent<HTMLAnchorElement>,
      link: TopNavLink,
      closeMobile = false
    ) => {
      if (link.disabled) {
        event.preventDefault()
        return
      }

      if (link.requiresAuth) {
        event.preventDefault()
        if (closeMobile) {
          setMobileOpen(false)
        }
        setAuthPromptSecondsLeft(AUTH_PROMPT_SECONDS)
        setAuthPromptTarget({
          title: t(link.title),
          href: link.href,
        })
        return
      }

      if (closeMobile) {
        setMobileOpen(false)
      }
    },
    [t]
  )

  const desktopLinkClass = (link: TopNavLink) =>
    cn(
      'rounded-md px-2.5 py-1.5 text-[13px] whitespace-nowrap transition-colors',
      pathname === link.href
        ? 'bg-indigo-50 font-medium text-indigo-600'
        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
      link.disabled && 'pointer-events-none opacity-50'
    )

  const mobileLinkClass = (link: TopNavLink) =>
    cn(
      'text-sm text-gray-700',
      link.disabled && 'pointer-events-none opacity-50'
    )

  return (
    <>
      <header
        className={cn(
          'sticky top-0 z-50 border-b border-gray-200 bg-white',
          props.className
        )}
      >
        <nav className='mx-auto flex h-14 w-full max-w-[1440px] items-center justify-between gap-4 px-8 max-[640px]:px-5'>
          <Link
            to={homeUrl}
            className='flex shrink-0 items-center gap-2.5'
            aria-label={displaySiteName}
          >
            <span className='flex size-7 shrink-0 items-center justify-center'>
              {loading ? (
                <Skeleton className='size-full rounded-lg' />
              ) : customLogo ? (
                customLogo
              ) : (
                <HeaderLogo
                  src={systemLogo}
                  loading={loading}
                  logoLoaded={logoLoaded}
                  className='size-full rounded-lg object-contain'
                />
              )}
            </span>
            <span className='text-[15px] font-semibold tracking-tight text-gray-900'>
              {loading ? <Skeleton className='h-4 w-16' /> : displaySiteName}
            </span>
          </Link>

          <div className='hidden items-center gap-0.5 md:flex'>
            {links.map((link, i) =>
              link.external ? (
                <a
                  key={i}
                  href={link.href}
                  target='_blank'
                  rel='noopener noreferrer'
                  aria-disabled={link.disabled}
                  tabIndex={link.disabled ? -1 : undefined}
                  onClick={(event) => handleNavLinkClick(event, link)}
                  className={desktopLinkClass(link)}
                >
                  {t(link.title)}
                </a>
              ) : (
                <Link
                  key={i}
                  to={link.href}
                  disabled={link.disabled}
                  onClick={(event) => handleNavLinkClick(event, link)}
                  className={desktopLinkClass(link)}
                >
                  {t(link.title)}
                </Link>
              )
            )}

            {(showLanguageSwitcher || showThemeSwitch || showNotifications) && (
              <div className='mx-2 h-4 w-px shrink-0 bg-gray-200' />
            )}

            {showLanguageSwitcher && (
              <LanguageSwitcher className={ICON_TRIGGER_CLASS} />
            )}
            {showThemeSwitch && <ThemeSwitch className={ICON_TRIGGER_CLASS} />}
            {showNotifications && (
              <NotificationPopover
                open={notifications.popoverOpen}
                onOpenChange={notifications.setPopoverOpen}
                unreadCount={notifications.unreadCount}
                activeTab={notifications.activeTab}
                onTabChange={notifications.setActiveTab}
                notice={notifications.notice}
                announcements={notifications.announcements}
                loading={notifications.loading}
              />
            )}

            {showAuthButtons &&
              (loading ? (
                <Skeleton className='ml-1.5 h-8 w-20 rounded-md' />
              ) : isAuthenticated ? (
                <span className='ml-1.5 flex items-center'>
                  <ProfileDropdown />
                </span>
              ) : (
                <Link
                  to='/sign-in'
                  className='ml-1.5 rounded-md border border-gray-300 px-3.5 py-1.5 text-[13px] font-medium whitespace-nowrap text-gray-700 transition-colors hover:border-indigo-400 hover:text-indigo-600'
                >
                  {t('Sign in')}
                </Link>
              ))}
          </div>

          <div className='flex items-center gap-1 md:hidden'>
            {showLanguageSwitcher && (
              <LanguageSwitcher className={ICON_TRIGGER_CLASS} />
            )}
            {showThemeSwitch && <ThemeSwitch className={ICON_TRIGGER_CLASS} />}
            <button
              type='button'
              className='p-1.5 text-gray-600'
              onClick={() => setMobileOpen((open) => !open)}
              aria-expanded={mobileOpen}
              aria-label={t('Toggle navigation menu')}
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </nav>

        {mobileOpen && (
          <div className='border-t border-gray-200 bg-white md:hidden'>
            <div className='flex flex-col gap-3 px-5 py-4'>
              {links.map((link, i) =>
                link.external ? (
                  <a
                    key={i}
                    href={link.href}
                    target='_blank'
                    rel='noopener noreferrer'
                    aria-disabled={link.disabled}
                    tabIndex={link.disabled ? -1 : undefined}
                    onClick={(event) => handleNavLinkClick(event, link, true)}
                    className={mobileLinkClass(link)}
                  >
                    {t(link.title)}
                  </a>
                ) : (
                  <Link
                    key={i}
                    to={link.href}
                    disabled={link.disabled}
                    onClick={(event) => handleNavLinkClick(event, link, true)}
                    className={mobileLinkClass(link)}
                  >
                    {t(link.title)}
                  </Link>
                )
              )}

              {showAuthButtons && !loading && (
                <div className='border-t border-gray-200 pt-3'>
                  <Link
                    to={isAuthenticated ? '/dashboard' : '/sign-in'}
                    onClick={() => setMobileOpen(false)}
                    className='inline-block rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700'
                  >
                    {isAuthenticated ? t('Go to Dashboard') : t('Sign in')}
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}
      </header>

      <Dialog
        open={!!authPromptTarget}
        onOpenChange={(open) => {
          if (!open) {
            closeAuthPrompt()
          }
        }}
        title={t('Sign in required')}
        description={t('Please sign in to view {{module}}.', {
          module: authPromptTarget?.title || '',
        })}
        contentClassName='sm:max-w-md'
        contentHeight='auto'
        footer={
          <>
            <Button variant='outline' onClick={closeAuthPrompt}>
              {t('Cancel')}
            </Button>
            <Button onClick={navigateToSignIn}>{t('Sign in now')}</Button>
          </>
        }
      >
        <div className='bg-muted/40 text-muted-foreground rounded-lg px-3 py-2 text-sm'>
          {t('Redirecting to sign in in {{seconds}} seconds.', {
            seconds: authPromptSecondsLeft,
          })}
        </div>
      </Dialog>
    </>
  )
}
