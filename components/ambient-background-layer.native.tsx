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
  band: number
  angle: number
  orbit: number
  depth: number
  radius: number
  pulse: number
  drift: number
  tilt: number
}

type AmbientLink = {
  from: string
  to: string
  band: number
}

const BAND_CONFIG = [
  { count: 8, orbit: 0.2, orbitJitter: 0.03, speed: 0.18, size: [1.8, 3], lineAlpha: 0.07 },
  { count: 12, orbit: 0.32, orbitJitter: 0.04, speed: 0.14, size: [2.3, 4.1], lineAlpha: 0.09 },
  { count: 14, orbit: 0.45, orbitJitter: 0.05, speed: 0.1, size: [2.9, 5.6], lineAlpha: 0.1 },
  { count: 8, orbit: 0.6, orbitJitter: 0.055, speed: 0.075, size: [4.2, 8.6], lineAlpha: 0.085 },
] as const

const RENDER_FRAME_MS = 1000 / 30

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

  BAND_CONFIG.forEach((config, bandIndex) => {
    const rand = createSeededRandom(100 + bandIndex * 97)
    const bandIds: string[] = []

    for (let i = 0; i < config.count; i += 1) {
      const id = `b${bandIndex}-${i}`
      const angle = (Math.PI * 2 * i) / config.count + rand() * 0.34
      const orbit = config.orbit + (rand() - 0.5) * config.orbitJitter * 2
      const depth = -1 + rand() * 2
      const radius = config.size[0] + rand() * (config.size[1] - config.size[0])
      const pulse = rand() * Math.PI * 2
      const drift = 0.6 + rand() * 1.3
      const tilt = -0.9 + rand() * 1.8

      nodes.push({ id, band: bandIndex, angle, orbit, depth, radius, pulse, drift, tilt })
      bandIds.push(id)
    }

    for (let i = 0; i < bandIds.length; i += 1) {
      links.push({
        from: bandIds[i],
        to: bandIds[(i + 1) % bandIds.length],
        band: bandIndex,
      })
    }

    for (let i = 0; i < Math.max(2, Math.floor(bandIds.length / 3)); i += 1) {
      const from = bandIds[i]
      const to = bandIds[(i + 3) % bandIds.length]
      if (from !== to) {
        links.push({ from, to, band: bandIndex })
      }
    }
  })

  return { nodes, links }
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function useAmbientAnimation(active: boolean) {
  const [renderState, setRenderState] = useState({ phase: 0, motion: { x: 0, y: 0 } })
  const [motionStatus, setMotionStatus] = useState<'idle' | 'unavailable' | 'denied' | 'granted'>('idle')
  const animationRef = useRef<number | null>(null)
  const lastRef = useRef<number | null>(null)
  const lastCommitRef = useRef<number>(0)
  const phaseRef = useRef(0)
  const motionTargetRef = useRef({ x: 0, y: 0 })
  const motionCurrentRef = useRef({ x: 0, y: 0 })

  useEffect(() => {
    if (!active) {
      phaseRef.current = 0
      lastCommitRef.current = 0
      setRenderState({ phase: 0, motion: { x: 0, y: 0 } })
      setMotionStatus('idle')
      motionTargetRef.current = { x: 0, y: 0 }
      motionCurrentRef.current = { x: 0, y: 0 }
      return
    }

    let mounted = true

    const step = (timestamp: number) => {
      if (!mounted) return
      const last = lastRef.current ?? timestamp
      const delta = Math.min(timestamp - last, 48)
      lastRef.current = timestamp
      phaseRef.current += delta * 0.00018

      const smoothing = 1 - Math.pow(0.12, delta / 16)
      const nextX =
        motionCurrentRef.current.x +
        (motionTargetRef.current.x - motionCurrentRef.current.x) * smoothing
      const nextY =
        motionCurrentRef.current.y +
        (motionTargetRef.current.y - motionCurrentRef.current.y) * smoothing

      motionCurrentRef.current = {
        x: clamp(nextX, -1, 1),
        y: clamp(nextY, -1, 1),
      }

      if (timestamp - lastCommitRef.current >= RENDER_FRAME_MS) {
        lastCommitRef.current = timestamp
        setRenderState({
          phase: phaseRef.current,
          motion: motionCurrentRef.current,
        })
      }

      animationRef.current = requestAnimationFrame(step)
    }

    animationRef.current = requestAnimationFrame(step)

    return () => {
      mounted = false
      lastRef.current = null
      lastCommitRef.current = 0
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
        DeviceMotion.setUpdateInterval(80)
        subscription = DeviceMotion.addListener((event) => {
          const gamma =
            event.rotation?.gamma ??
            ((event.accelerationIncludingGravity?.x ?? 0) * 24)
          const beta =
            event.rotation?.beta ??
            ((event.accelerationIncludingGravity?.y ?? 0) * 24)
          motionTargetRef.current = {
            x: clamp(gamma / 22, -1, 1),
            y: clamp(beta / 28, -1, 1),
          }
        })
      } catch {
        setMotionStatus('unavailable')
        motionTargetRef.current = { x: 0, y: 0 }
        motionCurrentRef.current = { x: 0, y: 0 }
        setRenderState({ phase: phaseRef.current, motion: { x: 0, y: 0 } })
      }
    }

    setupMotion()

    return () => {
      mounted = false
      subscription?.remove()
      motionTargetRef.current = { x: 0, y: 0 }
      motionCurrentRef.current = { x: 0, y: 0 }
    }
  }, [active])

  return { phase: renderState.phase, motion: renderState.motion, motionStatus }
}

