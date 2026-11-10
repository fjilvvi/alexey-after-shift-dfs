import fs from 'node:fs/promises';
import sharp from 'sharp';

const root = new URL('../', import.meta.url).pathname;
const assets = root + 'public/assets/';
const WIDTH = 328;
const HEIGHT = 740;
const BASELINE = 737;
const FRAMES = 8;

async function raw(name) {
  const image = sharp(assets + name + '.png');
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

function sample(layer, x, y) {
  if (x < 0 || y < 0 || x >= layer.width - 1 || y >= layer.height - 1) return [0, 0, 0, 0];
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const fx = x - x0, fy = y - y0;
  const out = [0, 0, 0, 0];
  for (let c = 0; c < 4; c++) {
    const at = (xx, yy) => layer.data[(yy * layer.width + xx) * 4 + c];
    out[c] = at(x0, y0) * (1 - fx) * (1 - fy)
      + at(x0 + 1, y0) * fx * (1 - fy)
      + at(x0, y0 + 1) * (1 - fx) * fy
      + at(x0 + 1, y0 + 1) * fx * fy;
  }
  return out;
}

function over(dst, src) {
  const sa = src[3] / 255;
  if (sa <= 0) return;
  const da = dst[3] / 255;
  const oa = sa + da * (1 - sa);
  if (oa <= 0) return;
  for (let c = 0; c < 3; c++) dst[c] = (src[c] * sa + dst[c] * da * (1 - sa)) / oa;
  dst[3] = oa * 255;
}

function rotateInto(layer, destination, originX, originY, pivotX, pivotY, degrees, offsetY = 0) {
  const angle = degrees * Math.PI / 180;
  const cos = Math.cos(angle), sin = Math.sin(angle);
  const destPivotX = originX + pivotX;
  const destPivotY = originY + pivotY + offsetY;
  let bottom = 0;
  for (let y = Math.max(0, Math.floor(destPivotY - 350)); y < Math.min(HEIGHT, Math.ceil(destPivotY + 350)); y++) {
    for (let x = 0; x < WIDTH; x++) {
      const dx = x - destPivotX, dy = y - destPivotY;
      const sx = pivotX + cos * dx + sin * dy;
      const sy = pivotY - sin * dx + cos * dy;
      if (sx < 0 || sy < 0 || sx >= layer.width || sy >= layer.height) continue;
      const pixel = sample(layer, sx, sy);
      if (pixel[3] < 2) continue;
      const index = (y * WIDTH + x) * 4;
      const dst = [destination[index], destination[index + 1], destination[index + 2], destination[index + 3]];
      over(dst, pixel);
      for (let c = 0; c < 4; c++) destination[index + c] = dst[c];
      if (pixel[3] > 100) bottom = Math.max(bottom, y);
    }
  }
  return bottom;
}

function drawInto(layer, destination, originX, originY, crop = null, offsetY = 0) {
  const sx0 = crop?.left ?? 0;
  const sy0 = crop?.top ?? 0;
  const sw = crop?.width ?? layer.width;
  const sh = crop?.height ?? layer.height;
  for (let sy = 0; sy < sh; sy++) {
    const y = Math.round(originY + sy + offsetY);
    if (y < 0 || y >= HEIGHT) continue;
    for (let sx = 0; sx < sw; sx++) {
      const x = Math.round(originX + sx);
      if (x < 0 || x >= WIDTH) continue;
      const sourceIndex = ((sy + sy0) * layer.width + sx + sx0) * 4;
      const pixel = [layer.data[sourceIndex], layer.data[sourceIndex + 1], layer.data[sourceIndex + 2], layer.data[sourceIndex + 3]];
      if (pixel[3] < 2) continue;
      const index = (y * WIDTH + x) * 4;
      const dst = [destination[index], destination[index + 1], destination[index + 2], destination[index + 3]];
      over(dst, pixel);
      for (let c = 0; c < 4; c++) destination[index + c] = dst[c];
    }
  }
}

function translateY(source, offsetY) {
  const destination = Buffer.alloc(source.length);
  for (let y = 0; y < HEIGHT; y++) {
    const sourceY = y - offsetY;
    if (sourceY < 0 || sourceY >= HEIGHT) continue;
    source.copy(destination, y * WIDTH * 4, sourceY * WIDTH * 4, (sourceY + 1) * WIDTH * 4);
  }
  return destination;
}

const [idle, upper, leftLeg, rightLeg] = await Promise.all([
  raw('hero-idle'), raw('hero-upper'), raw('hero-leg-left'), raw('hero-leg-right'),
]);
// The source split at y=445 also caught the bottom of both hands. They belong
// to the upper sprite, not to a rotating leg, so mask only those two corners.
for (let y = 0; y < 55; y++) {
  for (let x = 0; x < 45; x++) leftLeg.data[(y * leftLeg.width + x) * 4 + 3] = 0;
  for (let x = 118; x < rightLeg.width; x++) rightLeg.data[(y * rightLeg.width + x) * 4 + 3] = 0;
}
const atlas = Buffer.alloc(WIDTH * FRAMES * HEIGHT * 4);
const diagnostics = [];

for (let frame = 0; frame < FRAMES; frame++) {
  const phase = frame * Math.PI * 2 / FRAMES;
  const swing = Math.sin(phase) * 13;
  const asymmetry = Math.cos(phase) * 2.5;
  const leftAngle = swing + asymmetry;
  const rightAngle = -swing + asymmetry;
  const bodyBob = Math.round(Math.sin(phase * 2) * 1.2);
  const pixels = Buffer.alloc(WIDTH * HEIGHT * 4);

  // Hip pivots live inside the original split artwork. The pelvis patch below
  // hides the rotating top edges while preserving the belt and silhouette.
  const leftBottom = rotateInto(leftLeg, pixels, 0, 445, 116, 12, leftAngle, bodyBob);
  const rightBottom = rotateInto(rightLeg, pixels, 165, 445, 43, 12, rightAngle, bodyBob);
  drawInto(upper, pixels, 0, 0, null, bodyBob);
  drawInto(idle, pixels, 80, 390, { left: 80, top: 390, width: 170, height: 128 }, bodyBob);

  const grounded = translateY(pixels, BASELINE - Math.max(leftBottom, rightBottom));
  for (let y = 0; y < HEIGHT; y++) {
    const sourceStart = y * WIDTH * 4;
    const atlasStart = (y * WIDTH * FRAMES + frame * WIDTH) * 4;
    grounded.copy(atlas, atlasStart, sourceStart, sourceStart + WIDTH * 4);
  }
  diagnostics.push({ frame, leftAngle, rightAngle, leftBottom, rightBottom, groundOffset: BASELINE - Math.max(leftBottom, rightBottom) });
}

await sharp(atlas, { raw: { width: WIDTH * FRAMES, height: HEIGHT, channels: 4 } })
  .png({ compressionLevel: 9 })
  .toFile(assets + 'hero-walk.png');
await fs.writeFile(assets + 'walk-metadata.json', JSON.stringify({ width: WIDTH, height: HEIGHT, baseline: BASELINE, frames: FRAMES, diagnostics }, null, 2));
console.log(`Generated ${FRAMES} grounded walk frames: ${WIDTH * FRAMES}x${HEIGHT}`);
