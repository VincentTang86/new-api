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
import { NotificationPopover } from '@/components/notification-popover'
import { PublicLanguageSwitcher } from '@/components/public-language-switcher'
import { PublicThemeToggle } from '@/components/public-theme-toggle'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useNotifications } from '@/hooks/use-notifications'
import { usePublicNavLinks } from '@/hooks/use-public-nav-links'
import { useSystemConfig } from '@/hooks/use-system-config'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'

import { defaultTopNavLinks } from '../config/top-nav.config'
import type { TopNavLink } from '../types'
import { HeaderLogo } from './header-logo'
import { PublicProfileMenu } from './public-profile-menu'

const AUTH_PROMPT_SECONDS = 5

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
  const dynamicLinks = usePublicNavLinks()
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

  /* Display-only items keep the resting link style on purpose (the design
   * shows them as plain labels), so they get no hover accent and a default
   * cursor instead of a dimmed state. */
  const desktopLinkClass = (link: TopNavLink) =>
    cn(
      'text-sm whitespace-nowrap transition-colors',
      // The design switches face as well as weight on the current page: Inter
      // semibold for the active link, Geist medium for the rest.
      pathname === link.href && !link.disabled
        ? 'pd-font-ui font-semibold text-(--pd-primary)'
        : 'font-medium text-(--pd-ink)',
      link.disabled ? 'cursor-default' : 'hover:text-(--pd-primary)'
    )

  const mobileLinkClass = (link: TopNavLink) =>
    cn(
      'text-sm',
      pathname === link.href && !link.disabled
        ? 'pd-font-ui font-semibold text-(--pd-primary)'
        : 'text-(--pd-ink)',
      link.disabled && 'cursor-default text-(--pd-muted-2)'
    )

  let brandMark: React.ReactNode
  if (loading) {
    brandMark = <Skeleton className='size-full rounded-md' />
  } else if (customLogo) {
    brandMark = customLogo
  } else {
    brandMark = (
      <HeaderLogo
        src={systemLogo}
        loading={loading}
        logoLoaded={logoLoaded}
        className='size-full rounded-md object-contain'
      />
    )
  }

  let authControls: React.ReactNode = null
  if (showAuthButtons) {
    if (loading) {
      authControls = <Skeleton className='h-8 w-24 rounded-full' />
    } else if (isAuthenticated) {
      authControls = <PublicProfileMenu />
    } else {
      authControls = (
        <>
          <Link
            to='/sign-in'
            className='text-sm font-medium whitespace-nowrap text-(--pd-ink) transition-colors hover:text-(--pd-primary)'
          >
            {t('Sign in')}
          </Link>
          <Link
            to='/register'
            className='flex h-[30px] items-center justify-center rounded-lg bg-linear-to-r from-(--pd-gradient-from) to-(--pd-gradient-to) px-4 text-sm font-semibold whitespace-nowrap text-white transition-opacity hover:opacity-90'
          >
            {t('Sign up')}
          </Link>
        </>
      )
    }
  }

  return (
    <>
      <header
        className={cn(
          'sticky top-0 z-50 border-b border-(--pd-border) bg-(--pd-canvas) drop-shadow-[0px_6px_9px_rgba(0,0,0,0.04)]',
          props.className
        )}
      >
        <nav className='mx-auto flex h-[55px] w-full max-w-[1440px] items-center justify-between gap-4 px-8 max-[640px]:px-5'>
          <Link
            to={homeUrl}
            className='flex shrink-0 items-center gap-3'
            aria-label={displaySiteName}
          >
            <span className='flex size-6 shrink-0 items-center justify-center'>
              {brandMark}
            </span>
            <span className='pd-font-display text-[22px] font-bold whitespace-nowrap text-(--pd-ink)'>
              {loading ? <Skeleton className='h-5 w-24' /> : displaySiteName}
            </span>
          </Link>

          <div className='hidden min-w-0 flex-1 items-center justify-end gap-8 pr-8 md:flex'>
            {links.map((link) =>
              link.external ? (
                <a
                  key={link.title}
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
                  key={link.title}
                  to={link.href}
                  disabled={link.disabled}
                  aria-disabled={link.disabled}
                  onClick={(event) => handleNavLinkClick(event, link)}
                  className={desktopLinkClass(link)}
                >
                  {t(link.title)}
                </Link>
              )
            )}
          </div>

          <div className='hidden shrink-0 items-center gap-4 md:flex'>
            {showLanguageSwitcher && <PublicLanguageSwitcher />}
            {showThemeSwitch && <PublicThemeToggle />}
            {showNotifications && isAuthenticated && (
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

            {authControls}
          </div>

          <div className='flex items-center gap-4 md:hidden'>
            {showLanguageSwitcher && <PublicLanguageSwitcher />}
            {showThemeSwitch && <PublicThemeToggle />}
            <button
              type='button'
              className='p-1.5 text-(--pd-muted-2)'
              onClick={() => setMobileOpen((open) => !open)}
              aria-expanded={mobileOpen}
              aria-label={t('Toggle navigation menu')}
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </nav>

        {mobileOpen && (
          <div className='border-t border-(--pd-border) bg-(--pd-canvas) md:hidden'>
            <div className='flex flex-col gap-3 px-5 py-4'>
              {links.map((link) =>
                link.external ? (
                  <a
                    key={link.title}
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
                    key={link.title}
                    to={link.href}
                    disabled={link.disabled}
                    aria-disabled={link.disabled}
                    onClick={(event) => handleNavLinkClick(event, link, true)}
                    className={mobileLinkClass(link)}
                  >
                    {t(link.title)}
                  </Link>
                )
              )}

              {showAuthButtons && !loading && (
                <div className='flex items-center gap-3 border-t border-(--pd-border) pt-3'>
                  {isAuthenticated ? (
                    <Link
                      to='/dashboard'
                      onClick={() => setMobileOpen(false)}
                      className='inline-flex h-9 items-center rounded-lg border border-(--pd-border) px-4 text-sm font-medium text-(--pd-ink)'
                    >
                      {t('Go to Dashboard')}
                    </Link>
                  ) : (
                    <>
                      <Link
                        to='/sign-in'
                        onClick={() => setMobileOpen(false)}
                        className='inline-flex h-9 items-center rounded-lg border border-(--pd-border) px-4 text-sm font-medium text-(--pd-ink)'
                      >
                        {t('Sign in')}
                      </Link>
                      <Link
                        to='/register'
                        onClick={() => setMobileOpen(false)}
                        className='inline-flex h-9 items-center rounded-lg bg-linear-to-r from-(--pd-gradient-from) to-(--pd-gradient-to) px-4 text-sm font-semibold text-white'
                      >
                        {t('Sign up')}
                      </Link>
                    </>
                  )}
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
