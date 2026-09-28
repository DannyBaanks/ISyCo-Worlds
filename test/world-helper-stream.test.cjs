'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const loadTs = require('./load-ts.cjs');

function decoderType() {
  try { return loadTs('src/main/worldHelperStream.ts').WorldHelperReplyDecoder; }
  catch { return undefined; }
}

test('reply decoder emits only the top-level reply across split keys and escaped chunks', () => {
  const Decoder = decoderType();
  assert.equal(typeof Decoder, 'function', 'WorldHelperReplyDecoder must be exported');

  const decoder = new Decoder();
  const output = [
    decoder.push('{"workers":[{"name":"reply"}],"re'),
    decoder.push('ply" : "Hola \\'),
    decoder.push('"GUS\\"\\n\\uD83D'),
    decoder.push('\\uDE42"}')
  ].join('');

  decoder.finish();
  assert.equal(output, 'Hola "GUS"\n🙂');
});

test('reply decoder rejects a truncated reply string instead of accepting a partial proposal', () => {
  const Decoder = decoderType();
  assert.equal(typeof Decoder, 'function', 'WorldHelperReplyDecoder must be exported');

  const decoder = new Decoder();
  assert.equal(decoder.push('{"reply":"partial'), 'partial');
  assert.throws(() => decoder.finish(), /truncated|unterminated|incomplete/i);
});

test('reply decoder rejects a response with no top-level reply field', () => {
  const Decoder = decoderType();
  assert.equal(typeof Decoder, 'function', 'WorldHelperReplyDecoder must be exported');

  const decoder = new Decoder();
  decoder.push('{"workers":[]}');
  assert.throws(() => decoder.finish(), /reply/i);
});
