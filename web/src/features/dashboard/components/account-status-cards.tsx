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
import { useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { Skeleton } from '@/components/ui/skeleton'
import type { ApiKey } from '@/features/keys/types'
import { formatQuota } from '@/lib/format'
import { useAuthStore } from '@/stores/auth-store'

const TOKEN_STATUS_ENABLED = 1

interface AccountStatusCardsProps {
  apiKeys: ApiKey[] | undefined
  apiKeysLoading: boolean
}

export function AccountStatusCards({
  apiKeys,
  apiKeysLoading,
}: AccountStatusCardsProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.auth.user)

  const quota = user?.quota ?? 0
  const activeCount =
    apiKeys?.filter((key) => key.status === TOKEN_STATUS_ENABLED).length ?? 0
  const inactiveCount = (apiKeys?.length ?? 0) - activeCount

  return (
    <div className='flex flex-col gap-3.5 sm:flex-row'>
      <div className='dark:bg-card dark:border-border flex min-w-0 flex-1 flex-col gap-2 rounded-xl border border-[#e5e7eb] bg-white px-5 py-4'>
        <div className='flex items-center gap-2'>
          <span className='dark:text-muted-foreground text-[13px] font-medium text-[#6b7280]'>
            {t('Credit Balance')}
          </span>
          {quota > 0 && (
            <span className='rounded-[4px] bg-[#ecfdf5] px-2 py-0.5 text-[11px] font-semibold text-[#10b981] dark:bg-[#10b981]/15'>
              {t('Available')}
            </span>
          )}
        </div>
        <div className='flex items-center gap-3'>
          <span className='dark:text-foreground text-[26px] font-bold tracking-tight text-[#111827]'>
            {formatQuota(quota)}
          </span>
          <button
            type='button'
            className='cursor-pointer rounded-full bg-[#fff0f0] px-3 py-1 text-xs font-semibold text-[#ff5a5f] transition-colors hover:bg-[#ffe4e4] dark:bg-[#ff5a5f]/15 dark:hover:bg-[#ff5a5f]/25'
            onClick={() => void navigate({ to: '/wallet' })}
          >
            {t('Add Credits')}
          </button>
        </div>
      </div>

      <div className='dark:bg-card dark:border-border flex min-w-0 flex-1 flex-col gap-2 rounded-xl border border-[#e5e7eb] bg-white px-5 py-4'>
        <div className='flex items-center gap-2'>
          <span className='dark:text-muted-foreground text-[13px] font-medium text-[#6b7280]'>
            {t('API Keys')}
          </span>
          {apiKeysLoading ? (
            <Skeleton className='h-4 w-24' />
          ) : (
            <span className='text-xs text-[#99a1ab]'>
              {t('{{active}} Active / {{inactive}} Inactive', {
                active: activeCount,
                inactive: inactiveCount,
              })}
            </span>
          )}
        </div>
        <div className='flex items-center gap-3'>
          {apiKeysLoading ? (
            <Skeleton className='h-8 w-10' />
          ) : (
            <span className='dark:text-foreground text-[26px] font-bold tracking-tight text-[#111827]'>
              {apiKeys?.length ?? 0}
            </span>
          )}
          <button
            type='button'
            className='cursor-pointer text-xs font-semibold text-[#ff5a5f] hover:underline'
            onClick={() => void navigate({ to: '/keys' })}
          >
            {t('Manage Keys')}
          </button>
        </div>
      </div>
    </div>
  )
}
