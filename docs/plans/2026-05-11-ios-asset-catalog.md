# iOS Asset Catalog + DS Accessor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `design-system/ios/` raw Swift outputs (ColorsLight/Dark, Spacing, Typography) with Xcode Asset Catalog (`Assets.xcassets/Colors/*.colorset`) plus 4 DS-prefixed Swift accessor enums, absorbing the iOS app team's existing `swift_to_colorsets.py` / `swift_to_ds_tokens.py` conversion logic.

**Architecture:** Four new pure-function generators in `formats/`, each consuming the SD-transformed light/dark token arrays (produced by the existing `sdLight` / `sdDark` instances). `build.js` removes the old `ios` SD platform entries and instead runs post-build steps that call each generator and write outputs to disk. `Assets.xcassets/` is multi-file (1145 files: root + folder + 1143 colorsets), so the Asset Catalog generator returns a `Map<filepath, content>` and `build.js` iterates with `fs.mkdirSync` + `fs.writeFileSync`. Three DS accessor generators (color/spacing/font) return a single Swift string each.

**Tech Stack:** Node 20 (ESM), Style Dictionary v5 + sd-transforms, `node --test` (built-in runner), `node:assert/strict`.

**Spec:** `docs/specs/2026-05-11-ios-asset-catalog-design.md`

---

## File Structure

**New files (all in `formats/`):**
- `ios-asset-catalog.js` — `generateAssetCatalog({ lightColors, darkColors }) → { files: Map<string,string>, warnings: string[] }`. Pure; emits 1145 file paths + their JSON contents. Includes inline `parseColor` (hex + rgba) and `isPlainColor` (gradient skip) helpers — copied from current `formats/ios-colors.js` patterns to avoid cross-file dependency.
- `ios-asset-catalog.test.js` — fixture-based tests for: single-color light-only, light+dark different, light+dark same (dark entry omitted), dark-only with warning, gradient filter, 3-decimal component formatting.
- `ios-ds-color-accessor.js` — `generateDSColorAccessor(allTokens) → string`. Returns `DSColor+Generated.swift` content; alphabetically-sorted, deduped color names with `Color("name", bundle: .module)`.
- `ios-ds-color-accessor.test.js` — tests for: alphabetical order, gradient skip, deduplication, namespace declaration.
- `ios-ds-spacing.js` — `generateDSSpacing(allTokens) → { spacingContent, radiusContent }`. Filters `path[0]` regex + drops names containing `px` + renames (prefix-strip + `Nxl→xlN`) + dedups + emits two enum strings.
- `ios-ds-spacing.test.js` — tests for: pixel-alias filter, `spacingMd→md`, `spacing2xl→xl2`, `spacing10xl→xl10`, dedup, integer-vs-float value rendering, separate Spacing/Radius blocks.
- `ios-ds-font.js` — `generateDSFont(allTokens) → string`. Returns `DSFont+Generated.swift` content with `DSFontRegistration.register()` boilerplate + per-token lazy-init Font.
- `ios-ds-font.test.js` — tests for: lazy-init wrapper, `Font.custom` family, weight name mapping, CSS shorthand parsing, system-fallback when family missing.

**Deleted files:**
- `formats/ios-colors.js` + `ios-colors.test.js`
- `formats/ios-spacing.js` + `ios-spacing.test.js`
- `formats/ios-typography.js` + `ios-typography.test.js`
- `ios/ColorsLight.swift`, `ColorsDark.swift`, `Spacing.swift`, `Typography.swift` (existing raw outputs)

**Modified files:**
- `build.js` — removes the `ios` SD platform from both `sdLight` and `sdDark`, removes 3 register calls + 3 imports, adds 4 new imports + 4 post-build write blocks.
- `README.md` — new section documenting the new iOS output format and a sample sync script for downstream iOS apps.

**Generated outputs (~1149 files, committed):**
- `ios/Assets.xcassets/Contents.json` (root catalog meta)
- `ios/Assets.xcassets/Colors/Contents.json` (folder provider)
- `ios/Assets.xcassets/Colors/<name>.colorset/Contents.json` × 1143
- `ios/DSColor+Generated.swift`
- `ios/DSSpacing+Generated.swift`
- `ios/DSRadius+Generated.swift`
- `ios/DSFont+Generated.swift`

---

## Task 1: Asset Catalog generator