export function AmbientBackgroundLayer({ enabled, reducedMotion = false, scheme }: Props) {
  const { width, height } = useWindowDimensions()
  const { colors } = useAppTheme()
  const { phase, motion } = useAmbientAnimation(enabled && !reducedMotion)
  const graph = useMemo(() => createAmbientGraph(), [])
  const graphByBand = useMemo(
    () =>
      BAND_CONFIG.map((_, bandIndex) => ({
        nodes: graph.nodes.filter((node) => node.band === bandIndex),
        links: graph.links.filter((link) => link.band === bandIndex),
      })),
    [graph.links, graph.nodes]
  )
  const viewTranslateX = reducedMotion ? 0 : motion.x * 72 * colors.ambientMotionMultiplier
  const viewTranslateY = reducedMotion ? 0 : motion.y * 58 * colors.ambientMotionMultiplier
  const baseRgb = useMemo(
    () => (scheme === 'dark' ? { r: 255, g: 255, b: 255 } : { r: 24, g: 24, b: 24 }),
    [scheme]
  )

  const layers = useMemo(
    () =>
      BAND_CONFIG.map((config, index) => {
        const centerX = width * 0.5
        const centerY = height * 0.44

        const layerNodes = graphByBand[index].nodes.map((node) => {
          const rotation = phase * config.speed * colors.ambientIdleSpeed + node.pulse * 0.08
          const twist = reducedMotion ? 0 : motion.x * 1.35 + motion.y * 0.42
          const angle = node.angle + rotation + twist * (0.7 + index * 0.18)
          const orbitBase = Math.min(width, height) * node.orbit
          const perspective = 1 + node.depth * 0.34 + (reducedMotion ? 0 : motion.y * node.depth * 0.28)
          const projectedOrbit = orbitBase * perspective
          const pulse =
            reducedMotion ? 1 : 1 + Math.sin(phase * (1.2 + node.drift * 0.16) + node.pulse) * 0.18
          const cx = centerX + Math.cos(angle) * projectedOrbit + Math.sin(phase * 0.9 + node.pulse) * 5
          const cy = centerY + Math.sin(angle) * projectedOrbit * (0.56 + node.tilt * 0.08) + node.depth * 24 + motion.y * 34
          const depthScale = 0.82 + ((node.depth + 1) / 2) * 1.9
          const radius = Math.max(1.05, node.radius * depthScale * pulse)
          const glowRadius = radius * (2.8 + depthScale * 0.9)
          return {
            ...node,
            cx,
            cy,
            radius,
            glowRadius: Math.max(4, glowRadius),
            nodeColor: `rgba(${baseRgb.r}, ${baseRgb.g}, ${baseRgb.b}, ${0.08 + depthScale * 0.11})`,
            glowColor: `rgba(${baseRgb.r}, ${baseRgb.g}, ${baseRgb.b}, ${0.016 + depthScale * 0.032})`,
            lineColor: `rgba(${baseRgb.r}, ${baseRgb.g}, ${baseRgb.b}, ${config.lineAlpha})`,
          }
        })

        const nodeById = new Map(layerNodes.map((node) => [node.id, node]))
        const layerLinks = graphByBand[index].links.map((link) => ({
          ...link,
          start: nodeById.get(link.from),
          end: nodeById.get(link.to),
        }))

        return { layerNodes, layerLinks }
      }),
    [baseRgb.b, baseRgb.g, baseRgb.r, colors.ambientIdleSpeed, graphByBand, height, motion.x, motion.y, phase, reducedMotion, width]
  )

  const coreSphere = useMemo(() => {
    const centerX = width * 0.5 + (reducedMotion ? 0 : motion.x * 18 * colors.ambientMotionMultiplier)
    const centerY = height * 0.44 + (reducedMotion ? 0 : motion.y * 22 * colors.ambientMotionMultiplier)
    const pulse = reducedMotion ? 1 : 1 + Math.sin(phase * 1.35) * 0.16
    const coreRadius = Math.max(24, Math.min(width, height) * 0.074 * pulse)
    return {
      centerX,
      centerY,
      coreRadius,
      glowRadius: coreRadius * 2.9,
      haloRadius: coreRadius * 5.2,
      glowColor: `rgba(${baseRgb.r}, ${baseRgb.g}, ${baseRgb.b}, ${scheme === 'dark' ? 0.1 : 0.07})`,
      haloColor: `rgba(${baseRgb.r}, ${baseRgb.g}, ${baseRgb.b}, ${scheme === 'dark' ? 0.05 : 0.032})`,
      coreColor: `rgba(${baseRgb.r}, ${baseRgb.g}, ${baseRgb.b}, ${scheme === 'dark' ? 0.24 : 0.16})`,
    }
  }, [baseRgb.b, baseRgb.g, baseRgb.r, colors.ambientMotionMultiplier, height, motion.x, motion.y, phase, reducedMotion, scheme, width])

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
        <Circle cx={coreSphere.centerX} cy={coreSphere.centerY} r={coreSphere.haloRadius} color={coreSphere.haloColor} />
        <Circle cx={coreSphere.centerX} cy={coreSphere.centerY} r={coreSphere.glowRadius} color={coreSphere.glowColor} />
        <Circle cx={coreSphere.centerX} cy={coreSphere.centerY} r={coreSphere.coreRadius} color={coreSphere.coreColor} />
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
                  strokeWidth={0.55 + index * 0.28}
                />
              )
            })}

            {layer.layerNodes.map((node) => (
              <React.Fragment key={node.id}>
                <Line
                  p1={vec(coreSphere.centerX, coreSphere.centerY)}
                  p2={vec(node.cx, node.cy)}
                  color={`rgba(${baseRgb.r}, ${baseRgb.g}, ${baseRgb.b}, ${0.015 + index * 0.012})`}
                  strokeWidth={0.35 + index * 0.18}
                />
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
