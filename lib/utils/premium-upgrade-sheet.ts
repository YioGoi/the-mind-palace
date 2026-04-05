export type PremiumPlanOption = 'yearly' | 'monthly'

type Params = {
  windowHeight: number
  insetTop: number
  insetBottom: number
  selectedPlan: PremiumPlanOption
}

export function getPremiumUpgradeSheetModel(params: Params) {
  const topPadding = Math.max(params.insetTop + 16, 24)
  const bottomMargin = Math.max(params.insetBottom + 10, 20)
  const sheetMaxHeight =
    params.windowHeight - Math.max(params.insetTop + 24, 32) - Math.max(params.insetBottom + 10, 20)

  return {
    topPadding,
    bottomMargin,
    sheetMaxHeight,
    primaryButtonLabel:
      params.selectedPlan === 'yearly' ? 'Start Yearly Premium' : 'Start Monthly Premium',
    usesScrollableContent: true,
    usesFixedFooter: true,
  }
}
