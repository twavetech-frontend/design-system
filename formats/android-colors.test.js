import { test } from 'node:test';
import assert from 'node:assert/strict';
import { androidColorsFormat } from './android-colors.js';

const fakeDict = {
  allTokens: [
    { name: 'colorsBgPrimary', $type: 'color', $value: '#5645E8' },
    { name: 'colorsTextPrimary', $type: 'color', $value: '#131722' },
    { name: 'spacingS100', $type: 'dimension', $value: '4px' },  // filtered
  ],
};

test('emits Kotlin package and Compose Color import', () => {
  const out = androidColorsFormat({ dictionary: fakeDict, options: { objectName: 'LightColors' } });
  assert.match(out, /package com\.imin\.designsystem\.tokens/);
  assert.match(out, /import androidx\.compose\.ui\.graphics\.Color/);
});

test('emits object with named colors as 0xFFRRGGBB', () => {
  const out = androidColorsFormat({ dictionary: fakeDict, options: { objectName: 'LightColors' } });
  assert.match(out, /object LightColors \{/);
  assert.match(out, /val colorsBgPrimary = Color\(0xFF5645E8\)/);
  assert.match(out, /val colorsTextPrimary = Color\(0xFF131722\)/);
});

test('handles 8-digit hex with alpha (#RRGGBBAA → 0xAARRGGBB)', () => {
  const dict = { allTokens: [{ name: 'colorsBgOverlay', $type: 'color', $value: '#000000aa' }] };
  const out = androidColorsFormat({ dictionary: dict, options: { objectName: 'LightColors' } });
  assert.match(out, /val colorsBgOverlay = Color\(0xAA000000\)/);
});

test('handles rgba() values emitted by SD v5 for alpha tokens', () => {
  const dict = { allTokens: [
    { name: 'colorsOverlay', $type: 'color', $value: 'rgba(255, 255, 255, 0.5)' },
  ]};
  const out = androidColorsFormat({ dictionary: dict, options: { objectName: 'LightColors' } });
  // 0.5 alpha → 128 (0x80), white = 0xFFFFFF
  assert.match(out, /val colorsOverlay = Color\(0x80FFFFFF\)/);
});

test('filters out gradient tokens ($type=color but value is linear-gradient)', () => {
  const dict = { allTokens: [
    { name: 'gradientBrand', $type: 'color', $value: 'linear-gradient(to right, #5645E8, #7F7FFF)' },
    { name: 'colorsTextPrimary', $type: 'color', $value: '#131722' },
  ]};
  const out = androidColorsFormat({ dictionary: dict, options: { objectName: 'LightColors' } });
  assert.doesNotMatch(out, /gradientBrand/);
  assert.match(out, /colorsTextPrimary/);
});

test('filters out non-color tokens', () => {
  const out = androidColorsFormat({ dictionary: fakeDict, options: { objectName: 'LightColors' } });
  assert.doesNotMatch(out, /spacingS100/);
});
