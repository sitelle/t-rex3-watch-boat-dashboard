const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const SIZE = 248;
const CENTER = SIZE / 2;
const TRANSPARENT = { r: 0, g: 0, b: 0, a: 0 };

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function mix(a, b, t) {
  return a + (b - a) * t;
}

function mixColor(colorA, colorB, t) {
  return {
    r: Math.round(mix(colorA.r, colorB.r, t)),
    g: Math.round(mix(colorA.g, colorB.g, t)),
    b: Math.round(mix(colorA.b, colorB.b, t)),
    a: Math.round(mix(colorA.a ?? 255, colorB.a ?? 255, t)),
  };
}

function withAlpha(color, alpha) {
  return { ...color, a: Math.round(clamp(alpha, 0, 1) * 255) };
}

function smoothstep(edge0, edge1, value) {
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function polygonContains(points, x, y) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const xi = points[i][0];
    const yi = points[i][1];
    const xj = points[j][0];
    const yj = points[j][1];

    const intersect =
      yi > y !== yj > y &&
      x < ((xj - xi) * (y - yi)) / (yj - yi + Number.EPSILON) + xi;
    if (intersect) {
      inside = !inside;
    }
  }
  return inside;
}

function distanceToSegment(px, py, ax, ay, bx, by) {
  const abx = bx - ax;
  const aby = by - ay;
  const ab2 = abx * abx + aby * aby;
  if (ab2 === 0) {
    return Math.hypot(px - ax, py - ay);
  }

  const apx = px - ax;
  const apy = py - ay;
  const t = clamp((apx * abx + apy * aby) / ab2, 0, 1);
  const cx = ax + abx * t;
  const cy = ay + aby * t;
  return Math.hypot(px - cx, py - cy);
}

function distanceToPolyline(px, py, points) {
  let minDistance = Infinity;
  for (let i = 0; i < points.length - 1; i += 1) {
    const [ax, ay] = points[i];
    const [bx, by] = points[i + 1];
    minDistance = Math.min(minDistance, distanceToSegment(px, py, ax, ay, bx, by));
  }
  return minDistance;
}

