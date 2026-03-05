import { register } from '@tokens-studio/sd-transforms';
import StyleDictionary from 'style-dictionary';
import fs from 'fs';

// Read tokens.json and fix de-structured descriptions by token-transformer
const tokensData = JSON.parse(fs.readFileSync('./tokens-transformed.json', 'utf8'));

function fixDescriptions(obj) {
    for (const key in obj) {
        if ((key === 'description' || key === '$description') && typeof obj[key] === 'object' && obj[key] !== null) {
            // Extract the actual string from value property, or delete it
            if (typeof obj[key].value === 'string') {
                obj[key] = obj[key].value;
            } else {
                delete obj[key];
            }
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
            fixDescriptions(obj[key]);
        }
    }
}
fixDescriptions(tokensData);

// Register all Tokens Studio transforms
register(StyleDictionary);

const sd = new StyleDictionary({
    tokens: tokensData,
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
