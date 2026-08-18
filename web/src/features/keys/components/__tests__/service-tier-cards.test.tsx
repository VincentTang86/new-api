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
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'

const reducedMotionMediaQuery = window.matchMedia('(prefers-reduced-motion)')
Object.defineProperty(window, 'matchMedia', {
  configurable: true,
  value: () => reducedMotionMediaQuery,
})

const { useState } = await import('react')
const { createInstance } = await import('i18next')
const { I18nextProvider, initReactI18next } = await import('react-i18next')
const { ServiceTierCards } = await import('../service-tier-cards')
const { buildServiceTierOptions } = await import('../../lib')

const i18n = createInstance()
await i18n.use(initReactI18next).init({
  lng: 'en',
  resources: { en: { translation: { Ratio: 'Ratio' } } },
})

const tiers = buildServiceTierOptions(
  {
    Production: { desc: 'Production', ratio: 1 },
    'Best Effort': { desc: 'Lower Cost', ratio: 0.9 },
    vip: { desc: 'Priority access', ratio: 2 },
  },
  i18n.t
)

function Harness(props: { initialValue: string }) {
  const [value, setValue] = useState(props.initialValue)

  return (
    <I18nextProvider i18n={i18n}>
      <ServiceTierCards
        options={tiers}
        value={value}
        onValueChange={setValue}
      />
      <output data-testid='selected-tier'>{value}</output>
    </I18nextProvider>
  )
}

function getTierRadio(tier: string): HTMLElement {
  return screen.getByRole('radio', { name: tier })
}

describe('ServiceTierCards', () => {
  test('renders one card per usable group, led by the known tiers', () => {
    render(<Harness initialValue='Production' />)

    expect(
      [...document.querySelectorAll('[data-service-tier-card]')].map((card) =>
        card.getAttribute('data-service-tier-card')
      )
    ).toEqual(['Production', 'Best Effort', 'vip'])
  })

  test('shows the tier name, workload blurb and pricing badge of a known tier', () => {
    render(<Harness initialValue='Production' />)

    const card = document.querySelector<HTMLElement>(
      '[data-service-tier-card="Best Effort"]'
    )
    expect(card?.textContent).toContain('Best Effort')
    expect(card?.textContent).toContain(
      'Lower-cost endpoints for development, testing, and non-critical workloads.'
    )
    expect(card?.textContent).toContain('Discounted pricing')
  })

  test('falls back to the ratio badge on a group the catalogue does not name', () => {
    render(<Harness initialValue='Production' />)

    const card = document.querySelector<HTMLElement>(
      '[data-service-tier-card="vip"]'
    )
    expect(card?.textContent).toContain('Priority access')
    expect(card?.textContent).toContain('2x Ratio')
  })

  test('marks only the selected tier as checked', () => {
    render(<Harness initialValue='Production' />)

    expect(getTierRadio('Production').getAttribute('aria-checked')).toBe('true')
    expect(getTierRadio('Best Effort').getAttribute('aria-checked')).toBe(
      'false'
    )
  })

  test('moves the selection to the clicked tier', () => {
    render(<Harness initialValue='Production' />)

    fireEvent.click(getTierRadio('Best Effort'))

    expect(screen.getByTestId('selected-tier').textContent).toBe('Best Effort')
    expect(getTierRadio('Best Effort').getAttribute('aria-checked')).toBe(
      'true'
    )
    expect(getTierRadio('Production').getAttribute('aria-checked')).toBe(
      'false'
    )
  })

  test('names each radio after its tier alone and keeps them in a radio group', () => {
    render(<Harness initialValue='Production' />)

    expect(screen.getByRole('radiogroup')).toBeTruthy()
    expect(
      screen.getAllByRole('radio').map((radio) => radio.getAttribute('id'))
    ).toHaveLength(3)
    expect(
      getTierRadio('Best Effort').getAttribute('aria-describedby')
    ).toBeTruthy()
  })

  test('keeps no card selected when the form has no tier yet', () => {
    render(<Harness initialValue='' />)

    for (const tier of ['Production', 'Best Effort', 'vip']) {
      expect(getTierRadio(tier).getAttribute('aria-checked')).toBe('false')
    }
  })
})
