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
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { formatInputPrice, formatOutputPrice } from '../../lib/pricing'
import type { LandingModelRow } from '../../types'
import type { PricingListVariant } from './pricing-model-list'
import { ProviderMark } from './provider-mark'
import { SavingsCell } from './savings-cell'

interface PricingPreviewAccordionProps {
  rows: readonly LandingModelRow[]
  variant: PricingListVariant
}

/**
 * Nine columns cannot fit a phone. Below `md` each model collapses to a row
 * that expands into the same figures as a two-column grid.
 */
export function PricingPreviewAccordion(props: PricingPreviewAccordionProps) {
  const { t } = useTranslation()
  const panelIdPrefix = useId()
  const [openId, setOpenId] = useState<string | null>(null)

  return (
    <div
      data-slot='pricing-accordion'
      className='overflow-hidden rounded-md border border-gray-200 md:hidden'
    >
      {props.rows.map((row) => {
        const isOpen = openId === row.modelId
        const panelId = `${panelIdPrefix}-${row.modelId}`
        const Chevron = isOpen ? ChevronUp : ChevronDown
        return (
          <div
            key={row.modelId}
            className='border-b border-gray-100 last:border-b-0'
          >
            <button
              type='button'
              aria-expanded={isOpen}
              aria-controls={panelId}
              onClick={() => setOpenId(isOpen ? null : row.modelId)}
              className='flex w-full items-center justify-between px-4 py-3.5 text-left'
            >
              <span className='flex items-center gap-2.5'>
                <ProviderMark
                  provider={row.provider}
                  variant={props.variant === 'preview' ? 'dot' : 'chip'}
                />
                <span className='text-sm font-medium text-gray-900'>
                  {row.name}
                </span>
              </span>
              <Chevron size={14} className='text-gray-400' aria-hidden />
            </button>
            {isOpen && (
              <div id={panelId} className='bg-gray-50 px-4 pb-4 text-sm'>
                <p className='mb-3 font-mono text-xs text-gray-400'>
                  {row.modelId}
                </p>
                <dl className='grid grid-cols-2 gap-3'>
                  <div>
                    <dt className='mb-1 text-xs text-indigo-600'>
                      {t('Input / 1M')}
                    </dt>
                    <dd className='font-mono font-medium text-indigo-700'>
                      {formatInputPrice(row.inputPrice)}
                    </dd>
                  </div>
                  <div>
                    <dt className='mb-1 text-xs text-indigo-600'>
                      {t('Output / 1M')}
                    </dt>
                    <dd className='font-mono font-medium text-indigo-700'>
                      {formatOutputPrice(row.outputPrice)}
                    </dd>
                  </div>
                  <div>
                    <dt className='mb-1 text-xs text-gray-400'>
                      {t('Official input / 1M')}
                    </dt>
                    <dd className='font-mono text-gray-400 line-through'>
                      {formatInputPrice(row.officialInputPrice)}
                    </dd>
                  </div>
                  <div>
                    <dt className='mb-1 text-xs text-gray-400'>
                      {t('Official output / 1M')}
                    </dt>
                    <dd className='font-mono text-gray-400 line-through'>
                      {formatOutputPrice(row.officialOutputPrice)}
                    </dd>
                  </div>
                  <div>
                    <dt className='mb-1 text-xs text-emerald-600'>
                      {t('Input savings')}
                    </dt>
                    <dd className='font-mono'>
                      <SavingsCell
                        ourPrice={row.inputPrice}
                        officialPrice={row.officialInputPrice}
                      />
                    </dd>
                  </div>
                  <div>
                    <dt className='mb-1 text-xs text-emerald-600'>
                      {t('Output savings')}
                    </dt>
                    <dd className='font-mono'>
                      <SavingsCell
                        ourPrice={row.outputPrice}
                        officialPrice={row.officialOutputPrice}
                      />
                    </dd>
                  </div>
                  <div>
                    <dt className='mb-1 text-xs text-gray-500'>
                      {t('Context')}
                    </dt>
                    <dd className='font-mono font-medium text-gray-900'>
                      {row.context}
                    </dd>
                  </div>
                </dl>
                {props.variant === 'catalogue' && (
                  <Link
                    to='/pricing/$modelId'
                    params={{ modelId: row.modelId }}
                    className='mt-3 inline-block text-xs text-indigo-600 hover:text-indigo-800'
                  >
                    {t('Details →')}
                  </Link>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