**Files:**
- Create: `formats/ios-asset-catalog.js`
- Create: `formats/ios-asset-catalog.test.js`

- [ ] **Step 1: Write the failing tests**

Create `formats/ios-asset-catalog.test.js`:

```js
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
    red: '0.337', green: '0.270', blue: '0.910', alpha: '1.000',
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/julee/imin/design-system
npm test
```

Expected: FAIL with `Cannot find module './ios-asset-catalog.js'`.

- [ ] **Step 3: Implement `formats/ios-asset-catalog.js`**

Create `formats/ios-asset-catalog.js`:

```js
const ROOT_DIR = 'ios/Assets.xcassets';
const COLORS_DIR = `${ROOT_DIR}/Colors`;

function isPlainColor(value) {
  return typeof value === 'string' && (value.startsWith('#') || /^rgba?\s*\(/i.test(value));
}

function parseColor(value) {
  if (typeof value !== 'string') return null;
  if (value.startsWith('#')) {
    let h = value.slice(1);
    if (h.length === 3) h = h.split('').map((c) => c + c).join('') + 'ff';
    else if (h.length === 6) h += 'ff';
    if (h.length !== 8) return null;
    return {
      r: parseInt(h.slice(0, 2), 16) / 255,
      g: parseInt(h.slice(2, 4), 16) / 255,
      b: parseInt(h.slice(4, 6), 16) / 255,
      a: parseInt(h.slice(6, 8), 16) / 255,
    };
  }
  const m = value.match(/^rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*(\d*\.?\d+)\s*)?\)$/i);
  if (!m) return null;
  return {
    r: Number(m[1]) / 255,
    g: Number(m[2]) / 255,
    b: Number(m[3]) / 255,
    a: m[4] !== undefined ? Number(m[4]) : 1,
  };
}

function fmt(n) {
  return n.toFixed(3);
}

function rgbaEqual(a, b) {
  return a.r === b.r && a.g === b.g && a.b === b.b && a.a === b.a;
}

function colorEntry(rgba, dark) {
  const entry = {
    idiom: 'universal',
    color: {
      'color-space': 'srgb',
      components: {
        red: fmt(rgba.r),
        green: fmt(rgba.g),
        blue: fmt(rgba.b),
        alpha: fmt(rgba.a),
      },
    },
  };
  if (dark) {
    entry.appearances = [{ appearance: 'luminosity', value: 'dark' }];
  }
  return entry;
}

function dumpJson(data) {
  return JSON.stringify(data, null, 2) + '\n';
}

function collectColors(tokens) {
  const out = new Map();
  for (const t of tokens) {
    if (t.$type !== 'color') continue;
    if (!isPlainColor(t.$value)) continue;
    const rgba = parseColor(t.$value);
    if (rgba) out.set(t.name, rgba);
  }
  return out;
}

export function generateAssetCatalog({ lightColors, darkColors }) {
  const files = new Map();
  const warnings = [];

  files.set(
    `${ROOT_DIR}/Contents.json`,
    dumpJson({ info: { author: 'xcode', version: 1 } }),
  );
  files.set(
    `${COLORS_DIR}/Contents.json`,
    dumpJson({ info: { author: 'xcode', version: 1 } }),
  );

  const lightByName = collectColors(lightColors);
  const darkByName = collectColors(darkColors);

  const allNames = new Set([...lightByName.keys(), ...darkByName.keys()]);

  for (const name of allNames) {
    const light = lightByName.get(name);
    const dark = darkByName.get(name);
    const entries = [];
    if (light) {
      entries.push(colorEntry(light, false));
      if (dark && !rgbaEqual(light, dark)) {
        entries.push(colorEntry(dark, true));
      }
    } else if (dark) {
      entries.push(colorEntry(dark, false));
      warnings.push(`'${name}' exists only in DarkColors — emitted as universal`);
    }

    const content = dumpJson({
      colors: entries,
      info: { author: 'xcode', version: 1 },
    });
    files.set(`${COLORS_DIR}/${name}.colorset/Contents.json`, content);
  }

  return { files, warnings };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test
```

Expected: 9 new tests pass + existing tests still pass.

- [ ] **Step 5: Commit**

```bash
git add formats/ios-asset-catalog.js formats/ios-asset-catalog.test.js
git commit -m "feat(ios): Asset Catalog generator (multi-file Contents.json emit)"
```

