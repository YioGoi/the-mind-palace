export function getAiEntryVisibility(params: {
  premiumEnabled: boolean
  aiUpsellMarketingEnabled: boolean
  notesCreatedCount: number
  hasUnlockedAiRevealAt13: boolean
  hideAiButton: boolean
}) {
  const freeAiVisible =
    !params.premiumEnabled &&
    params.aiUpsellMarketingEnabled &&
    params.notesCreatedCount >= 13 &&
    !params.hasUnlockedAiRevealAt13

  return {
    freeAiVisible,
    showAiButton: !params.hideAiButton && (params.premiumEnabled || freeAiVisible),
    showAiRevealTooltip: freeAiVisible && !params.hasUnlockedAiRevealAt13,
  }
}
