import { getAiGatewayUrl } from '../ai/config'
import { AI_ASSISTANT_MODELS, ChatCompletionOptions, callWithFallback } from '../model-router'

export async function callAiAssistant(
  systemPrompt: string,
  userMessage: string,
  options?: ChatCompletionOptions
): Promise<string> {
  const endpoint = getAiGatewayUrl()
  if (!endpoint) throw new Error('AI assistant endpoint not set (EXPO_PUBLIC_AI_GATEWAY_URL)')

  return callWithFallback(
    endpoint,
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
    AI_ASSISTANT_MODELS,
    options
  )
}
