'use client';

import { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { STAMPS, PALETTES, stampAssetUrl, type StampId } from '@/lib/stamps';

const categories = [
  { id: 'all', name: 'すべて', stamps: STAMPS },
  {
    id: 'lines',
    name: 'ライン',
    stamps: STAMPS.filter((s) =>
      ['crayon-band', 'oval', 'wave', 'diagonal-lines'].includes(s.id),
    ),
  },
  {
    id: 'arrows',
    name: '矢印',
    stamps: STAMPS.filter((s) => s.id.endsWith('-arrow')),
  },
  {
    id: 'illustrations',
    name: 'イラスト',
    stamps: STAMPS.filter(
      (s) => !s.decorative && s.id !== 'crayon-band' && s.id !== 'oval',
    ),
  },
];
const paletteItems = PALETTES.map((p, value) => ({ value, label: p.name }));

type StampTrayProps = {
  palette: number;
  color: string;
  selectedStamp?: StampId;
  disabled: boolean;
  onPaletteChange: (palette: number) => void;
  onColorChange: (color: string) => void;
  onAddStamp: (id: StampId) => void;
};

export function StampTray({
  palette,
  color,
  selectedStamp,
  disabled,
  onPaletteChange,
  onColorChange,
  onAddStamp,
}: StampTrayProps) {
  const [category, setCategory] = useState('all');
  const visible = categories.find((c) => c.id === category)!;
  return (
    <aside className="stamp-tray" aria-label="スタンプと色">
      <div className="tray-title">
        <h2>スタンプ</h2>
        <span>{visible.stamps.length}こ</span>
      </div>
      <Tabs
        value={category}
        onValueChange={(value) => setCategory(String(value))}
        className="stamp-tabs"
      >
        <TabsList className="stamp-category-list" aria-label="スタンプの種類">
          {categories.map((c) => (
            <TabsTrigger key={c.id} value={c.id} className="stamp-category-tab">
              {c.name}
            </TabsTrigger>
          ))}
        </TabsList>
        <div className="stamp-color-controls">
          <div className="stamp-color-choice">
            <p className="stamp-color-label" id="stamp-color-label">
              {selectedStamp ? '選んだスタンプの色' : '次に置く色'}
            </p>
            <div
              className="stamp-swatches"
              role="group"
              aria-labelledby="stamp-color-label"
            >
              {PALETTES[palette].colors.map((c, i) => (
                <button
                  key={c}
                  type="button"
                  className={`stamp-swatch ${c === color ? 'active' : ''}`}
                  aria-label={PALETTES[palette].labels[i]}
                  aria-pressed={c === color}
                  disabled={disabled}
                  onClick={() => onColorChange(c)}
                >
                  <span style={{ background: c }} />
                </button>
              ))}
            </div>
          </div>
          <div className="stamp-palette-choice">
            <label className="stamp-color-label" htmlFor="stamp-palette">
              パレット
            </label>
            <Select
              items={paletteItems}
              value={palette}
              disabled={disabled}
              onValueChange={(value) => {
                if (value !== null) onPaletteChange(value);
              }}
            >
              <SelectTrigger
                id="stamp-palette"
                className="stamp-palette-trigger"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent
                className="stamp-palette-menu"
                align="end"
                alignItemWithTrigger={false}
              >
                {PALETTES.map((p, i) => (
                  <SelectItem
                    key={p.name}
                    value={i}
                    className="stamp-palette-option"
                  >
                    <span className="palette-option-colors" aria-hidden="true">
                      {p.colors.map((c) => (
                        <span key={c} style={{ background: c }} />
                      ))}
                    </span>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        {categories.map((c) => (
          <TabsContent
            key={c.id}
            value={c.id}
            className="stamp-category-content"
          >
            <div className="sticker-grid">
              {c.stamps.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={`sticker-tile ${selectedStamp === s.id ? 'selected-type' : ''}`}
                  disabled={disabled}
                  aria-label={`${s.name}を追加${s.decorative ? '（飾り用）' : ''}`}
                  onClick={() => onAddStamp(s.id)}
                >
                  <img
                    src={stampAssetUrl(s.id, 'thumbs')}
                    alt=""
                    loading="lazy"
                  />
                  <span>{s.name}</span>
                </button>
              ))}
            </div>
          </TabsContent>
        ))}
      </Tabs>
      <p className="tray-hint">好きな形をタップして追加</p>
    </aside>
  );
}
