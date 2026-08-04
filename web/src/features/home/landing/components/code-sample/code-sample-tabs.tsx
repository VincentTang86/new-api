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
import { Check, Copy } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'
import { cn } from '@/lib/utils'

import { LANDING_CODE_SURFACE } from '../../constants'
import { buildLandingCodeSamples } from '../../data/code-samples'
import type { LandingCodeLanguage } from '../../types'

interface CodeSampleTabsProps {
  baseUrl: string
}

/**
 * The snippet panel is the one deliberately dark surface on the page in both
 * themes, so it uses literal editor colours rather than page colours.
 */
export function CodeSampleTabs(props: CodeSampleTabsProps) {
  const { t } = useTranslation()
  const [language, setLanguage] = useState<LandingCodeLanguage>('python')
  const { copiedText, copyToClipboard } = useCopyToClipboard({ notify: false })

  const samples = useMemo(
    () => buildLandingCodeSamples(props.baseUrl),
    [props.baseUrl]
  )
  const active = samples.find((sample) => sample.language === language)
  const isCopied = Boolean(active) && copiedText === active?.snippet

  return (
    <div
      className='overflow-hidden rounded-md border border-gray-200'
      style={{ background: LANDING_CODE_SURFACE }}
    >
      <div
        role='tablist'
        aria-label={t('Code sample language')}
        className='flex items-center justify-between border-b border-gray-800 px-1'
      >
        <div className='flex'>
          {samples.map((sample) => {
            const isActive = sample.language === language
            return (
              <button
                key={sample.language}
                type='button'
                role='tab'
                aria-selected={isActive}
                onClick={() => setLanguage(sample.language)}
                className={cn(
                  'px-4 py-2.5 font-mono text-xs transition-colors',
                  isActive
                    ? 'border-b border-indigo-400 text-white'
                    : 'text-gray-500 hover:text-gray-300'
                )}
              >
                {sample.label}
              </button>
            )
          })}
        </div>
        {active ? (
          <button
            type='button'
            onClick={() => copyToClipboard(active.snippet)}
            aria-label={isCopied ? t('Copied') : t('Copy code sample')}
            className='flex items-center gap-1.5 px-3 py-2 text-xs text-gray-400 transition-colors hover:text-gray-200'
          >
            {isCopied ? (
              <>
                <Check size={12} className='text-emerald-400' aria-hidden />
                <span className='text-emerald-400'>{t('Copied')}</span>
              </>
            ) : (
              <>
                <Copy size={12} aria-hidden />
                {t('Copy')}
              </>
            )}
          </button>
        ) : null}
      </div>

      <pre className='overflow-x-auto p-5 font-mono text-sm leading-relaxed text-gray-300'>
        <code>{active?.snippet}</code>
      </pre>
    </div>
  )
}
