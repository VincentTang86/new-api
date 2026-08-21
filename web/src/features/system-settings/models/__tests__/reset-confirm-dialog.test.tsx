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
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'

vi.mock('../../api', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    getDefaultModelRatio: vi.fn(async () => ({
      success: true,
      data: JSON.stringify({ 'gpt-4': 15, 'gpt-4o': 1.25 }),
    })),
    resetModelRatios: vi.fn(async () => ({ success: true })),
  }
})

import { RatioSettingsCard } from '../ratio-settings-card'

const modelDefaults = {
  ModelPrice: '{}',
  ModelRatio: JSON.stringify({ 'glm-5.2': 0.39375, 'gpt-4': 15, 'qwen3.8-max': 1 }),
  CacheRatio: '{}',
  CreateCacheRatio: '{}',
  CompletionRatio: '{}',
  ImageRatio: '{}',
  AudioRatio: '{}',
  AudioCompletionRatio: '{}',
  ExposeRatioEnabled: false,
  BillingMode: '{}',
  BillingExpr: '{}',
}
const groupDefaults = {
  GroupRatio: '{}',
  TopupGroupRatio: '{}',
  UserUsableGroups: '{}',
  GroupGroupRatio: '{}',
  AutoGroups: '[]',
  MaxTokenAutoGroups: 5,
  DefaultUseAutoGroup: false,
  GroupSpecialUsableGroup: '{}',
}

describe('reset confirm hardening', () => {
  test('lists custom models and gates confirm on RESET', async () => {
    const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
    render(
      <QueryClientProvider client={qc}>
        <RatioSettingsCard
          modelDefaults={modelDefaults}
          groupDefaults={groupDefaults}
          toolPricesDefault={'{}'}
          visibleTabs={['models']}
        />
      </QueryClientProvider>
    )

    fireEvent.click(screen.getByRole('button', { name: /Reset prices/ }))

    // 名单：glm-5.2 与 qwen3.8-max 是自有模型，gpt-4 在默认表中不应出现
    await waitFor(() =>
      expect(
        screen.getByText('The following {{count}} custom model ratios will be deleted:'.replace('{{count}}', '2'))
      ).toBeTruthy()
    )
    const list = document.querySelector('.font-mono')!
    expect(list.textContent).toContain('glm-5.2')
    expect(list.textContent).toContain('qwen3.8-max')
    expect(list.textContent).not.toContain('gpt-4')

    // desc 含默认表数量 2
    expect(
      screen.getByText(/Resetting only rewrites ModelRatio.*2 models.*unchanged\./)
    ).toBeTruthy()

    const confirmBtn = screen.getByRole('button', { name: 'Reset' }) as HTMLButtonElement
    expect(confirmBtn.disabled).toBe(true)

    const input = screen.getByPlaceholderText('Type RESET to confirm') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'reset' } })
    expect((screen.getByRole('button', { name: 'Reset' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(input, { target: { value: 'RESET' } })
    await waitFor(() =>
      expect((screen.getByRole('button', { name: 'Reset' }) as HTMLButtonElement).disabled).toBe(false)
    )
  })
})
