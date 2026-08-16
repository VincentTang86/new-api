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
import { usePublicFooterColumns } from '../hooks/use-public-footer'
import type { TopNavLink } from '../types'
import { Footer, type FooterProps } from './footer'
import { PublicHeader, type PublicHeaderProps } from './public-header'

/** Support address published in the footer of every public page. */
const PUBLIC_SUPPORT_EMAIL = 'fairrouter@protonmail.com'

type PublicLayoutProps = {
  children: React.ReactNode
  showMainContainer?: boolean
  navContent?: React.ReactNode
  headerProps?: Omit<PublicHeaderProps, 'navContent'>
  navLinks?: TopNavLink[]
  showThemeSwitch?: boolean
  showAuthButtons?: boolean
  showNotifications?: boolean
  logo?: React.ReactNode
  siteName?: string
  /** Passed through to the shared footer; omit for the default footer. */
  footerProps?: FooterProps
  /** Opt out only for pages that render their own closing chrome. */
  showFooter?: boolean
}

export function PublicLayout(props: PublicLayoutProps) {
  const footerColumns = usePublicFooterColumns()

  return (
    // `public-design` scopes the design file's raw palette, font pair and
    // dark-mode repaint to the public shell — see styles/public-design.css.
    <div className='public-design min-h-svh overflow-x-hidden bg-(--pd-canvas)'>
      <PublicHeader
        navContent={props.navContent}
        navLinks={props.navLinks}
        showThemeSwitch={props.showThemeSwitch}
        showAuthButtons={props.showAuthButtons}
        showNotifications={props.showNotifications}
        logo={props.logo}
        siteName={props.siteName}
        {...props.headerProps}
      />

      {props.showMainContainer !== false ? (
        <main className='container px-4 py-6 md:px-4'>{props.children}</main>
      ) : (
        props.children
      )}

      {props.showFooter !== false && (
        <Footer
          columns={footerColumns}
          supportEmail={PUBLIC_SUPPORT_EMAIL}
          {...props.footerProps}
        />
      )}
    </div>
  )
}
