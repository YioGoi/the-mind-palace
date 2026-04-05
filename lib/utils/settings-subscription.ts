export function getSubscriptionCta(hasPremiumAccess: boolean) {
  return hasPremiumAccess
    ? {
        title: 'Premium plan active',
        description: 'AI note organization and planning are currently enabled on this device.',
        actionLabel: 'View plan',
      }
    : {
        title: 'Premium plan',
        description: 'Upgrade whenever you want to unlock AI organization, planning, and context suggestions.',
        actionLabel: 'See premium',
      }
}
