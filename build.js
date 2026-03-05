import { register } from '@tokens-studio/sd-transforms';
import StyleDictionary from 'style-dictionary';
import fs from 'fs';

// Read the original tokens.json exported by Tokens Studio
const rawData = fs.readFileSync('./tokens.json', 'utf8');
const allTokens = JSON.parse(rawData);

// We manually merge the sets: 'core', 'light', 'theme'
const setsToMerge = ['core', 'light', 'theme'];
const mergedTokens = {};

setsToMerge.forEach((setName) => {
    if (allTokens[setName]) {
        // Deep merge to combine token sets safely
        for (const [key, value] of Object.entries(allTokens[setName])) {
            mergedTokens[key] = { ...mergedTokens[key], ...value };
        }
    }
});

// Register all Tokens Studio transforms
register(StyleDictionary);

const sd = new StyleDictionary({
    tokens: mergedTokens,
    preprocessors: ['tokens-studio'],
    platforms: {
        css: {
            transformGroup: 'tokens-studio',
            prefix: 'ds',
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