---

## Task 2: DSColor accessor generator

**Files:**
- Create: `formats/ios-ds-color-accessor.js`
- Create: `formats/ios-ds-color-accessor.test.js`

- [ ] **Step 1: Write the failing tests**

Create `formats/ios-ds-color-accessor.test.js`:

```js
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test
```

Expected: FAIL — `Cannot find module './ios-ds-color-accessor.js'`.

- [ ] **Step 3: Implement `formats/ios-ds-color-accessor.js`**

```js
function isPlainColor(value) {
  return typeof value === 'string' && (value.startsWith('#') || /^rgba?\s*\(/i.test(value));
}

export function generateDSColorAccessor(allTokens) {
  const names = allTokens
    .filter((t) => t.$type === 'color' && isPlainColor(t.$value))
    .map((t) => t.name);
  const sorted = [...new Set(names)].sort();
  const lines = sorted.map(
    (n) => `    public static let ${n} = Color("${n}", bundle: .module)`,
  );
  return `// Auto-generated by build.js — do not edit.
import SwiftUI

public enum DSColor {
${lines.join('\n')}
}
`;
}
```

- [ ] **Step 4: Run tests**

```bash
npm test
```

Expected: 6 new tests pass.

- [ ] **Step 5: Commit**

```bash
git add formats/ios-ds-color-accessor.js formats/ios-ds-color-accessor.test.js
git commit -m "feat(ios): DSColor+Generated.swift accessor generator"
```

---

## Task 3: DSSpacing + DSRadius generator

**Files:**
- Create: `formats/ios-ds-spacing.js`
- Create: `formats/ios-ds-spacing.test.js`

- [ ] **Step 1: Write the failing tests**

Create `formats/ios-ds-spacing.test.js`:

```js
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
  // Only one `none` declaration
  const matches = spacingContent.match(/let none:/g) || [];
  assert.equal(matches.length, 1);
  // Value is the later one (1)
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test
```

Expected: FAIL — `Cannot find module './ios-ds-spacing.js'`.

- [ ] **Step 3: Implement `formats/ios-ds-spacing.js`**

```js
import { stripPx, isNumericLike } from './utils.js';

const PIXEL_ALIAS_RE = /px/i;

function normalizeSemanticName(raw) {
  let name = raw;
  for (const prefix of ['spacing', 'radius']) {
    if (raw.toLowerCase().startsWith(prefix)) {
      name = raw.slice(prefix.length);
      name = (name.charAt(0).toLowerCase() + name.slice(1));
      break;
    }
  }
  // Numeric prefix swap: '2xl' → 'xl2', '10xl' → 'xl10'
  const m = name.match(/^(\d+)(xl)$/);
  if (m) name = `${m[2]}${m[1]}`;
  return name;
}

function dedup(pairs) {
  const seen = new Map();
  const result = [];
  for (const [n, v] of pairs) {
    if (seen.has(n)) {
      result[seen.get(n)] = [n, v];
    } else {
      seen.set(n, result.length);
      result.push([n, v]);
    }
  }
  return result;
}

function filterTokens(allTokens, pathPrefix, typeSet) {
  return allTokens.filter((t) => {
    const p0 = (t.path?.[0] || '').toLowerCase();
    return (
      typeSet.has(t.$type) &&
      pathPrefix.test(p0) &&
      isNumericLike(t.$value) &&
      !PIXEL_ALIAS_RE.test(t.name)
    );
  });
}

function renderEnum(enumName, tokens) {
  const renamed = tokens.map((t) => [normalizeSemanticName(t.name), stripPx(t.$value)]);
  const deduped = dedup(renamed);
  const lines = deduped.map(([n, v]) => {
    const num = Number(v);
    const valStr = Number.isFinite(num) && Number.isInteger(num) ? String(num) : String(v);
    return `    public static let ${n}: CGFloat = ${valStr}`;
  });
  return `// Auto-generated by build.js — do not edit.
import CoreGraphics

public enum ${enumName} {
${lines.join('\n')}
}
`;
}

const SPACING_TYPES = new Set(['number', 'dimension', 'spacing']);
const RADIUS_TYPES = new Set(['number', 'borderRadius']);

export function generateDSSpacing(allTokens) {
  const spacing = filterTokens(allTokens, /^spacing/, SPACING_TYPES);
  const radius = filterTokens(allTokens, /^radius/, RADIUS_TYPES);
  return {
    spacingContent: renderEnum('DSSpacing', spacing),
    radiusContent: renderEnum('DSRadius', radius),
  };
}
```