function createPngBuffer(width, height, pixels) {
  const rows = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y += 1) {
    const rowOffset = y * (width * 4 + 1);
    rows[rowOffset] = 0;
    for (let x = 0; x < width; x += 1) {
      const src = (y * width + x) * 4;
      const dst = rowOffset + 1 + x * 4;
      rows[dst] = pixels[src];
      rows[dst + 1] = pixels[src + 1];
      rows[dst + 2] = pixels[src + 2];
      rows[dst + 3] = pixels[src + 3];
    }
  }

  const signature = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  ]);

  function crc32(buffer) {
    let crc = 0xffffffff;
    for (let i = 0; i < buffer.length; i += 1) {
      crc ^= buffer[i];
      for (let j = 0; j < 8; j += 1) {
        const mask = -(crc & 1);
        crc = (crc >>> 1) ^ (0xedb88320 & mask);
      }
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  function chunk(type, data) {
    const typeBuffer = Buffer.from(type, "ascii");
    const lengthBuffer = Buffer.alloc(4);
    lengthBuffer.writeUInt32BE(data.length, 0);

    const crcBuffer = Buffer.alloc(4);
    const crcValue = crc32(Buffer.concat([typeBuffer, data]));
    crcBuffer.writeUInt32BE(crcValue, 0);

    return Buffer.concat([lengthBuffer, typeBuffer, data, crcBuffer]);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const idat = zlib.deflateSync(rows);

  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const backgroundInner = { r: 8, g: 34, b: 46, a: 255 };
const backgroundOuter = { r: 19, g: 56, b: 69, a: 255 };
const ringColor = { r: 92, g: 218, b: 255, a: 255 };
const hullColor = { r: 244, g: 250, b: 252, a: 255 };
const sailColor = { r: 92, g: 218, b: 255, a: 255 };
const accentColor = { r: 255, g: 172, b: 77, a: 255 };
const shadowColor = { r: 5, g: 18, b: 24, a: 255 };

const sail = [
  [118, 74],
  [118, 148],
  [83, 139],
];

const jib = [
  [122, 85],
  [160, 125],
  [122, 144],
];

const hull = [
  [69, 155],
  [171, 155],
  [188, 166],
  [84, 166],
];

const wake = [
  [87, 181],
  [117, 176],
  [148, 181],
  [180, 176],
];

const windLines = [
  [
    [140, 74],
    [158, 69],
    [177, 74],
    [194, 70],
  ],
  [
    [147, 90],
    [166, 86],
    [185, 91],
    [201, 88],
  ],
  [
    [142, 106],
    [159, 102],
    [176, 107],
    [191, 104],
  ],
];

const northMarker = [
  [124, 32],
  [115, 50],
  [133, 50],
];

const pixels = Buffer.alloc(SIZE * SIZE * 4);

function sampleScene(x, y) {
  const dx = x - CENTER;
  const dy = y - CENTER;
  const distance = Math.hypot(dx, dy);

  if (distance > 118) {
    return TRANSPARENT;
  }

  const radialT = clamp(distance / 118, 0, 1);
  let color = mixColor(backgroundInner, backgroundOuter, radialT);

  const glowT = smoothstep(86, 18, Math.hypot(x - 95, y - 92));
  color = mixColor(color, { r: 20, g: 74, b: 94, a: 255 }, glowT * 0.34);

  const lowerShadeT = smoothstep(0, 1, (y - 124) / 92);
  color = mixColor(color, shadowColor, lowerShadeT * 0.16);

  const ringDistance = Math.abs(distance - 106);
  const ringStrength = 1 - smoothstep(0, 4.5, ringDistance);
  if (ringStrength > 0) {
    color = mixColor(color, ringColor, ringStrength * 0.95);
  }

  if (polygonContains(northMarker, x, y)) {
    color = mixColor(color, ringColor, 0.9);
  }

  for (let i = 0; i < windLines.length; i += 1) {
    const lineDistance = distanceToPolyline(x, y, windLines[i]);
    const lineStrength = 1 - smoothstep(0.8, 4.8, lineDistance);
    if (lineStrength > 0) {
      color = mixColor(color, withAlpha(ringColor, 0.9), lineStrength * 0.9);
    }
  }

  if (polygonContains(sail, x, y)) {
    const sailShade = clamp((150 - y) / 72, 0, 1) * 0.28;
    color = mixColor(color, mixColor(sailColor, hullColor, sailShade), 0.96);
  }

  if (polygonContains(jib, x, y)) {
    const jibShade = clamp((x - 118) / 44, 0, 1) * 0.3;
    color = mixColor(color, mixColor(sailColor, hullColor, jibShade), 0.9);
  }

  const mastDistance = distanceToSegment(x, y, 121, 70, 121, 160);
  const mastStrength = 1 - smoothstep(0.5, 2.2, mastDistance);
  if (mastStrength > 0) {
    color = mixColor(color, hullColor, mastStrength);
  }

  if (polygonContains(hull, x, y)) {
    const hullShade = clamp((y - 154) / 18, 0, 1) * 0.18;
    color = mixColor(color, mixColor(hullColor, accentColor, hullShade), 0.98);
  }

  const keelDistance = distanceToSegment(x, y, 111, 166, 140, 166);
  const keelStrength = 1 - smoothstep(0.6, 2.2, keelDistance);
  if (keelStrength > 0) {
    color = mixColor(color, accentColor, keelStrength * 0.92);
  }

  const wakeDistance = distanceToPolyline(x, y, wake);
  const wakeStrength = 1 - smoothstep(0.7, 3.2, wakeDistance);
  if (wakeStrength > 0) {
    color = mixColor(color, accentColor, wakeStrength * 0.78);
  }

  const innerShadow = smoothstep(103, 118, distance);
  if (innerShadow > 0) {
    color = mixColor(color, shadowColor, innerShadow * 0.28);
  }

  return color;
}

for (let y = 0; y < SIZE; y += 1) {
  for (let x = 0; x < SIZE; x += 1) {
    const offsets = [
      [0.25, 0.25],
      [0.75, 0.25],
      [0.25, 0.75],
      [0.75, 0.75],
    ];
    const accum = { r: 0, g: 0, b: 0, a: 0 };

    for (let i = 0; i < offsets.length; i += 1) {
      const [ox, oy] = offsets[i];
      const sample = sampleScene(x + ox, y + oy);
      accum.r += sample.r;
      accum.g += sample.g;
      accum.b += sample.b;
      accum.a += sample.a ?? 255;
    }

    const index = (y * SIZE + x) * 4;
    pixels[index] = Math.round(accum.r / offsets.length);
    pixels[index + 1] = Math.round(accum.g / offsets.length);
    pixels[index + 2] = Math.round(accum.b / offsets.length);
    pixels[index + 3] = Math.round(accum.a / offsets.length);
  }
}

const outputPath = path.join(__dirname, "boat-dashboard-icon-248.png");
fs.writeFileSync(outputPath, createPngBuffer(SIZE, SIZE, pixels));
console.log(outputPath);
