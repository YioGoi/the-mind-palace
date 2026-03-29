import { useAppTheme } from '@/hooks/use-app-theme'
import { DeviceMotion } from 'expo-sensors'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { StyleSheet, View, useWindowDimensions } from 'react-native'
import { Canvas, Circle, Group, Line, vec } from '@shopify/react-native-skia'

type Props = {
  enabled: boolean
  reducedMotion?: boolean
  scheme: 'light' | 'dark'
}

type AmbientNode = {
  id: string
  x: number
  y: number
  r: number
  layer: number
  pulse: number
  drift: number
}

type AmbientLink = {
  from: string
  to: string
  layer: number
}

const LAYER_CONFIG = [
  { count: 16, minR: 1.1, maxR: 2.1, driftX: 8, driftY: 5, motionX: 300, motionY: 232, speed: 0.052 },
  { count: 12, minR: 1.6, maxR: 2.9, driftX: 14, driftY: 9, motionX: 204, motionY: 156, speed: 0.075 },
  { count: 6, minR: 3.6, maxR: 5.8, driftX: 30, driftY: 19, motionX: 108, motionY: 80, speed: 0.125 },
  { count: 4, minR: 5.4, maxR: 8.8, driftX: 40, driftY: 26, motionX: 56, motionY: 44, speed: 0.16 },
] as const

function createSeededRandom(seed: number) {
  let value = seed
  return () => {
    value = (value * 1664525 + 1013904223) % 4294967296
    return value / 4294967296
  }
}

