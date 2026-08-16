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
import { useTranslation } from 'react-i18next'

import { useStatus } from '@/hooks/use-status'

import {
  LANDING_CONTAINER,
  LANDING_FALLBACK_API_BASE_URL,
  LANDING_FALLBACK_DOCS_URL,
  LANDING_SECTION_IDS,
} from '../../constants'
import { CodeSampleTabs } from '../code-sample/code-sample-tabs'

export function LandingCodeSample() {
  const { t } = useTranslation()
  const { status } = useStatus()

  const serverAddress = (status?.server_address as string | undefined)?.replace(
    /\/+$/,
    ''
  )
  const baseUrl = serverAddress
    ? `${serverAddress}/v1`
    : LANDING_FALLBACK_API_BASE_URL
  const docsUrl =
    (status?.docs_link as string | undefined) || LANDING_FALLBACK_DOCS_URL

  return (
    <section id={LANDING_SECTION_IDS.code} className='py-16'>
      <div className={LANDING_CONTAINER}>
        <div className='max-w-[720px]'>
          <h2 className='pd-font-display mb-3 text-[40px] font-extrabold tracking-tight text-(--pd-ink-strong) max-[640px]:text-[28px]'>
            {t('Change two lines, start calling')}
          </h2>
          <p className='mb-8 text-base text-(--pd-muted)'>
            {t(
              'Already using the OpenAI SDK? Only base_url and api_key need to change.'
            )}
          </p>
          <CodeSampleTabs baseUrl={baseUrl} />
          <p className='mt-4 text-sm text-(--pd-muted-3)'>
            <a
              href={docsUrl}
              target='_blank'
              rel='noopener noreferrer'
              className='text-(--pd-primary) transition-colors hover:opacity-80'
            >
              {t('Read the quickstart guide')}
            </a>
          </p>
        </div>
      </div>
    </section>
  )
}
