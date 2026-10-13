// Pharaonic background tile: lotus, papyrus, ankh, Eye of Horus, five-point
// "sba" stars and Nile water lines. Drawn as a 160×160 seamless SVG tile.
// The same drawing is used on web (inline SVG) and rendered to PNG for native
// (assets/images/pattern-*.png via scripts/render-pattern.mjs).

export const PATTERN_SIZE = 160;

export const patternColors = {
  light: { line: '#B4441A', gold: '#C9952B', opacity: 0.16 },
  dark: { line: '#D9A441', gold: '#E8B860', opacity: 0.14 },
} as const;

/** Five-point Egyptian star centred at (x, y). */
function star(x: number, y: number, r: number) {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const rad = (Math.PI / 5) * i - Math.PI / 2;
    const rr = i % 2 === 0 ? r : r * 0.42;
    pts.push(`${(x + rr * Math.cos(rad)).toFixed(2)},${(y + rr * Math.sin(rad)).toFixed(2)}`);
  }
  return `<polygon points="${pts.join(' ')}"/>`;
}

/** Nile water hieroglyph (zigzag) between x1 and x2 at height y. */
function water(x1: number, x2: number, y: number) {
  const step = 8;
  let d = `M${x1} ${y}`;
  for (let x = x1, up = true; x < x2; x += step / 2, up = !up) d += ` L${x + step / 2} ${up ? y - 3 : y}`;
  return `<path d="${d}"/>`;
}

export function patternSvg(scheme: 'light' | 'dark') {
  const { line, gold, opacity } = patternColors[scheme];
  const s = PATTERN_SIZE;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
<g opacity="${opacity}" fill="none" stroke="${line}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
  <!-- Lotus (centre) -->
  <g transform="translate(80 84)">
    <path d="M0 18 C-4 6 -4 -8 0 -22 C4 -8 4 6 0 18 Z"/>
    <path d="M0 18 C-8 10 -16 -2 -18 -14 C-10 -10 -4 -2 0 18"/>
    <path d="M0 18 C8 10 16 -2 18 -14 C10 -10 4 -2 0 18"/>
    <path d="M-14 22 Q0 16 14 22"/>
    <path d="M0 22 L0 34"/>
  </g>
  <!-- Papyrus umbels (corners, seamless across tile edges) -->
  ${[[0, 0], [s, 0], [0, s], [s, s]]
    .map(
      ([x, y]) => `<g transform="translate(${x} ${y})">
    <path d="M0 10 L0 -10"/>
    <path d="M0 -10 L-9 -20 M0 -10 L-4 -22 M0 -10 L4 -22 M0 -10 L9 -20"/>
    <path d="M-9 -20 Q0 -26 9 -20"/>
  </g>`,
    )
    .join('')}
  <!-- Ankh (left & right edges) -->
  ${[[22, 80], [138, 80]]
    .map(
      ([x, y]) => `<g transform="translate(${x} ${y})">
    <ellipse cx="0" cy="-12" rx="5" ry="7"/>
    <path d="M0 -5 L0 16 M-8 -3 L8 -3"/>
  </g>`,
    )
    .join('')}
  <!-- Eye of Horus (top & bottom middle) -->
  ${[[80, 26], [80, 140]]
    .map(
      ([x, y]) => `<g transform="translate(${x} ${y})">
    <path d="M-14 0 Q0 -10 14 0 Q0 7 -14 0 Z"/>
    <circle cx="0" cy="-1" r="3"/>
    <path d="M-14 -6 Q0 -16 16 -6"/>
    <path d="M-2 5 L-4 14 M4 4 Q10 12 6 16 Q2 18 3 13"/>
  </g>`,
    )
    .join('')}
  <!-- Nile water lines -->
  ${water(34, 62, 52)}${water(98, 126, 52)}${water(34, 62, 118)}${water(98, 126, 118)}
</g>
<g opacity="${opacity * 1.1}" fill="${gold}" stroke="none">
  ${star(40, 22, 4)}${star(120, 22, 4)}${star(40, 140, 4)}${star(120, 140, 4)}${star(80, 0, 3)}${star(80, s, 3)}${star(0, 80, 3)}${star(s, 80, 3)}
</g>
</svg>`;
}

export function patternDataUri(scheme: 'light' | 'dark') {
  return `url("data:image/svg+xml;utf8,${encodeURIComponent(patternSvg(scheme))}")`;
}
