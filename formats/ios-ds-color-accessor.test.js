import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateDSColorAccessor } from './ios-ds-color-accessor.js';

test('emits Swift header and DSColor enum', () => {
  const out = generateDSColorAccessor([
    { name: 'colorsBaseWhite', $type: 'color', $value: '#ffffff' },
  ]);
  assert.match(out, /\/\/ Auto-generated/);
  assert.match(out, /import SwiftUI/);
  assert.match(out, /public enum DSColor \{/);
});

test('emits Color("name", bundle: .module) for each token', () => {
  const out = generateDSColorAccessor([
    { name: 'colorsBgPrimary', $type: 'color', $value: '#ffffff' },
  ]);
  assert.match(
    out,
    /public static let colorsBgPrimary = Color\("colorsBgPrimary", bundle: \.module\)/,
  );
});

test('sorts names alphabetically', () => {
  const out = generateDSColorAccessor([
    { name: 'colorsZ', $type: 'color', $value: '#000000' },
    { name: 'colorsA', $type: 'color', $value: '#000000' },
    { name: 'colorsM', $type: 'color', $value: '#000000' },
  ]);
  const aIdx = out.indexOf('colorsA');
  const mIdx = out.indexOf('colorsM');
  const zIdx = out.indexOf('colorsZ');
  assert.ok(aIdx < mIdx && mIdx < zIdx);
});

test('skips non-color tokens', () => {
  const out = generateDSColorAccessor([
    { name: 'colorsX', $type: 'color', $value: '#000000' },
    { name: 'spacingMd', $type: 'dimension', $value: '8px' },
  ]);
  assert.match(out, /colorsX/);
  assert.doesNotMatch(out, /spacingMd/);
});

test('skips gradient tokens', () => {
  const out = generateDSColorAccessor([
    { name: 'colorsX', $type: 'color', $value: '#000000' },
    { name: 'gradientBrand', $type: 'color', $value: 'linear-gradient(to right, #000, #fff)' },
  ]);
  assert.match(out, /colorsX/);
  assert.doesNotMatch(out, /gradientBrand/);
});

test('deduplicates by name', () => {
  const out = generateDSColorAccessor([
    { name: 'colorsX', $type: 'color', $value: '#000000' },
    { name: 'colorsX', $type: 'color', $value: '#ffffff' },
  ]);
  const matches = out.match(/colorsX/g) || [];
  // appears once in `let colorsX` and once in `Color("colorsX"...)` = 2 occurrences for one declaration
  assert.equal(matches.length, 2);
});
