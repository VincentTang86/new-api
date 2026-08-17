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
        'Discounted rates on the same models. Pricing is transparent — see the source of pricing comparisons.'
      ),
    },
    {
      key: 'routing',
      Icon: ShieldCheck,
      title: t('No substitutions'),
      desc: t(
        'We never secretly replace models. The model ID you request is the model that runs.'
      ),
    },
    {
      key: 'latency',
      Icon: Activity,
      title: t('Stable & fast'),
      desc: t(
        'Model routes and route configuration reduce latency and deliver access across all supported providers.'
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
    <section className={`${LANDING_CONTAINER} py-16`}>
      <div className='grid grid-cols-4 gap-5 max-[900px]:grid-cols-2 max-[640px]:grid-cols-1'>
        {features.map((feature) => (
          <div
            key={feature.key}
            className='flex flex-col gap-3 rounded-2xl bg-(--pd-surface) p-7 drop-shadow-[0px_2px_6px_rgba(0,0,0,0.06)]'
          >
            <div className='flex items-center gap-3'>
              <span className='flex size-8 shrink-0 items-center justify-center rounded-lg bg-(--pd-accent-bg)'>
                <feature.Icon
                  size={18}
                  className='text-(--pd-primary)'
                  aria-hidden
                />
              </span>
              <h3 className='pd-font-display text-xl font-bold whitespace-nowrap text-(--pd-ink-strong)'>
                {feature.title}
              </h3>
            </div>
            <p className='text-base leading-[1.6] text-(--pd-muted)'>
              {feature.desc}
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}
