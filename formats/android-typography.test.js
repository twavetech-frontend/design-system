import { test } from 'node:test';
import assert from 'node:assert/strict';
import { androidTypographyFormat } from './android-typography.js';

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

test('emits package and TextStyle imports', () => {
  const out = androidTypographyFormat({ dictionary: fakeDict });
  assert.match(out, /package com\.imin\.designsystem\.tokens/);
  assert.match(out, /import androidx\.compose\.ui\.text\.TextStyle/);
  assert.match(out, /import androidx\.compose\.ui\.text\.font\.FontWeight/);
  assert.match(out, /import androidx\.compose\.ui\.unit\.sp/);
});

test('emits Typography object with TextStyle values', () => {
  const out = androidTypographyFormat({ dictionary: fakeDict });
  assert.match(out, /object Typography \{/);
  assert.match(out, /val textBodyM = TextStyle\(/);
  assert.match(out, /fontSize = 16\.sp/);
  assert.match(out, /fontWeight = FontWeight\.Normal/);
  assert.match(out, /lineHeight = 24\.sp/);
});

test('maps weight 600 to FontWeight.SemiBold', () => {
  const out = androidTypographyFormat({ dictionary: fakeDict });
  assert.match(out, /fontWeight = FontWeight\.SemiBold/);
});

test('parses SD v5 CSS font shorthand string', () => {
  const dict = {
    allTokens: [
      { name: 'textDisplay', $type: 'typography', $value: '700 32px/40 Pretendard' },
    ],
  };
  const out = androidTypographyFormat({ dictionary: dict });
  assert.match(out, /val textDisplay = TextStyle\(/);
  assert.match(out, /fontSize = 32\.sp/);
  assert.match(out, /fontWeight = FontWeight\.Bold/);
  assert.match(out, /lineHeight = 40\.sp/);
});

test('filters out non-typography tokens', () => {
  const out = androidTypographyFormat({ dictionary: fakeDict });
  assert.doesNotMatch(out, /colorsBgPrimary/);
});
