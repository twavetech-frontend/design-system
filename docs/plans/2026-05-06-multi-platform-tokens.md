# Multi-Platform Tokens Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate iOS (SwiftUI), Android (Compose), and Web (CSS + TypeScript) token files from `tokens.json`, auto-built and committed by GitHub Actions whenever Token Studio pushes a change.

**Architecture:** Style Dictionary v5 + sd-transforms, with custom format functions per platform. Light/dark colors are produced by two separate SD instances (already in place). Non-color tokens (spacing, radius, typography) are produced once. A pure-function generator handles `web/tokens.ts` after both light/dark dictionaries are exported. Everything wires into a single `build.js`. CI runs the build on `tokens.json` push, then `[skip ci]` auto-commits the regenerated outputs.

**Tech Stack:** Node 20 (ESM), Style Dictionary v5, @tokens-studio/sd-transforms, `node --test` (built-in test runner), GitHub Actions.

**Spec:** `docs/specs/2026-05-06-multi-platform-tokens-design.md`

---

## File Structure

**New files:**
- `formats/web-ts.js` — pure function `generateTokensTs(lightTokens, darkTokens) → string`
- `formats/ios-colors.js` — SD format `ios/colors-namespace`, takes `namespace` option
- `formats/ios-spacing.js` — SD format `ios/spacing-radius`
- `formats/ios-typography.js` — SD format `ios/typography-font`
- `formats/android-colors.js` — SD format `android/compose-colors`, takes `objectName` option
- `formats/android-spacing.js` — SD format `android/compose-spacing`
- `formats/android-typography.js` — SD format `android/compose-typography`
- `formats/*.test.js` — co-located unit tests
- `.github/workflows/build-tokens.yml`

**Modified files:**
- `build.js` — orchestrates all platforms, registers formats, generates tokens.ts post-build
- `package.json` — `scripts.build`, `scripts.test`

