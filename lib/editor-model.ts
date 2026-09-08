import type { StampId } from './stamps';

export type PlacedStamp = {
  id: string;
  stamp: StampId;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  color: string;
  palette: number;
};
export type EditorHistory = {
  past: PlacedStamp[][];
  present: PlacedStamp[];
  future: PlacedStamp[][];
};
export const emptyHistory = (): EditorHistory => ({
  past: [],
  present: [],
  future: [],
});
export const clamp = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, n));
export const same = (a: PlacedStamp[], b: PlacedStamp[]) =>
  JSON.stringify(a) === JSON.stringify(b);
export function commit(
  h: EditorHistory,
  next: PlacedStamp[],
  before = h.present,
): EditorHistory {
  if (same(before, next)) return { ...h, present: next };
  return { past: [...h.past, before].slice(-60), present: next, future: [] };
}
export function undo(h: EditorHistory): EditorHistory {
  return h.past.length
    ? {
        past: h.past.slice(0, -1),
        present: h.past.at(-1)!,
        future: [h.present, ...h.future].slice(0, 60),
      }
    : h;
}
export function redo(h: EditorHistory): EditorHistory {
  return h.future.length
    ? {
        past: [...h.past, h.present].slice(-60),
        present: h.future[0],
        future: h.future.slice(1),
      }
    : h;
}
export function patch(
  stamps: PlacedStamp[],
  id: string,
  changes: Partial<PlacedStamp>,
) {
  return stamps.map((s) => (s.id === id ? { ...s, ...changes } : s));
}
export function reorder(
  stamps: PlacedStamp[],
  id: string,
  direction: 'front' | 'back',
) {
  const index = stamps.findIndex((s) => s.id === id);
  if (index < 0) return stamps;
  const next = [...stamps];
  const [item] = next.splice(index, 1);
  next.splice(direction === 'front' ? next.length : 0, 0, item);
  return next;
}
export function fitImage(
  width: number,
  height: number,
  viewWidth: number,
  viewHeight: number,
) {
  return Math.min(
    Math.max(1, viewWidth - 36) / width,
    Math.max(1, viewHeight - 36) / height,
  );
}
export function constrainImage(width: number, height: number) {
  const ratio = Math.min(
    1,
    8192 / width,
    8192 / height,
    Math.sqrt(16_000_000 / (width * height)),
  );
  return {
    width: Math.max(1, Math.floor(width * ratio)),
    height: Math.max(1, Math.floor(height * ratio)),
    resized: ratio < 1,
  };
}
export function resizeStamp(
  stamp: PlacedStamp,
  factor: number,
  maxDimension: number,
) {
  const bounded = clamp(
    factor,
    Math.max(12 / stamp.width, 12 / stamp.height),
    maxDimension / Math.max(stamp.width, stamp.height),
  );
  return { width: stamp.width * bounded, height: stamp.height * bounded };
}
