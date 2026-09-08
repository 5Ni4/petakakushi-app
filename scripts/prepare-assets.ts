import fs from 'node:fs/promises';
import sharp from 'sharp';
import { STAMPS, createStampSvg } from '../lib/stamps.ts';
await fs.mkdir('public/thumbs', { recursive: true });
for (const spec of STAMPS) {
  const source = await fs.readFile(`public/stamps/${spec.id}.svg`, 'utf8');
  const color = source.match(/<svg[^>]*\bcolor="(#[a-f0-9]{6})"/i)![1];
  const { svg } = createStampSvg(source, spec.id, color, 0, 240);
  await sharp(Buffer.from(svg)).png().toFile(`public/thumbs/${spec.id}.png`);
}
await sharp('public/thumbs/524-silhouette.png')
  .resize(180, 180, {
    fit: 'contain',
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  })
  .png()
  .toFile('public/favicon.png');
console.log('Prepared 14 lightweight thumbnails and favicon.');
