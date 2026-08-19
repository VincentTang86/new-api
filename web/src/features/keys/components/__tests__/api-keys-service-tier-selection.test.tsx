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
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'vitest'

const { createInstance } = await import('i18next')
const { I18nextProvider, initReactI18next } = await import('react-i18next')
const { QueryClient, QueryClientProvider } =
  await import('@tanstack/react-query')
const { api } = await import('@/lib/api')
const { ApiKeysProvider } = await import('../api-keys-provider')
const { ApiKeysMutateDrawer } = await import('../api-keys-mutate-drawer')

const i18n = createInstance()
await i18n.use(initReactI18next).init({
  lng: 'en',
  resources: { en: { translation: {} } },
})

// A FairRouter-shaped deployment: named service tiers, no Auto group.
const USER_GROUPS = {
  'Best Effort': { desc: 'Lower Cost', ratio: 0.9 },
  Production: { desc: 'Production', ratio: 1 },
}

type ApiMethod = (url: string, data?: unknown) => Promise<{ data: unknown }>
type MockableApi = { get: ApiMethod; post: ApiMethod }

const apiClient = api as unknown as MockableApi
const originalGet = apiClient.get
const originalPost = apiClient.post
let queryClient: InstanceType<typeof QueryClient> | null = null

function installApiFixtures(
  createdPayloads: Array<Record<string, unknown>>
): void {
  apiClient.get = async (url) => {
    switch (url) {
      case '/api/status':
        return { data: { data: { default_use_auto_group: false } } }
      case '/api/user/models':
        return { data: { success: true, data: [] } }
      case '/api/user/self/groups':
        return { data: { success: true, data: USER_GROUPS } }
      case '/api/token/auto-groups':
        return { data: { success: true, data: { groups: [], max_count: 3 } } }
      default:
        throw new Error(`Unexpected GET ${url}`)
    }
  }
  apiClient.post = async (url, data) => {
    expect(url).toBe('/api/token/')
    createdPayloads.push(data as Record<string, unknown>)
    return { data: { success: true, data: {} } }
  }
}

async function renderCreateDrawer(): Promise<void> {
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const freshAt = Date.now() + 60_000
  queryClient.setQueryData(
    ['status'],
    { default_use_auto_group: false },
    { updatedAt: freshAt }
  )
  queryClient.setQueryData(
    ['user-models'],
    { success: true, data: [] },
    { updatedAt: freshAt }
  )
  queryClient.setQueryData(
    ['user-groups'],
    { success: true, data: USER_GROUPS },
    { updatedAt: freshAt }
  )
  queryClient.setQueryData(
    ['token-auto-groups'],
    { success: true, data: { groups: [], max_count: 3 } },
    { updatedAt: freshAt }
  )

  render(
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>
        <ApiKeysProvider>
          <ApiKeysMutateDrawer open onOpenChange={() => undefined} />
        </ApiKeysProvider>
      </I18nextProvider>
    </QueryClientProvider>
  )
  await waitFor(
    () => {
      expect(findButton('Save changes')).toBeEnabled()
    },
    { timeout: 1500 }
  )
}

function findButton(text: string): HTMLButtonElement {
  const button = screen
    .queryAllByRole<HTMLButtonElement>('button')
    .find((candidate) => candidate.textContent?.includes(text))
  if (!button) {
    throw new Error(`Expected button containing "${text}"`)
  }
  return button
}

function getTierRadio(tier: string): HTMLElement {
  const radio = document.querySelector<HTMLElement>(
    `[data-service-tier-card="${tier}"] [data-slot="radio-group-item"]`
  )
  if (!radio) {
    throw new Error(`Expected a service tier card for "${tier}"`)
  }
  return radio
}

function typeName(value: string): void {
  const label = [...document.querySelectorAll<HTMLLabelElement>('label')].find(
    (candidate) => candidate.textContent?.trim() === 'Name *'
  )
  const input = label?.control as HTMLInputElement | null
  if (!input) {
    throw new Error('Expected the name input')
  }
  fireEvent.input(input, { target: { value } })
}

afterEach(() => {
  apiClient.get = originalGet
  apiClient.post = originalPost
  localStorage.clear()
  queryClient?.clear()
  queryClient = null
})

describe('API key service tier selection', () => {
  test('opens on Production when the deployment does not default to Auto', async () => {
    installApiFixtures([])
    await renderCreateDrawer()

    expect(getTierRadio('Production').getAttribute('aria-checked')).toBe('true')
    expect(getTierRadio('Best Effort').getAttribute('aria-checked')).toBe(
      'false'
    )
  })

  test('labels the tier field as required', async () => {
    installApiFixtures([])
    await renderCreateDrawer()

    const labels = [...document.querySelectorAll('label')].map((label) =>
      label.textContent?.trim()
    )
    expect(labels).toContain('Service Tier *')
    expect(labels).not.toContain('Group')
  })

  test('sends the picked tier as the group of the created key', async () => {
    const createdPayloads: Array<Record<string, unknown>> = []
    installApiFixtures(createdPayloads)
    await renderCreateDrawer()

    fireEvent.click(getTierRadio('Best Effort'))
    typeName('economy')
    fireEvent.click(findButton('Save changes'))

    await waitFor(() => expect(createdPayloads).toHaveLength(1))
    expect(createdPayloads[0]?.group).toBe('Best Effort')
    expect(createdPayloads[0]?.cross_group_retry).toBe(false)
  })
})
