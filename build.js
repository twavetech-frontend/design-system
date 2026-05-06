import { register } from '@tokens-studio/sd-transforms';
import StyleDictionary from 'style-dictionary';
import fs from 'fs';
import { generateTokensTs } from './formats/web-ts.js';
import { iosColorsFormatDef } from './formats/ios-colors.js';
import { iosSpacingFormatDef } from './formats/ios-spacing.js';
import { iosTypographyFormatDef } from './formats/ios-typography.js';
import { androidColorsFormatDef } from './formats/android-colors.js';
import { androidSpacingFormatDef } from './formats/android-spacing.js';
import { androidTypographyFormatDef } from './formats/android-typography.js';

// Read the original tokens.json exported by Tokens Studio
const rawData = fs.readFileSync('./tokens.json', 'utf8');
const allTokens = JSON.parse(rawData);

// Register all Tokens Studio transforms
register(StyleDictionary);

StyleDictionary.registerFormat(iosColorsFormatDef);
StyleDictionary.registerFormat(iosSpacingFormatDef);
StyleDictionary.registerFormat(iosTypographyFormatDef);
StyleDictionary.registerFormat(androidColorsFormatDef);
StyleDictionary.registerFormat(androidSpacingFormatDef);
StyleDictionary.registerFormat(androidTypographyFormatDef);

// Custom name transform: kebab-case groups with camelCase leaves
// e.g. Colors / Text / text-primary (900) → colors-text-textPrimary-900
StyleDictionary.registerTransform({
    name: 'name/kebab-camel',
    type: 'name',
    transform: (token) => {
        return token.path.map((segment) => {
            let clean = segment.trim();

            // Extract parenthesized content: "text-primary (900)" or "Gray (light mode)"
            let suffix = '';
            const parenMatch = clean.match(/^(.+?)\s*\(([^)]+)\)$/);
            if (parenMatch) {
                clean = parenMatch[1].trim();
                const parenContent = parenMatch[2].trim();
                // Numeric-like suffix (900, 0px, 2px) → separate with dash
                if (/^\d/.test(parenContent)) {
                    suffix = parenContent.replace(/[^a-zA-Z0-9]/g, '');
                } else {
                    // Text content (light mode) → merge into the name
                    clean = clean + ' ' + parenContent;
                }
            }

            // Convert to camelCase: "Gray light mode" → "grayLightMode", "text-primary" → "textPrimary"
            let camel = clean
                .replace(/[_\s-]+(.)/g, (_, c) => c.toUpperCase())
                .replace(/^(.)/, (_, c) => c.toLowerCase());

            if (suffix) {
                camel = camel + '-' + suffix;
            }

            return camel;
        }).join('-');
    },
});

// Get the list of transforms from tokens-studio group, replace the name transform
const tokensStudioTransforms = StyleDictionary.hooks.transformGroups['tokens-studio'];
const customTransforms = tokensStudioTransforms.map(t =>
    t === 'name/camel' ? 'name/kebab-camel' : t
);

StyleDictionary.registerTransformGroup({
    name: 'custom-tokens-studio',
    transforms: customTransforms,
});

// Helper: merge specific token sets
function mergeSets(setNames) {
    const merged = {};
    setNames.forEach((setName) => {
        if (allTokens[setName]) {
            for (const [key, value] of Object.entries(allTokens[setName])) {
                merged[key] = { ...merged[key], ...value };
            }
        }
    });
    return merged;
}

// Common sets (primitives, typography, spacing, etc.)
const commonSets = Object.keys(allTokens).filter(key =>
    !key.startsWith('$') &&
    !key.includes('Color modes/')
);

// Build light mode: common + light color mode
const lightSets = [...commonSets, '1. Color modes/Light'];
const lightTokens = mergeSets(lightSets);

// Build dark mode: common + dark color mode
const darkSets = [...commonSets, '1. Color modes/Dark'];
const darkTokens = mergeSets(darkSets);

// Build light tokens (main tokens.css)
const sdLight = new StyleDictionary({
    tokens: lightTokens,
    preprocessors: ['tokens-studio'],
    platforms: {
        css: {
            transformGroup: 'custom-tokens-studio',
            buildPath: 'web/',
            files: [
                {
                    destination: 'tokens.css',
                    format: 'css/variables',
                },
            ],
        },
        ios: {
            transformGroup: 'tokens-studio',
            buildPath: 'ios/',
            files: [
                {
                    destination: 'ColorsLight.swift',
                    format: 'ios/colors-namespace',
                    options: { namespace: 'LightColors' },
                },
                {
                    destination: 'Spacing.swift',
                    format: 'ios/spacing-radius',
                },
                {
                    destination: 'Typography.swift',
                    format: 'ios/typography-font',
                },
            ],
        },
        android: {
            transformGroup: 'tokens-studio',
            buildPath: 'android/',
            files: [
                {
                    destination: 'LightColors.kt',
                    format: 'android/compose-colors',
                    options: { objectName: 'LightColors' },
                },
                {
                    destination: 'Spacing.kt',
                    format: 'android/compose-spacing',
                },
                {
                    destination: 'Typography.kt',
                    format: 'android/compose-typography',
                },
            ],
        },
    },
});

await sdLight.buildAllPlatforms();

// Build dark tokens (tokens-dark.css) with [data-theme="dark"] selector
const sdDark = new StyleDictionary({
    tokens: darkTokens,
    preprocessors: ['tokens-studio'],
    platforms: {
        css: {
            transformGroup: 'custom-tokens-studio',
            buildPath: 'web/',
            files: [
                {
                    destination: 'tokens-dark.css',
                    format: 'css/variables',
                    options: {
                        selector: '[data-theme="dark"]',
                    },
                },
            ],
        },
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
    },
});

await sdDark.buildAllPlatforms();

// Generate web/tokens.ts (combined light+dark) using transformed dictionaries
const lightDict = await sdLight.getPlatformTokens('css');
const darkDict = await sdDark.getPlatformTokens('css');
fs.writeFileSync('web/tokens.ts', generateTokensTs(lightDict.allTokens, darkDict.allTokens));
console.log('✓ web/tokens.ts (light + dark merged)');

console.log('✅ tokens.css (light) + tokens-dark.css (dark) generated');
