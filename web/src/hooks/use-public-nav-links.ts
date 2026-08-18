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
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import type { TopNavLink } from '@/components/layout/types'
import { LANDING_FALLBACK_DOCS_URL } from '@/features/home/landing/constants'
import { useStatus } from '@/hooks/use-status'
import { parseHeaderNavModulesFromStatus } from '@/lib/nav-modules'
import { useAuthStore } from '@/stores/auth-store'

/**
 * Header navigation from the FairRouter design: Home, Models & Pricing,
 * Playground, Docs, Contact Us. Shared by the public header and the console
 * header so both render the same five entries.
 *
 * - Playground navigates to /playground — the route sits under the
 *   authenticated tree, so its guard sends signed-out visitors to /sign-in
 *   (with a redirect back) by itself.
 * - Docs opens the configured documentation site (`docs_link` from
 *   /api/status, the same source the footer and landing CTAs use) in a new
 *   tab, falling back to the project docs when unset.
 * - Contact Us routes to the existing About page.
 *
 * Home and pricing keep honoring the backend `HeaderNavModules` switches, so
 * admins can still hide them. The design has no Console, Rankings or About
 * entry, so those switches no longer have anything to drive.
 */
export function usePublicNavLinks(): TopNavLink[] {
  const { t } = useTranslation()
  const { status } = useStatus()
  const { auth } = useAuthStore()

  const modules = useMemo(() => {
    return parseHeaderNavModulesFromStatus(
      status as Record<string, unknown> | null
    )
  }, [status])

  const isAuthed = !!auth?.user

  const links: TopNavLink[] = []

  if (modules?.home !== false) {
    links.push({ title: t('Home'), href: '/' })
  }

  const pricing = modules?.pricing
  if (pricing && typeof pricing === 'object' && pricing.enabled) {
    const requiresAuth = pricing.requireAuth && !isAuthed
    links.push({
      title: t('Models & Pricing'),
      href: '/pricing',
      requiresAuth,
    })
  }

  const docsUrl =
    (status?.docs_link as string | undefined) || LANDING_FALLBACK_DOCS_URL

  links.push(
    { title: t('Playground'), href: '/playground' },
    { title: t('Docs'), href: docsUrl, external: true },
    { title: t('Contact Us'), href: '/about' }
  )

  return links
}