- [ ] **Step 4: Run tests**

```bash
npm test
```

Expected: 8 new tests pass.

- [ ] **Step 5: Commit**

```bash
git add formats/ios-ds-spacing.js formats/ios-ds-spacing.test.js
git commit -m "feat(ios): DSSpacing/DSRadius generator (semantic-only + rename + dedup)"
```

---

## Task 4: DSFont generator

**Files:**
- Create: `formats/ios-ds-font.js`
- Create: `formats/ios-ds-font.test.js`

- [ ] **Step 1: Write the failing tests**

Create `formats/ios-ds-font.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateDSFont } from './ios-ds-font.js';

test('emits SwiftUI import and DSFont enum with registration boilerplate', () => {
  const out = generateDSFont([]);
  assert.match(out, /import SwiftUI/);
  assert.match(out, /public enum DSFont \{/);
  assert.match(out, /private static let _registered: Void = DSFontRegistration\.register\(\)/);
});

test('emits lazy-init Font with _registered trigger for each token (object form)', () => {
  const out = generateDSFont([
    {
      name: 'textBodyM',
      $type: 'typography',
      $value: { fontFamily: 'Pretendard', fontWeight: 400, fontSize: '16px', lineHeight: '24px' },
    },
  ]);
  assert.match(
    out,
    /public static let textBodyM: Font = \{ _ = _registered; return Font\.custom\("Pretendard", size: 16\)\.weight\(\.regular\) \}\(\)/,
  );
});

test('parses CSS shorthand string form (SD v5 typography emit)', () => {
  const out = generateDSFont([
    { name: 'textDisplay', $type: 'typography', $value: '600 32px/40 Pretendard' },
  ]);
  assert.match(
    out,
    /public static let textDisplay: Font = \{ _ = _registered; return Font\.custom\("Pretendard", size: 32\)\.weight\(\.semibold\) \}\(\)/,
  );
});

test('maps fontWeight bands to SwiftUI Font.Weight', () => {
  const out = generateDSFont([
    { name: 't100', $type: 'typography', $value: { fontFamily: 'X', fontWeight: 100, fontSize: '12px' } },
    { name: 't400', $type: 'typography', $value: { fontFamily: 'X', fontWeight: 400, fontSize: '12px' } },
    { name: 't600', $type: 'typography', $value: { fontFamily: 'X', fontWeight: 600, fontSize: '12px' } },
    { name: 't700', $type: 'typography', $value: { fontFamily: 'X', fontWeight: 700, fontSize: '12px' } },
    { name: 't900', $type: 'typography', $value: { fontFamily: 'X', fontWeight: 900, fontSize: '12px' } },
  ]);
  assert.match(out, /t100:[^\n]*\.weight\(\.ultraLight\)/);
  assert.match(out, /t400:[^\n]*\.weight\(\.regular\)/);
  assert.match(out, /t600:[^\n]*\.weight\(\.semibold\)/);
  assert.match(out, /t700:[^\n]*\.weight\(\.bold\)/);
  assert.match(out, /t900:[^\n]*\.weight\(\.black\)/);
});

test('falls back to Font.system when fontFamily missing', () => {
  const out = generateDSFont([
    { name: 'textCaption', $type: 'typography', $value: { fontWeight: 400, fontSize: '12px' } },
  ]);
  assert.match(
    out,
    /textCaption: Font = \{ _ = _registered; return Font\.system\(size: 12\)\.weight\(\.regular\) \}\(\)/,
  );
});

test('filters out non-typography tokens', () => {
  const out = generateDSFont([
    { name: 'colorsX', $type: 'color', $value: '#000000' },
    { name: 'textBodyM', $type: 'typography', $value: { fontFamily: 'X', fontWeight: 400, fontSize: '16px' } },
  ]);
  assert.doesNotMatch(out, /colorsX/);
  assert.match(out, /textBodyM/);
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test
```

Expected: FAIL — `Cannot find module './ios-ds-font.js'`.

- [ ] **Step 3: Implement `formats/ios-ds-font.js`**

