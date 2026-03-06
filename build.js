import { register } from '@tokens-studio/sd-transforms';
import StyleDictionary from 'style-dictionary';
import fs from 'fs';

// Read the original tokens.json exported by Tokens Studio
const rawData = fs.readFileSync('./tokens.json', 'utf8');
const allTokens = JSON.parse(rawData);

// Dynamically merge all sets except metadata/themes
const setsToMerge = Object.keys(allTokens).filter(key => !key.startsWith('$'));
const mergedTokens = {};

setsToMerge.forEach((setName) => {
    if (allTokens[setName]) {
        for (const [key, value] of Object.entries(allTokens[setName])) {
            mergedTokens[key] = { ...mergedTokens[key], ...value };
        }
    }
});

// Register all Tokens Studio transforms
register(StyleDictionary);

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

const sd = new StyleDictionary({
    tokens: mergedTokens,
    preprocessors: ['tokens-studio'],
    platforms: {
        css: {
            transformGroup: 'custom-tokens-studio',
            buildPath: 'build/css/',
            files: [
                {
                    destination: 'tokens.css',
                    format: 'css/variables',
                },
            ],
        },
    },
});

await sd.buildAllPlatforms();
