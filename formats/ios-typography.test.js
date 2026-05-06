import { test } from 'node:test';
import assert from 'node:assert/strict';
import { iosTypographyFormat } from './ios-typography.js';

const fakeDict = {
  allTokens: [
    {
      name: 'textBodyM',
      $type: 'typography',
      $value: { fontFamily: 'Pretendard', fontWeight: 400, fontSize: '16px', lineHeight: '24px' },
    },
    {
      name: 'textHeadingL',
      $type: 'typography',
      $value: { fontFamily: 'Pretendard', fontWeight: 600, fontSize: '24px', lineHeight: '32px' },
    },
    { name: 'colorsBgPrimary', $type: 'color', $value: '#fff' },
  ],
};

test('emits SwiftUI import and Font extension', () => {
  const out = iosTypographyFormat({ dictionary: fakeDict });
  assert.match(out, /import SwiftUI/);
  assert.match(out, /public extension Font \{/);
});

test('emits each typography token as Font.custom', () => {
  const out = iosTypographyFormat({ dictionary: fakeDict });
  assert.match(out, /static let textBodyM = Font\.custom\("Pretendard", size: 16\)\.weight\(\.regular\)/);
  assert.match(out, /static let textHeadingL = Font\.custom\("Pretendard", size: 24\)\.weight\(\.semibold\)/);
});

test('falls back to Font.system when fontFamily missing', () => {
  const dict = {
    allTokens: [
      { name: 'textCaption', $type: 'typography', $value: { fontWeight: 400, fontSize: '12px' } },
    ],
  };
  const out = iosTypographyFormat({ dictionary: dict });
  assert.match(out, /static let textCaption = Font\.system\(size: 12\)\.weight\(\.regular\)/);
});

test('parses SD v5 CSS font shorthand string', () => {
  const dict = {
    allTokens: [
      { name: 'textDisplay', $type: 'typography', $value: '600 32px/40 Pretendard' },
    ],
  };
  const out = iosTypographyFormat({ dictionary: dict });
  assert.match(out, /static let textDisplay = Font\.custom\("Pretendard", size: 32\)\.weight\(\.semibold\)/);
});

test('filters out non-typography tokens', () => {
  const out = iosTypographyFormat({ dictionary: fakeDict });
  assert.doesNotMatch(out, /colorsBgPrimary/);
});