```js
import { stripPx } from './utils.js';

function weightToken(weight) {
  const n = Number(weight);
  if (n <= 200) return 'ultraLight';
  if (n <= 300) return 'light';
  if (n <= 400) return 'regular';
  if (n <= 500) return 'medium';
  if (n <= 600) return 'semibold';
  if (n <= 700) return 'bold';
  if (n <= 800) return 'heavy';
  return 'black';
}

function parseTypoValue(raw) {
  if (raw && typeof raw === 'object') return raw;
  if (typeof raw !== 'string') return {};
  const m = raw.match(/^\s*(\d+)\s+(-?\d+(?:\.\d+)?(?:px)?)(?:\/(-?\d+(?:\.\d+)?(?:px)?))?\s+(.+?)\s*$/);
  if (!m) return {};
  return {
    fontWeight: Number(m[1]),
    fontSize: m[2],
    lineHeight: m[3],
    fontFamily: m[4],
  };
}

export function generateDSFont(allTokens) {
  const typo = allTokens.filter((t) => t.$type === 'typography');
  const lines = typo.map((t) => {
    const v = parseTypoValue(t.$value);
    const size = stripPx(v.fontSize ?? '16');
    const weight = weightToken(v.fontWeight ?? 400);
    const fontExpr = v.fontFamily
      ? `Font.custom("${v.fontFamily}", size: ${size})`
      : `Font.system(size: ${size})`;
    return `    public static let ${t.name}: Font = { _ = _registered; return ${fontExpr}.weight(.${weight}) }()`;
  });

  return `// Auto-generated by build.js — do not edit.
import SwiftUI

public enum DSFont {
    // Pretendard 폰트 자동 등록 — 어떤 멤버에 처음 접근해도 1회 실행됨
    private static let _registered: Void = DSFontRegistration.register()

${lines.join('\n')}
}
`;
}
```

- [ ] **Step 4: Run tests**

```bash
npm test
```

Expected: 6 new tests pass.

- [ ] **Step 5: Commit**

```bash
git add formats/ios-ds-font.js formats/ios-ds-font.test.js
git commit -m "feat(ios): DSFont generator with DSFontRegistration lazy-init wrapper"
```

---

## Task 5: Rewire build.js + delete old format files + delete raw ios/*.swift

**Files:**
- Modify: `build.js`
- Delete: `formats/ios-colors.js` + `ios-colors.test.js`
- Delete: `formats/ios-spacing.js` + `ios-spacing.test.js`
- Delete: `formats/ios-typography.js` + `ios-typography.test.js`
- Delete: `ios/ColorsLight.swift`, `ColorsDark.swift`, `Spacing.swift`, `Typography.swift`

- [ ] **Step 1: Read current build.js iOS-related lines**

```bash
cd /Users/julee/imin/design-system
grep -n "ios\|Ios\|iOS\|ColorsLight\|ColorsDark\|Spacing\|Typography\|iosColors\|iosSpacing\|iosTypography" build.js | head -30
```

Note the locations of:
- Imports for `iosColorsFormatDef`, `iosSpacingFormatDef`, `iosTypographyFormatDef`
- `StyleDictionary.registerFormat(...)` calls for the 3 iOS formats
- `ios:` platform entries inside `sdLight.platforms` and `sdDark.platforms`

- [ ] **Step 2: Remove old iOS format imports and registrations from build.js**

In `build.js`:

1. Delete these import lines (top of file):
   ```js
   import { iosColorsFormatDef } from './formats/ios-colors.js';
   import { iosSpacingFormatDef } from './formats/ios-spacing.js';
   import { iosTypographyFormatDef } from './formats/ios-typography.js';
   ```

2. Delete these registration lines (near the top, after `register(StyleDictionary)`):
   ```js
   StyleDictionary.registerFormat(iosColorsFormatDef);
   StyleDictionary.registerFormat(iosSpacingFormatDef);
   StyleDictionary.registerFormat(iosTypographyFormatDef);
   ```

3. Delete the entire `ios:` platform block from `sdLight` (the platforms config object that contains `destination: 'ColorsLight.swift'`, `Spacing.swift`, `Typography.swift`).

4. Delete the entire `ios:` platform block from `sdDark` (contains `destination: 'ColorsDark.swift'`).

- [ ] **Step 3: Add new imports at the top of build.js**

