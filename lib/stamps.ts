export const PALETTES = [
  {
    name: '524',
    colors: ['#F5DC51', '#6AB6C8', '#E58C53', '#4B7560'],
    labels: ['きいろ', 'みずいろ', 'オレンジ', 'ふかみどり'],
  },
  {
    name: 'かわいい',
    colors: ['#E9A2B5', '#B5A3D8', '#B1CFA7', '#EDC58B'],
    labels: ['ピンク', 'ラベンダー', 'ピスタチオ', 'ミルクティー'],
  },
  {
    name: 'かっこいい',
    colors: ['#4460CE', '#B9CE56', '#7F929D', '#323C57'],
    labels: ['ブルー', 'ライム', 'ブルーグレー', 'ネイビー'],
  },
  {
    name: 'モノトーン',
    colors: ['#303032', '#727275', '#B3B1AE', '#E8E5DF'],
    labels: ['すみいろ', 'グレー', 'ライトグレー', 'しろ'],
  },
];
export const STAMPS = [
  {
    id: 'crayon-band',
    name: 'クレヨンの帯',
    box: [20, 64, 316, 114],
    stretch: true,
    decorative: false,
  },
  {
    id: 'oval',
    name: '楕円',
    box: [31, 50, 301, 142],
    stretch: true,
    decorative: false,
  },
  {
    id: 'droplet',
    name: 'しずく',
    box: [109, 28, 137, 180],
    stretch: false,
    decorative: false,
  },
  {
    id: 'star',
    name: '星',
    box: [83, 21, 198, 190],
    stretch: false,
    decorative: false,
  },
  {
    id: '524-silhouette',
    name: '524',
    box: [85, 23, 198, 210],
    stretch: false,
    decorative: false,
  },
  {
    id: 'cheese',
    name: 'チーズ',
    box: [56, 34, 251, 167],
    stretch: false,
    decorative: false,
  },
  {
    id: 'rocket',
    name: 'ロケット',
    box: [81, 30, 160, 194],
    stretch: false,
    decorative: false,
  },
  {
    id: 'ufo',
    name: 'UFO',
    box: [33, 37, 294, 156],
    stretch: false,
    decorative: false,
  },
  {
    id: 'wave',
    name: '波線',
    box: [17, 55, 329, 130],
    stretch: false,
    decorative: true,
  },
  {
    id: 'diagonal-lines',
    name: '斜線',
    box: [47, 50, 277, 141],
    stretch: false,
    decorative: true,
  },
  {
    id: 'straight-arrow',
    name: 'まっすぐ',
    box: [26, 62, 303, 112],
    stretch: false,
    decorative: true,
  },
  {
    id: 'curly-arrow',
    name: 'くるんくるん',
    box: [21, 51, 310, 117],
    stretch: false,
    decorative: true,
  },
  {
    id: 'zigzag-arrow',
    name: 'ジグザグ',
    box: [24, 55, 309, 122],
    stretch: false,
    decorative: true,
  },
  {
    id: 'curved-arrow',
    name: 'ゆったり',
    box: [26, 54, 307, 126],
    stretch: false,
    decorative: true,
  },
] as const;
export type StampId = (typeof STAMPS)[number]['id'];
const ASSET_REVISIONS: Partial<Record<StampId, string>> = {
  wave: '1.2.0',
  'diagonal-lines': '1.2.0',
};
export function stampAssetUrl(id: StampId, kind: 'stamps' | 'thumbs') {
  const revision = ASSET_REVISIONS[id];
  return `/${kind}/${id}.${kind === 'stamps' ? 'svg' : 'png'}${revision ? `?v=${revision}` : ''}`;
}
export function createStampSvg(
  source: string,
  id: StampId,
  color: string,
  palette: number,
  longEdge = 1024,
) {
  if (!/^#[0-9a-f]{6}$/i.test(color)) throw new Error('Invalid stamp color.');
  const spec = STAMPS.find((s) => s.id === id);
  if (!spec) throw new Error('Invalid stamp.');
  const accents = ['#E58C53', '#B5A3D8', '#7F929D', '#727275'],
    details = ['#FFF5DE', '#FFF4F7', '#F1F4FF', '#F6F6F6'];
  const box = spec.box,
    factor = longEdge / Math.max(box[2], box[3]),
    width = Math.ceil(box[2] * factor),
    height = Math.ceil(box[3] * factor);
  const svg = source
    .replace(
      /<svg\b[^>]*>/,
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${box.join(' ')}" color="${color}">`,
    )
    .replaceAll('#FFF5DE', details[palette] ?? details[0])
    .replaceAll('fill="#E58C53"', `fill="${accents[palette] ?? accents[0]}"`);
  return { svg, width, height };
}
