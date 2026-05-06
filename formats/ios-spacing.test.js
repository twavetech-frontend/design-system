import { test } from 'node:test';
import assert from 'node:assert/strict';
import { iosSpacingFormat } from './ios-spacing.js';

const fakeDict = {
  allTokens: [
    { name: 'spacingS100', $type: 'dimension', $value: '4px', path: ['Spacing', 's100'] },
    { name: 'spacingS200', $type: 'dimension', $value: '8px', path: ['Spacing', 's200'] },
    { name: 'radiusR100', $type: 'borderRadius', $value: '4px', path: ['Radius', 'r100'] },
    { name: 'colorsBgPrimary', $type: 'color', $value: '#fff', path: ['Colors','bg','primary'] },  // filtered out
  ],
};

test('emits CoreGraphics import', () => {
  const out = iosSpacingFormat({ dictionary: fakeDict });
  assert.match(out, /import CoreGraphics/);
});

test('emits Spacing enum with dimension tokens', () => {
  const out = iosSpacingFormat({ dictionary: fakeDict });
  assert.match(out, /public enum Spacing \{/);
  assert.match(out, /public static let spacingS100: CGFloat = 4/);
  assert.match(out, /public static let spacingS200: CGFloat = 8/);
});

test('emits Radius enum with borderRadius tokens', () => {
  const out = iosSpacingFormat({ dictionary: fakeDict });
  assert.match(out, /public enum Radius \{/);
  assert.match(out, /public static let radiusR100: CGFloat = 4/);
});

test('filters out color tokens', () => {
  const out = iosSpacingFormat({ dictionary: fakeDict });
  assert.doesNotMatch(out, /colorsBgPrimary/);
});
