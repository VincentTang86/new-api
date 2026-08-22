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
import userEvent from '@testing-library/user-event'
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

// Each tier serves its own models, the way /api/user/models?group= answers.
const MODELS_BY_TIER: Record<string, string[]> = {
  'Best Effort': ['gpt-5-mini'],
  Production: ['gpt-5-mini', 'claude-opus-4'],
}

const STORED_KEY_ID = 7

type ApiGet = (
  url: string,
  config?: { params?: Record<string, unknown> }
) => Promise<{ data: unknown }>
type ApiSend = (url: string, data?: unknown) => Promise<{ data: unknown }>
type MockableApi = { get: ApiGet; post: ApiSend; put: ApiSend }

const apiClient = api as unknown as MockableApi
const originalGet = apiClient.get
const originalPost = apiClient.post
const originalPut = apiClient.put
let queryClient: InstanceType<typeof QueryClient> | null = null
let storedKey: Record<string, unknown> | null = null

function installApiFixtures(
  createdPayloads: Array<Record<string, unknown>>,
  updatedPayloads: Array<Record<string, unknown>> = []
): void {
  apiClient.get = async (url, config) => {
    switch (url) {
      case '/api/status':
        return { data: { data: { default_use_auto_group: false } } }
      case '/api/user/models': {
        const group = String(config?.params?.group ?? '')
        return { data: { success: true, data: MODELS_BY_TIER[group] ?? [] } }
      }
      case '/api/user/self/groups':
        return { data: { success: true, data: USER_GROUPS } }
      case '/api/token/auto-groups':
        return { data: { success: true, data: { groups: [], max_count: 3 } } }
      case `/api/token/${STORED_KEY_ID}`:
        return { data: { success: true, data: storedKey } }
      default:
        throw new Error(`Unexpected GET ${url}`)
    }
  }
  apiClient.post = async (url, data) => {
    expect(url).toBe('/api/token/')
    createdPayloads.push(data as Record<string, unknown>)
    return { data: { success: true, data: {} } }
  }
  apiClient.put = async (url, data) => {
    expect(url).toBe('/api/token/')
    updatedPayloads.push(data as Record<string, unknown>)
    return { data: { success: true, data: {} } }
  }
}

function buildStoredKey(
  group: string,
  modelLimits: string
): Record<string, unknown> {
  return {
    id: STORED_KEY_ID,
    name: 'legacy',
    key: 'sk-legacy',
    status: 1,
    remain_quota: 0,
    used_quota: 0,
    unlimited_quota: true,
    expired_time: -1,
    created_time: 0,
    accessed_time: 0,
    group,
    auto_groups: null,
    cross_group_retry: false,
    model_limits_enabled: modelLimits.length > 0,
    model_limits: modelLimits,
    allow_ips: '',
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

async function renderUpdateDrawer(key: Record<string, unknown>): Promise<void> {
  storedKey = key
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
          <ApiKeysMutateDrawer
            open
            onOpenChange={() => undefined}
            currentRow={key as never}
          />
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
  fireEvent.click(findButton('Advanced Settings'))
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

// The combobox opens on the pointer/focus sequence, which fireEvent.click does
// not produce, so opening it needs userEvent. Opening is a separate step from
// reading because reopening the list inside a waitFor callback spins the event
// loop: every poll fires another click that never opens anything, and the
// starved loop never reaches waitFor's own timeout.
async function openModelOptions(): Promise<void> {
  const input = document.querySelector<HTMLElement>(
    '[data-slot="combobox-chip-input"]'
  )
  if (!input) {
    throw new Error('Expected the Model Limits input')
  }
  await userEvent.click(input)
}

function getModelOptions(): string[] {
  return [
    ...document.querySelectorAll<HTMLElement>('[data-slot="combobox-item"]'),
  ]
    .map((option) => option.textContent?.trim() ?? '')
    .sort()
}

function getModelLimitChips(): string[] {
  const label = [...document.querySelectorAll<HTMLLabelElement>('label')].find(
    (candidate) => candidate.textContent?.trim() === 'Model Limits'
  )
  const item = label?.closest('[data-slot="form-item"]')
  return [...(item?.querySelectorAll('[data-slot="combobox-chip"]') ?? [])].map(
    (chip) => chip.textContent?.replace(/\s+/g, ' ').trim() ?? ''
  )
}

afterEach(() => {
  apiClient.get = originalGet
  apiClient.post = originalPost
  apiClient.put = originalPut
  storedKey = null
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

  test('only offers the models the picked tier serves', async () => {
    installApiFixtures([])
    await renderCreateDrawer()

    fireEvent.click(findButton('Advanced Settings'))
    fireEvent.click(getTierRadio('Production'))
    await openModelOptions()
    await waitFor(() =>
      expect(getModelOptions()).toEqual(['claude-opus-4', 'gpt-5-mini'])
    )

    fireEvent.click(getTierRadio('Best Effort'))
    await openModelOptions()
    await waitFor(() => expect(getModelOptions()).toEqual(['gpt-5-mini']))
  })

  test("drops stored model limits the key's own tier does not serve", async () => {
    installApiFixtures([])
    await renderUpdateDrawer(
      buildStoredKey('Best Effort', 'gpt-5-mini,claude-opus-4')
    )

    await waitFor(() => expect(getModelLimitChips()).toEqual(['gpt-5-mini']))
    expect(
      screen.getByText(/Removed .* claude-opus-4/, { exact: false })
    ).toBeInTheDocument()
    // One model survived, so the limit still applies and needs no warning.
    expect(screen.queryByText(/The model limit is now empty/)).toBeNull()
  })

  test('warns that clearing the last limit opens the whole tier', async () => {
    const updatedPayloads: Array<Record<string, unknown>> = []
    installApiFixtures([], updatedPayloads)
    await renderUpdateDrawer(buildStoredKey('Production', 'claude-opus-4'))

    await waitFor(() => expect(getModelLimitChips()).toEqual(['claude-opus-4']))

    fireEvent.click(getTierRadio('Best Effort'))
    await waitFor(() => expect(getModelLimitChips()).toEqual([]))
    expect(
      screen.getByText(/The model limit is now empty/, { exact: false })
    ).toBeInTheDocument()

    fireEvent.click(findButton('Save changes'))
    await waitFor(() => expect(updatedPayloads).toHaveLength(1))
    expect(updatedPayloads[0]?.model_limits).toBe('')
    expect(updatedPayloads[0]?.model_limits_enabled).toBe(false)
  })
})
