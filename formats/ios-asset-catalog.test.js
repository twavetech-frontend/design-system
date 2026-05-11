import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateAssetCatalog } from './ios-asset-catalog.js';

const ROOT = 'ios/Assets.xcassets/Contents.json';
const COLORS_ROOT = 'ios/Assets.xcassets/Colors/Contents.json';
const path = (name) => `ios/Assets.xcassets/Colors/${name}.colorset/Contents.json`;

test('emits root catalog and folder provider meta files', () => {
  const { files } = generateAssetCatalog({ lightColors: [], darkColors: [] });
  assert.ok(files.has(ROOT));
  assert.ok(files.has(COLORS_ROOT));
  const root = JSON.parse(files.get(ROOT));
  assert.deepEqual(root, { info: { author: 'xcode', version: 1 } });
});

test('emits a colorset with light universal entry only', () => {
  const light = [{ name: 'colorsBgPrimary', $type: 'color', $value: '#5645e8' }];
  const { files } = generateAssetCatalog({ lightColors: light, darkColors: [] });
  const content = JSON.parse(files.get(path('colorsBgPrimary')));
  assert.equal(content.colors.length, 1);
  assert.equal(content.colors[0].idiom, 'universal');
  assert.equal(content.colors[0].appearances, undefined);
  assert.deepEqual(content.colors[0].color.components, {
    red: '0.337', green: '0.271', blue: '0.910', alpha: '1.000',
  });
});

test('appends dark entry when dark differs from light', () => {
  const light = [{ name: 'colorsBgPrimary', $type: 'color', $value: '#5645e8' }];
  const dark = [{ name: 'colorsBgPrimary', $type: 'color', $value: '#7f7fff' }];
  const { files } = generateAssetCatalog({ lightColors: light, darkColors: dark });
  const content = JSON.parse(files.get(path('colorsBgPrimary')));
  assert.equal(content.colors.length, 2);
  assert.equal(content.colors[0].appearances, undefined);
  assert.deepEqual(content.colors[1].appearances, [
    { appearance: 'luminosity', value: 'dark' },
  ]);
});

test('omits dark entry when dark equals light', () => {
  const light = [{ name: 'colorsBaseWhite', $type: 'color', $value: '#ffffff' }];
  const dark = [{ name: 'colorsBaseWhite', $type: 'color', $value: '#ffffff' }];
  const { files } = generateAssetCatalog({ lightColors: light, darkColors: dark });
  const content = JSON.parse(files.get(path('colorsBaseWhite')));
  assert.equal(content.colors.length, 1);
});

test('emits dark-only token as universal entry with warning', () => {
  const dark = [{ name: 'colorsDarkOnly', $type: 'color', $value: '#000000' }];
  const { files, warnings } = generateAssetCatalog({ lightColors: [], darkColors: dark });
  const content = JSON.parse(files.get(path('colorsDarkOnly')));
  assert.equal(content.colors.length, 1);
  assert.equal(content.colors[0].appearances, undefined);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /colorsDarkOnly/);
});

test('skips gradient tokens whose $value is linear-gradient(...)', () => {
  const light = [
    { name: 'colorsBgPrimary', $type: 'color', $value: '#5645e8' },
    { name: 'gradientBrand', $type: 'color', $value: 'linear-gradient(to right, #5645e8, #7f7fff)' },
  ];
  const { files } = generateAssetCatalog({ lightColors: light, darkColors: [] });
  assert.ok(files.has(path('colorsBgPrimary')));
  assert.ok(!files.has(path('gradientBrand')));
});

test('parses rgba() values (SD v5 emits alpha tokens as rgba)', () => {
  const light = [{ name: 'colorsOverlay', $type: 'color', $value: 'rgba(255, 255, 255, 0.5)' }];
  const { files } = generateAssetCatalog({ lightColors: light, darkColors: [] });
  const content = JSON.parse(files.get(path('colorsOverlay')));
  assert.deepEqual(content.colors[0].color.components, {
    red: '1.000', green: '1.000', blue: '1.000', alpha: '0.500',
  });
});

test('parses 3-digit hex shorthand', () => {
  const light = [{ name: 'colorsShort', $type: 'color', $value: '#abc' }];
  const { files } = generateAssetCatalog({ lightColors: light, darkColors: [] });
  const content = JSON.parse(files.get(path('colorsShort')));
  // #abc → #aabbcc → r=0xaa/255, g=0xbb/255, b=0xcc/255 (alpha defaults to 1.000)
  assert.deepEqual(content.colors[0].color.components, {
    red: '0.667', green: '0.733', blue: '0.800', alpha: '1.000',
  });
});

test('rounds components to 3 decimal places', () => {
  const light = [{ name: 'colorsX', $type: 'color', $value: '#131722' }];
  const { files } = generateAssetCatalog({ lightColors: light, darkColors: [] });
  const content = JSON.parse(files.get(path('colorsX')));
  // 0x13/255 = 0.0745..., 0x17/255 = 0.0901..., 0x22/255 = 0.1333...
  assert.deepEqual(content.colors[0].color.components, {
    red: '0.075', green: '0.090', blue: '0.133', alpha: '1.000',
  });
});

test('preserves "colors" before "info" key order in colorset JSON', () => {
  const light = [{ name: 'colorsX', $type: 'color', $value: '#000000' }];
  const { files } = generateAssetCatalog({ lightColors: light, darkColors: [] });
  const raw = files.get(path('colorsX'));
  const colorsIdx = raw.indexOf('"colors"');
  const infoIdx = raw.indexOf('"info"');
  assert.ok(colorsIdx >= 0 && infoIdx >= 0);
  assert.ok(colorsIdx < infoIdx);
});
