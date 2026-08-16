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

import { LANDING_PROVIDER_ORDER } from '../../constants'
import { LANDING_PROVIDERS } from '../../lib/providers'

/**
 * "MODELS FROM" strip under the hero. Real vendor marks (lobehub icons on
 * their brand chip) beside the vendor name — the design mock shipped broken
 * placeholder images here, so the chip treatment is deliberately our own:
 * icon and label sit side by side, nothing overlaps.
 */
export function LandingProviderRow() {
  const { t } = useTranslation()

  return (
    <div className='flex w-full flex-col items-center gap-5 pt-2'>
      <p className='text-xs font-bold tracking-widest text-(--pd-muted-2) uppercase'>
        {t('Models from')}
      </p>
      <ul className='flex flex-wrap items-center justify-center gap-x-4 gap-y-3'>
        {LANDING_PROVIDER_ORDER.map((key) => {
          const provider = LANDING_PROVIDERS[key]
          return (
            <li
              key={key}
              className='inline-flex items-center gap-2 rounded-xl py-1'
            >
              <span
                className='flex size-[18px] shrink-0 items-center justify-center rounded'
                style={{ background: provider.chip.bg }}
              >
                <provider.chip.Icon
                  size={12}
                  className='text-white'
                  aria-hidden
                />
              </span>
              <span className='text-[15px] font-medium whitespace-nowrap text-(--pd-ink)'>
                {provider.label}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
