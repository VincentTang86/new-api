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
import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'

const { getCoreRowModel, useReactTable } = await import('@tanstack/react-table')
const { createInstance } = await import('i18next')
const { I18nextProvider, initReactI18next, useTranslation } =
  await import('react-i18next')
const { DataTableViewOptions } = await import('../view-options')

const i18n = createInstance()
await i18n.use(initReactI18next).init({
  lng: 'en',
  resources: {
    en: {
      translation: {
        View: 'View',
        'Toggle columns': 'Toggle columns',
        Name: 'Name',
        Status: 'Status',
      },
    },
    zh: {
      translation: {
        View: '查看',
        'Toggle columns': '切换列',
        Name: '名称',
        Status: '状态',
      },
    },
  },
})

type ApiKeyRow = { name: string; status: string }

const rows: ApiKeyRow[] = [{ name: 'test01', status: 'enabled' }]

function Harness() {
  const { t } = useTranslation()
  const table = useReactTable<ApiKeyRow>({
    data: rows,
    columns: [
      { accessorKey: 'name', header: t('Name') },
      { accessorKey: 'status', header: t('Status') },
    ],
    getCoreRowModel: getCoreRowModel(),
  })

  return <DataTableViewOptions table={table} />
}

function openToggleColumnsMenu() {
  fireEvent.click(screen.getByRole('button', { name: i18n.t('View') }))
}

describe('data table view options localization', () => {
  test('lists column labels in the language selected after the table mounted', async () => {
    await i18n.changeLanguage('en')
    render(
      <I18nextProvider i18n={i18n}>
        <Harness />
      </I18nextProvider>
    )

    await act(async () => {
      await i18n.changeLanguage('zh')
    })
    openToggleColumnsMenu()

    expect(
      screen.getAllByRole('menuitemcheckbox').map((item) => item.textContent)
    ).toEqual(['名称', '状态'])
  })
})
