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
import { ArrowRight } from 'lucide-react'
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

  const primaryLabel = props.isAuthenticated
    ? t('Go to console')
    : t('Get Started')
  const primaryTarget = props.isAuthenticated ? '/keys' : '/register'

  return (
    // Full-bleed brand band closing the page — the only inverted section.
    <section className='border-t border-gray-100 bg-indigo-600 py-20'>
      <div className={`${LANDING_CONTAINER} text-center`}>
        <h2 className='mb-3 text-3xl font-semibold tracking-tight text-white max-[640px]:text-2xl'>
          {t('Start your next model call at a lower cost')}
        </h2>
        <p className='mb-8 text-sm text-indigo-200'>
          {t('No commitment. Pay only for what you use.')}
        </p>
        <div className='flex flex-wrap justify-center gap-3'>
          <Link
            to={primaryTarget}
            className='inline-flex items-center gap-2 rounded-md bg-white px-5 py-2.5 text-sm font-medium text-indigo-700 transition-colors hover:bg-indigo-50'
          >
            {primaryLabel}
            <ArrowRight size={14} aria-hidden />
          </Link>
          <a
            href={docsUrl}
            target='_blank'
            rel='noopener noreferrer'
            className='inline-flex items-center gap-2 rounded-md border border-indigo-500 bg-indigo-700 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-800'
          >
            {t('View API Docs')}
          </a>
        </div>
      </div>
    </section>
  )
}
