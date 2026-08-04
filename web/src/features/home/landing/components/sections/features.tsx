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
import { Activity, Plug, ShieldCheck, Zap } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { LANDING_CONTAINER } from '../../constants'

export function LandingFeatures() {
  const { t } = useTranslation()

  const features = [
    {
      key: 'price',
      Icon: Zap,
      title: t('Lower prices'),
      desc: t(
        'Discounted rates on the same models. Pricing is transparent — see the source of every discount.'
      ),
    },
    {
      key: 'routing',
      Icon: ShieldCheck,
      title: t('No substitutions'),
      desc: t(
        'The model ID you request is the model that runs. Routing records are available in your dashboard.'
      ),
    },
    {
      key: 'latency',
      Icon: Activity,
      title: t('Stable & fast'),
      desc: t(
        'Health checks and route optimization reduce failures and latency across all supported models.'
      ),
    },
    {
      key: 'api',
      Icon: Plug,
      title: t('One API'),
      desc: t(
        'Compatible with the OpenAI SDK. Switch by changing base_url and api_key — no other code changes needed.'
      ),
    },
  ]

  return (
    <section className='border-t border-gray-100 bg-gray-50'>
      <div className={`${LANDING_CONTAINER} py-16`}>
        {/* Hairline grid: the 1px gaps expose the container behind the cells,
            so the four read as one block rather than as cards. */}
        <div className='grid grid-cols-4 gap-px bg-gray-200 max-[900px]:grid-cols-2 max-[640px]:grid-cols-1'>
          {features.map((feature) => (
            <div key={feature.key} className='bg-gray-50 p-6'>
              <div className='mb-3'>
                <feature.Icon
                  size={18}
                  className='text-indigo-600'
                  aria-hidden
                />
              </div>
              <h3 className='mb-2 text-sm font-semibold text-gray-900'>
                {feature.title}
              </h3>
              <p className='text-sm leading-relaxed text-gray-600'>
                {feature.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
