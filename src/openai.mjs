const OPENAI_URL = 'https://api.openai.com/v1/responses';

export async function streamOpenAIResponse({ apiKey, model, instructions, input, signal, reasoningEffort = 'medium', maxOutputTokens = 1100 }) {
  const requestBody = {
    model,
    instructions,
    input,
    store: false,
    stream: true,
    reasoning: { effort: reasoningEffort },
    text: { verbosity: 'low' },
    max_output_tokens: maxOutputTokens
  };
  let response;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    response = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'text/event-stream'
      },
      body: JSON.stringify(requestBody),
      signal
    });
    if (response.ok || ![429, 500, 502, 503, 504].includes(response.status) || attempt === 1) break;
    const retryAfter = Math.min(1500, Math.max(250, Number(response.headers.get('retry-after') || 0) * 1000 || 400));
    await new Promise((resolve, reject) => {
      const timer = setTimeout(resolve, retryAfter);
      signal?.addEventListener('abort', () => {
        clearTimeout(timer);
        reject(signal.reason || new Error('ABORTED'));
      }, { once: true });
    });
  }

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

  if (buffer.trim()) {
    const dataLine = buffer.split('\n').find((line) => line.startsWith('data: '));
    if (dataLine && dataLine !== 'data: [DONE]') {
      try {
        const payload = JSON.parse(dataLine.slice(6));
        if (payload.type === 'response.output_text.delta' && typeof payload.delta === 'string') yield { type: 'delta', delta: payload.delta };
      } catch {
        // Un événement final incomplet est ignoré sans perdre les deltas précédents.
      }
    }
  }
}