**Deleted files:**
- `config.json` — stale, unused (build.js doesn't read it)
- `build/` directory contents — moved to `web/`

**Generated outputs (committed to repo, written by CI):**
- `web/tokens.css`, `web/tokens-dark.css`, `web/tokens.ts`
- `ios/ColorsLight.swift`, `ios/ColorsDark.swift`, `ios/Spacing.swift`, `ios/Typography.swift`
- `android/LightColors.kt`, `android/DarkColors.kt`, `android/Spacing.kt`, `android/Typography.kt`

---

## Task 1: Relocate CSS output to `web/`

**Goal:** Preserve current CSS content; only the output path changes from `build/css/` to `web/`. Delete unused `config.json`.

**Files:**
- Modify: `build.js` (lines 95, 115)
- Delete: `config.json`
- Delete: `build/css/` contents (will be regenerated to `web/`)

- [ ] **Step 1: Update build.js paths**

In `build.js`, change both `buildPath` from `'build/css/'` to `'web/'`:

```js
// line 95 (sdLight platform config)
buildPath: 'web/',

// line 115 (sdDark platform config)
buildPath: 'web/',
```

- [ ] **Step 2: Delete stale config.json**

```bash
rm config.json
```

It's a leftover from `style-dictionary init` that build.js never reads (build.js loads `tokens.json` directly and configures SD programmatically).

- [ ] **Step 3: Run build and verify outputs**

```bash
npm run build
ls web/
```

Expected: `web/tokens.css` and `web/tokens-dark.css` exist with the same content as `build/css/tokens.css` and `build/css/tokens-dark.css` had.

- [ ] **Step 4: Sanity check content matches old output**

```bash
diff build/css/tokens.css web/tokens.css
diff build/css/tokens-dark.css web/tokens-dark.css
```

Expected: `diff` exits 0 (no differences) for both. If any difference, investigate before continuing.

- [ ] **Step 5: Remove the old `build/` directory**

```bash
rm -rf build
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor(build): relocate css output build/css/ → web/, drop unused config.json"
```

---

## Task 2: Add Web TypeScript output

**Goal:** Generate `web/tokens.ts` containing typed `colors.light` / `colors.dark`, `spacing`, `radius`, and `typography` const objects from both light + dark dictionaries.

**Files:**
- Create: `formats/web-ts.js`
- Create: `formats/web-ts.test.js`
- Modify: `build.js` (add post-build TS generation after both SD instances run)
- Modify: `package.json` (add `test` script)

- [ ] **Step 1: Add `test` script to package.json**

In `package.json`, replace the existing `"test"` line under `scripts`:

```json
"test": "node --test formats/"
```

- [ ] **Step 2: Write the failing test**

Create `formats/web-ts.test.js`:

```js
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
```

- [ ] **Step 3: Run test to verify it fails**

```bash
npm test
```

Expected: FAIL — `Cannot find module './web-ts.js'`.

- [ ] **Step 4: Implement `formats/web-ts.js`**

Create `formats/web-ts.js`:

```js
/**
 * Pure function: generate web/tokens.ts content from light + dark transformed token arrays.
 *
 * Inputs are SD-transformed tokens (post-name-camelCase, post-reference-resolve).
 * Each token has: name (string), $type (string), $value (string|object), path (string[]).
 */
export function generateTokensTs(lightTokens, darkTokens) {
  const lightColors = lightTokens.filter((t) => t.$type === 'color');
  const darkColors = darkTokens.filter((t) => t.$type === 'color');
  const spacing = lightTokens.filter((t) => t.$type === 'dimension' || t.$type === 'spacing');
  const radius = lightTokens.filter((t) => t.$type === 'borderRadius');
  const typography = lightTokens.filter((t) => t.$type === 'typography');

  const stripPx = (v) => {
    if (typeof v !== 'string') return v;
    const m = v.match(/^(-?\d+(?:\.\d+)?)px$/);
    return m ? Number(m[1]) : v;
  };

  const colorEntries = (tokens) =>
    tokens.map((t) => `    ${t.name}: '${t.$value}',`).join('\n');

  const dimEntries = (tokens) =>
    tokens.map((t) => `  ${t.name}: ${stripPx(t.$value)},`).join('\n');

  const typoEntries = (tokens) =>
    tokens.map((t) => {
      const v = t.$value || {};
      const parts = [];
      if (v.fontFamily) parts.push(`fontFamily: '${v.fontFamily}'`);
      if (v.fontWeight) parts.push(`fontWeight: ${typeof v.fontWeight === 'number' ? v.fontWeight : `'${v.fontWeight}'`}`);
      if (v.fontSize) parts.push(`fontSize: ${stripPx(v.fontSize)}`);
      if (v.lineHeight) parts.push(`lineHeight: ${stripPx(v.lineHeight)}`);
      if (v.letterSpacing) parts.push(`letterSpacing: ${stripPx(v.letterSpacing)}`);
      return `  ${t.name}: { ${parts.join(', ')} },`;
    }).join('\n');

  return `// Auto-generated by build.js — do not edit.
export const colors = {
  light: {
${colorEntries(lightColors)}
  },
  dark: {
${colorEntries(darkColors)}
  },
} as const;

export const spacing = {
${dimEntries(spacing)}
} as const;

export const radius = {
${dimEntries(radius)}
} as const;

export const typography = {
${typoEntries(typography)}
} as const;

export type ColorToken = keyof typeof colors.light;
export type SpacingToken = keyof typeof spacing;
export type RadiusToken = keyof typeof radius;
export type TypographyToken = keyof typeof typography;
`;
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npm test
```

Expected: PASS — all 5 tests.

- [ ] **Step 6: Wire into build.js**

In `build.js`, add at the top:

```js
import { generateTokensTs } from './formats/web-ts.js';
```

Then after both `await sdLight.buildAllPlatforms()` and `await sdDark.buildAllPlatforms()` calls, before the final `console.log`, add:

```js
// Generate web/tokens.ts (combined light+dark) using transformed dictionaries
const lightDict = await sdLight.getPlatformTokens('css');
const darkDict = await sdDark.getPlatformTokens('css');
fs.writeFileSync('web/tokens.ts', generateTokensTs(lightDict.allTokens, darkDict.allTokens));
console.log('✓ web/tokens.ts (light + dark merged)');
```

- [ ] **Step 7: Run build and inspect tokens.ts**

```bash
npm run build
head -30 web/tokens.ts
```

Expected: `colors.light` block with hex values, `colors.dark` block with different hex values, `spacing`, `radius`, `typography` blocks, type exports at bottom.

- [ ] **Step 8: Commit**

```bash
git add formats/web-ts.js formats/web-ts.test.js build.js package.json web/tokens.ts
git commit -m "feat(web): add tokens.ts with typed light/dark colors + spacing/radius/typography"
```

---

## Task 3: Add iOS Color outputs (Light + Dark)

**Goal:** Generate `ios/ColorsLight.swift` and `ios/ColorsDark.swift` as SwiftUI `Color` namespaced enums.

**Files:**
- Create: `formats/ios-colors.js`
- Create: `formats/ios-colors.test.js`
- Modify: `build.js` (register format, add iOS platform to both sdLight and sdDark)

- [ ] **Step 1: Write the failing test**

Create `formats/ios-colors.test.js`:

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test
```

Expected: FAIL — `Cannot find module './ios-colors.js'`.

- [ ] **Step 3: Implement `formats/ios-colors.js`**

Create `formats/ios-colors.js`:

```js
/**
 * Style Dictionary format: SwiftUI Color namespace enum.
 *
 * Options:
 *   namespace — e.g., 'LightColors' or 'DarkColors'
 */
function hexToRgba(hex) {
  const h = hex.replace('#', '');
  const full = h.length === 3
    ? h.split('').map((c) => c + c).join('') + 'ff'
    : h.length === 6 ? h + 'ff' : h;
  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;
  const a = parseInt(full.slice(6, 8), 16) / 255;
  return { r, g, b, a };
}

function fmt(n) {
  // Trim to 4 decimals, drop trailing zeros
  return Number(n.toFixed(4)).toString();
}

export function iosColorsFormat({ dictionary, options }) {
  const namespace = options?.namespace || 'Colors';
  const lines = dictionary.allTokens
    .filter((t) => t.$type === 'color')
    .map((t) => {
      const { r, g, b, a } = hexToRgba(t.$value);
      return a < 1
        ? `    public static let ${t.name} = Color(red: ${fmt(r)}, green: ${fmt(g)}, blue: ${fmt(b)}, opacity: ${fmt(a)})`
        : `    public static let ${t.name} = Color(red: ${fmt(r)}, green: ${fmt(g)}, blue: ${fmt(b)})`;
    });

  return `// Auto-generated by build.js — do not edit.
import SwiftUI

public enum ${namespace} {
${lines.join('\n')}
}
`;
}

// Style Dictionary registration helper
export const iosColorsFormatDef = {
  name: 'ios/colors-namespace',
  format: iosColorsFormat,
};
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test
```

Expected: PASS — all 4 tests.

- [ ] **Step 5: Wire into build.js (both sdLight and sdDark)**

In `build.js`, add import:

```js
import { iosColorsFormatDef } from './formats/ios-colors.js';
```

After `register(StyleDictionary)` (line ~10), add format registration:

```js
StyleDictionary.registerFormat(iosColorsFormatDef);
```

In sdLight's platforms config, add an iOS platform (alongside `css`). **Note:** uses the built-in `tokens-studio` transform group (which includes `name/camel`) — NOT `custom-tokens-studio` — because Swift identifiers must be pure camelCase, not the kebab-camel hybrid the web CSS uses.

```js
ios: {
    transformGroup: 'tokens-studio',
    buildPath: 'ios/',
    files: [
        {
            destination: 'ColorsLight.swift',
            format: 'ios/colors-namespace',
            options: { namespace: 'LightColors' },
        },
    ],
},
```

In sdDark's platforms config, mirror it:

```js
ios: {
    transformGroup: 'tokens-studio',
    buildPath: 'ios/',
    files: [
        {
            destination: 'ColorsDark.swift',
            format: 'ios/colors-namespace',
            options: { namespace: 'DarkColors' },
        },
    ],
},
```

- [ ] **Step 6: Run build and inspect Swift output**

```bash
npm run build
head -20 ios/ColorsLight.swift
head -20 ios/ColorsDark.swift
```

Expected: each file starts with `import SwiftUI`, then `public enum LightColors {` (or `DarkColors`), then ~757 `public static let` color lines.

- [ ] **Step 7: Commit**

```bash
git add formats/ios-colors.js formats/ios-colors.test.js build.js ios/ColorsLight.swift ios/ColorsDark.swift
git commit -m "feat(ios): generate SwiftUI Color enums for light/dark"
```

---

## Task 4: Add iOS Spacing & Radius

**Goal:** Generate `ios/Spacing.swift` containing `Spacing` and `Radius` enums of `CGFloat` values.

**Files:**
- Create: `formats/ios-spacing.js`
- Create: `formats/ios-spacing.test.js`
- Modify: `build.js`

- [ ] **Step 1: Write the failing test**

Create `formats/ios-spacing.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { iosSpacingFormat } from './ios-spacing.js';

const fakeDict = {
  allTokens: [
    { name: 'spacingS100', $type: 'dimension', $value: '4px' },
    { name: 'spacingS200', $type: 'dimension', $value: '8px' },
    { name: 'radiusR100', $type: 'borderRadius', $value: '4px' },
    { name: 'colorsBgPrimary', $type: 'color', $value: '#fff' },  // filtered out
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test
```

Expected: FAIL — `Cannot find module './ios-spacing.js'`.

- [ ] **Step 3: Implement `formats/ios-spacing.js`**

Create `formats/ios-spacing.js`:

```js
function stripPx(v) {
  if (typeof v !== 'string') return v;
  const m = v.match(/^(-?\d+(?:\.\d+)?)px$/);
  return m ? m[1] : v;
}

export function iosSpacingFormat({ dictionary }) {
  const spacing = dictionary.allTokens.filter(
    (t) => t.$type === 'dimension' || t.$type === 'spacing',
  );
  const radius = dictionary.allTokens.filter((t) => t.$type === 'borderRadius');

  const lineFor = (t) => `    public static let ${t.name}: CGFloat = ${stripPx(t.$value)}`;

  return `// Auto-generated by build.js — do not edit.
import CoreGraphics

public enum Spacing {
${spacing.map(lineFor).join('\n')}
}

public enum Radius {
${radius.map(lineFor).join('\n')}
}
`;
}

export const iosSpacingFormatDef = {
  name: 'ios/spacing-radius',
  format: iosSpacingFormat,
};
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test
```

Expected: PASS.

- [ ] **Step 5: Wire into build.js**

Add import:

```js
import { iosSpacingFormatDef } from './formats/ios-spacing.js';
```

Register after iOS colors registration:

```js
StyleDictionary.registerFormat(iosSpacingFormatDef);
```

In sdLight's `ios` platform, add another file to the `files` array (Spacing/Radius are in light common set, dark doesn't need duplicate):

```js
{
    destination: 'Spacing.swift',
    format: 'ios/spacing-radius',
},
```

(The existing `ColorsLight.swift` entry stays; this is a sibling.)

- [ ] **Step 6: Run build and inspect**

```bash
npm run build
head -20 ios/Spacing.swift
```

Expected: `import CoreGraphics`, `public enum Spacing { ... }`, `public enum Radius { ... }`.

- [ ] **Step 7: Commit**

```bash
git add formats/ios-spacing.js formats/ios-spacing.test.js build.js ios/Spacing.swift
git commit -m "feat(ios): generate Spacing and Radius CGFloat enums"
```

---

## Task 5: Add iOS Typography

**Goal:** Generate `ios/Typography.swift` as a `Font` extension with one static let per `textStyle`.

**Files:**
- Create: `formats/ios-typography.js`
- Create: `formats/ios-typography.test.js`
- Modify: `build.js`

- [ ] **Step 1: Write the failing test**

Create `formats/ios-typography.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { iosTypographyFormat } from './ios-typography.js';

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
    { name: 'colorsBgPrimary', $type: 'color', $value: '#fff' },  // filtered out
  ],
};

test('emits SwiftUI import and Font extension', () => {
  const out = iosTypographyFormat({ dictionary: fakeDict });
  assert.match(out, /import SwiftUI/);
  assert.match(out, /public extension Font \{/);
});

test('emits each typography token as Font.custom', () => {
  const out = iosTypographyFormat({ dictionary: fakeDict });
  assert.match(out, /static let textBodyM = Font\.custom\("Pretendard", size: 16\)\.weight\(\.regular\)/);
  assert.match(out, /static let textHeadingL = Font\.custom\("Pretendard", size: 24\)\.weight\(\.semibold\)/);
});

test('falls back to Font.system when fontFamily missing', () => {
  const dict = {
    allTokens: [
      { name: 'textCaption', $type: 'typography', $value: { fontWeight: 400, fontSize: '12px' } },
    ],
  };
  const out = iosTypographyFormat({ dictionary: dict });
  assert.match(out, /static let textCaption = Font\.system\(size: 12\)\.weight\(\.regular\)/);
});

test('filters out non-typography tokens', () => {
  const out = iosTypographyFormat({ dictionary: fakeDict });
  assert.doesNotMatch(out, /colorsBgPrimary/);
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test
```

Expected: FAIL.

- [ ] **Step 3: Implement `formats/ios-typography.js`**

Create `formats/ios-typography.js`:

```js
function stripPx(v) {
  if (typeof v !== 'string') return v;
  const m = v.match(/^(-?\d+(?:\.\d+)?)px$/);
  return m ? m[1] : v;
}

function weightToken(weight) {
  const n = Number(weight);
  if (n <= 200) return '.ultraLight';
  if (n <= 300) return '.light';
  if (n <= 400) return '.regular';
  if (n <= 500) return '.medium';
  if (n <= 600) return '.semibold';
  if (n <= 700) return '.bold';
  if (n <= 800) return '.heavy';
  return '.black';
}

export function iosTypographyFormat({ dictionary }) {
  const typography = dictionary.allTokens.filter((t) => t.$type === 'typography');

  const lineFor = (t) => {
    const v = t.$value || {};
    const size = stripPx(v.fontSize ?? '16');
    const weight = weightToken(v.fontWeight ?? 400);
    const fontExpr = v.fontFamily
      ? `Font.custom("${v.fontFamily}", size: ${size})`
      : `Font.system(size: ${size})`;
    return `    static let ${t.name} = ${fontExpr}.weight(${weight})`;
  };

  return `// Auto-generated by build.js — do not edit.
import SwiftUI

public extension Font {
${typography.map(lineFor).join('\n')}
}
`;
}

export const iosTypographyFormatDef = {
  name: 'ios/typography-font',
  format: iosTypographyFormat,
};
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test
```

Expected: PASS.

- [ ] **Step 5: Wire into build.js**

Add import + register:

```js
import { iosTypographyFormatDef } from './formats/ios-typography.js';
// ...
StyleDictionary.registerFormat(iosTypographyFormatDef);
```

Add to sdLight's `ios` platform `files` array:

```js
{
    destination: 'Typography.swift',
    format: 'ios/typography-font',
},
```

- [ ] **Step 6: Run build and inspect**

```bash
npm run build
head -20 ios/Typography.swift
```

Expected: `import SwiftUI`, `public extension Font { ... }`, one `static let` per textStyle.

- [ ] **Step 7: Commit**

```bash
git add formats/ios-typography.js formats/ios-typography.test.js build.js ios/Typography.swift
git commit -m "feat(ios): generate Font extension for typography textStyles"
```

---

## Task 6: Add Android Color outputs (Light + Dark)

**Goal:** Generate `android/LightColors.kt` and `android/DarkColors.kt` as Compose `Color` Kotlin objects.

**Files:**
- Create: `formats/android-colors.js`
- Create: `formats/android-colors.test.js`
- Modify: `build.js`

- [ ] **Step 1: Write the failing test**

Create `formats/android-colors.test.js`:

```js
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

test('filters out non-color tokens', () => {
  const out = androidColorsFormat({ dictionary: fakeDict, options: { objectName: 'LightColors' } });
  assert.doesNotMatch(out, /spacingS100/);
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test
```

Expected: FAIL.

- [ ] **Step 3: Implement `formats/android-colors.js`**

Create `formats/android-colors.js`:

```js
/**
 * Convert #RRGGBB or #RRGGBBAA hex to Compose Color literal: 0xAARRGGBB.
 * Compose Color expects ARGB packed.
 */
function hexToComposeArgb(hex) {
  const h = hex.replace('#', '');
  const full = h.length === 3
    ? h.split('').map((c) => c + c).join('') + 'FF'
    : h.length === 6 ? h + 'FF' : h;
  const rr = full.slice(0, 2);
  const gg = full.slice(2, 4);
  const bb = full.slice(4, 6);
  const aa = full.slice(6, 8);
  return `0x${aa.toUpperCase()}${rr.toUpperCase()}${gg.toUpperCase()}${bb.toUpperCase()}`;
}

const PACKAGE = 'com.imin.designsystem.tokens';

export function androidColorsFormat({ dictionary, options }) {
  const objectName = options?.objectName || 'Colors';
  const lines = dictionary.allTokens
    .filter((t) => t.$type === 'color')
    .map((t) => `    val ${t.name} = Color(${hexToComposeArgb(t.$value)})`);

  return `// Auto-generated by build.js — do not edit.
package ${PACKAGE}

import androidx.compose.ui.graphics.Color

object ${objectName} {
${lines.join('\n')}
}
`;
}

export const androidColorsFormatDef = {
  name: 'android/compose-colors',
  format: androidColorsFormat,
};
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test
```

Expected: PASS.

- [ ] **Step 5: Wire into build.js (both sdLight and sdDark)**

Add import + register:

```js
import { androidColorsFormatDef } from './formats/android-colors.js';
// ...
StyleDictionary.registerFormat(androidColorsFormatDef);
```

Add an `android` platform to sdLight's platforms config (uses `tokens-studio` group for pure camelCase, same reasoning as iOS):

```js
android: {
    transformGroup: 'tokens-studio',
    buildPath: 'android/',
    files: [
        {
            destination: 'LightColors.kt',
            format: 'android/compose-colors',
            options: { objectName: 'LightColors' },
        },
    ],
},
```

Mirror in sdDark:

```js
android: {
    transformGroup: 'tokens-studio',
    buildPath: 'android/',
    files: [
        {
            destination: 'DarkColors.kt',
            format: 'android/compose-colors',
            options: { objectName: 'DarkColors' },
        },
    ],
},
```

- [ ] **Step 6: Run build and inspect**

```bash
npm run build
head -20 android/LightColors.kt
head -20 android/DarkColors.kt
```

Expected: `package com.imin.designsystem.tokens`, `import androidx.compose.ui.graphics.Color`, `object LightColors { ... }` (or DarkColors), `val ... = Color(0xFF...)` lines.

- [ ] **Step 7: Commit**

```bash
git add formats/android-colors.js formats/android-colors.test.js build.js android/LightColors.kt android/DarkColors.kt
git commit -m "feat(android): generate Compose Color objects for light/dark"
```

---

## Task 7: Add Android Spacing & Radius

**Goal:** Generate `android/Spacing.kt` containing `Spacing` and `Radius` Kotlin objects with `Dp` values.

**Files:**
- Create: `formats/android-spacing.js`
- Create: `formats/android-spacing.test.js`
- Modify: `build.js`

- [ ] **Step 1: Write the failing test**

Create `formats/android-spacing.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { androidSpacingFormat } from './android-spacing.js';

const fakeDict = {
  allTokens: [
    { name: 'spacingS100', $type: 'dimension', $value: '4px' },
    { name: 'spacingS200', $type: 'dimension', $value: '8px' },
    { name: 'radiusR100', $type: 'borderRadius', $value: '4px' },
    { name: 'colorsBgPrimary', $type: 'color', $value: '#fff' },
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

test('filters out color tokens', () => {
  const out = androidSpacingFormat({ dictionary: fakeDict });
  assert.doesNotMatch(out, /colorsBgPrimary/);
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test
```

Expected: FAIL.

- [ ] **Step 3: Implement `formats/android-spacing.js`**

Create `formats/android-spacing.js`:

```js
function stripPx(v) {
  if (typeof v !== 'string') return v;
  const m = v.match(/^(-?\d+(?:\.\d+)?)px$/);
  return m ? m[1] : v;
}

const PACKAGE = 'com.imin.designsystem.tokens';

export function androidSpacingFormat({ dictionary }) {
  const spacing = dictionary.allTokens.filter(
    (t) => t.$type === 'dimension' || t.$type === 'spacing',
  );
  const radius = dictionary.allTokens.filter((t) => t.$type === 'borderRadius');

  const lineFor = (t) => `    val ${t.name} = ${stripPx(t.$value)}.dp`;

  return `// Auto-generated by build.js — do not edit.
package ${PACKAGE}

import androidx.compose.ui.unit.dp

object Spacing {
${spacing.map(lineFor).join('\n')}
}

object Radius {
${radius.map(lineFor).join('\n')}
}
`;
}

export const androidSpacingFormatDef = {
  name: 'android/compose-spacing',
  format: androidSpacingFormat,
};
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test
```

Expected: PASS.

- [ ] **Step 5: Wire into build.js**

Add import + register:

```js
import { androidSpacingFormatDef } from './formats/android-spacing.js';
// ...
StyleDictionary.registerFormat(androidSpacingFormatDef);
```

Add to sdLight's `android` platform `files` array:

```js
{
    destination: 'Spacing.kt',
    format: 'android/compose-spacing',
},
```

- [ ] **Step 6: Run build and inspect**

```bash
npm run build
head -20 android/Spacing.kt
```

Expected: `package`, `import ...unit.dp`, `object Spacing { ... }`, `object Radius { ... }`.

- [ ] **Step 7: Commit**

```bash
git add formats/android-spacing.js formats/android-spacing.test.js build.js android/Spacing.kt
git commit -m "feat(android): generate Compose Dp objects for Spacing and Radius"
```

---

## Task 8: Add Android Typography

**Goal:** Generate `android/Typography.kt` containing a `Typography` object with one `TextStyle` per textStyle token.

**Files:**
- Create: `formats/android-typography.js`
- Create: `formats/android-typography.test.js`
- Modify: `build.js`

- [ ] **Step 1: Write the failing test**

Create `formats/android-typography.test.js`:

```js
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

test('filters out non-typography tokens', () => {
  const out = androidTypographyFormat({ dictionary: fakeDict });
  assert.doesNotMatch(out, /colorsBgPrimary/);
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test
```

Expected: FAIL.

- [ ] **Step 3: Implement `formats/android-typography.js`**

Create `formats/android-typography.js`:

```js
function stripPx(v) {
  if (typeof v !== 'string') return v;
  const m = v.match(/^(-?\d+(?:\.\d+)?)px$/);
  return m ? m[1] : v;
}

function weightToken(weight) {
  const n = Number(weight);
  if (n <= 100) return 'FontWeight.Thin';
  if (n <= 200) return 'FontWeight.ExtraLight';
  if (n <= 300) return 'FontWeight.Light';
  if (n <= 400) return 'FontWeight.Normal';
  if (n <= 500) return 'FontWeight.Medium';
  if (n <= 600) return 'FontWeight.SemiBold';
  if (n <= 700) return 'FontWeight.Bold';
  if (n <= 800) return 'FontWeight.ExtraBold';
  return 'FontWeight.Black';
}

const PACKAGE = 'com.imin.designsystem.tokens';

export function androidTypographyFormat({ dictionary }) {
  const typography = dictionary.allTokens.filter((t) => t.$type === 'typography');

  const lineFor = (t) => {
    const v = t.$value || {};
    const parts = [];
    if (v.fontSize) parts.push(`fontSize = ${stripPx(v.fontSize)}.sp`);
    if (v.fontWeight !== undefined) parts.push(`fontWeight = ${weightToken(v.fontWeight)}`);
    if (v.lineHeight) parts.push(`lineHeight = ${stripPx(v.lineHeight)}.sp`);
    if (v.letterSpacing) parts.push(`letterSpacing = ${stripPx(v.letterSpacing)}.sp`);
    return `    val ${t.name} = TextStyle(\n        ${parts.join(',\n        ')},\n    )`;
  };

  return `// Auto-generated by build.js — do not edit.
package ${PACKAGE}

import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

object Typography {
${typography.map(lineFor).join('\n\n')}
}
`;
}

export const androidTypographyFormatDef = {
  name: 'android/compose-typography',
  format: androidTypographyFormat,
};
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test
```

Expected: PASS.

- [ ] **Step 5: Wire into build.js**

Add import + register:

```js
import { androidTypographyFormatDef } from './formats/android-typography.js';
// ...
StyleDictionary.registerFormat(androidTypographyFormatDef);
```

Add to sdLight's `android` platform `files` array:

```js
{
    destination: 'Typography.kt',
    format: 'android/compose-typography',
},
```

- [ ] **Step 6: Run build and inspect**

```bash
npm run build
head -30 android/Typography.kt
```

Expected: `package`, three imports, `object Typography { ... }` with `val textBodyM = TextStyle(...)` blocks.

- [ ] **Step 7: Commit**

```bash
git add formats/android-typography.js formats/android-typography.test.js build.js android/Typography.kt
git commit -m "feat(android): generate Compose TextStyle Typography object"
```

---

## Task 9: Update package.json scripts

**Goal:** Reflect `web/` location in `build:all` (sync-to-agent unchanged) and confirm `test` is wired.

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Verify current package.json scripts**

```bash
cat package.json | grep -A 6 '"scripts"'
```

Expected: should show `"test": "node --test formats/"` (added in Task 2) and existing `build`, `sync-agent`, `build:all`.

- [ ] **Step 2: Confirm `build:all` still works**

`sync-to-agent.js` reads `tokens.json` (not `build/css/`), so no path update needed there.

```bash
npm run build:all
ls ../figma-design-agent/ds/
```

Expected: `DESIGN_TOKENS.md` and `TOKEN_MAP.json` regenerated successfully (no errors about missing files).

- [ ] **Step 3: Confirm `npm test` passes**

```bash
npm test
```

Expected: all 7 test files run, all assertions pass.

- [ ] **Step 4: No commit needed if no changes**

If `package.json` was already correct from Task 2, skip. Otherwise:

```bash
git add package.json
git commit -m "chore: sync package.json scripts after multi-platform build"
```

---

## Task 10: GitHub Actions workflow

**Goal:** On push to `main` that touches `tokens.json`, run the build and auto-commit regenerated outputs with `[skip ci]`.

**Files:**
- Create: `.github/workflows/build-tokens.yml`

- [ ] **Step 1: Create the workflow**

Create `.github/workflows/build-tokens.yml`:

```yaml
name: Build Tokens

on:
  push:
    branches: [main]
    paths:
      - 'tokens.json'

permissions:
  contents: write

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - run: npm ci

      - run: npm test

      - run: npm run build

      - name: Commit token outputs
        run: |
          git config user.name 'github-actions[bot]'
          git config user.email '41898282+github-actions[bot]@users.noreply.github.com'
          git add ios/ android/ web/
          if git diff --staged --quiet; then
            echo "No token output changes"
            exit 0
          fi
          git commit -m "chore(tokens): rebuild from Figma push [skip ci]"
          git push
```

- [ ] **Step 2: Verify YAML is valid locally**

```bash
node -e "import('yaml').then(m=>console.log(m.default.parse(require('fs').readFileSync('.github/workflows/build-tokens.yml','utf8'))))" 2>/dev/null \
  || python3 -c "import yaml; yaml.safe_load(open('.github/workflows/build-tokens.yml'))"
```

Expected: prints parsed structure or runs silently (exit 0). If syntax error, fix.

- [ ] **Step 3: Commit and push**

```bash
git add .github/workflows/build-tokens.yml
git commit -m "ci: auto-build tokens on tokens.json push, commit outputs with [skip ci]"
git push origin main
```

- [ ] **Step 4: Verify Actions tab settings**

In GitHub web UI: **Settings → Actions → General → Workflow permissions** must be set to "Read and write permissions" for the auto-commit to push. If branch protection rules require PR review on `main`, this workflow will fail to push — note for follow-up.

---

## Task 11: End-to-end verification

**Goal:** Confirm the full pipeline produces sensible outputs for all platforms, then trigger CI to verify auto-commit works.

**Files:**
- None (verification only)

- [ ] **Step 1: Clean rebuild from scratch**

```bash
rm -rf ios/ android/ web/
npm run build
```

Expected: `ios/`, `android/`, `web/` directories regenerated with all expected files.

- [ ] **Step 2: Spot-check each output file**

```bash
ls ios/ android/ web/
wc -l ios/ColorsLight.swift ios/ColorsDark.swift ios/Spacing.swift ios/Typography.swift
wc -l android/LightColors.kt android/DarkColors.kt android/Spacing.kt android/Typography.kt
wc -l web/tokens.css web/tokens-dark.css web/tokens.ts
```

Expected:
- `ios/ColorsLight.swift` and `ios/ColorsDark.swift`: ~760 lines each (757 colors + header/wrapper).
- `ios/Spacing.swift`: ~70 lines (49 spacing + 13 radius + wrappers).
- `ios/Typography.swift`: ~50 lines (44 textStyles + wrapper).
- Android files: similar counts.
- `web/tokens.css`: same line count as before (existing baseline).
- `web/tokens.ts`: ~1500+ lines (light + dark + spacing + radius + typography).

- [ ] **Step 3: Validate iOS Swift syntax (optional, requires swiftc)**

```bash
which swiftc && swiftc -parse ios/*.swift 2>&1 | head || echo "swiftc not installed; skip"
```

Expected: no parse errors. If `swiftc` not available locally, skip.

- [ ] **Step 4: Validate Kotlin syntax (optional, requires kotlinc)**

```bash
which kotlinc && kotlinc -d /tmp/dstokens.jar android/*.kt 2>&1 | head || echo "kotlinc not installed; skip"
```

Expected: compiles cleanly (or skip if not installed).

- [ ] **Step 5: Run all tests one final time**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 6: Trigger CI by making a no-op tokens.json change**

```bash
# Re-export-equivalent change: re-write the file with same content (no diff) won't trigger;
# instead, bump a comment or whitespace if Token Studio format allows. Otherwise wait for
# the next genuine designer push to verify the workflow.
```

Note: a synthetic test push isn't strictly required — the workflow is small and unit-tested. The real verification is the next time Token Studio pushes.

- [ ] **Step 7: Commit any final adjustments**

If steps 1-5 surfaced anything to fix (e.g., a typography token with missing fontFamily that produced bad Swift), patch the relevant format function, re-run tests, and commit.

```bash
git status
# If clean, done.
# If changes, commit with a descriptive message.
```

---

## Self-Review Checklist (post-write)

- [x] Spec section coverage:
  - 폴더 구조 → Task 1 (web migration), Tasks 3-8 (ios/, android/ created)
  - 자동화 흐름 → Task 10
  - 토큰 명명 (camelCase 평면) → SD's `name/camel` from `custom-tokens-studio` group, applied via `transformGroup` (already in build.js)
  - iOS/Android/Web 산출물 사양 → Tasks 2-8
  - 빌드 파이프라인 변경 → Tasks 1-9
  - GitHub Actions → Task 10
  - 무한 루프 방지 (paths + [skip ci]) → Task 10
- [x] No placeholders / TBD / "TODO" in tasks
- [x] Each format file has a co-located test
- [x] Type/method names consistent: `iosColorsFormat`, `iosSpacingFormat`, etc., with `*FormatDef` exports for SD registration
- [x] Code blocks present in every code step
- [x] Commit at end of every task

## Open follow-ups (not blocking; mention in implementation if surfaced)

- Branch protection on `main` may block the bot's push (Task 10 step 4 — needs human verification post-merge).
- Actual Android package name `com.imin.designsystem.tokens` is provisional — change to whatever the consuming Android app expects.
- iOS `Font.custom` requires the font asset to be bundled in the app — typography only emits the *reference*; asset bundling is out of scope.
- `tokens-transformed.json` file in repo root is no longer used by build.js; consider deleting in a future cleanup.
