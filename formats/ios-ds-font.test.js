import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateDSFont } from './ios-ds-font.js';

test('emits SwiftUI import and DSFont enum with registration boilerplate', () => {
  const out = generateDSFont([]);
  assert.match(out, /import SwiftUI/);
  assert.match(out, /public enum DSFont \{/);
  assert.match(out, /private static let _registered: Void = DSFontRegistration\.register\(\)/);
});

test('emits lazy-init Font with _registered trigger for each token (object form)', () => {
  const out = generateDSFont([
    {
      name: 'textBodyM',
      $type: 'typography',
      $value: { fontFamily: 'Pretendard', fontWeight: 400, fontSize: '16px', lineHeight: '24px' },
    },
  ]);
  assert.match(
    out,
    /public static let textBodyM: Font = \{ _ = _registered; return Font\.custom\("Pretendard", size: 16\)\.weight\(\.regular\) \}\(\)/,
  );
});

test('parses CSS shorthand string form (SD v5 typography emit)', () => {
  const out = generateDSFont([
    { name: 'textDisplay', $type: 'typography', $value: '600 32px/40 Pretendard' },
  ]);
  assert.match(
    out,
    /public static let textDisplay: Font = \{ _ = _registered; return Font\.custom\("Pretendard", size: 32\)\.weight\(\.semibold\) \}\(\)/,
  );
});

test('maps fontWeight bands to SwiftUI Font.Weight', () => {
  const out = generateDSFont([
    { name: 't100', $type: 'typography', $value: { fontFamily: 'X', fontWeight: 100, fontSize: '12px' } },
    { name: 't400', $type: 'typography', $value: { fontFamily: 'X', fontWeight: 400, fontSize: '12px' } },
    { name: 't600', $type: 'typography', $value: { fontFamily: 'X', fontWeight: 600, fontSize: '12px' } },
    { name: 't700', $type: 'typography', $value: { fontFamily: 'X', fontWeight: 700, fontSize: '12px' } },
    { name: 't900', $type: 'typography', $value: { fontFamily: 'X', fontWeight: 900, fontSize: '12px' } },
  ]);
  assert.match(out, /t100:[^\n]*\.weight\(\.ultraLight\)/);
  assert.match(out, /t400:[^\n]*\.weight\(\.regular\)/);
  assert.match(out, /t600:[^\n]*\.weight\(\.semibold\)/);
  assert.match(out, /t700:[^\n]*\.weight\(\.bold\)/);
  assert.match(out, /t900:[^\n]*\.weight\(\.black\)/);
});

test('falls back to Font.system when fontFamily missing', () => {
  const out = generateDSFont([
    { name: 'textCaption', $type: 'typography', $value: { fontWeight: 400, fontSize: '12px' } },
  ]);
  assert.match(
    out,
    /textCaption: Font = \{ _ = _registered; return Font\.system\(size: 12\)\.weight\(\.regular\) \}\(\)/,
  );
});

test('filters out non-typography tokens', () => {
  const out = generateDSFont([
    { name: 'colorsX', $type: 'color', $value: '#000000' },
    { name: 'textBodyM', $type: 'typography', $value: { fontFamily: 'X', fontWeight: 400, fontSize: '16px' } },
  ]);
  assert.doesNotMatch(out, /colorsX/);
  assert.match(out, /textBodyM/);
});
