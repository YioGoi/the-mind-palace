import { getActiveAiUpsellTeaser } from '../lib/utils/ai-upsell-teaser'

describe('AI upsell teaser selection', () => {
  test('shows the 3-note teaser when the user crosses the first milestone', () => {
    const teaser = getActiveAiUpsellTeaser({
      readyForTeaser: true,
      aiUpsellMarketingEnabled: true,
      premiumEnabled: false,
      notesCreatedCount: 3,
      hasSeenTeaserAt3: false,
      hasSeenTeaserAt7: false,
    })

    expect(teaser?.milestone).toBe(3)
    expect(teaser?.title).toContain('building your Mind Palace')
  })

  test('prefers the 7-note teaser when both milestones are technically eligible', () => {
    const teaser = getActiveAiUpsellTeaser({
      readyForTeaser: true,
      aiUpsellMarketingEnabled: true,
      premiumEnabled: false,
      notesCreatedCount: 12,
      hasSeenTeaserAt3: false,
      hasSeenTeaserAt7: false,
    })

    expect(teaser?.milestone).toBe(7)
    expect(teaser?.title).toContain('more organized system')
  })

  test('hides teasers when marketing is disabled or premium is active', () => {
    const marketingOff = getActiveAiUpsellTeaser({
      readyForTeaser: true,
      aiUpsellMarketingEnabled: false,
      premiumEnabled: false,
      notesCreatedCount: 7,
      hasSeenTeaserAt3: false,
      hasSeenTeaserAt7: false,
    })
    const premiumOn = getActiveAiUpsellTeaser({
      readyForTeaser: true,
      aiUpsellMarketingEnabled: true,
      premiumEnabled: true,
      notesCreatedCount: 7,
      hasSeenTeaserAt3: false,
      hasSeenTeaserAt7: false,
    })

    expect(marketingOff).toBeNull()
    expect(premiumOn).toBeNull()
  })
})
