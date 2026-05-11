import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateDSSpacing } from './ios-ds-spacing.js';

test('emits CoreGraphics import and DSSpacing/DSRadius enums', () => {
  const { spacingContent, radiusContent } = generateDSSpacing([
    { name: 'spacingMd', $type: 'number', $value: 8, path: ['spacing-md'] },
    { name: 'radiusXxs', $type: 'number', $value: 4, path: ['radius-xxs'] },
  ]);
  assert.match(spacingContent, /import CoreGraphics/);
  assert.match(spacingContent, /public enum DSSpacing \{/);
  assert.match(radiusContent, /public enum DSRadius \{/);
});

test('strips spacing/radius prefix and lowercases first char', () => {
  const { spacingContent, radiusContent } = generateDSSpacing([
    { name: 'spacingMd', $type: 'number', $value: 8, path: ['spacing-md'] },
    { name: 'radiusFull', $type: 'number', $value: 9999, path: ['radius-full'] },
  ]);
  assert.match(spacingContent, /public static let md: CGFloat = 8/);
  assert.match(radiusContent, /public static let full: CGFloat = 9999/);
});

test('swaps numeric-prefix xl: spacing2xl → xl2, spacing10xl → xl10', () => {
  const { spacingContent } = generateDSSpacing([
    { name: 'spacing2xl', $type: 'number', $value: 20, path: ['spacing-2xl'] },
    { name: 'spacing10xl', $type: 'number', $value: 128, path: ['spacing-10xl'] },
  ]);
  assert.match(spacingContent, /public static let xl2: CGFloat = 20/);
  assert.match(spacingContent, /public static let xl10: CGFloat = 128/);
});

test('filters out names containing "px" (pixel aliases)', () => {
  const { spacingContent } = generateDSSpacing([
    { name: 'spacing00px', $type: 'number', $value: 0, path: ['spacing-0-0px'] },
    { name: 'spacing14px', $type: 'number', $value: 4, path: ['spacing-1-4px'] },
    { name: 'spacingMd', $type: 'number', $value: 8, path: ['spacing-md'] },
  ]);
  assert.doesNotMatch(spacingContent, /spacing00px|spacing14px/);
  assert.match(spacingContent, /public static let md: CGFloat = 8/);
});

test('emits integer when value is whole, float string otherwise', () => {
  const { spacingContent } = generateDSSpacing([
    { name: 'spacingXs', $type: 'number', $value: 4, path: ['spacing-xs'] },
    { name: 'spacingHalf', $type: 'number', $value: 0.5, path: ['spacing-half'] },
  ]);
  assert.match(spacingContent, /xs: CGFloat = 4$/m);
  assert.match(spacingContent, /half: CGFloat = 0\.5/);
});

test('separates spacing and radius by path[0] regex', () => {
  const { spacingContent, radiusContent } = generateDSSpacing([
    { name: 'spacingMd', $type: 'number', $value: 8, path: ['spacing-md'] },
    { name: 'radiusXxs', $type: 'number', $value: 4, path: ['radius-xxs'] },
  ]);
  assert.match(spacingContent, /let md:/);
  assert.doesNotMatch(spacingContent, /let xxs:/);
  assert.match(radiusContent, /let xxs:/);
  assert.doesNotMatch(radiusContent, /let md:/);
});

test('dedups by normalized name (later wins, first-seen position preserved)', () => {
  const { spacingContent } = generateDSSpacing([
    { name: 'spacingNone', $type: 'number', $value: 0, path: ['spacing-none'] },
    { name: 'spacingNone', $type: 'number', $value: 1, path: ['spacing-none'] },
  ]);
  const matches = spacingContent.match(/let none:/g) || [];
  assert.equal(matches.length, 1);
  assert.match(spacingContent, /let none: CGFloat = 1/);
});

test('accepts $type variants (number, dimension, spacing, borderRadius)', () => {
  const { spacingContent, radiusContent } = generateDSSpacing([
    { name: 'spacingDimension', $type: 'dimension', $value: '8px', path: ['spacing-dim'] },
    { name: 'spacingNum', $type: 'number', $value: 4, path: ['spacing-num'] },
    { name: 'radiusBR', $type: 'borderRadius', $value: '4px', path: ['radius-br'] },
  ]);
  assert.match(spacingContent, /let dimension:/);
  assert.match(spacingContent, /let num:/);
  assert.match(radiusContent, /let bR:/);
});
