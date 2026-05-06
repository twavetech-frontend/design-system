import { test } from 'node:test';
import assert from 'node:assert/strict';
import { iosColorsFormat } from './ios-colors.js';

const fakeDict = {
  allTokens: [
    { name: 'colorsBgPrimary', $type: 'color', $value: '#5645E8' },
    { name: 'colorsTextPrimary', $type: 'color', $value: '#131722' },
    { name: 'spacingS100', $type: 'dimension', $value: '4px' },  // should be filtered out
  ],
};

test('emits SwiftUI imports and namespace enum', () => {
  const out = iosColorsFormat({ dictionary: fakeDict, options: { namespace: 'LightColors' } });
  assert.match(out, /import SwiftUI/);
  assert.match(out, /public enum LightColors \{/);
});

test('emits each color as static let with Color literal', () => {
  const out = iosColorsFormat({ dictionary: fakeDict, options: { namespace: 'LightColors' } });
  assert.match(out, /public static let colorsBgPrimary = Color\(red: 0\.337[\d]*, green: 0\.270[\d]*, blue: 0\.909[\d]*\)/);
  assert.match(out, /public static let colorsTextPrimary = Color\(red: 0\.07[\d]*, green: 0\.090[\d]*, blue: 0\.133[\d]*\)/);
});

test('filters out non-color tokens', () => {
  const out = iosColorsFormat({ dictionary: fakeDict, options: { namespace: 'LightColors' } });
  assert.doesNotMatch(out, /spacingS100/);
});

test('handles 8-digit hex with alpha', () => {
  const dict = { allTokens: [{ name: 'colorsBgOverlay', $type: 'color', $value: '#000000aa' }] };
  const out = iosColorsFormat({ dictionary: dict, options: { namespace: 'LightColors' } });
  assert.match(out, /Color\(red: 0(?:\.0+)?, green: 0(?:\.0+)?, blue: 0(?:\.0+)?, opacity: 0\.66[\d]*\)/);
});
