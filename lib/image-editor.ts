import { createStampSvg, type StampId } from './stamps';
import type { PlacedStamp } from './editor-model';

export type StampBitmap = { image: HTMLImageElement; url: string };
const sourceCache = new Map<string, Promise<string>>();
const bitmapCache = new Map<string, Promise<StampBitmap>>();
const bitmapUrls = new Set<string>();
export const stampKey = (s: Pick<PlacedStamp, 'stamp' | 'color' | 'palette'>) =>
  `${s.stamp}:${s.color}:${s.palette}`;
export function blobFromCanvas(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob(
        (b) =>
          b ? resolve(b) : reject(new Error('画像を保存できませんでした。')),
        'image/png',
      );
    } catch (error) {
      reject(error);
    }
  });
}
export async function decodeImage(url: string) {
  const image = new Image();
  image.decoding = 'async';
  image.src = url;
  await image.decode();
  return image;
}
export function getStampBitmap(
  id: StampId,
  color: string,
  palette: number,
): Promise<StampBitmap> {
  const key = `${id}:${color}:${palette}`;
  const existing = bitmapCache.get(key);
  if (existing) return existing;
  const task = renderStamp(id, color, palette).catch((error) => {
    bitmapCache.delete(key);
    throw error;
  });
  bitmapCache.set(key, task);
  return task;
}
async function renderStamp(
  id: StampId,
  color: string,
  palette: number,
): Promise<StampBitmap> {
  if (!sourceCache.has(id))
    sourceCache.set(
      id,
      fetch(`/stamps/${id}.svg`)
        .then((r) => {
          if (!r.ok) throw new Error('スタンプを読み込めませんでした。');
          return r.text();
        })
        .catch((e) => {
          sourceCache.delete(id);
          throw e;
        }),
    );
  const source = await sourceCache.get(id)!;
  // The approved vector art is kept intact. Only the outer viewport and ink colors change.
  const { svg, width, height } = createStampSvg(source, id, color, palette);
  const sourceUrl = URL.createObjectURL(
    new Blob([svg], { type: 'image/svg+xml' }),
  );
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  try {
    const image = await decodeImage(sourceUrl);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('画像の準備に失敗しました。');
    ctx.drawImage(image, 0, 0, width, height);
    const blob = await blobFromCanvas(canvas);
    const url = URL.createObjectURL(blob);
    bitmapUrls.add(url);
    try {
      return { url, image: await decodeImage(url) };
    } catch (error) {
      URL.revokeObjectURL(url);
      bitmapUrls.delete(url);
      throw error;
    }
  } finally {
    URL.revokeObjectURL(sourceUrl);
    canvas.width = canvas.height = 1;
  }
}
export async function renderExport(
  image: HTMLImageElement,
  width: number,
  height: number,
  stamps: PlacedStamp[],
): Promise<Blob> {
  // Prepare everything before painting, so failed assets can never produce a partial export.
  const bitmaps = await Promise.all(
    stamps.map((s) => getStampBitmap(s.stamp, s.color, s.palette)),
  );
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  try {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('画像を書き出せませんでした。');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(image, 0, 0, width, height);
    stamps.forEach((s, i) => {
      ctx.save();
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      ctx.translate(s.x, s.y);
      ctx.rotate((s.rotation * Math.PI) / 180);
      ctx.drawImage(
        bitmaps[i].image,
        -s.width / 2,
        -s.height / 2,
        s.width,
        s.height,
      );
      ctx.restore();
    });
    return await blobFromCanvas(canvas);
  } finally {
    canvas.width = canvas.height = 1;
  }
}
export function disposeStampCache() {
  for (const url of bitmapUrls) URL.revokeObjectURL(url);
  bitmapUrls.clear();
  bitmapCache.clear();
  sourceCache.clear();
}
export function releaseStampBitmaps(keys: string[]) {
  for (const key of keys) {
    const task = bitmapCache.get(key);
    if (!task) continue;
    bitmapCache.delete(key);
    void task
      .then((bitmap) => {
        URL.revokeObjectURL(bitmap.url);
        bitmapUrls.delete(bitmap.url);
        bitmap.image.src = '';
      })
      .catch(() => {});
  }
}
