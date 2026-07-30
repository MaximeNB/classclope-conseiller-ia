import test from 'node:test';
import assert from 'node:assert/strict';
import { parseOpenAIStream } from '../src/openai.mjs';

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
