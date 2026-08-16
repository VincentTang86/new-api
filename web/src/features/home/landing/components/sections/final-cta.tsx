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
import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { useStatus } from '@/hooks/use-status'

import { LANDING_CONTAINER, LANDING_FALLBACK_DOCS_URL } from '../../constants'

interface LandingFinalCtaProps {
  isAuthenticated: boolean
}

export function LandingFinalCta(props: LandingFinalCtaProps) {
  const { t } = useTranslation()
  const { status } = useStatus()

  // /docs is not a real route; the nav only links there when docs_link is
  // unset. Always resolve to the configured external documentation.
  const docsUrl =
    (status?.docs_link as string | undefined) || LANDING_FALLBACK_DOCS_URL

  const primaryTarget = props.isAuthenticated ? '/keys' : '/register'

  return (
    // Gradient brand card closing the page — the only inverted surface.
    <section className={`${LANDING_CONTAINER} py-16`}>
      <div className='relative flex flex-col items-center gap-8 rounded-3xl border border-white/40 bg-linear-to-r from-(--pd-gradient-from) to-(--pd-gradient-to) p-20 drop-shadow-[0px_18px_20px_rgba(0,0,0,0.1)] max-[640px]:p-8'>
        <div className='flex flex-col items-center gap-4 text-center'>
          <h2 className='pd-font-display text-[48px] leading-[1.15] font-extrabold text-white max-[640px]:text-[30px]'>
            {t('Start your next model call at a lower cost')}
          </h2>
          <p className='max-w-[600px] text-lg text-white/80 max-[640px]:text-base'>
            {t('No commitment. Pay only for what you use.')}
          </p>
        </div>
        <div className='flex flex-wrap items-center justify-center gap-4'>
          <Link
            to={primaryTarget}
            className='flex items-center justify-center rounded-lg bg-white px-7 py-3.5 text-sm font-semibold whitespace-nowrap text-(--pd-primary) transition-opacity hover:opacity-90'
          >
            {t('Start Building')}
          </Link>
          <a
            href={docsUrl}
            target='_blank'
            rel='noopener noreferrer'
            className='flex items-center justify-center rounded-lg border-[1.5px] border-white/50 px-7 py-3.5 text-sm font-medium whitespace-nowrap text-white transition-colors hover:bg-white/10'
          >
            {t('View API Docs')}
          </a>
        </div>
      </div>
    </section>
  )
}
