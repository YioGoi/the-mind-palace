import { getAiGatewayUrl } from '../ai/config';
import { CONTEXT_ENGINE_MODELS, callWithFallback } from '../model-router';
import { Context, NoteInput, UserFeedback } from './types';

export async function callContextEngineAPI(
  note: NoteInput,
  contexts: Context[],
  feedback: UserFeedback = [],
  userMessage: string
): Promise<string> {
  const endpoint = getAiGatewayUrl()
  if (!endpoint) throw new Error('Context Engine endpoint not set')

  return callWithFallback(
    endpoint,
    [{ role: 'user', content: userMessage }],
    CONTEXT_ENGINE_MODELS
  )
}

// Self-test function (for local/dev use)
export async function testCallContextEngineAPI() {
  const note = { title: 'Test' } as NoteInput;
  const contexts: Context[] = [];
  const feedback: UserFeedback = [];
  const userMessage = 'Classify this note';
  try {
    const result = await callContextEngineAPI(note, contexts, feedback, userMessage);
    // eslint-disable-next-line no-console
    return result;
  } catch (e) {
    // eslint-disable-next-line no-console
    throw e;
  }
}
