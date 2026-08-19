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

const { getCoreRowModel, useReactTable } = await import('@tanstack/react-table')
const { DataTableView } = await import('../data-table-view')

type ApiKeyRow = { name: string; status: string; models: string }

const noRows: ApiKeyRow[] = []

function Harness() {
  const table = useReactTable<ApiKeyRow>({
    data: noRows,
    columns: [
      { accessorKey: 'name', header: 'Name' },
      { accessorKey: 'status', header: 'Status' },
      { accessorKey: 'models', header: 'Models' },
    ],
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <>
      <button
        type='button'
        onClick={() => table.getColumn('models')?.toggleVisibility(false)}
      >
        hide models
      </button>
      <DataTableView table={table} emptyTitle='No API Keys Found' />
    </>
  )
}

describe('data table view empty state', () => {
  test('spans the empty cell over the columns still visible after one is hidden', () => {
    render(<Harness />)

    const emptyCell = screen.getByRole('cell')
    expect(emptyCell).toHaveAttribute('colspan', '3')

    fireEvent.click(screen.getByRole('button', { name: 'hide models' }))

    expect(screen.getByRole('cell')).toHaveAttribute('colspan', '2')
  })
})
