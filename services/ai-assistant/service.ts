import { isModelRouterError } from '../model-router'
import { applyCleanupPlan, planCleanup } from './cleanup'
import { executeAssistantPlan, planAssistantActions } from './orchestrator'
import { AssistantActionPlan, AssistantActionResponse, AssistantIntent, CleanupApplyResult, CleanupPlan, NoteCategory } from './types'

export type AssistantRunResult =
  | { ok: true; intent: 'capture'; result: AssistantActionResponse }
  | { ok: true; intent: 'cleanup'; result: CleanupPlan }
  | { ok: false; degrade: true; reason: 'all_models_failed' }
  | { ok: false; degrade: false; reason: 'parse_error' | 'execution_error' | 'upgrade_required' | 'quota_exceeded' | 'rate_limited' }

const CLEANUP_INTENT_PATTERN =
  /\b(organize|organise|cleanup|clean up|tidy|merge|rename|move context|move this context|move the context|fix contexts|fix my contexts|plan my notes|plan my contexts|sort my notes|sort my contexts|review my notes|review my contexts|ta[sş]ı|kategoriye ta[sş]ı|context.*urgent|context.*have|context.*nice)\b/i

const ACTIONABLE_SIGNAL_PATTERNS = [
  /\b(tomorrow|today|tonight|this morning|this afternoon|this evening|next monday|next tuesday|next wednesday|next thursday|next friday|next saturday|next sunday)\b/i,
  /\b(yar[ıi]n|bug[üu]n|bu akşam|haftaya|cuma|cumartesi|pazar|pazartesi|sal[ıi]|çarşamba|perşembe)\b/i,
  /\b(demain|aujourd'hui|ce soir|vendredi|samedi|dimanche|lundi|mardi|mercredi|jeudi)\b/i,
  /\b(morgen|heute|heute abend|freitag|samstag|sonntag|montag|dienstag|mittwoch|donnerstag)\b/i,
  /\b(mañana|hoy|esta noche|viernes|sábado|domingo|lunes|martes|miércoles|jueves)\b/i,
  /\b(call|send|reply|buy|book|schedule|review|finish|prepare|pay|move)\b/i,
  /\b(ara|g[öo]nder|bitir|haz[ıi]rla|al|öde|ta[sş][ıi])\b/i,
  /\b(appeler|envoyer|terminer|préparer|payer|réserver)\b/i,
  /\b(anrufen|senden|beantworten|kaufen|planen|prüfen|abschließen)\b/i,
  /\b(llama|envía|responde|compra|agenda|revisa|termina|prepara|paga)\b/i,
  /\b(at|by)\s+\d{1,2}(?::\d{2})?\s*(am|pm)?\b/i,
  /\b\d{1,2}:\d{2}\b/,
]

const REVIEW_SIGNAL_PATTERNS = [
  /\b(should|whether|if .*belongs|if .*stay|does it make sense|too early|mixed|forced category move|category change|stay in nice|move from nice|move to have|move to urgent)\b/i,
  /\b(olmal[ıi]|mant[ıi]kl[ıi]|kar[ıi][sş][ıi]k|ta[sş][ıi]nmal[ıi]|değerlendir|yorum yap|zorlama)\b/i,
  /\b(s'il faut|a du sens|trop mixte|sans forcer|déplacer de nice|devenir un contexte have)\b/i,
  /\b(ob .* sinnvoll ist|noch zu früh|ehrlich sagen|wechsel von nice|kontext-änderung)\b/i,
  /\b(si debería pasar|si todav[íi]a es una mezcla|sin simplificar demasiado|cambio de categor[íi]a)\b/i,
]

const META_SIGNAL_PATTERNS = [
  /\b(i'm overwhelmed|help me think|reduce cognitive load|organization and honesty|don't overcommit|without overcommitting)\b/i,
  /\b(ne yapacağımı bilmiyorum|yardım et|kafam karışık)\b/i,
  /\b(aide-moi|je veux plus qu'une simple capture)\b/i,
  /\b(hilf mir|ich will nicht nur notizen)\b/i,
  /\b(ayúdame|no solo captures)\b/i,
]

const REFLECTION_BLOCKER_PATTERNS = [
  /\b(can you help me think|help me think|not just save|i suspect|i think|i wonder|i'm not sure|i am not sure)\b/i,
  /\b(should|whether|does it make sense|too early|without forcing|don't force|do not force)\b/i,
  /\b(bence|san[ıi]r[ıi]m|emin değilim|zorlamadan|zorlama|sence)\b/i,
  /\b(je pense|je me demande|je ne suis pas s[ûu]r|sans forcer)\b/i,
  /\b(ich denke|ich frage mich|ich bin nicht sicher|ohne zu [üu]bertreiben)\b/i,
  /\b(creo que|me pregunto|no estoy seguro|sin forzar)\b/i,
]

const SIMPLE_ACTION_START_PATTERNS = [
  /^(?:call|send|reply|buy|book|schedule|review|finish|prepare|pay|move)\b/i,
  /^(?:ara|g[öo]nder|bitir|haz[ıi]rla|al|öde|ta[sş][ıi])\b/i,
  /^(?:appeler|envoyer|terminer|pr[ée]parer|payer|r[ée]server)\b/i,
  /^(?:anrufen|senden|beantworten|kaufen|planen|pr[üu]fen|abschlie[sß]en)\b/i,
  /^(?:llama|env[íi]a|responde|compra|agenda|revisa|termina|prepara|paga)\b/i,
]

const SIMPLE_TIME_PREFIX_PATTERNS = [
  /^(?:tomorrow|today|tonight|this morning|this afternoon|this evening|next friday|friday morning)\b/i,
  /^(?:yar[ıi]n|bug[üu]n|bu akşam|cuma sabah[ıi])\b/i,
  /^(?:demain|aujourd'hui|ce soir|vendredi matin)\b/i,
  /^(?:morgen|heute|heute abend|freitag(?:vormittag| morgen)?)\b/i,
  /^(?:ma[ñn]ana|hoy|esta noche|viernes por la ma[ñn]ana)\b/i,
]

type CapabilityLocale =
  | 'en'
  | 'tr'
  | 'fr'
  | 'de'
  | 'es'
  | 'it'
  | 'pt'
  | 'nl'
  | 'ru'
  | 'ar'
  | 'hi'
  | 'ja'
  | 'ko'
  | 'zh'

const CAPABILITY_INTENT_PATTERNS: Array<{ locale: CapabilityLocale; pattern: RegExp }> = [
  { locale: 'en', pattern: /what can you do/i },
  { locale: 'en', pattern: /what exactly can you do/i },
  { locale: 'en', pattern: /how can you help/i },
  { locale: 'en', pattern: /how should i write/i },
  { locale: 'en', pattern: /how do you decide/i },
  { locale: 'en', pattern: /are you only/i },
  { locale: 'en', pattern: /can you .*reorgani[sz]e/i },
  { locale: 'en', pattern: /can you .*organi[sz]e/i },
  { locale: 'en', pattern: /can you help me think/i },
  { locale: 'en', pattern: /help me think/i },
  { locale: 'en', pattern: /capabilit/i },
  { locale: 'tr', pattern: /neler yapabilirsin/i },
  { locale: 'tr', pattern: /yard[ıi]mc[ıi] olursun/i },
  { locale: 'tr', pattern: /sadece note mu/i },
  { locale: 'tr', pattern: /d[üu]zenleme de yapabiliyor/i },
  { locale: 'tr', pattern: /nas[ıi]l yazarsam/i },
  { locale: 'tr', pattern: /ne t[üu]r .* yapabili/i },
  { locale: 'fr', pattern: /que peux-tu faire/i },
  { locale: 'fr', pattern: /que pouvez-vous faire/i },
  { locale: 'fr', pattern: /comment peux-tu m'aider/i },
  { locale: 'fr', pattern: /comment pouvez-vous m'aider/i },
  { locale: 'fr', pattern: /comment devrais-je écrire/i },
  { locale: 'fr', pattern: /peux-tu .*réorganiser/i },
  { locale: 'fr', pattern: /peux-tu .*organiser/i },
  { locale: 'fr', pattern: /aider à réfléchir/i },
  { locale: 'de', pattern: /kannst du .*tun/i },
  { locale: 'de', pattern: /was kannst du/i },
  { locale: 'de', pattern: /wie kannst du helfen/i },
  { locale: 'de', pattern: /wie soll ich schreiben/i },
  { locale: 'de', pattern: /kannst du .*organisieren/i },
  { locale: 'de', pattern: /kannst du .*reorganisieren/i },
  { locale: 'es', pattern: /puedes ayudarme/i },
  { locale: 'es', pattern: /que puedes hacer/i },
  { locale: 'es', pattern: /qué puedes hacer/i },
  { locale: 'es', pattern: /como deberia escribir/i },
  { locale: 'es', pattern: /cómo debería escribir/i },
  { locale: 'es', pattern: /puedes .*reorganizar/i },
  { locale: 'es', pattern: /puedes .*organizar/i },
  { locale: 'es', pattern: /si te hablo como/i },
  { locale: 'it', pattern: /puoi aiutarmi/i },
  { locale: 'it', pattern: /cosa puoi fare/i },
  { locale: 'it', pattern: /come dovrei scrivere/i },
  { locale: 'it', pattern: /puoi .*riorganizzare/i },
  { locale: 'it', pattern: /puoi .*organizzare/i },
  { locale: 'pt', pattern: /o que voce pode fazer/i },
  { locale: 'pt', pattern: /o que você pode fazer/i },
  { locale: 'pt', pattern: /como voce pode ajudar/i },
  { locale: 'pt', pattern: /como você pode ajudar/i },
  { locale: 'pt', pattern: /como devo escrever/i },
  { locale: 'pt', pattern: /pode .*reorganizar/i },
  { locale: 'pt', pattern: /pode .*organizar/i },
  { locale: 'nl', pattern: /wat kun je doen/i },
  { locale: 'nl', pattern: /hoe kun je helpen/i },
  { locale: 'nl', pattern: /hoe moet ik schrijven/i },
  { locale: 'nl', pattern: /kun je .*reorganiseren/i },
  { locale: 'nl', pattern: /kun je .*organiseren/i },
  { locale: 'ru', pattern: /что ты умеешь/i },
  { locale: 'ru', pattern: /что вы умеете/i },
  { locale: 'ru', pattern: /чем ты можешь помочь/i },
  { locale: 'ru', pattern: /чем вы можете помочь/i },
  { locale: 'ru', pattern: /как мне лучше писать/i },
  { locale: 'ru', pattern: /можешь .*организ/i },
  { locale: 'ru', pattern: /можете .*организ/i },
  { locale: 'ar', pattern: /ماذا يمكنك أن تفعل/i },
  { locale: 'ar', pattern: /كيف يمكنك مساعدتي/i },
  { locale: 'ar', pattern: /كيف ينبغي أن أكتب/i },
  { locale: 'ar', pattern: /هل يمكنك .*تنظيم/i },
  { locale: 'hi', pattern: /तुम क्या कर सकते हो/i },
  { locale: 'hi', pattern: /आप क्या कर सकते हैं/i },
  { locale: 'hi', pattern: /तुम मेरी कैसे मदद कर सकते हो/i },
  { locale: 'hi', pattern: /आप मेरी कैसे मदद कर सकते हैं/i },
  { locale: 'hi', pattern: /मुझे कैसे लिखना चाहिए/i },
  { locale: 'hi', pattern: /क्या तुम .*व्यवस्थित/i },
  { locale: 'hi', pattern: /क्या आप .*व्यवस्थित/i },
  { locale: 'ja', pattern: /何ができますか/i },
  { locale: 'ja', pattern: /どうやって手伝えますか/i },
  { locale: 'ja', pattern: /どう書けばいい/i },
  { locale: 'ja', pattern: /整理できますか/i },
  { locale: 'ja', pattern: /再編できますか/i },
  { locale: 'ko', pattern: /무엇을 할 수 있나요/i },
  { locale: 'ko', pattern: /어떻게 도와줄 수 있나요/i },
  { locale: 'ko', pattern: /어떻게 쓰면 되나요/i },
  { locale: 'ko', pattern: /정리할 수 있나요/i },
  { locale: 'ko', pattern: /재구성할 수 있나요/i },
  { locale: 'zh', pattern: /你能做什么/i },
  { locale: 'zh', pattern: /你可以做什么/i },
  { locale: 'zh', pattern: /你怎么帮我/i },
  { locale: 'zh', pattern: /我该怎么写/i },
  { locale: 'zh', pattern: /你能.*整理/i },
  { locale: 'zh', pattern: /你可以.*整理/i },
]

function detectCapabilityLocale(userMessage: string): CapabilityLocale | null {
  const match = CAPABILITY_INTENT_PATTERNS.find(({ pattern }) => pattern.test(userMessage))
  return match?.locale ?? null
}

function hasActionableSignals(userMessage: string) {
  return ACTIONABLE_SIGNAL_PATTERNS.some((pattern) => pattern.test(userMessage))
}

function hasReviewSignals(userMessage: string) {
  return REVIEW_SIGNAL_PATTERNS.some((pattern) => pattern.test(userMessage))
}

function hasMetaSignals(userMessage: string) {
  return META_SIGNAL_PATTERNS.some((pattern) => pattern.test(userMessage))
}

function hasReflectionBlockers(userMessage: string) {
  return REFLECTION_BLOCKER_PATTERNS.some((pattern) => pattern.test(userMessage))
}

function splitMixedCaptureInput(userMessage: string) {
  const segments = userMessage
    .split(/(?:\r?\n|[;,]|\.\s+)/)
    .map((segment) => segment.trim())
    .filter(Boolean)

  if (segments.length <= 1) {
    return {
      actionableText: userMessage.trim(),
      actionableSegments: userMessage.trim() ? [userMessage.trim()] : [],
      reviewSegments: [] as string[],
      metaSegments: [] as string[],
      isMixed: false,
    }
  }

  const actionableSegments: string[] = []
  const reviewSegments: string[] = []
  const metaSegments: string[] = []

  for (const segment of segments) {
    if (hasReviewSignals(segment)) {
      reviewSegments.push(segment)
      continue
    }

    if (hasMetaSignals(segment) && !hasActionableSignals(segment)) {
      metaSegments.push(segment)
      continue
    }

    actionableSegments.push(segment)
  }

  return {
    actionableText: actionableSegments.join('. ').trim(),
    actionableSegments,
    reviewSegments,
    metaSegments,
    isMixed: reviewSegments.length > 0 || metaSegments.length > 0,
  }
}

function appendReviewSummary(baseSummary: string, reviewSegments: string[]) {
  if (reviewSegments.length === 0) return baseSummary

  const reviewHint =
    reviewSegments.length === 1
      ? 'I left the less-certain category question as a review instead of forcing it into a note.'
      : 'I left the less-certain review questions out of notes instead of forcing them into tasks.'

  return `${baseSummary} ${reviewHint}`.trim()
}

const SIMPLE_CAPTURE_MAX_SEGMENTS = 3

function normalizeHour(hour: number, meridiem?: string | null) {
  if (!meridiem) return hour
  const lower = meridiem.toLowerCase()
  if (lower === 'pm' && hour < 12) return hour + 12
  if (lower === 'am' && hour === 12) return 0
  return hour
}

function toIsoLocal(date: Date) {
  const tzOffsetMinutes = -date.getTimezoneOffset()
  const sign = tzOffsetMinutes >= 0 ? '+' : '-'
  const hours = String(Math.floor(Math.abs(tzOffsetMinutes) / 60)).padStart(2, '0')
  const minutes = String(Math.abs(tzOffsetMinutes) % 60).padStart(2, '0')
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hh = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  const ss = String(date.getSeconds()).padStart(2, '0')
  return `${year}-${month}-${day}T${hh}:${mm}:${ss}${sign}${hours}:${minutes}`
}

function addHours(date: Date, hours: number) {
  const next = new Date(date)
  next.setHours(next.getHours() + hours)
  return next
}

function nextWeekday(base: Date, targetDay: number, hour: number, minute: number) {
  const candidate = new Date(base)
  candidate.setHours(hour, minute, 0, 0)
  const delta = (targetDay - candidate.getDay() + 7) % 7
  candidate.setDate(candidate.getDate() + delta)
  if (delta === 0 && candidate.getTime() <= base.getTime()) {
    candidate.setDate(candidate.getDate() + 7)
  }
  return candidate
}

function parseSimpleDueDate(segment: string, now: Date): Date | null {
  const patterns: Array<(text: string) => Date | null> = [
    (text) => {
      const match = text.match(/\b(?:tomorrow|yar[ıi]n)\b(?:\s+(?:at|saat)?)?\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i)
      if (!match) return null
      const hour = normalizeHour(Number(match[1]), match[3] ?? null)
      const minute = Number(match[2] ?? '0')
      const date = new Date(now)
      date.setDate(date.getDate() + 1)
      date.setHours(hour, minute, 0, 0)
      return date
    },
    (text) => {
      const match = text.match(/\bmorgen\b(?:\s+um)?\s*(\d{1,2})(?::(\d{2}))?\s*uhr/i)
      if (!match) return null
      const date = new Date(now)
      date.setDate(date.getDate() + 1)
      date.setHours(Number(match[1]), Number(match[2] ?? '0'), 0, 0)
      return date
    },
    (text) => {
      const match = text.match(/\bdemain\b(?:\s+à)?\s*(\d{1,2})(?:h|:)(\d{2})?/i)
      if (!match) return null
      const date = new Date(now)
      date.setDate(date.getDate() + 1)
      date.setHours(Number(match[1]), Number(match[2] ?? '0'), 0, 0)
      return date
    },
    (text) => {
      const match = text.match(/\bma[ñn]ana\b(?:\s+a\s+las)?\s*(\d{1,2})(?::(\d{2}))?/i)
      if (!match) return null
      const date = new Date(now)
      date.setDate(date.getDate() + 1)
      date.setHours(Number(match[1]), Number(match[2] ?? '0'), 0, 0)
      return date
    },
    (text) => {
      const weekdayDefs: Array<{ pattern: RegExp; day: number; hour: number; minute: number }> = [
        { pattern: /\bfriday morning\b/i, day: 5, hour: 9, minute: 0 },
        { pattern: /\bfreitag(?:vormittag| morgen)?\b/i, day: 5, hour: 9, minute: 0 },
        { pattern: /\bvendredi matin\b/i, day: 5, hour: 9, minute: 0 },
        { pattern: /\bviernes por la ma[ñn]ana\b/i, day: 5, hour: 9, minute: 0 },
        { pattern: /\bcuma sabah[ıi]\b/i, day: 5, hour: 9, minute: 0 },
        { pattern: /\btomorrow morning\b/i, day: -1, hour: 9, minute: 0 },
        { pattern: /\bdemain matin\b/i, day: -1, hour: 9, minute: 0 },
        { pattern: /\bmorgen früh\b/i, day: -1, hour: 9, minute: 0 },
        { pattern: /\bma[ñn]ana por la ma[ñn]ana\b/i, day: -1, hour: 9, minute: 0 },
        { pattern: /\byar[ıi]n sabah\b/i, day: -1, hour: 9, minute: 0 },
      ]

      const match = weekdayDefs.find(({ pattern }) => pattern.test(text))
      if (!match) return null

      if (match.day === -1) {
        const date = new Date(now)
        date.setDate(date.getDate() + 1)
        date.setHours(match.hour, match.minute, 0, 0)
        return date
      }

      return nextWeekday(now, match.day, match.hour, match.minute)
    },
  ]

  for (const pattern of patterns) {
    const result = pattern(segment)
    if (result) return result
  }

  return null
}

function cleanSimpleTitle(segment: string) {
  return segment
    .replace(/\b(?:please|pl[ei]ase|lütfen)\b/gi, '')
    .replace(/\b(?:i need to|need to|i have to|have to|i must|must)\b/gi, '')
    .replace(/\b(?:can you|could you|help me)\b/gi, '')
    .replace(/\b(?:tomorrow|today|tonight|this morning|this afternoon|this evening|yar[ıi]n|bug[üu]n|morgen|demain|ma[ñn]ana)\b/gi, '')
    .replace(/\b(?:friday morning|freitagvormittag|vendredi matin|viernes por la ma[ñn]ana|cuma sabah[ıi])\b/gi, '')
    .replace(/\b(?:at|by|um|à|a las|saat)\b/gi, '')
    .replace(/\b\d{1,2}(?::\d{2})?\s*(?:am|pm|uhr)?\b/gi, '')
    .replace(/\s+/g, ' ')
    .replace(/^[,.\-–: ]+|[,.\-–: ]+$/g, '')
    .replace(/^(and|ve|und|et|y)\s+/i, '')
    .trim()
}

function inferSimpleCategory(dueDate: Date | null): NoteCategory {
  if (!dueDate) return 'HAVE'
  const diffMs = dueDate.getTime() - Date.now()
  return diffMs <= 72 * 60 * 60 * 1000 ? 'URGENT' : 'HAVE'
}

function isClearlyActionableSimpleSegment(segment: string) {
  const normalized = segment.trim()
  if (!normalized) return false
  if (normalized.length > 140) return false
  if (normalized.includes('?')) return false
  if (hasReviewSignals(normalized) || hasMetaSignals(normalized) || hasReflectionBlockers(normalized)) {
    return false
  }

  const startsWithAction = SIMPLE_ACTION_START_PATTERNS.some((pattern) => pattern.test(normalized))
  if (startsWithAction) return true

  const startsWithTime = SIMPLE_TIME_PREFIX_PATTERNS.some((pattern) => pattern.test(normalized))
  if (!startsWithTime) return false

  return SIMPLE_ACTION_START_PATTERNS.some((pattern) =>
    pattern.test(
      normalized
        .replace(SIMPLE_TIME_PREFIX_PATTERNS.find((timePattern) => timePattern.test(normalized)) ?? /^$/, '')
        .trim()
    )
  )
}

function tryBuildSimpleCapturePlan(actionableSegments: string[]) {
  if (actionableSegments.length === 0 || actionableSegments.length > SIMPLE_CAPTURE_MAX_SEGMENTS) return null
  if (!actionableSegments.every(isClearlyActionableSimpleSegment)) return null

  const now = new Date()
  const actions = actionableSegments.flatMap((segment) => {
    if (!hasActionableSignals(segment) || segment.length > 180) return []

    const dueDate = parseSimpleDueDate(segment, now)
    const title = cleanSimpleTitle(segment)
    if (!title || title.length < 3) return []

    const reminderDate = dueDate ? addHours(dueDate, -4) : null
    const action = {
      type: 'create_note' as const,
      title,
      category: inferSimpleCategory(dueDate),
      body: null,
      dueDate: dueDate ? toIsoLocal(dueDate) : null,
      reminders: reminderDate && reminderDate.getTime() > now.getTime() ? [toIsoLocal(reminderDate)] : [],
      context: null,
    }

    return [action]
  })

  if (actions.length === 0 || actions.length > SIMPLE_CAPTURE_MAX_SEGMENTS) return null

  const summary =
    actions.length === 1
      ? 'I captured the concrete task and kept the rest lightweight.'
      : `I captured ${actions.length} concrete tasks and kept the rest lightweight.`

  return {
    actions,
    summary,
  } satisfies AssistantActionPlan
}

function buildCapabilityReply(locale: CapabilityLocale): AssistantActionResponse {
  const summaries: Record<CapabilityLocale, string> = {
    en: "I can do more than save notes. I can turn messy input into notes, split mixed requests into actions, add reminders or due dates, and help reorganize your system through planning and cleanup. I can also suggest context changes, including whole-context category moves like Nice, Have, and Urgent, usually with review or confirmation before bigger changes.",
    tr: 'Sadece not kaydetmem. Dağınık yazdıklarını görevlere ayırabilir, hatırlatıcı ve tarih ekleyebilir, planning ve cleanup ile sistemi düzenlemene yardımcı olabilirim. Nice, Have ve Urgent arasında tüm context taşımayı da önerebilirim; büyük değişiklikleri genelde önce review veya onayla ilerletirim.',
    fr: "Je peux faire plus que prendre des notes. Je peux transformer des idées en actions, séparer des demandes mixtes, ajouter des rappels ou des échéances, et t'aider à réorganiser le système via planning et cleanup. Je peux aussi proposer des changements de contexte, y compris des déplacements complets entre Nice, Have et Urgent, en général avec revue ou confirmation avant les gros changements.",
    de: 'Ich kann mehr als nur Notizen speichern. Ich kann chaotische Eingaben in Aufgaben aufteilen, Erinnerungen oder Termine hinzufügen und dir bei Planung und Cleanup helfen, dein System neu zu ordnen. Ich kann auch Kontextänderungen vorschlagen, einschließlich ganzer Kategorie-Wechsel zwischen Nice, Have und Urgent, normalerweise mit Review oder Bestätigung vor größeren Änderungen.',
    es: 'Puedo hacer más que guardar notas. Puedo convertir entradas desordenadas en acciones, separar solicitudes mixtas, añadir recordatorios o fechas límite y ayudarte a reorganizar tu sistema mediante planning y cleanup. También puedo sugerir cambios de contexto, incluidos movimientos completos entre Nice, Have y Urgent, normalmente con revisión o confirmación antes de cambios grandes.',
    it: 'Posso fare più che salvare note. Posso trasformare input confusi in azioni, separare richieste miste, aggiungere promemoria o scadenze e aiutarti a riorganizzare il sistema tramite planning e cleanup. Posso anche suggerire cambi di contesto, compresi spostamenti completi tra Nice, Have e Urgent, di solito con review o conferma prima dei cambiamenti più grandi.',
    pt: 'Posso fazer mais do que salvar notas. Posso transformar entradas confusas em ações, separar pedidos mistos, adicionar lembretes ou prazos e ajudar a reorganizar seu sistema com planning e cleanup. Também posso sugerir mudanças de contexto, incluindo mover um contexto inteiro entre Nice, Have e Urgent, normalmente com revisão ou confirmação antes de mudanças maiores.',
    nl: 'Ik kan meer doen dan alleen notities opslaan. Ik kan rommelige input opsplitsen in acties, herinneringen of deadlines toevoegen en je helpen je systeem te herorganiseren via planning en cleanup. Ik kan ook contextwijzigingen voorstellen, inclusief volledige category moves tussen Nice, Have en Urgent, meestal met review of bevestiging voor grotere wijzigingen.',
    ru: 'Я умею не только сохранять заметки. Я могу превращать хаотичный ввод в действия, разделять смешанные запросы, добавлять напоминания или сроки и помогать с reorganize через planning и cleanup. Я также могу предлагать изменения контекстов, включая перенос целого контекста между Nice, Have и Urgent, обычно с review или подтверждением перед более крупными изменениями.',
    ar: 'أستطيع أن أفعل أكثر من حفظ الملاحظات. يمكنني تحويل المدخلات المبعثرة إلى إجراءات، وفصل الطلبات المختلطة، وإضافة تذكيرات أو مواعيد نهائية، ومساعدتك في إعادة تنظيم النظام عبر التخطيط والتنظيف. ويمكنني أيضا اقتراح تغييرات على السياقات، بما في ذلك نقل سياق كامل بين Nice و Have و Urgent، وعادة مع مراجعة أو تأكيد قبل التغييرات الأكبر.',
    hi: 'मैं सिर्फ नोट सेव करने से ज्यादा कर सकता हूँ। मैं बिखरी हुई बातों को actions में बदल सकता हूँ, mixed requests को अलग कर सकता हूँ, reminders या due dates जोड़ सकता हूँ, और planning तथा cleanup के जरिए तुम्हारे system को organize करने में मदद कर सकता हूँ। मैं context changes भी suggest कर सकता हूँ, जैसे पूरे context को Nice, Have और Urgent के बीच move करना, आमतौर पर बड़े बदलावों से पहले review या confirmation के साथ।',
    ja: 'ノートを保存するだけではありません。ばらばらな入力を行動に分けたり、混ざった依頼を整理したり、リマインダーや期限を追加したり、planning と cleanup を通じてシステムの再編成を手伝えます。Nice・Have・Urgent の間でコンテキスト全体を移す提案もでき、大きな変更は通常 review や確認を前提に進めます。',
    ko: '저는 메모를 저장하는 것 이상을 할 수 있어요. 흐트러진 입력을 실행 항목으로 나누고, 섞인 요청을 분리하고, 리마인더나 마감일을 추가하고, planning과 cleanup을 통해 시스템 재정리를 도울 수 있어요. Nice, Have, Urgent 사이에서 컨텍스트 전체를 옮기는 제안도 가능하며, 큰 변경은 보통 review나 확인을 거쳐 진행해요.',
    zh: '我不只是保存笔记。我可以把零散输入拆成可执行事项，分离混合请求，添加提醒或截止时间，并通过 planning 和 cleanup 帮你整理整个系统。我也可以建议 context 调整，包括在 Nice、Have、Urgent 之间移动整个 context，不过较大的变更通常会先经过 review 或确认。',
  }

  return {
    createdNotes: [],
    operationLog: [],
    summary: summaries[locale],
    warnings: [],
  }
}

export function detectAssistantIntent(userMessage: string): AssistantIntent {
  return CLEANUP_INTENT_PATTERN.test(userMessage) ? 'cleanup' : 'capture'
}

export async function runAiAssistant(userMessage: string): Promise<AssistantRunResult> {
  const capabilityLocale = detectCapabilityLocale(userMessage)
  if (capabilityLocale && !hasActionableSignals(userMessage)) {
    return {
      ok: true,
      intent: 'capture',
      result: buildCapabilityReply(capabilityLocale),
    }
  }

  const intent = detectAssistantIntent(userMessage)
  const captureSplit =
    intent === 'capture'
      ? splitMixedCaptureInput(userMessage)
      : { actionableText: userMessage, actionableSegments: [userMessage], reviewSegments: [] as string[], metaSegments: [] as string[], isMixed: false }
  const plannerInput =
    intent === 'capture' && captureSplit.actionableText
      ? captureSplit.actionableText
      : userMessage
  const simpleCapturePlan =
    intent === 'capture'
      ? tryBuildSimpleCapturePlan(captureSplit.actionableSegments)
      : null

  let plan
  try {
    plan = simpleCapturePlan
      ? simpleCapturePlan
      : intent === 'cleanup'
      ? await planCleanup(userMessage)
      : await planAssistantActions(plannerInput)
  } catch (error) {
    if (isModelRouterError(error)) {
      if (error.errorType === 'upgrade_required') {
        return { ok: false, degrade: false, reason: 'upgrade_required' }
      }
      if (error.errorType === 'quota_exceeded') {
        return { ok: false, degrade: false, reason: 'quota_exceeded' }
      }
      if (error.errorType === 'rate_limited') {
        return { ok: false, degrade: false, reason: 'rate_limited' }
      }
    }
    return { ok: false, degrade: true, reason: 'all_models_failed' }
  }

  try {
    if (!Array.isArray(plan.actions)) {
      return { ok: false, degrade: false, reason: 'parse_error' }
    }
    if (intent === 'cleanup') {
      return { ok: true, intent, result: plan as CleanupPlan }
    }

    const result = await executeAssistantPlan(plan as import('./types').AssistantActionPlan)
    if (captureSplit.reviewSegments.length > 0) {
      result.summary = appendReviewSummary(result.summary, captureSplit.reviewSegments)
    }
    return { ok: true, intent, result }
  } catch {
    return { ok: false, degrade: false, reason: 'execution_error' }
  }
}

export async function applyAiCleanupPlan(plan: CleanupPlan): Promise<CleanupApplyResult> {
  return applyCleanupPlan(plan)
}
