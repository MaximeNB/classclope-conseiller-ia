import test from 'node:test';
import assert from 'node:assert/strict';
import { parseOpenAIStream, streamOpenAIResponse } from '../src/openai.mjs';

test('recompose les deltas du flux Responses API', async () => {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(
        encoder.encode(
          'event: response.output_text.delta\ndata: {"type":"response.output_text.delta","delta":"Bonjour "}\n\n'
        )
      );
      controller.enqueue(
        encoder.encode(
          'event: response.output_text.delta\ndata: {"type":"response.output_text.delta","delta":"CLASS’CLOPE"}\n\n'
        )
      );
      controller.close();
    }
  });

  let answer = '';
  for await (const event of parseOpenAIStream(stream)) answer += event.delta;
  assert.equal(answer, 'Bonjour CLASS’CLOPE');
});

test('préserve un dernier delta même sans double saut de ligne final', async () => {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode('data: {"type":"response.output_text.delta","delta":"Final"}'));
      controller.close();
    }
  });
  let answer = '';
  for await (const event of parseOpenAIStream(stream)) answer += event.delta;
  assert.equal(answer, 'Final');
});

test('configure le modèle de production avec raisonnement et réponse concise', async () => {
  const originalFetch = globalThis.fetch;
  let captured;
  globalThis.fetch = async (_url, options) => {
    captured = JSON.parse(options.body);
    return new Response('data: [DONE]\n\n', { status: 200, headers: { 'content-type': 'text/event-stream' } });
  };
  try {
    await streamOpenAIResponse({
      apiKey: 'test-key',
      model: 'gpt-5.6-sol',
      instructions: 'test',
      input: [{ role: 'user', content: 'Bonjour' }],
      reasoningEffort: 'medium',
      maxOutputTokens: 1100
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.equal(captured.model, 'gpt-5.6-sol');
  assert.deepEqual(captured.reasoning, { effort: 'medium' });
  assert.deepEqual(captured.text, { verbosity: 'low' });
  assert.equal(captured.store, false);
  assert.equal(captured.max_output_tokens, 1100);
});