function createAmbientGraph() {
  const nodes: AmbientNode[] = []
  const links: AmbientLink[] = []

  LAYER_CONFIG.forEach((config, layerIndex) => {
    const rand = createSeededRandom(100 + layerIndex * 97)
    const layerIds: string[] = []

    for (let i = 0; i < config.count; i += 1) {
      const id = `l${layerIndex}-${i}`
      const x = 0.08 + rand() * 0.84
      const y = 0.1 + rand() * 0.8
      const r = config.minR + rand() * (config.maxR - config.minR)
      const pulse = rand() * Math.PI * 2
      const drift = 0.6 + rand() * 1.3

      nodes.push({ id, x, y, r, layer: layerIndex, pulse, drift })
      layerIds.push(id)
    }

    for (let i = 0; i < layerIds.length - 1; i += 1) {
      links.push({ from: layerIds[i], to: layerIds[i + 1], layer: layerIndex })
    }

    for (let i = 0; i < Math.max(1, Math.floor(layerIds.length / 2)); i += 1) {
      const from = layerIds[i]
      const to = layerIds[(i + 2) % layerIds.length]
      if (from !== to) {
        links.push({ from, to, layer: layerIndex })
      }
    }
  })

  return { nodes, links }
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function useAmbientAnimation(active: boolean) {
  const [phase, setPhase] = useState(0)
  const [motion, setMotion] = useState({ x: 0, y: 0 })
  const [motionStatus, setMotionStatus] = useState<'idle' | 'unavailable' | 'denied' | 'granted'>('idle')
  const animationRef = useRef<number | null>(null)
  const lastRef = useRef<number | null>(null)

  useEffect(() => {
    if (!active) {
      setPhase(0)
      setMotion({ x: 0, y: 0 })
      setMotionStatus('idle')
      return
    }

    let mounted = true

    const step = (timestamp: number) => {
      if (!mounted) return
      const last = lastRef.current ?? timestamp
      const delta = Math.min(timestamp - last, 48)
      lastRef.current = timestamp
      setPhase((prev) => prev + delta * 0.00018)
      animationRef.current = requestAnimationFrame(step)
    }

    animationRef.current = requestAnimationFrame(step)

    return () => {
      mounted = false
      lastRef.current = null
      if (animationRef.current !== null) cancelAnimationFrame(animationRef.current)
      animationRef.current = null
    }
  }, [active])

  useEffect(() => {
    if (!active) return

    let mounted = true
    let subscription: { remove: () => void } | null = null

    const setupMotion = async () => {
      try {
        const available = await DeviceMotion.isAvailableAsync()
        if (!available || !mounted) {
          setMotionStatus('unavailable')
          return
        }

        let permissions = await DeviceMotion.getPermissionsAsync()
        if (!permissions.granted) {
          permissions = await DeviceMotion.requestPermissionsAsync()
        }
        if (!permissions.granted || !mounted) {
          setMotionStatus('denied')
          return
        }

        setMotionStatus('granted')
        DeviceMotion.setUpdateInterval(120)
        subscription = DeviceMotion.addListener((event) => {
          const gamma =
            event.rotation?.gamma ??
            ((event.accelerationIncludingGravity?.x ?? 0) * 24)
          const beta =
            event.rotation?.beta ??
            ((event.accelerationIncludingGravity?.y ?? 0) * 24)
          setMotion({
            x: clamp(gamma / 45, -1, 1),
            y: clamp(beta / 60, -1, 1),
          })
        })
      } catch {
        setMotionStatus('unavailable')
        setMotion({ x: 0, y: 0 })
      }
    }

    setupMotion()

    return () => {
      mounted = false
      subscription?.remove()
    }
  }, [active])

  return { phase, motion, motionStatus }
}

export function AmbientBackgroundLayer({ enabled, reducedMotion = false, scheme }: Props) {
  const { width, height } = useWindowDimensions()
  const { colors } = useAppTheme()
  const { phase, motion } = useAmbientAnimation(enabled && !reducedMotion)
  const graph = useMemo(() => createAmbientGraph(), [])
  const viewTranslateX = reducedMotion ? 0 : motion.x * 44 * colors.ambientMotionMultiplier
  const viewTranslateY = reducedMotion ? 0 : motion.y * 36 * colors.ambientMotionMultiplier
  const baseRgb = useMemo(
    () => (scheme === 'dark' ? { r: 255, g: 255, b: 255 } : { r: 24, g: 24, b: 24 }),
    [scheme]
  )

  const layers = useMemo(
    () =>
      LAYER_CONFIG.map((config, index) => {
        const depth = (index + 1) / LAYER_CONFIG.length
        const shiftX = reducedMotion
          ? 0
          : Math.sin(phase * config.speed + index) * config.driftX +
            motion.x * config.motionX * colors.ambientMotionMultiplier
        const shiftY = reducedMotion
          ? 0
          : Math.cos(phase * config.speed * 0.78 + index * 0.35) * config.driftY +
            motion.y * config.motionY * colors.ambientMotionMultiplier

        const layerNodes = graph.nodes.filter((node) => node.layer === index).map((node) => {
          const pulse = reducedMotion ? 1 : 1 + Math.sin(phase * (1.1 + node.drift * 0.14) + node.pulse) * 0.16
          const perspectiveScale = reducedMotion
            ? 1
            : 1 + motion.x * depth * 0.24 + motion.y * depth * 0.18
          const haloScale = 2.8 + depth * 2.8
          return {
            ...node,
            cx: node.x * width + shiftX,
            cy: node.y * height + shiftY,
            radius: Math.max(0.9, node.r * pulse * perspectiveScale),
            glowRadius: Math.max(3, node.r * haloScale * pulse),
            nodeColor: `rgba(${baseRgb.r}, ${baseRgb.g}, ${baseRgb.b}, ${0.05 + depth * 0.2})`,
            glowColor: `rgba(${baseRgb.r}, ${baseRgb.g}, ${baseRgb.b}, ${0.012 + depth * 0.05})`,
            lineColor: `rgba(${baseRgb.r}, ${baseRgb.g}, ${baseRgb.b}, ${0.02 + depth * 0.11})`,
          }
        })

        const layerLinks = graph.links.filter((link) => link.layer === index).map((link) => ({
          ...link,
          start: layerNodes.find((node) => node.id === link.from),
          end: layerNodes.find((node) => node.id === link.to),
        }))

        return { layerNodes, layerLinks }
      }),
    [baseRgb.b, baseRgb.g, baseRgb.r, colors.ambientMotionMultiplier, graph.links, graph.nodes, height, motion.x, motion.y, phase, reducedMotion, width]
  )

  if (!enabled || width === 0 || height === 0) return null

  return (
    <View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        {
          transform: [{ translateX: viewTranslateX }, { translateY: viewTranslateY }],
        },
      ]}
    >
      <Canvas style={StyleSheet.absoluteFill}>
        {layers.map((layer, index) => (
          <Group key={`ambient-layer-${index}`}>
            {layer.layerLinks.map((link) => {
              if (!link.start || !link.end) return null
              return (
                <Line
                  key={`${link.from}-${link.to}`}
                  p1={vec(link.start.cx, link.start.cy)}
                  p2={vec(link.end.cx, link.end.cy)}
                  color={link.start.lineColor}
                  strokeWidth={0.45 + index * 0.36}
                />
              )
            })}

            {layer.layerNodes.map((node) => (
              <React.Fragment key={node.id}>
                <Circle cx={node.cx} cy={node.cy} r={node.glowRadius} color={node.glowColor} />
                <Circle cx={node.cx} cy={node.cy} r={node.radius} color={node.nodeColor} />
              </React.Fragment>
            ))}
          </Group>
        ))}
      </Canvas>
    </View>
  )
}

export default AmbientBackgroundLayer

const styles = StyleSheet.create({})
