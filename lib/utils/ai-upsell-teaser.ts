export type AiUpsellTeaser = {
  milestone: 3 | 7
  title: string
  body: string
} | null

type Params = {
  readyForTeaser: boolean
  aiUpsellMarketingEnabled: boolean
  premiumEnabled: boolean
  notesCreatedCount: number
  hasSeenTeaserAt3: boolean
  hasSeenTeaserAt7: boolean
}

export function getActiveAiUpsellTeaser(params: Params): AiUpsellTeaser {
  if (!params.readyForTeaser || !params.aiUpsellMarketingEnabled || params.premiumEnabled) {
    return null
  }

  if (params.notesCreatedCount >= 7 && !params.hasSeenTeaserAt7) {
    return {
      milestone: 7,
      title: 'Premium AI can turn these notes into a more organized system.',
      body: 'You already capture things here. Let AI help you sort them with less effort.',
    }
  }

  if (params.notesCreatedCount >= 3 && !params.hasSeenTeaserAt3) {
    return {
      milestone: 3,
      title: 'You’re building your Mind Palace.',
      body: 'Soon, AI can help organize it for you.',
    }
  }

  return null
}
