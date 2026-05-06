import { test } from 'node:test';
import assert from 'node:assert/strict';
import { androidSpacingFormat } from './android-spacing.js';

const fakeDict = {
  allTokens: [
    { name: 'spacingS100', $type: 'dimension', $value: '4px', path: ['Spacing', 's100'] },
    { name: 'spacingS200', $type: 'dimension', $value: '8px', path: ['Spacing', 's200'] },
    { name: 'radiusR100', $type: 'borderRadius', $value: '4px', path: ['Radius', 'r100'] },
    { name: 'colorsBgPrimary', $type: 'color', $value: '#fff', path: ['Colors','bg','primary'] },
  ],
};

test('emits package and Dp import', () => {
  const out = androidSpacingFormat({ dictionary: fakeDict });
  assert.match(out, /package com\.imin\.designsystem\.tokens/);
  assert.match(out, /import androidx\.compose\.ui\.unit\.dp/);
});

test('emits Spacing object with .dp values', () => {
  const out = androidSpacingFormat({ dictionary: fakeDict });
  assert.match(out, /object Spacing \{/);
  assert.match(out, /val spacingS100 = 4\.dp/);
  assert.match(out, /val spacingS200 = 8\.dp/);
});

test('emits Radius object with .dp values', () => {
  const out = androidSpacingFormat({ dictionary: fakeDict });
  assert.match(out, /object Radius \{/);
  assert.match(out, /val radiusR100 = 4\.dp/);
});

test('handles plain number $value (real SD v5 output)', () => {
  const dict = {
    allTokens: [
      { name: 'spacingNone', $type: 'number', $value: 0, path: ['spacing-none'] },
      { name: 'spacingMd', $type: 'number', $value: 8, path: ['spacing-md'] },
      { name: 'radiusNone', $type: 'number', $value: 0, path: ['radius-none'] },
    ],
  };
  const out = androidSpacingFormat({ dictionary: dict });
  assert.match(out, /val spacingNone = 0\.dp/);
  assert.match(out, /val spacingMd = 8\.dp/);
  assert.match(out, /val radiusNone = 0\.dp/);
});

test('filters out color tokens', () => {
  const out = androidSpacingFormat({ dictionary: fakeDict });
  assert.doesNotMatch(out, /colorsBgPrimary/);
});