```js
import { generateAssetCatalog } from './formats/ios-asset-catalog.js';
import { generateDSColorAccessor } from './formats/ios-ds-color-accessor.js';
import { generateDSSpacing } from './formats/ios-ds-spacing.js';
import { generateDSFont } from './formats/ios-ds-font.js';
```

Also confirm these are already imported (used by other code paths):
- `fs` (node:fs) — for `mkdirSync`, `writeFileSync`
- `path` — may not be imported yet; add `import path from 'node:path';` if missing

- [ ] **Step 4: Add the iOS post-build block to build.js**

After the existing `generateTokensTs` write block (look for `web/tokens.ts` write), add:

```js
// iOS — Asset Catalog (multi-file) + 4 DS accessors
console.log('iOS outputs:');

const lightAllTokens = lightDict.allTokens;
const darkAllTokens = darkDict.allTokens;

// 1) Asset Catalog: root meta + folder provider + 1143 colorset/Contents.json
const { files: catalogFiles, warnings: catalogWarnings } = generateAssetCatalog({
  lightColors: lightAllTokens,
  darkColors: darkAllTokens,
});
for (const [filepath, content] of catalogFiles) {
  fs.mkdirSync(path.dirname(filepath), { recursive: true });
  fs.writeFileSync(filepath, content);
}
for (const w of catalogWarnings) console.warn(`  ⚠ ${w}`);
console.log(`  ✓ ios/Assets.xcassets/ (${catalogFiles.size} files)`);

// 2) DSColor accessor
fs.writeFileSync('ios/DSColor+Generated.swift', generateDSColorAccessor(lightAllTokens));
console.log('  ✓ ios/DSColor+Generated.swift');

// 3) DSSpacing + DSRadius
const { spacingContent, radiusContent } = generateDSSpacing(lightAllTokens);
fs.writeFileSync('ios/DSSpacing+Generated.swift', spacingContent);
fs.writeFileSync('ios/DSRadius+Generated.swift', radiusContent);
console.log('  ✓ ios/DSSpacing+Generated.swift');
console.log('  ✓ ios/DSRadius+Generated.swift');

// 4) DSFont
fs.writeFileSync('ios/DSFont+Generated.swift', generateDSFont(lightAllTokens));
console.log('  ✓ ios/DSFont+Generated.swift');
```

Note: `lightDict` and `darkDict` should already be in scope from the existing `generateTokensTs` block. If they're not, add `const lightDict = await sdLight.getPlatformTokens('css');` and `const darkDict = await sdDark.getPlatformTokens('css');` near the top of the post-build region.

- [ ] **Step 5: Delete old raw iOS Swift outputs and old format files**

```bash
rm -f ios/ColorsLight.swift ios/ColorsDark.swift ios/Spacing.swift ios/Typography.swift
rm -f formats/ios-colors.js formats/ios-colors.test.js
rm -f formats/ios-spacing.js formats/ios-spacing.test.js
rm -f formats/ios-typography.js formats/ios-typography.test.js
```

- [ ] **Step 6: Build and verify**

```bash
npm run build
```

Expected: no errors. Output should include lines like `✓ ios/Assets.xcassets/ (1145 files)`, `✓ ios/DSColor+Generated.swift`, etc.

Verify the new outputs exist:

```bash
ls ios/
# Expected: Assets.xcassets/  DSColor+Generated.swift  DSFont+Generated.swift  DSRadius+Generated.swift  DSSpacing+Generated.swift
ls ios/Assets.xcassets/Colors/ | head
# Expected: Contents.json + <name>.colorset/ directories
find ios/Assets.xcassets/Colors -maxdepth 1 -type d -name '*.colorset' | wc -l
# Expected: ~1143
```

- [ ] **Step 7: Run all tests**

```bash
npm test
```

Expected: all tests pass (old ios-colors/spacing/typography tests removed; new tests pass; web-ts + android tests untouched).

- [ ] **Step 8: Commit the rewire + deletes**

```bash
git add -A
git commit -m "refactor(build): replace raw ios/*.swift with Asset Catalog + DS accessors

Removes the SD 'ios' platform from sdLight/sdDark and the three legacy
format modules (ios-colors/spacing/typography). Adds a post-build block
that calls the four new generators and writes:
  - ios/Assets.xcassets/Colors/*.colorset (1143 light+dark colorsets)
  - ios/DSColor+Generated.swift
  - ios/DSSpacing+Generated.swift / DSRadius+Generated.swift
  - ios/DSFont+Generated.swift

Old ColorsLight/Dark/Spacing/Typography.swift outputs are deleted —
downstream iOS apps should clone the new Assets.xcassets + DS accessor
files directly, dropping their swift→colorset conversion step."
```

