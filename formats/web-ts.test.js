import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateTokensTs } from './web-ts.js';

test('emits colors.light and colors.dark sections', () => {
  const light = [
    { name: 'colorsBgPrimary', $type: 'color', $value: '#5645E8', path: ['Colors','bg','primary'] },
  ];
  const dark = [
    { name: 'colorsBgPrimary', $type: 'color', $value: '#7F7FFF', path: ['Colors','bg','primary'] },
  ];
  const out = generateTokensTs(light, dark);
  assert.match(out, /export const colors = \{/);
  assert.match(out, /light: \{/);
  assert.match(out, /dark: \{/);
  assert.match(out, /colorsBgPrimary: '#5645E8'/);
  assert.match(out, /colorsBgPrimary: '#7F7FFF'/);
});

test('emits spacing as numeric (strips px)', () => {
  const light = [
    { name: 'spacingS100', $type: 'dimension', $value: '4px', path: ['Spacing','s100'] },
  ];
  const out = generateTokensTs(light, []);
  assert.match(out, /export const spacing = \{/);
  assert.match(out, /spacingS100: 4,/);
});

test('emits radius separately from spacing', () => {
  const light = [
    { name: 'radiusR100', $type: 'borderRadius', $value: '4px', path: ['Radius','r100'] },
  ];
  const out = generateTokensTs(light, []);
  assert.match(out, /export const radius = \{/);
  assert.match(out, /radiusR100: 4,/);
});

test('emits typography as composite object', () => {
  const light = [
    {
      name: 'textBodyM',
      $type: 'typography',
      $value: { fontFamily: 'Pretendard', fontWeight: 400, fontSize: '16px', lineHeight: '24px' },
      path: ['textStyles','body','m'],
    },
  ];
  const out = generateTokensTs(light, []);
  assert.match(out, /export const typography = \{/);
  assert.match(out, /textBodyM: \{/);
  assert.match(out, /fontSize: 16/);
  assert.match(out, /lineHeight: 24/);
});

test('exports type aliases', () => {
  const out = generateTokensTs([], []);
  assert.match(out, /export type ColorToken = keyof typeof colors\.light/);
  assert.match(out, /export type SpacingToken = keyof typeof spacing/);
});

test('parses SD v5 CSS font shorthand string', () => {
  const light = [{
    name: 'display2xlRegular',
    $type: 'typography',
    $value: '400 72px/90 Pretendard',
    path: ['Display 2xl', 'Regular'],
  }];
  const out = generateTokensTs(light, []);
  assert.match(out, /fontFamily: 'Pretendard'/);
  assert.match(out, /fontWeight: 400/);
  assert.match(out, /fontSize: 72/);
  assert.match(out, /lineHeight: 90/);
});
