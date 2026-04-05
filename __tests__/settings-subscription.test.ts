import { getSubscriptionCta } from '../lib/utils/settings-subscription'

describe('settings subscription CTA', () => {
  test('shows the free upsell copy for free users', () => {
    expect(getSubscriptionCta(false)).toEqual({
      title: 'Premium plan',
      description: 'Upgrade whenever you want to unlock AI organization, planning, and context suggestions.',
      actionLabel: 'See premium',
    })
  })

  test('shows the active plan copy for premium users', () => {
    expect(getSubscriptionCta(true)).toEqual({
      title: 'Premium plan active',
      description: 'AI note organization and planning are currently enabled on this device.',
      actionLabel: 'View plan',
    })
  })
})
