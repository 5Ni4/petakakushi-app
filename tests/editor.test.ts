import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import sharp from 'sharp';
import {
  emptyHistory,
  commit,
  undo,
  redo,
  patch,
  reorder,
  constrainImage,
  resizeStamp,
  type PlacedStamp,
} from '../lib/editor-model.ts';
import { STAMPS, createStampSvg } from '../lib/stamps.ts';

const one: PlacedStamp = {
  id: 'one',
  stamp: 'crayon-band',
  x: 100,
  y: 120,
  width: 180,
  height: 70,
  rotation: 0,
  color: '#6AB6C8',
  palette: 0,
};
test('undo restores movement as one action; branching discards redo', () => {
  let h = commit(emptyHistory(), [one]);
  const before = h.present;
  h = { ...h, present: patch(h.present, 'one', { x: 105 }) };
  h = { ...h, present: patch(h.present, 'one', { x: 130 }) };
  h = commit(h, h.present, before);
  assert.equal(h.past.length, 2);
  h = undo(h);
  assert.equal(h.present[0].x, 100);
  assert.equal(redo(h).present[0].x, 130);
  h = commit(h, patch(h.present, 'one', { color: '#F5DC51' }));
  assert.equal(h.future.length, 0);
  assert.equal(undo(h).present[0].color, '#6AB6C8');
});
test('layer ordering and deletion are reversible', () => {
  const two = { ...one, id: 'two' };
  let h = commit(emptyHistory(), [one, two]);
  h = commit(h, reorder(h.present, 'one', 'front'));
  assert.deepEqual(
    h.present.map((s) => s.id),
    ['two', 'one'],
  );
  h = commit(
    h,
    h.present.filter((s) => s.id !== 'two'),
  );
  assert.equal(undo(h).present.length, 2);
  assert.deepEqual(reorder(h.present, 'missing', 'back'), h.present);
});
test('step ordering moves only past the adjacent stamp and preserves the artwork', () => {
  const two = { ...one, id: 'two', x: 80, rotation: 45 };
  const three = { ...one, id: 'three', color: '#F5DC51' };
  const four = { ...one, id: 'four', width: 220 };
  const original = [one, two, three, four];
  const forward = reorder(original, 'two', 'forward');
  assert.deepEqual(forward, [one, three, two, four]);
  assert.deepEqual(reorder(original, 'two', 'backward'), [
    two,
    one,
    three,
    four,
  ]);
  assert.deepEqual(reorder(original, 'two', 'front'), [one, three, four, two]);
  assert.deepEqual(reorder(original, 'three', 'back'), [three, one, two, four]);
  assert.deepEqual(original, [one, two, three, four]);
  for (const stamp of forward) {
    assert.equal(
      stamp,
      original.find((s) => s.id === stamp.id),
    );
  }
});
test('layer boundaries and missing stamps are no-ops that keep redo available', () => {
  const two = { ...one, id: 'two' };
  const stamps = [one, two];
  for (const [id, direction] of [
    ['one', 'backward'],
    ['one', 'back'],
    ['two', 'forward'],
    ['two', 'front'],
    ['missing', 'forward'],
  ] as const) {
    assert.equal(reorder(stamps, id, direction), stamps);
  }
  const single = [one];
  const empty: PlacedStamp[] = [];
  for (const direction of ['forward', 'backward', 'front', 'back'] as const) {
    assert.equal(reorder(single, 'one', direction), single);
    assert.equal(reorder(empty, 'one', direction), empty);
  }
  let h = commit(emptyHistory(), stamps);
  h = commit(h, reorder(h.present, 'one', 'forward'));
  h = undo(h);
  const unchanged = commit(h, reorder(h.present, 'two', 'forward'));
  assert.deepEqual(unchanged, h);
  assert.deepEqual(redo(unchanged).present, [two, one]);
});
test('consecutive step moves undo and redo individually; a new order branches history', () => {
  const two = { ...one, id: 'two' };
  const three = { ...one, id: 'three' };
  let h = commit(emptyHistory(), [one, two, three]);
  h = commit(h, reorder(h.present, 'one', 'forward'));
  const first = h;
  h = commit(h, reorder(h.present, 'one', 'forward'));
  assert.deepEqual(h.present, [two, three, one]);
  assert.deepEqual(undo(h).present, first.present);
  assert.deepEqual(undo(undo(h)).present, [one, two, three]);
  assert.deepEqual(redo(undo(h)).present, h.present);
  const branch = commit(undo(h), reorder(first.present, 'three', 'backward'));
  assert.deepEqual(branch.present, [two, three, one]);
  assert.equal(branch.future.length, 0);
});
test('cancelled gesture preserves undo and redo', () => {
  let h = commit(emptyHistory(), [one]);
  h = commit(h, patch(h.present, 'one', { x: 140 }));
  h = undo(h);
  const before = h.present;
  h = { ...h, present: patch(h.present, 'one', { x: 150 }) };
  h = { ...h, present: before };
  assert.equal(redo(h).present[0].x, 140);
});
test('image dimensions preserve normal screenshots and bound long/large inputs', () => {
  assert.deepEqual(constrainImage(1290, 2796), {
    width: 1290,
    height: 2796,
    resized: false,
  });
  for (const [w, h] of [
    [4000, 10000],
    [100000, 100],
    [15000, 18000],
  ]) {
    const size = constrainImage(w, h);
    assert.ok(size.width * size.height <= 16_000_000);
    assert.ok(size.width <= 8192 && size.height <= 8192);
    assert.ok(size.width >= 1 && size.height >= 1);
  }
});
test('resize preserves aspect and minimum usable dimensions', () => {
  const size = resizeStamp(one, 0.0001, 4000);
  assert.ok(size.height >= 12);
  assert.equal(size.width / size.height, one.width / one.height);
  const huge = resizeStamp(one, 10000, 4000);
  assert.ok(Math.max(huge.width, huge.height) <= 4000);
});
test('every original stamp rasterizes after cropping and recoloring', async () => {
  for (const spec of STAMPS) {
    const source = await fs.readFile(`public/stamps/${spec.id}.svg`, 'utf8');
    const result = createStampSvg(source, spec.id, '#303032', 3, 360);
    assert.ok(!result.svg.includes('fill="#E58C53"'));
    const { info } = await sharp(Buffer.from(result.svg))
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    assert.equal(info.width, result.width);
    assert.equal(info.height, result.height);
    assert.equal(info.channels, 4);
  }
});
test('mask interiors including texture and cheese holes are fully opaque', async () => {
  const regions: Record<string, [number, number, number, number]> = {
    'crayon-band': [75, 105, 210, 35],
    oval: [100, 100, 155, 38],
    droplet: [153, 135, 42, 25],
    star: [168, 110, 25, 40],
    '524-silhouette': [135, 105, 99, 65],
    cheese: [95, 133, 160, 34],
    ufo: [130, 139, 100, 20],
    rocket: [171, 85, 18, 22],
  };
  for (const [id, [x, y, w, h]] of Object.entries(regions)) {
    const svg = (await fs.readFile(`public/stamps/${id}.svg`, 'utf8')).replace(
      'width="1080" height="720"',
      'width="360" height="240"',
    );
    const { data, info } = await sharp(Buffer.from(svg))
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    // Rocket sample is transformed by the artwork's existing 24-degree rotation.
    for (let dy = 0; dy < h; dy++)
      for (let dx = 0; dx < w; dx++) {
        let px = x + dx,
          py = y + dy;
        if (id === 'rocket') {
          const a = (24 * Math.PI) / 180,
            ox = px - 180,
            oy = py - 120;
          px = Math.round(180 + ox * Math.cos(a) - oy * Math.sin(a));
          py = Math.round(120 + ox * Math.sin(a) + oy * Math.cos(a));
        }
        assert.equal(
          data[(py * info.width + px) * 4 + 3],
          255,
          `${id} is transparent at ${px},${py}`,
        );
      }
  }
});