---

## Task 6: README — new output format and downstream sync sample

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Read current README**

```bash
cat README.md
```

Note the existing sections (if any). The current README is very minimal (`# design-system\nfigma에서 token studio 연동 test git`).

- [ ] **Step 2: Append the new section**

Append to `README.md`:

```markdown
## Outputs

Each `npm run build` regenerates:

- `web/tokens.css`, `tokens-dark.css`, `tokens.ts` — CSS variables + typed TS const
- `android/LightColors.kt`, `DarkColors.kt`, `Spacing.kt`, `Typography.kt` — Compose objects
- `ios/Assets.xcassets/` + `ios/DS*+Generated.swift` — Xcode Asset Catalog + four DS-prefixed accessor enums (`DSColor`, `DSSpacing`, `DSRadius`, `DSFont`)

The iOS output is consumed directly — no client-side conversion needed. See **Downstream iOS sync** below.

## Downstream iOS sync (sample)

For an iOS Swift Package consumer (e.g., `imin-design-system` app), a 3-step sync script:

```bash
#!/usr/bin/env bash
set -euo pipefail

REPO_URL="https://github.com/twavetech-frontend/design-system.git"
BRANCH="main"
CACHE_DIR="$(pwd)/tokens-cache"
DEST_GENERATED="Packages/DesignSystem/Sources/DesignSystem/Generated"
DEST_ASSETS="Packages/DesignSystem/Sources/DesignSystem/Resources/Assets.xcassets"

# 1) Sparse-clone the ios/ directory
if [ -d "$CACHE_DIR/.git" ]; then
  git -C "$CACHE_DIR" fetch --depth=1 origin "$BRANCH"
  git -C "$CACHE_DIR" reset --hard "origin/$BRANCH"
else
  rm -rf "$CACHE_DIR"
  git clone --depth=1 --filter=blob:none --sparse --branch "$BRANCH" "$REPO_URL" "$CACHE_DIR"
  git -C "$CACHE_DIR" sparse-checkout set ios
fi

# 2) Copy Asset Catalog + DS accessor files
mkdir -p "$DEST_GENERATED" "$DEST_ASSETS"
find "$DEST_GENERATED" -maxdepth 1 -name "DS*+Generated.swift" -delete
cp "$CACHE_DIR/ios"/DS*+Generated.swift "$DEST_GENERATED/"
rm -rf "$DEST_ASSETS/Colors"
cp -r "$CACHE_DIR/ios/Assets.xcassets/." "$DEST_ASSETS/"

# 3) (Optional) Pretendard fonts — fetch directly from upstream; design-system does not vendor them
# curl -sLfo "$DEST_GENERATED/../Resources/Fonts/Pretendard-Regular.otf" \
#   "https://raw.githubusercontent.com/orioncactus/pretendard/v1.3.9/packages/pretendard/dist/public/static/Pretendard-Regular.otf"

