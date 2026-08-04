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

const FALLBACK_DOCS_URL = 'https://docs.newapi.pro'

/**
 * Footer links shared by every public page.
 *
 * Module gating matters here: an operator can switch pricing, rankings or about
 * off, and a footer link to a disabled page would bounce the visitor straight
 * back to the home page.
 */
export function usePublicFooterColumns(): FooterColumnProps[] {
  const { status } = useStatus()
  const docsUrl = (status?.docs_link as string | undefined) || FALLBACK_DOCS_URL

  return useMemo(() => {
    const modules = parseHeaderNavModulesFromStatus(status)
    const product: FooterColumnProps['links'] = []
    if (modules.pricing.enabled) {
      product.push({ text: 'Models & Pricing', href: '/pricing' })
    }
    if (modules.rankings.enabled) {
      product.push({ text: 'Rankings', href: '/rankings' })
    }
    if (modules.about) {
      product.push({ text: 'About', href: '/about' })
    }

    return [
      { title: 'Product', links: product },
      { title: 'Developers', links: [{ text: 'API Docs', href: docsUrl }] },
      {
        title: 'Legal',
        links: [
          { text: 'Terms of Service', href: '/user-agreement' },
          { text: 'Privacy Policy', href: '/privacy-policy' },
        ],
      },
    ].filter((column) => column.links.length > 0)
  }, [docsUrl, status])
}
