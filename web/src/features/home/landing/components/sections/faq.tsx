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
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useSystemConfig } from '@/hooks/use-system-config'
import { cn } from '@/lib/utils'

import { LANDING_CONTAINER, LANDING_SECTION_IDS } from '../../constants'

export function LandingFaq() {
  const { t } = useTranslation()
  const { systemName } = useSystemConfig()
  const panelIdPrefix = useId()
  const [openKey, setOpenKey] = useState<string | null>(null)

  const items = [
    {
      key: 'official',
      q: t('Is this the official API from model providers?'),
      a: t(
        'No. {{name}} is an independent API routing service. We access providers through official channels and pass the savings on to developers. We are not affiliated with any AI company.',
        { name: systemName }
      ),
    },
    {
      key: 'why-cheaper',
      q: t('Why are prices lower?'),
      a: t(
        'We obtain discounted rates through volume purchasing and partner channels, then share the majority of those savings with users. The discount amount and its source are documented on each model’s detail page.'
      ),
    },
    {
      key: 'migrate',
      q: t('How do I migrate from OpenAI?'),
      a: t(
        'Two changes: point base_url at our endpoint and replace your api_key with the key you generated here, then update the model ID. No other code changes are required.'
      ),
    },
    {
      key: 'models',
      q: t('Which models are supported?'),
      a: t(
        'Ten curated models from OpenAI, Anthropic, Google, DeepSeek, Meta, Alibaba, Kimi, Zhipu, MiniMax, and Doubao. See the pricing table above for the full list and current status.'
      ),
    },
    {
      key: 'billing',
      q: t('How does billing work?'),
      a: t(
        'You are billed per actual token consumed, with separate rates for input and output. There is no minimum spend, subscription, or platform surcharge. Requests are rejected when your balance is insufficient — no overdraft.'
      ),
    },
    {
      key: 'failures',
      q: t('Am I charged for failed requests?'),
      a: t(
        'Failures caused by our infrastructure are not charged. Failures due to malformed requests, context-length exceeded, or upstream provider errors are billed based on tokens consumed up to the point of failure.'
      ),
    },
    {
      key: 'privacy',
      q: t('Is my request content stored?'),
      a: t(
        'Request and response content is not used for training or analysis. Logs are retained for billing reconciliation and incident investigation only. See the privacy policy for details.'
      ),
    },
  ]

  return (
    <section
      id={LANDING_SECTION_IDS.faq}
      className={cn(LANDING_CONTAINER, 'py-20')}
    >
      <h2 className='mb-10 text-3xl font-semibold tracking-tight text-gray-900 max-[640px]:text-2xl'>
        {t('FAQ')}
      </h2>
      <div className='max-w-[720px] overflow-hidden rounded-md border border-gray-200'>
        {items.map((item) => {
          const isOpen = openKey === item.key
          const panelId = `${panelIdPrefix}-${item.key}`
          const Chevron = isOpen ? ChevronUp : ChevronDown
          return (
            <div
              key={item.key}
              className='border-b border-gray-100 last:border-b-0'
            >
              <button
                type='button'
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => setOpenKey(isOpen ? null : item.key)}
                className='flex w-full items-start justify-between gap-4 px-5 py-4 text-left'
              >
                <span className='text-sm font-medium text-gray-900'>
                  {item.q}
                </span>
                <Chevron
                  size={16}
                  className='mt-0.5 shrink-0 text-gray-400'
                  aria-hidden
                />
              </button>
              {isOpen && (
                <div
                  id={panelId}
                  className='faq-answer bg-gray-50 px-5 pb-4 text-sm leading-relaxed text-gray-600'
                >
                  {item.a}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
