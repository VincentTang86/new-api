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

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

import { SettingsSwitchField } from '../components/settings-form-layout'

export interface NowPaymentsSettingsValues {
  NowPaymentsEnabled: boolean
  NowPaymentsApiKey: string
  NowPaymentsIpnSecret: string
  NowPaymentsSandbox: boolean
  NowPaymentsUnitPrice: number
  NowPaymentsMinTopUp: number
  NowPaymentsFeePaidByUser: boolean
  NowPaymentsFixedRate: boolean
  NowPaymentsPayCurrencies: string
}

interface Props {
  values: NowPaymentsSettingsValues
  onValueChange: <K extends keyof NowPaymentsSettingsValues>(
    key: K,
    value: NowPaymentsSettingsValues[K]
  ) => void
}

const NOWPAYMENTS_DASHBOARD_URL = 'https://account.nowpayments.io'

export function NowPaymentsSettingsSection({ values, onValueChange }: Props) {
  const { t } = useTranslation()

  return (
    <div className='space-y-4'>
      <div>
        <h3 className='text-lg font-medium'>{t('NOWPayments Gateway')}</h3>
        <p className='text-muted-foreground text-sm'>
          {t(
            'Accept cryptocurrency top-ups through the NOWPayments hosted invoice page. Prices are quoted in USD.'
          )}
        </p>
      </div>

      <div className='rounded-md bg-blue-50 p-4 text-sm text-blue-900 dark:bg-blue-950 dark:text-blue-100'>
        <p className='mb-2 font-medium'>{t('IPN Configuration:')}</p>
        <ul className='list-inside list-disc space-y-1'>
          <li>
            {t('IPN callback URL:')}{' '}
            <code className='rounded bg-blue-100 px-1 py-0.5 text-xs dark:bg-blue-900'>
              {'<ServerAddress>/api/nowpayments/webhook'}
            </code>
          </li>
          <li>
            {t(
              'Generate the IPN secret under Settings → Payments in the NOWPayments dashboard and make sure your firewall lets NOWPayments reach the callback URL.'
            )}
          </li>
          <li>
            {t('Configure at:')}{' '}
            <a
              href={NOWPAYMENTS_DASHBOARD_URL}
              target='_blank'
              rel='noreferrer'
              className='underline hover:no-underline'
            >
              {t('NOWPayments Dashboard')}
            </a>
          </li>
        </ul>
      </div>

      <div className='grid gap-4 sm:grid-cols-2'>
        <SettingsSwitchField
          checked={values.NowPaymentsEnabled}
          onCheckedChange={(v) => onValueChange('NowPaymentsEnabled', v)}
          label={t('Enable NOWPayments')}
          className='py-0'
        />
        <SettingsSwitchField
          checked={values.NowPaymentsSandbox}
          onCheckedChange={(v) => onValueChange('NowPaymentsSandbox', v)}
          label={t('Sandbox mode')}
          description={t(
            'Uses api-sandbox.nowpayments.io with the keys entered below. The sandbox is no longer kept in sync with production.'
          )}
          className='py-0'
        />
      </div>

      <div className='grid gap-4 sm:grid-cols-2'>
        <div className='grid gap-1.5'>
          <Label>{t('API Key')}</Label>
          <Input
            type='password'
            placeholder={t('Enter new key to update')}
            autoComplete='new-password'
            value={values.NowPaymentsApiKey}
            onChange={(event) =>
              onValueChange('NowPaymentsApiKey', event.target.value)
            }
          />
          <p className='text-muted-foreground text-xs'>
            {t('Leave blank unless rotating the key')}
          </p>
        </div>
        <div className='grid gap-1.5'>
          <Label>{t('IPN Secret')}</Label>
          <Input
            type='password'
            placeholder={t('Enter new key to update')}
            autoComplete='new-password'
            value={values.NowPaymentsIpnSecret}
            onChange={(event) =>
              onValueChange('NowPaymentsIpnSecret', event.target.value)
            }
          />
          <p className='text-muted-foreground text-xs'>
            {t('Leave blank unless rotating the secret')}
          </p>
        </div>
      </div>

      <div className='grid gap-4 sm:grid-cols-2'>
        <div className='grid gap-1.5'>
          <Label>{t('Unit price (USD)')}</Label>
          <Input
            type='number'
            step='0.01'
            min={0}
            value={values.NowPaymentsUnitPrice}
            onChange={(event) =>
              onValueChange(
                'NowPaymentsUnitPrice',
                event.target.value === '' ? 0 : event.target.valueAsNumber
              )
            }
          />
          <p className='text-muted-foreground text-xs'>
            {t('USD charged per credit unit')}
          </p>
        </div>
        <div className='grid gap-1.5'>
          <Label>{t('Minimum top-up')}</Label>
          <Input
            type='number'
            step='1'
            min={1}
            value={values.NowPaymentsMinTopUp}
            onChange={(event) =>
              onValueChange(
                'NowPaymentsMinTopUp',
                event.target.value === '' ? 1 : event.target.valueAsNumber
              )
            }
          />
          <p className='text-muted-foreground text-xs'>
            {t(
              'Crypto networks enforce their own minimums; keep this high enough to clear them after fees.'
            )}
          </p>
        </div>
      </div>

      <div className='grid gap-1.5'>
        <Label>{t('Accepted coins')}</Label>
        <Input
          placeholder='usdtbsc,usdtton,usdc'
          value={values.NowPaymentsPayCurrencies}
          onChange={(event) =>
            onValueChange('NowPaymentsPayCurrencies', event.target.value)
          }
        />
        <p className='text-muted-foreground text-xs'>
          {t(
            'Comma-separated NOWPayments tickers offered to the customer at checkout. Each one must also be enabled in Coins Settings on the NOWPayments dashboard, otherwise creating a payment fails.'
          )}
        </p>
      </div>

      <div className='grid gap-4 sm:grid-cols-2'>
        <SettingsSwitchField
          checked={values.NowPaymentsFeePaidByUser}
          onCheckedChange={(v) => onValueChange('NowPaymentsFeePaidByUser', v)}
          label={t('Fees paid by customer')}
          description={t(
            'The customer covers network and service fees so the full USD amount settles. NOWPayments forces a fixed rate when this is on; only enable it if fixed-rate coins are available on your account.'
          )}
          className='py-0'
        />
        <SettingsSwitchField
          checked={values.NowPaymentsFixedRate}
          onCheckedChange={(v) => onValueChange('NowPaymentsFixedRate', v)}
          label={t('Fixed exchange rate')}
          description={t(
            'Locks the crypto amount for 10 minutes after the customer picks a coin; unpaid invoices then expire.'
          )}
          className='py-0'
        />
      </div>
    </div>
  )
}