# 4) Validate
swift build
```

The consumer is expected to provide its own `enum DSFontRegistration { static func register() { ... } }` somewhere in the same module — `DSFont+Generated.swift` calls `DSFontRegistration.register()` to wire up Pretendard once.
```

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs(readme): document new iOS Asset Catalog output + downstream sync sample"
```

---

## Task 7: End-to-end verification

**Files:** None (verification only)

- [ ] **Step 1: Clean rebuild from scratch**

```bash
rm -rf ios/
npm run build
```

Expected: no errors. New `ios/` directory tree is created.

- [ ] **Step 2: Inventory**

```bash
ls ios/
# Expected: Assets.xcassets/  DSColor+Generated.swift  DSFont+Generated.swift  DSRadius+Generated.swift  DSSpacing+Generated.swift
echo "Colorsets: $(find ios/Assets.xcassets/Colors -maxdepth 1 -type d -name '*.colorset' | wc -l)"
# Expected: ~1143
wc -l ios/DSColor+Generated.swift ios/DSSpacing+Generated.swift ios/DSRadius+Generated.swift ios/DSFont+Generated.swift
```

Expected counts (approximate, based on Phase 1):
- DSColor: ~1146 lines (1143 colors + 4 wrapper)
- DSSpacing: ~20 lines (semantic only, ~16 entries)
- DSRadius: ~17 lines (semantic only, ~13 entries)
- DSFont: ~50 lines (44 textStyles + wrapper + registration boilerplate)

- [ ] **Step 3: Spot-check a generated colorset**

```bash
cat ios/Assets.xcassets/Colors/colorsBgPrimary.colorset/Contents.json
```

Expected: well-formed JSON with `colors` (1 or 2 entries) and `info`. If light/dark differ, two entries (universal + dark appearance).

- [ ] **Step 4: Spot-check DS accessor swift files**

```bash
head -20 ios/DSColor+Generated.swift
head -20 ios/DSSpacing+Generated.swift
head -20 ios/DSFont+Generated.swift
```

Expected:
- DSColor starts with `import SwiftUI` and `public enum DSColor {`
- DSSpacing starts with `import CoreGraphics` and `public enum DSSpacing {` and contains entries like `public static let md: CGFloat = 8`
- DSFont contains `DSFontRegistration.register()` and `Font.custom("Pretendard", ...)` lazy-inits

- [ ] **Step 5: Optional Swift parse (if swiftc available)**

```bash
which swiftc 2>/dev/null && swiftc -parse ios/DSColor+Generated.swift ios/DSSpacing+Generated.swift ios/DSRadius+Generated.swift 2>&1 | head -20 || echo "swiftc not installed; skip"
```

Note: `DSFont+Generated.swift` references `DSFontRegistration` which doesn't exist in this isolated parse — `swiftc -parse` will fail on it. That's expected (the consumer provides it).

- [ ] **Step 6: Verify all tests pass**

```bash
npm test
```

Expected: all generator tests pass; no leftover old ios-* tests.

- [ ] **Step 7: Verify deleted files are not lingering**

```bash
ls formats/ | grep -E '^(ios-colors|ios-spacing|ios-typography)' && echo "STILL THERE" || echo "all old format files deleted ✓"
ls ios/ | grep -E '^(ColorsLight|ColorsDark|Spacing|Typography)\.swift$' && echo "STILL THERE" || echo "all old raw .swift files deleted ✓"
```

Both grep commands should return "all old ... files deleted ✓".

- [ ] **Step 8: No commit needed if everything clean**

If steps 1-7 surfaced any issue, fix and commit. Otherwise this task is verification-only.

---

## Self-Review Checklist (post-write)

- **Spec coverage:**
  - 출력 구조 (1143 colorsets + root + folder + 4 DS accessors) → Task 1 + Task 5
  - Light/Dark merge 룰 (omit dark when same, dark-only universal+warn) → Task 1
  - DSColor accessor (sorted, gradient skip, `Color("name", bundle: .module)`) → Task 2
  - DSSpacing/DSRadius (semantic only, prefix strip, `Nxl→xlN`, dedup) → Task 3
  - DSFont (lazy-init `_registered`, `DSFontRegistration.register()`) → Task 4
  - build.js rewire (remove old platform + register; add post-build) → Task 5
  - Delete legacy formats + raw .swift → Task 5
  - README sync sample → Task 6
  - End-to-end smoke verify → Task 7

- **Placeholder scan:** No TBD/TODO/incomplete; every code step has full code.

- **Type consistency:**
  - `generateAssetCatalog({ lightColors, darkColors }) → { files, warnings }` consistent across Task 1 and Task 5.
  - `generateDSColorAccessor(allTokens) → string` consistent across Task 2 and Task 5.
  - `generateDSSpacing(allTokens) → { spacingContent, radiusContent }` consistent across Task 3 and Task 5.
  - `generateDSFont(allTokens) → string` consistent across Task 4 and Task 5.
  - DSFontRegistration referenced as external dep in Task 4 and documented as consumer-supplied in Task 6.

## Open follow-ups (not blocking)

- iOS app team coordination: PR merge timing + iOS app's `sync-design-tokens.sh` update with the new 3-step form (sample in README).
- If iOS app has any direct consumers of `Spacing.xxs` / `Radius.xxs` etc. that we've renamed (now `none`, etc.), they will need to migrate. The DS accessor convention drops the prefix — same as the iOS team's existing `swift_to_ds_tokens.py` output, so consumers should already be on this form.
