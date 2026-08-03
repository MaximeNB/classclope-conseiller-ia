const OPENAI_URL = 'https://api.openai.com/v1/responses';

export async function streamOpenAIResponse({ apiKey, model, instructions, input, signal }) {
  const response = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'text/event-stream'
    },
    body: JSON.stringify({
      model,
      instructions,
      input,
      store: false,
      stream: true,
      reasoning: { effort: 'low' },
      max_output_tokens: 900
    }),
    signal
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`OpenAI ${response.status}: ${details.slice(0, 500)}`);
  }
  if (!response.body) throw new Error('Flux OpenAI indisponible');
  return response.body;
}

export async function* parseOpenAIStream(stream) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const events = buffer.split('\n\n');
    buffer = events.pop() || '';

    for (const event of events) {
      const dataLine = event
        .split('\n')
        .find((line) => line.startsWith('data: '));
      if (!dataLine || dataLine === 'data: [DONE]') continue;

      let payload;
      try {
        payload = JSON.parse(dataLine.slice(6));
      } catch {
        continue;
      }

      if (payload.type === 'response.output_text.delta' && typeof payload.delta === 'string') {
        yield { type: 'delta', delta: payload.delta };
      }
      if (payload.type === 'response.failed') {
        throw new Error(payload.response?.error?.message || 'La réponse OpenAI a échoué');
      }
      if (payload.type === 'error') {
        throw new Error(payload.message || 'Erreur OpenAI');
      }
    }
  }
}
