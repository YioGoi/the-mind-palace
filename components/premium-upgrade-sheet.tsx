import { useAppTheme } from '@/hooks/use-app-theme'
import { getPremiumUpgradeSheetModel, PremiumPlanOption } from '@/lib/utils/premium-upgrade-sheet'
import React, { useState } from 'react'
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

type Props = {
  visible: boolean
  onClose: () => void
  onStartPremium: () => void
}

const BENEFITS = [
  'Turn one thought into a structured plan',
  'Let AI choose or create the right context',
  'Organize faster with less mental effort',
]

const CLEANUP_PROMPT_EXAMPLE = 'Organize, clean up and plan my notes and contexts'

export function PremiumUpgradeSheet({ visible, onClose, onStartPremium }: Props) {
  const { colors } = useAppTheme()
  const insets = useSafeAreaInsets()
  const { height: windowHeight } = useWindowDimensions()
  const [selectedPlan, setSelectedPlan] = useState<PremiumPlanOption>('yearly')
  const sheetModel = getPremiumUpgradeSheetModel({
    windowHeight,
    insetTop: insets.top,
    insetBottom: insets.bottom,
    selectedPlan,
  })

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={[
          styles.backdrop,
          {
            paddingTop: sheetModel.topPadding,
          },
        ]}
        onPress={onClose}
      >
        <Pressable
          style={[
            styles.sheet,
            {
              backgroundColor: colors.colorBgElevated,
              borderColor: colors.colorBorder,
              marginBottom: sheetModel.bottomMargin,
              maxHeight: sheetModel.sheetMaxHeight,
            },
          ]}
          onPress={(event) => event.stopPropagation()}
        >
          <ScrollView
            bounces={false}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            <Text style={[styles.eyebrow, { color: colors.colorPrimary }]}>PREMIUM AI</Text>
            <Text style={[styles.title, { color: colors.colorTextMain }]}>
              Unlock AI for your Mind Palace
            </Text>
            <Text style={[styles.body, { color: colors.colorTextSecondary }]}>
              You already capture notes, reminders, and due dates here. Premium adds the AI layer
              that organizes them for you.
            </Text>

            <View
              style={[
                styles.promptExampleCard,
                {
                  backgroundColor: colors.colorBgMuted,
                  borderColor: colors.colorBorder,
                },
              ]}
            >
              <Text style={[styles.promptExampleLabel, { color: colors.colorTextSecondary }]}>
                Try this in AI chat
              </Text>
              <Text style={[styles.promptExampleText, { color: colors.colorTextMain }]}>
                {CLEANUP_PROMPT_EXAMPLE}
              </Text>
              <Text style={[styles.promptExampleHint, { color: colors.colorTextSecondary }]}>
                Premium can organize your existing notes and contexts, not just create new ones.
              </Text>
            </View>

            <View style={styles.planStack}>
              <TouchableOpacity
                activeOpacity={0.88}
                onPress={() => setSelectedPlan('yearly')}
                style={[
                  styles.planCard,
                  {
                    backgroundColor: selectedPlan === 'yearly' ? colors.colorPrimarySoft : colors.colorBgMuted,
                    borderColor: selectedPlan === 'yearly' ? colors.colorPrimary : colors.colorBorder,
                  },
                ]}
              >
                <View style={styles.planHeaderRow}>
                  <View>
                    <Text style={[styles.planLabel, { color: colors.colorTextMain }]}>Yearly</Text>
                    <Text style={[styles.planValue, { color: colors.colorTextMain }]}>$19.99 / year</Text>
                  </View>
                  <View style={[styles.badge, { backgroundColor: colors.colorPrimary }]}>
                    <Text style={[styles.badgeText, { color: colors.colorBgMain }]}>Best value</Text>
                  </View>
                </View>
                <Text style={[styles.planHint, { color: colors.colorTextSecondary }]}>
                  Save 44% and get a full year of AI support to organize, plan, and remind you.
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.88}
                onPress={() => setSelectedPlan('monthly')}
                style={[
                  styles.planCard,
                  {
                    backgroundColor: selectedPlan === 'monthly' ? colors.colorPrimarySoft : colors.colorBgMuted,
                    borderColor: selectedPlan === 'monthly' ? colors.colorPrimary : colors.colorBorder,
                  },
                ]}
              >
                <Text style={[styles.planLabel, { color: colors.colorTextMain }]}>Monthly</Text>
                <Text style={[styles.planValue, { color: colors.colorTextMain }]}>$2.99 / month</Text>
                <Text style={[styles.planHint, { color: colors.colorTextSecondary }]}>
                  A tiny monthly upgrade for a calmer system.
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.benefits}>
              {BENEFITS.map((benefit) => (
                <View key={benefit} style={styles.benefitRow}>
                  <Text style={[styles.benefitDot, { color: colors.colorPrimary }]}>•</Text>
                  <Text style={[styles.benefitText, { color: colors.colorTextMain }]}>{benefit}</Text>
                </View>
              ))}
            </View>
          </ScrollView>

          <View
            style={[
              styles.footer,
              {
                borderTopColor: colors.colorBorder,
                backgroundColor: colors.colorBgElevated,
              },
            ]}
          >
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={onStartPremium}
              style={[styles.primaryButton, { backgroundColor: colors.colorPrimary }]}
            >
              <Text style={[styles.primaryButtonText, { color: colors.colorBgMain }]}>
                {sheetModel.primaryButtonLabel}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity activeOpacity={0.75} onPress={onClose} style={styles.secondaryButton}>
              <Text style={[styles.secondaryButtonText, { color: colors.colorTextSecondary }]}>Maybe later</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
  },
  sheet: {
    borderRadius: 24,
    paddingTop: 20,
    borderWidth: 1,
    overflow: 'hidden',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    lineHeight: 30,
  },
  body: {
    marginTop: 10,
    fontSize: 16,
    lineHeight: 23,
  },
  planStack: {
    marginTop: 16,
    gap: 10,
  },
  promptExampleCard: {
    marginTop: 14,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 6,
  },
  promptExampleLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  promptExampleText: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '800',
  },
  promptExampleHint: {
    fontSize: 13,
    lineHeight: 18,
  },
  planCard: {
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
  },
  planHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  planLabel: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  planValue: {
    fontSize: 24,
    fontWeight: '800',
  },
  planHint: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 19,
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '800',
  },
  priceCard: {
    marginTop: 16,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  priceValue: {
    fontSize: 24,
    fontWeight: '800',
  },
  priceHint: {
    marginTop: 4,
    fontSize: 14,
  },
  benefits: {
    marginTop: 18,
    gap: 10,
  },
  benefitRow: {
    flexDirection: 'row',
    gap: 8,
  },
  benefitDot: {
    fontSize: 18,
    lineHeight: 20,
    fontWeight: '700',
  },
  benefitText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 21,
  },
  footer: {
    borderTopWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 16,
  },
  primaryButton: {
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '800',
  },
  secondaryButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    marginTop: 4,
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
})
