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
import type { FooterColumnProps } from '../components/footer'

/**
 * Footer links shared by every public page — exactly the three the design
 * lists, and unconditional like the design's are.
 *
 * They are deliberately not module-gated. The header's Contact Us item is
 * ungated too, and gating the legal pair on `user_agreement_enabled` /
 * `privacy_policy_enabled` empties the footer row on any deployment that has
 * not filled those documents in, which is how the row went blank once. All
 * three routes exist regardless.
 *
 * Rankings, Models & Pricing and API Docs are absent because the design has no
 * footer entry for them; those pages stay reachable from the header.
 */
const PUBLIC_FOOTER_COLUMNS: FooterColumnProps[] = [
  {
    title: 'Product',
    links: [
      // Same destination as the header's last nav item, and named the same way.
      { text: 'Contact Us', href: '/about' },
      { text: 'User Agreement', href: '/user-agreement' },
      { text: 'Privacy Policy', href: '/privacy-policy' },
    ],
  },
]

export function usePublicFooterColumns(): FooterColumnProps[] {
  return PUBLIC_FOOTER_COLUMNS
}
