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

import { useStatus } from '@/hooks/use-status'
import { parseHeaderNavModulesFromStatus } from '@/lib/nav-modules'

import type { FooterColumnProps } from '../components/footer'

/**
 * Footer links shared by every public page.
 *
 * The design lists exactly three: Contact Us, User Agreement, Privacy Policy.
 * Only the first comes from here — the two legal links are rendered by the
 * footer's own `LegalLinks`, which gates them on whether those pages are
 * enabled at all. Rankings, Models & Pricing and API Docs are deliberately
 * absent; those pages stay routable, just unlinked from the footer.
 *
 * Module gating still matters for the one link that is left: an operator can
 * switch the about page off, and a footer link to a disabled page would bounce
 * the visitor straight back to the home page.
 */
export function usePublicFooterColumns(): FooterColumnProps[] {
  const { status } = useStatus()

  return useMemo(() => {
    const modules = parseHeaderNavModulesFromStatus(status)
    if (!modules.about) {
      return []
    }
    return [
      {
        title: 'Product',
        // Same destination as the header's last nav item, and named the same way.
        links: [{ text: 'Contact Us', href: '/about' }],
      },
    ]
  }, [status])
}
