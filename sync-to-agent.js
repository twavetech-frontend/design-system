#!/usr/bin/env node
/**
 * sync-to-agent.js
 *
 * Generates DESIGN_TOKENS.md from tokens.json for figma-design-agent.
 * Also generates a CSS-to-Figma mapping table (TOKEN_MAP.json).
 *
 * Usage:
 *   node sync-to-agent.js [--out <dir>]
 *   Default output: ../figma-design-agent/ds/
 *
 * What it does:
 *   1. Reads tokens.json (same source as build.js)
 *   2. Generates DESIGN_TOKENS.md in Figma path format (Colors/Gray (light mode)/25)
 *   3. Generates TOKEN_MAP.json mapping CSS var names ↔ Figma paths
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Parse args
const args = process.argv.slice(2);
let outDir = path.resolve(__dirname, '..', '..', 'figma-design-agent', 'ds');
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--out' && args[i + 1]) {
    outDir = path.resolve(args[i + 1]);
    i++;
  }
}

// ─── Load tokens.json ───────────────────────────────────────────────
const tokensPath = path.join(__dirname, 'tokens.json');
const allTokens = JSON.parse(fs.readFileSync(tokensPath, 'utf8'));

// ─── Name transform (same logic as build.js) ───────────────────────
function toCssVarName(segments) {
  return '--' + segments.map((segment) => {
    let clean = segment.trim();
    let suffix = '';
    const parenMatch = clean.match(/^(.+?)\s*\(([^)]+)\)$/);
    if (parenMatch) {
      clean = parenMatch[1].trim();
      const parenContent = parenMatch[2].trim();
      if (/^\d/.test(parenContent)) {
        suffix = parenContent.replace(/[^a-zA-Z0-9]/g, '');
      } else {
        clean = clean + ' ' + parenContent;
      }
    }
    let camel = clean
      .replace(/[_\s-]+(.)/g, (_, c) => c.toUpperCase())
      .replace(/^(.)/, (_, c) => c.toLowerCase());
    if (suffix) {
      camel = camel + '-' + suffix;
    }
    return camel;
  }).join('-');
}

// ─── Recursively extract tokens ─────────────────────────────────────
function extractTokens(obj, pathSegments = [], results = []) {
  for (const [key, value] of Object.entries(obj)) {
    if (key.startsWith('$')) continue;
    const currentPath = [...pathSegments, key];

    if (value && typeof value === 'object' && '$value' in value) {
      // Leaf token
      const figmaPath = currentPath.join('/');
      const cssVar = toCssVarName(currentPath);
      let type = (value.$type || '').toUpperCase();
      let resolvedValue = value.$value;

      // Resolve aliases: "{Colors.Base.white}" → look up the actual value
      if (typeof resolvedValue === 'string' && resolvedValue.startsWith('{')) {
        type = type || 'ALIAS';
      }

      results.push({ figmaPath, cssVar, value: resolvedValue, type });
    } else if (value && typeof value === 'object') {
      extractTokens(value, currentPath, results);
    }
  }
  return results;
}

// ─── Classify tokens by category ────────────────────────────────────
function classifyToken(figmaPath) {
  const lower = figmaPath.toLowerCase();
  if (lower.startsWith('colors/') || lower.startsWith('component colors/')) return 'colors';
  if (lower.startsWith('spacing')) return 'spacing';
  if (lower.startsWith('radius')) return 'radius';
  if (lower.startsWith('font') || lower.startsWith('line height')) return 'typography';
  if (lower.startsWith('container')) return 'layout';
  if (lower.startsWith('width') || lower.startsWith('paragraph')) return 'width';
  return 'other';
}

// ─── Process each token set ─────────────────────────────────────────
// Exclude Dark mode — agent uses Light mode as default
const setsToProcess = Object.keys(allTokens).filter(k =>
  !k.startsWith('$') && !k.toLowerCase().includes('dark mode')
);

// Merge all sets (later sets override earlier ones, same as build.js)
const mergedTokens = {};
for (const setName of setsToProcess) {
  if (allTokens[setName]) {
    for (const [key, value] of Object.entries(allTokens[setName])) {
      mergedTokens[key] = { ...mergedTokens[key], ...value };
    }
  }
}

const allExtracted = extractTokens(mergedTokens);

// Classify
const categories = {
  colors: [],
  spacing: [],
  radius: [],
  typography: [],
  layout: [],
  width: [],
  other: [],
};

for (const token of allExtracted) {
  const cat = classifyToken(token.figmaPath);
  categories[cat].push(token);
}

// ─── Resolve alias values ───────────────────────────────────────────
function resolveAlias(value, allTokensFlat, depth = 0) {
  if (depth > 10) return value; // prevent infinite recursion
  if (typeof value !== 'string' || !value.startsWith('{')) return value;

  // Parse alias: "{Colors.Base.white}" → path "Colors/Base/white"
  const aliasPath = value.slice(1, -1).replace(/\./g, '/');
  const target = allTokensFlat.find(t => t.figmaPath === aliasPath);
  if (target) {
    return resolveAlias(target.value, allTokensFlat, depth + 1);
  }
  return value; // unresolved
}

// Resolve all aliases
for (const token of allExtracted) {
  if (typeof token.value === 'string' && token.value.startsWith('{')) {
    const resolved = resolveAlias(token.value, allExtracted);
    token.resolvedValue = resolved;
  } else {
    token.resolvedValue = token.value;
  }
}

// ─── Generate DESIGN_TOKENS.md ──────────────────────────────────────
function generateDesignTokensMd() {
  const lines = [];
  const now = new Date().toISOString().split('T')[0];

  lines.push('# Design Tokens Reference — DS-1');
  lines.push('');
  lines.push('> Auto-generated by sync-to-agent.js');
  lines.push(`> Generated: ${now}`);
  lines.push('> Source: design-system/tokens.json');
  lines.push('');
  lines.push('**Token 컬럼**: Figma 변수 경로 (set_bound_variables에 사용)');
  lines.push('**CSS Variable 컬럼**: docs 사이트의 CSS 변수명 (웹 참조용)');
  lines.push('**TOKEN_MAP.json**: CSS 변수명 → Figma 경로 양방향 매핑');
  lines.push('');
  lines.push('---');

  // Colors
  const primitiveColors = categories.colors.filter(t => !t.figmaPath.startsWith('Component'));
  const componentColors = categories.colors.filter(t => t.figmaPath.startsWith('Component'));

  lines.push('');
  lines.push('## Colors');
  lines.push('');
  lines.push(`### Primitive Colors (${primitiveColors.length} tokens)`);
  lines.push('');
  lines.push('| Token | Value | CSS Variable |');
  lines.push('|-------|-------|-------------|');
  for (const t of primitiveColors) {
    const displayValue = typeof t.resolvedValue === 'string' ? t.resolvedValue : JSON.stringify(t.resolvedValue);
    lines.push(`| ${t.figmaPath} | ${displayValue} | \`${t.cssVar}\` |`);
  }

  if (componentColors.length > 0) {
    lines.push('');
    lines.push(`### Component Colors (${componentColors.length} tokens)`);
    lines.push('');
    lines.push('| Token | Value | CSS Variable |');
    lines.push('|-------|-------|-------------|');
    for (const t of componentColors) {
      const displayValue = typeof t.resolvedValue === 'string' ? t.resolvedValue : JSON.stringify(t.resolvedValue);
      lines.push(`| ${t.figmaPath} | ${displayValue} | \`${t.cssVar}\` |`);
    }
  }

  // Spacing
  if (categories.spacing.length > 0) {
    lines.push('');
    lines.push('## Spacing');
    lines.push('');
    lines.push('| Token | Value | CSS Variable |');
    lines.push('|-------|-------|-------------|');
    for (const t of categories.spacing) {
      lines.push(`| ${t.figmaPath} | ${t.resolvedValue} | \`${t.cssVar}\` |`);
    }
  }

  // Radius
  if (categories.radius.length > 0) {
    lines.push('');
    lines.push('## Radius');
    lines.push('');
    lines.push('| Token | Value | CSS Variable |');
    lines.push('|-------|-------|-------------|');
    for (const t of categories.radius) {
      lines.push(`| ${t.figmaPath} | ${t.resolvedValue} | \`${t.cssVar}\` |`);
    }
  }

  // Typography
  if (categories.typography.length > 0) {
    lines.push('');
    lines.push('## Typography');
    lines.push('');
    lines.push('| Token | Value | CSS Variable |');
    lines.push('|-------|-------|-------------|');
    for (const t of categories.typography) {
      lines.push(`| ${t.figmaPath} | ${t.resolvedValue} | \`${t.cssVar}\` |`);
    }
  }

  // Layout
  if (categories.layout.length > 0) {
    lines.push('');
    lines.push('## Layout');
    lines.push('');
    lines.push('| Token | Value | CSS Variable |');
    lines.push('|-------|-------|-------------|');
    for (const t of categories.layout) {
      lines.push(`| ${t.figmaPath} | ${t.resolvedValue} | \`${t.cssVar}\` |`);
    }
  }

  // Width
  if (categories.width.length > 0) {
    lines.push('');
    lines.push('## Width');
    lines.push('');
    lines.push('| Token | Value | CSS Variable |');
    lines.push('|-------|-------|-------------|');
    for (const t of categories.width) {
      lines.push(`| ${t.figmaPath} | ${t.resolvedValue} | \`${t.cssVar}\` |`);
    }
  }

  lines.push('');
  return lines.join('\n');
}

// ─── Generate TOKEN_MAP.json ────────────────────────────────────────
function generateTokenMap() {
  const map = {};
  for (const token of allExtracted) {
    map[token.cssVar] = {
      figmaPath: token.figmaPath,
      value: token.resolvedValue,
      type: token.type,
    };
  }
  return map;
}

// ─── Write outputs ──────────────────────────────────────────────────
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

const designTokensContent = generateDesignTokensMd();
const designTokensPath = path.join(outDir, 'DESIGN_TOKENS.md');
fs.writeFileSync(designTokensPath, designTokensContent, 'utf8');
console.log(`✓ DESIGN_TOKENS.md → ${designTokensPath} (${allExtracted.length} tokens)`);

const tokenMap = generateTokenMap();
const tokenMapPath = path.join(outDir, 'TOKEN_MAP.json');
fs.writeFileSync(tokenMapPath, JSON.stringify(tokenMap, null, 2), 'utf8');
console.log(`✓ TOKEN_MAP.json → ${tokenMapPath} (${Object.keys(tokenMap).length} mappings)`);

// Summary
console.log('\nToken breakdown:');
for (const [cat, tokens] of Object.entries(categories)) {
  if (tokens.length > 0) {
    console.log(`  ${cat}: ${tokens.length}`);
  }
}
