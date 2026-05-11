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
