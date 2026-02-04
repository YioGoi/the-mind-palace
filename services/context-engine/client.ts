import { Context, NoteInput, UserFeedback } from './types';

const ENDPOINT = process.env.EXPO_PUBLIC_CONTEXT_ENGINE_URL;


export async function callContextEngineAPI(
  note: NoteInput,
  contexts: Context[],
  feedback: UserFeedback = [],
  userMessage: string,
  model: string = 'upstage/solar-pro-3:free'
): Promise<string> {
  if (!ENDPOINT) throw new Error('Context Engine endpoint not set')
  // OpenRouter expects a model and messages array
  const body = {
    model,
    messages: [
      { role: 'user', content: userMessage }
    ],
    note,
    contexts,
    feedback
  };
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 
        'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`Context Engine API error: ${res.status}`)
  
  const responseText = await res.text()
  // OpenRouter returns a full chat completion object, extract the message content
  try {
    const openRouterResponse = JSON.parse(responseText)
    if (openRouterResponse.choices && openRouterResponse.choices[0]?.message?.content) {
      return openRouterResponse.choices[0].message.content
    }
    // If not in expected format, return raw text
    return responseText
  } catch {
    // If JSON parse fails, return raw text
    return responseText
  }
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
    console.log('API result:', result);
    return result;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('API error:', e);
    throw e;
  }
}
