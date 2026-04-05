import { getPremiumUpgradeSheetModel } from '../lib/utils/premium-upgrade-sheet'

describe('premium upgrade sheet model', () => {
  test('keeps the CTA in a fixed footer and the rest in scrollable content', () => {
    const model = getPremiumUpgradeSheetModel({
      windowHeight: 667,
      insetTop: 20,
      insetBottom: 0,
      selectedPlan: 'yearly',
    })

    expect(model.usesScrollableContent).toBe(true)
    expect(model.usesFixedFooter).toBe(true)
    expect(model.sheetMaxHeight).toBeLessThan(667)
    expect(model.sheetMaxHeight).toBeGreaterThan(0)
    expect(model.primaryButtonLabel).toBe('Start Yearly Premium')
  })

  test('updates the footer CTA when monthly is selected', () => {
    const model = getPremiumUpgradeSheetModel({
      windowHeight: 568,
      insetTop: 0,
      insetBottom: 12,
      selectedPlan: 'monthly',
    })

    expect(model.primaryButtonLabel).toBe('Start Monthly Premium')
    expect(model.bottomMargin).toBeGreaterThanOrEqual(20)
  })
})
