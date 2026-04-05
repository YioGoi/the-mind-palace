import { getAiEntryVisibility } from '../lib/utils/ai-entry-visibility'

describe('AI entry visibility', () => {
  test('shows free AI tooltip/button before the reveal has been used', () => {
    const result = getAiEntryVisibility({
      premiumEnabled: false,
      aiUpsellMarketingEnabled: true,
      notesCreatedCount: 13,
      hasUnlockedAiRevealAt13: false,
      hideAiButton: false,
    })

    expect(result.freeAiVisible).toBe(true)
    expect(result.showAiButton).toBe(true)
    expect(result.showAiRevealTooltip).toBe(true)
  })

  test('hides free AI entry after the reveal has already been used', () => {
    const result = getAiEntryVisibility({
      premiumEnabled: false,
      aiUpsellMarketingEnabled: true,
      notesCreatedCount: 25,
      hasUnlockedAiRevealAt13: true,
      hideAiButton: false,
    })

    expect(result.freeAiVisible).toBe(false)
    expect(result.showAiButton).toBe(false)
    expect(result.showAiRevealTooltip).toBe(false)
  })

  test('still shows the AI button for premium users', () => {
    const result = getAiEntryVisibility({
      premiumEnabled: true,
      aiUpsellMarketingEnabled: false,
      notesCreatedCount: 0,
      hasUnlockedAiRevealAt13: true,
      hideAiButton: false,
    })

    expect(result.freeAiVisible).toBe(false)
    expect(result.showAiButton).toBe(true)
    expect(result.showAiRevealTooltip).toBe(false)
  })
})
