'use client';

import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import {
  ImagePlus,
  ShieldCheck,
  Download,
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  Scan,
  Hand,
  Move,
  MoreHorizontal,
  Copy,
  Trash2,
  ArrowUpToLine,
  ArrowDownToLine,
  ArrowUp,
  ArrowDown,
  Layers,
  RotateCw,
  Share2,
  X,
  LoaderCircle,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { StampTray } from '@/components/stamp-tray';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { STAMPS, PALETTES, stampAssetUrl, type StampId } from '@/lib/stamps';
import {
  clamp,
  commit,
  undo,
  redo,
  emptyHistory,
  patch,
  reorder,
  fitImage,
  constrainImage,
  resizeStamp,
  type PlacedStamp,
  type EditorHistory,
  type LayerDirection,
} from '@/lib/editor-model';
import {
  getStampBitmap,
  renderExport,
  decodeImage,
  blobFromCanvas,
  stampKey,
  releaseStampBitmaps,
  type StampBitmap,
} from '@/lib/image-editor';
import { registerEditorTools } from '@/lib/webmcp';

type Photo = {
  url: string;
  image: HTMLImageElement;
  width: number;
  height: number;
};
type View = { zoom: number; x: number; y: number };
type Gesture = {
  pointer: number;
  mode: 'move' | 'resize' | 'pan';
  startX: number;
  startY: number;
  stamp?: PlacedStamp;
  before: PlacedStamp[];
  view: View;
  distance: number;
};
type Saved = { url: string; file: File; width: number; height: number };
const specFor = (id: StampId) => STAMPS.find((s) => s.id === id)!;
const numeric = (v: number | readonly number[]) =>
  Array.isArray(v) ? v[0] : (v as number);
const freshView = (): View => ({ zoom: 1, x: 0, y: 0 });

export default function Home() {
  const input = useRef<HTMLInputElement>(null),
    viewport = useRef<HTMLDivElement>(null),
    stage = useRef<HTMLDivElement>(null);
  const [photo, setPhoto] = useState<Photo | null>(null),
    photoRef = useRef<Photo | null>(null);
  const [history, setHistory] = useState<EditorHistory>(emptyHistory),
    historyRef = useRef<EditorHistory>(emptyHistory());
  const [selected, setSelected] = useState<string | null>(null),
    selectedRef = useRef<string | null>(null);
  const [palette, setPalette] = useState(0),
    [color, setColor] = useState(PALETTES[0].colors[1]);
  const paletteRef = useRef(palette),
    colorRef = useRef(color);
  paletteRef.current = palette;
  colorRef.current = color;
  const [view, setView] = useState<View>(freshView),
    viewRef = useRef<View>(freshView());
  const [area, setArea] = useState({ width: 800, height: 600 });
  const [panMode, setPanMode] = useState(false),
    [busy, setBusy] = useState(false),
    busyRef = useRef(false);
  const [exporting, setExporting] = useState(false),
    [message, setMessage] = useState('');
  const [dragOver, setDragOver] = useState(false),
    [saved, setSaved] = useState<Saved | null>(null);
  const [assetImages, setAssetImages] = useState<Record<string, StampBitmap>>(
    {},
  );
  const [layersOpen, setLayersOpen] = useState(false),
    [layerMessage, setLayerMessage] = useState(''),
    [canShare, setCanShare] = useState(false);
  const loadVersion = useRef(0),
    generation = useRef(0),
    savedRef = useRef<Saved | null>(null),
    mounted = useRef(true);
  const gesture = useRef<Gesture | null>(null),
    pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{
    distance: number;
    zoom: number;
    anchorX: number;
    anchorY: number;
  } | null>(null);
  const sliderBefore = useRef<PlacedStamp[] | null>(null);
  const fit = photo
    ? fitImage(photo.width, photo.height, area.width, area.height)
    : 1;
  const scale = fit * view.zoom;
  const item = history.present.find((s) => s.id === selected);
  const spec = item ? specFor(item.stamp) : null;

  function updateHistory(next: EditorHistory) {
    historyRef.current = next;
    setHistory(next);
  }
  function select(id: string | null) {
    selectedRef.current = id;
    setSelected(id);
    const found = historyRef.current.present.find((s) => s.id === id);
    if (found) {
      setPalette(found.palette);
      paletteRef.current = found.palette;
      setColor(found.color);
      colorRef.current = found.color;
    }
  }
  function updateView(next: View) {
    viewRef.current = next;
    setView(next);
  }
  function change(stamps: PlacedStamp[]) {
    updateHistory(commit(historyRef.current, stamps));
  }
  function transformSelection(changes: Partial<PlacedStamp>) {
    const id = selectedRef.current;
    if (id) change(patch(historyRef.current.present, id, changes));
  }
  function cache(bitmap: StampBitmap, id: StampId, c: string, p: number) {
    setAssetImages((previous) => ({
      ...previous,
      [`${id}:${c}:${p}`]: bitmap,
    }));
  }
  function resetSaved() {
    if (savedRef.current) URL.revokeObjectURL(savedRef.current.url);
    savedRef.current = null;
    setSaved(null);
  }
  async function restoreHistory(next: EditorHistory) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      const bitmaps = await Promise.all(
        next.present.map((s) => getStampBitmap(s.stamp, s.color, s.palette)),
      );
      setAssetImages((previous) => {
        const result = { ...previous };
        next.present.forEach((s, i) => {
          result[stampKey(s)] = bitmaps[i];
        });
        return result;
      });
      updateHistory(next);
      select(selectedRef.current);
    } catch {
      setMessage('編集を戻せませんでした。もう一度試してね。');
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  function runUndo() {
    if (busyRef.current) return;
    finishGesture();
    pointers.current.clear();
    pinch.current = null;
    sliderBefore.current = null;
    void restoreHistory(undo(historyRef.current));
  }
  function runRedo() {
    if (busyRef.current) return;
    finishGesture();
    pointers.current.clear();
    pinch.current = null;
    sliderBefore.current = null;
    void restoreHistory(redo(historyRef.current));
  }
  function deleteSelected() {
    const id = selectedRef.current;
    if (!id) return;
    change(historyRef.current.present.filter((s) => s.id !== id));
    select(null);
  }
  function duplicateSelected() {
    const found = historyRef.current.present.find(
      (s) => s.id === selectedRef.current,
    );
    const p = photoRef.current;
    if (!found || !p) return;
    if (historyRef.current.present.length >= 60) {
      setMessage('スタンプは1枚の画像に60こまで置けます。');
      return;
    }
    const added = {
      ...found,
      id: crypto.randomUUID(),
      x: clamp(found.x + p.width * 0.025, 0, p.width),
      y: clamp(found.y + p.width * 0.025, 0, p.height),
    };
    change([...historyRef.current.present, added]);
    select(added.id);
  }
  function changeOrder(direction: LayerDirection, id = selectedRef.current) {
    if (!id || busyRef.current) return;
    finishGesture();
    const before = historyRef.current.present;
    const next = reorder(before, id, direction);
    if (next === before) return;
    change(next);
    const index = next.findIndex((s) => s.id === id);
    setLayerMessage(
      `${specFor(next[index].stamp).name}を手前から${next.length - index}番目に移動しました。`,
    );
  }

  async function choose(file?: File) {
    if (!file || busyRef.current) return;
    if (file.size > 60 * 1024 * 1024) {
      setMessage('画像が大きすぎるので、60MB以下の画像を選んでね。');
      return;
    }
    if (file.type === 'image/svg+xml' || /\.svg$/i.test(file.name)) {
      setMessage('スクショ・写真のPNG、JPEG、WebPなどを選んでね。');
      return;
    }
    const request = ++loadVersion.current;
    busyRef.current = true;
    setBusy(true);
    setMessage('画像を開いています…');
    let url = URL.createObjectURL(file),
      source: HTMLImageElement | null = null;
    try {
      source = await decodeImage(url);
      const size = constrainImage(source.naturalWidth, source.naturalHeight);
      if (size.resized) {
        const canvas = document.createElement('canvas');
        canvas.width = size.width;
        canvas.height = size.height;
        try {
          const ctx = canvas.getContext('2d');
          if (!ctx) throw Error();
          ctx.drawImage(source, 0, 0, size.width, size.height);
          const blob = await blobFromCanvas(canvas);
          URL.revokeObjectURL(url);
          source.src = '';
          url = URL.createObjectURL(blob);
          source = await decodeImage(url);
        } finally {
          canvas.width = canvas.height = 1;
        }
      }
      if (!mounted.current || request !== loadVersion.current) {
        URL.revokeObjectURL(url);
        return;
      }
      if (photoRef.current) {
        URL.revokeObjectURL(photoRef.current.url);
        photoRef.current.image.src = '';
      }
      const next = {
        url,
        image: source,
        width: size.width,
        height: size.height,
      };
      photoRef.current = next;
      setPhoto(next);
      generation.current++;
      updateHistory(emptyHistory());
      select(null);
      updateView(freshView());
      resetSaved();
      setMessage(
        size.resized
          ? `大きな画像のため、${size.width} × ${size.height}pxに調整しました。`
          : '画像を開いたよ。好きなスタンプを置いてね。',
      );
    } catch {
      URL.revokeObjectURL(url);
      setMessage('画像を開けませんでした。PNGやJPEGのスクショで試してね。');
    } finally {
      busyRef.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  async function addStamp(
    id: StampId,
    position?: { x: number; y: number },
    ink?: string,
    paletteIndex?: number,
  ) {
    const p = photoRef.current;
    if (!p) {
      input.current?.click();
      return null;
    }
    if (busyRef.current) return null;
    if (historyRef.current.present.length >= 60) {
      setMessage('スタンプは1枚の画像に60こまで置けます。');
      return null;
    }
    const stampSpec = specFor(id),
      c = ink ?? colorRef.current,
      pi = paletteIndex ?? paletteRef.current,
      currentGeneration = generation.current;
    busyRef.current = true;
    setBusy(true);
    try {
      const bitmap = await getStampBitmap(id, c, pi);
      if (currentGeneration !== generation.current || !mounted.current)
        return null;
      cache(bitmap, id, c, pi);
      const width = Math.min(
        p.width * 0.55,
        Math.min(p.width, p.height) * (stampSpec.stretch ? 0.46 : 0.31),
      );
      const height = (width * stampSpec.box[3]) / stampSpec.box[2];
      const currentFit =
        fitImage(p.width, p.height, area.width, area.height) *
        viewRef.current.zoom;
      const added: PlacedStamp = {
        id: crypto.randomUUID(),
        stamp: id,
        x: position
          ? clamp(position.x, 0, p.width)
          : clamp(p.width / 2 - viewRef.current.x / currentFit, 0, p.width),
        y: position
          ? clamp(position.y, 0, p.height)
          : clamp(p.height / 2 - viewRef.current.y / currentFit, 0, p.height),
        width,
        height,
        rotation: 0,
        color: c,
        palette: pi,
      };
      change([...historyRef.current.present, added]);
      select(added.id);
      setPanMode(false);
      setMessage(
        stampSpec.decorative
          ? '線のスタンプは飾り用。文字を隠すときは帯や塗りつぶした形を使ってね。'
          : `${stampSpec.name}を置いたよ。指で動かして位置を合わせてね。`,
      );
      return added.id;
    } catch {
      setMessage('スタンプを準備できませんでした。もう一度タップしてね。');
      return null;
    } finally {
      busyRef.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  async function applyColor(c: string, pi = paletteRef.current) {
    if (busyRef.current) return;
    setColor(c);
    colorRef.current = c;
    const found = historyRef.current.present.find(
      (s) => s.id === selectedRef.current,
    );
    if (!found) return;
    busyRef.current = true;
    setBusy(true);
    const currentGeneration = generation.current;
    try {
      const bitmap = await getStampBitmap(found.stamp, c, pi);
      if (currentGeneration === generation.current && mounted.current) {
        cache(bitmap, found.stamp, c, pi);
        change(
          patch(historyRef.current.present, found.id, {
            color: c,
            palette: pi,
          }),
        );
      }
    } catch {
      setMessage('色を変えられませんでした。もう一度試してね。');
    } finally {
      busyRef.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  function switchPalette(i: number) {
    if (busyRef.current) return;
    setPalette(i);
    paletteRef.current = i;
    void applyColor(PALETTES[i].colors[0], i);
  }
  function setZoom(next: number) {
    const old = viewRef.current;
    const zoom = clamp(next, 1, 6);
    updateView(
      zoom === 1
        ? freshView()
        : { zoom, x: (old.x * zoom) / old.zoom, y: (old.y * zoom) / old.zoom },
    );
  }
  function imagePoint(clientX: number, clientY: number) {
    const rect = stage.current?.getBoundingClientRect();
    const p = photoRef.current;
    if (!rect || !p) return { x: 0, y: 0 };
    return {
      x: ((clientX - rect.left) / rect.width) * p.width,
      y: ((clientY - rect.top) / rect.height) * p.height,
    };
  }
  function finishGesture(cancel = false) {
    const g = gesture.current;
    if (g && g.mode !== 'pan') {
      updateHistory(
        cancel
          ? { ...historyRef.current, present: g.before }
          : commit(historyRef.current, historyRef.current.present, g.before),
      );
    }
    gesture.current = null;
  }
  function pointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (!photoRef.current || busyRef.current || exporting || e.button > 0)
      return;
    const target = e.target as HTMLElement;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      finishGesture();
      const [a, b] = [...pointers.current.values()];
      const rect = viewport.current!.getBoundingClientRect();
      const current = viewRef.current;
      pinch.current = {
        distance: Math.max(1, Math.hypot(b.x - a.x, b.y - a.y)),
        zoom: current.zoom,
        anchorX:
          ((a.x + b.x) / 2 - (rect.left + rect.width / 2) - current.x) /
          current.zoom,
        anchorY:
          ((a.y + b.y) / 2 - (rect.top + rect.height / 2) - current.y) /
          current.zoom,
      };
      e.currentTarget.setPointerCapture(e.pointerId);
      e.preventDefault();
      return;
    }
    if (pointers.current.size > 2) return;
    const stampElement = target.closest<HTMLElement>('[data-stamp-id]');
    const found = historyRef.current.present.find(
      (s) => s.id === stampElement?.dataset.stampId,
    );
    const point = imagePoint(e.clientX, e.clientY);
    if (found && !panMode) {
      select(found.id);
      stampElement?.focus({ preventScroll: true });
      gesture.current = {
        pointer: e.pointerId,
        mode: target.closest('[data-resize]') ? 'resize' : 'move',
        startX: point.x,
        startY: point.y,
        stamp: { ...found },
        before: historyRef.current.present,
        view: { ...viewRef.current },
        distance: Math.max(1, Math.hypot(point.x - found.x, point.y - found.y)),
      };
    } else {
      if (!panMode) select(null);
      gesture.current = {
        pointer: e.pointerId,
        mode: 'pan',
        startX: e.clientX,
        startY: e.clientY,
        before: historyRef.current.present,
        view: { ...viewRef.current },
        distance: 1,
      };
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    e.preventDefault();
  }
  function pointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch.current && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      const start = pinch.current;
      const rect = viewport.current!.getBoundingClientRect();
      const zoom = clamp(
        (start.zoom * Math.hypot(a.x - b.x, a.y - b.y)) / start.distance,
        1,
        6,
      );
      updateView(
        zoom === 1
          ? freshView()
          : {
              zoom,
              x:
                (a.x + b.x) / 2 -
                rect.left -
                rect.width / 2 -
                start.anchorX * zoom,
              y:
                (a.y + b.y) / 2 -
                rect.top -
                rect.height / 2 -
                start.anchorY * zoom,
            },
      );
      return;
    }
    const g = gesture.current,
      p = photoRef.current;
    if (!g || g.pointer !== e.pointerId || !p) return;
    if (g.mode === 'pan') {
      if (viewRef.current.zoom > 1)
        updateView({
          ...g.view,
          x: g.view.x + e.clientX - g.startX,
          y: g.view.y + e.clientY - g.startY,
        });
      return;
    }
    const point = imagePoint(e.clientX, e.clientY),
      s = g.stamp!;
    let changes: Partial<PlacedStamp>;
    if (g.mode === 'move')
      changes = {
        x: clamp(s.x + point.x - g.startX, 0, p.width),
        y: clamp(s.y + point.y - g.startY, 0, p.height),
      };
    else
      changes = resizeStamp(
        s,
        Math.hypot(point.x - s.x, point.y - s.y) / g.distance,
        Math.max(p.width, p.height) * 2,
      );
    updateHistory({
      ...historyRef.current,
      present: patch(historyRef.current.present, s.id, changes),
    });
  }
  function pointerUp(e: ReactPointerEvent<HTMLDivElement>, cancel = false) {
    pointers.current.delete(e.pointerId);
    if (pinch.current) {
      if (pointers.current.size < 2) pinch.current = null;
      gesture.current = null;
    } else if (gesture.current?.pointer === e.pointerId) finishGesture(cancel);
    if (e.currentTarget.hasPointerCapture(e.pointerId))
      e.currentTarget.releasePointerCapture(e.pointerId);
  }
  function adjust(changes: Partial<PlacedStamp>, final = false) {
    const id = selectedRef.current;
    if (!id) return;
    if (!sliderBefore.current)
      sliderBefore.current = historyRef.current.present;
    const next = patch(historyRef.current.present, id, changes);
    if (final) {
      updateHistory(commit(historyRef.current, next, sliderBefore.current));
      sliderBefore.current = null;
    } else updateHistory({ ...historyRef.current, present: next });
  }
  function sizeChange(value: number | readonly number[], final = false) {
    if (!item || !photo) return;
    const width = (numeric(value) / 100) * photo.width;
    adjust({ width, height: (item.height * width) / item.width }, final);
  }
  function stampKeyDown(e: React.KeyboardEvent, id: string) {
    if (busyRef.current) return;
    select(id);
    const s = historyRef.current.present.find((x) => x.id === id),
      p = photoRef.current;
    if (!s || !p) return;
    const delta = e.shiftKey ? 10 : 1;
    const movement: Record<string, [number, number]> = {
      ArrowLeft: [-delta, 0],
      ArrowRight: [delta, 0],
      ArrowUp: [0, -delta],
      ArrowDown: [0, delta],
    };
    if (movement[e.key]) {
      e.preventDefault();
      e.stopPropagation();
      const [dx, dy] = movement[e.key];
      change(
        patch(historyRef.current.present, id, {
          x: clamp(s.x + dx, 0, p.width),
          y: clamp(s.y + dy, 0, p.height),
        }),
      );
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      deleteSelected();
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      select(id);
    }
  }

  async function exportImage() {
    const p = photoRef.current;
    if (!p || busyRef.current) return false;
    finishGesture();
    busyRef.current = true;
    setExporting(true);
    setMessage('画像をまとめています…');
    try {
      const blob = await renderExport(
        p.image,
        p.width,
        p.height,
        historyRef.current.present,
      );
      if (!mounted.current) return false;
      resetSaved();
      const now = new Date();
      const name = `petakakushi-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}.png`;
      const file = new File([blob], name, { type: 'image/png' });
      const next = {
        url: URL.createObjectURL(blob),
        file,
        width: p.width,
        height: p.height,
      };
      savedRef.current = next;
      setSaved(next);
      setCanShare(Boolean(navigator.canShare?.({ files: [file] })));
      setMessage('保存する画像ができたよ。');
      return true;
    } catch {
      setMessage(
        '書き出せませんでした。別のアプリを閉じるか、小さめの画像で試してね。',
      );
      return false;
    } finally {
      busyRef.current = false;
      if (mounted.current) setExporting(false);
    }
  }
  async function shareImage() {
    const result = savedRef.current;
    if (!result) return;
    try {
      await navigator.share({ files: [result.file] });
      setMessage('共有画面を閉じました。');
    } catch (e) {
      if (e instanceof Error && e.name !== 'AbortError')
        setMessage(
          '共有できなかったので、「PNGを保存」か画像の長押しを試してね。',
        );
    }
  }

  useEffect(() => {
    mounted.current = true;
    const el = viewport.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0].contentRect;
      setArea({ width: rect.width, height: rect.height });
    });
    observer.observe(el);
    return () => {
      observer.disconnect();
      mounted.current = false;
      loadVersion.current++;
    };
  }, []);
  useEffect(() => {
    const beforeUnload = (e: BeforeUnloadEvent) => {
      if (historyRef.current.present.length) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', beforeUnload);
    const key = (e: KeyboardEvent) => {
      if (
        e.defaultPrevented ||
        (e.target as HTMLElement).closest(
          'input,textarea,[role=slider],[role=dialog],[role=combobox],[role=listbox]',
        ) ||
        busyRef.current
      )
        return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        e.shiftKey ? runRedo() : runUndo();
      }
      if (e.key === 'Escape') select(null);
    };
    window.addEventListener('keydown', key);
    return () => {
      window.removeEventListener('beforeunload', beforeUnload);
      window.removeEventListener('keydown', key);
    };
  }, []);
  useEffect(() => {
    if (selected && !history.present.some((s) => s.id === selected))
      select(null);
  }, [history.present, selected]);
  const visibleAssetKeys = history.present.map(stampKey).join('|');
  useEffect(() => {
    const used = new Set(visibleAssetKeys.split('|'));
    const recent = Object.keys(assetImages)
        .filter((key) => !used.has(key))
        .slice(-4),
      retained = new Set([...used, ...recent]);
    const removed = Object.keys(assetImages).filter(
      (key) => !retained.has(key),
    );
    if (removed.length) {
      releaseStampBitmaps(removed);
      setAssetImages((previous) =>
        Object.fromEntries(
          Object.entries(previous).filter(([key]) => !removed.includes(key)),
        ),
      );
    }
  }, [visibleAssetKeys]);
  const actionsRef = useRef({
    state: () => ({}),
    add: addStamp,
    export: exportImage,
  });
  actionsRef.current = {
    state: () => ({
      image: photoRef.current
        ? { width: photoRef.current.width, height: photoRef.current.height }
        : null,
      stamps: historyRef.current.present.map((s) => ({ ...s })),
      selected: selectedRef.current,
      palettes: PALETTES,
      catalog: STAMPS.map((s) => ({
        id: s.id,
        name: s.name,
        decorative: s.decorative,
      })),
    }),
    add: addStamp,
    export: exportImage,
  };
  useEffect(() => registerEditorTools(actionsRef), []);

  return (
    <main className="editor-shell">
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/heic,image/heif"
        className="sr-only"
        aria-label="加工する画像"
        onChange={(e) => {
          void choose(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      <header className="app-header">
        <div className="wordmark">
          <img src="/thumbs/524-silhouette.png" alt="" />
          <h1>ぺたかくし</h1>
          <span className="tiny-label">by 524</span>
        </div>
        <div className="header-actions">
          <Button
            variant="outline"
            className="action-button choose-image"
            disabled={busy || exporting}
            aria-label="画像を選ぶ"
            onClick={() => input.current?.click()}
          >
            <ImagePlus />
            画像を選ぶ
          </Button>
          <Button
            className="action-button save-button"
            disabled={!photo || busy || exporting}
            onClick={() => void exportImage()}
          >
            {exporting ? <LoaderCircle className="spin" /> : <Download />}
            保存する
          </Button>
        </div>
      </header>
      <div className="privacy-note">
        <ShieldCheck size={16} />
        画像はこの端末の中だけで加工します。
      </div>
      <div className="workbench">
        <section className="work-area" aria-label="画像の編集">
          <div className="canvas-toolbar">
            <span className="workspace-label">
              {photo
                ? `${photo.width} × ${photo.height}px`
                : 'スクショに、ぺたっと。'}
            </span>
            <div className="tool-cluster">
              <Button
                variant="ghost"
                className="icon-button"
                disabled={!history.past.length || busy || exporting}
                onClick={runUndo}
                aria-label="元に戻す"
                title="元に戻す"
              >
                <Undo2 />
              </Button>
              <Button
                variant="ghost"
                className="icon-button"
                disabled={!history.future.length || busy || exporting}
                onClick={runRedo}
                aria-label="やり直す"
                title="やり直す"
              >
                <Redo2 />
              </Button>
              <Button
                variant="ghost"
                className="icon-button"
                disabled={!history.present.length || busy || exporting}
                onClick={() => {
                  setLayerMessage('');
                  setLayersOpen(true);
                }}
                aria-label="スタンプの重なり順を変更"
                title="重なり順"
              >
                <Layers />
              </Button>
            </div>
          </div>
          <div
            ref={viewport}
            className={`canvas-viewport ${photo ? 'has-photo' : ''} ${panMode ? 'pan-mode' : ''} ${dragOver ? 'drag-over' : ''}`}
            aria-busy={busy || exporting}
            onPointerDown={pointerDown}
            onPointerMove={pointerMove}
            onPointerUp={(e) => pointerUp(e)}
            onPointerCancel={(e) => pointerUp(e, true)}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node))
                setDragOver(false);
            }}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              void choose(e.dataTransfer.files[0]);
            }}
          >
            {photo ? (
              <div
                ref={stage}
                className="image-stage"
                style={{
                  width: photo.width * scale,
                  height: photo.height * scale,
                  transform: `translate(-50%,-50%) translate(${view.x}px,${view.y}px)`,
                }}
              >
                <img
                  className="source-photo"
                  src={photo.url}
                  alt="加工中の画像"
                  draggable={false}
                />
                {history.present.map((s) => (
                  <div
                    key={s.id}
                    data-stamp-id={s.id}
                    className={`placed-stamp ${selected === s.id ? 'selected-stamp' : ''}`}
                    role="button"
                    tabIndex={0}
                    aria-label={`${specFor(s.stamp).name}。矢印キーで移動、Deleteで削除`}
                    aria-pressed={selected === s.id}
                    onFocus={() => select(s.id)}
                    onKeyDown={(e) => stampKeyDown(e, s.id)}
                    style={{
                      left: `${(s.x / photo.width) * 100}%`,
                      top: `${(s.y / photo.height) * 100}%`,
                      width: `${(s.width / photo.width) * 100}%`,
                      height: `${(s.height / photo.height) * 100}%`,
                      transform: `translate(-50%,-50%) rotate(${s.rotation}deg)`,
                    }}
                  >
                    <img
                      src={assetImages[stampKey(s)]?.url}
                      alt=""
                      draggable={false}
                    />
                    {selected === s.id && (
                      <span
                        className="resize-handle"
                        data-resize
                        aria-hidden="true"
                      >
                        ↗
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-canvas">
                <div className="empty-stamps" aria-hidden="true">
                  <img className="empty-star" src="/thumbs/star.png" alt="" />
                  <img
                    className="empty-band"
                    src="/thumbs/crayon-band.png"
                    alt=""
                  />
                  <img className="empty-ufo" src="/thumbs/ufo.png" alt="" />
                </div>
                <h2>かくすのも、らくがきに。</h2>
                <p>スクショを選んで、スタンプをぺたり。</p>
                <Button
                  className="action-button upload-button"
                  disabled={busy}
                  onClick={() => input.current?.click()}
                >
                  <ImagePlus />
                  画像を選ぶ
                </Button>
                <span className="drop-hint">ここに画像をドロップしてもOK</span>
              </div>
            )}
          </div>
          {photo && (
            <div className="view-controls">
              <Button
                variant={panMode ? 'secondary' : 'ghost'}
                className="icon-button"
                aria-label={panMode ? 'スタンプを動かす' : '画像を動かす'}
                aria-pressed={panMode}
                onClick={() => setPanMode((p) => !p)}
              >
                {panMode ? <Hand /> : <Move />}
              </Button>
              <span>2本指で画像を拡大</span>
              <div className="zoom-buttons">
                <Button
                  variant="ghost"
                  className="icon-button"
                  disabled={view.zoom <= 1}
                  onClick={() => setZoom(view.zoom / 1.4)}
                  aria-label="画像を縮小"
                >
                  <ZoomOut />
                </Button>
                <span>{Math.round(view.zoom * 100)}%</span>
                <Button
                  variant="ghost"
                  className="icon-button"
                  disabled={view.zoom >= 6}
                  onClick={() => setZoom(view.zoom * 1.4)}
                  aria-label="画像を拡大"
                >
                  <ZoomIn />
                </Button>
                <Button
                  variant="ghost"
                  className="icon-button"
                  onClick={() => updateView(freshView())}
                  aria-label="画像全体を表示"
                >
                  <Scan />
                </Button>
              </div>
            </div>
          )}
          {item && photo && (
            <div className="selection-panel">
              <div className="selection-heading">
                <strong>{spec?.name}</strong>
                <span>選択中</span>
                <Button
                  variant="ghost"
                  className="icon-button"
                  disabled={busy || exporting}
                  onClick={deleteSelected}
                  aria-label="選択中のスタンプを削除"
                >
                  <Trash2 />
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button
                        variant="ghost"
                        className="icon-button"
                        disabled={busy || exporting}
                        aria-label="選択中のスタンプの操作"
                      />
                    }
                  >
                    <MoreHorizontal />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="stamp-menu">
                    <DropdownMenuItem onClick={duplicateSelected}>
                      <Copy />
                      複製する
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => changeOrder('front')}>
                      <ArrowUpToLine />
                      いちばん前へ
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => changeOrder('back')}>
                      <ArrowDownToLine />
                      いちばん後ろへ
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => transformSelection({ rotation: 0 })}
                    >
                      <RotateCw />
                      回転を戻す
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button
                  variant="ghost"
                  className="icon-button"
                  onClick={() => select(null)}
                  aria-label="選択を解除"
                >
                  <Check />
                </Button>
              </div>
              <div className="adjustments">
                <div className="adjustment">
                  <label id="size-label">大きさ</label>
                  <Slider
                    aria-labelledby="size-label"
                    value={[(item.width / photo.width) * 100]}
                    min={Math.max(1, (12 / photo.width) * 100)}
                    max={Math.max(100, (item.width / photo.width) * 100)}
                    step={0.5}
                    disabled={busy || exporting}
                    onValueChange={(v) => sizeChange(v)}
                    onValueCommitted={(v) => sizeChange(v, true)}
                  />
                </div>
                <div className="adjustment">
                  <label id="rotation-label">
                    回転 <span>{Math.round(item.rotation)}°</span>
                  </label>
                  <Slider
                    aria-labelledby="rotation-label"
                    value={[item.rotation]}
                    min={-180}
                    max={180}
                    step={1}
                    disabled={busy || exporting}
                    onValueChange={(v) => adjust({ rotation: numeric(v) })}
                    onValueCommitted={(v) =>
                      adjust({ rotation: numeric(v) }, true)
                    }
                  />
                </div>
                {spec?.stretch && (
                  <div className="adjustment width-adjustment">
                    <label id="width-label">横幅だけ伸ばす</label>
                    <Slider
                      aria-labelledby="width-label"
                      value={[(item.width / photo.width) * 100]}
                      min={5}
                      max={150}
                      step={1}
                      disabled={busy || exporting}
                      onValueChange={(v) =>
                        adjust({ width: (numeric(v) / 100) * photo.width })
                      }
                      onValueCommitted={(v) =>
                        adjust(
                          { width: (numeric(v) / 100) * photo.width },
                          true,
                        )
                      }
                    />
                  </div>
                )}
              </div>
            </div>
          )}
          <p className="canvas-caption">
            {item && spec?.decorative
              ? '線のスタンプは飾り用。文字を隠すときは、帯や塗りつぶした形で。'
              : 'かくしたい文字は、スタンプの内側におさめてね。'}
          </p>
        </section>
        <StampTray
          palette={palette}
          color={color}
          selectedStamp={item?.stamp}
          disabled={busy || exporting}
          onPaletteChange={switchPalette}
          onColorChange={(c) => void applyColor(c)}
          onAddStamp={(id) => void addStamp(id)}
        />
      </div>
      <p className="status-message" role="status" aria-live="polite">
        {busy && <LoaderCircle className="spin" size={15} />} {message}
      </p>
      <Dialog
        open={Boolean(saved)}
        onOpenChange={(open) => {
          if (!open) resetSaved();
        }}
      >
        <DialogContent className="export-dialog" showCloseButton={false}>
          <div className="dialog-top">
            <DialogTitle>保存する画像</DialogTitle>
            <DialogClose
              render={
                <Button
                  variant="ghost"
                  className="icon-button"
                  aria-label="編集に戻る"
                />
              }
            >
              <X />
            </DialogClose>
          </div>
          <DialogDescription>
            隠し残しがないか、最後に確認してね。
          </DialogDescription>
          {saved && (
            <>
              <div className="export-preview">
                <img src={saved.url} alt="スタンプを合成した保存用画像" />
              </div>
              <p className="export-size">
                PNG · {saved.width} × {saved.height}px
              </p>
              <div className="export-actions">
                {canShare && (
                  <Button
                    className="action-button"
                    onClick={() => void shareImage()}
                  >
                    <Share2 />
                    共有・保存
                  </Button>
                )}
                <a
                  className="download-link"
                  href={saved.url}
                  download={saved.file.name}
                >
                  <Download size={18} />
                  PNGを保存
                </a>
              </div>
              <p className="export-help">
                iPhoneは「共有・保存」から「画像を保存」。表示されないときは、上の画像を長押しして保存できます。
              </p>
            </>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={layersOpen} onOpenChange={setLayersOpen}>
        <DialogContent className="layers-dialog" showCloseButton={false}>
          <div className="dialog-top">
            <DialogTitle>スタンプの重なり順</DialogTitle>
            <DialogClose
              render={
                <Button
                  variant="ghost"
                  className="icon-button"
                  aria-label="閉じる"
                />
              }
            >
              <X />
            </DialogClose>
          </div>
          <DialogDescription>
            上のものほど手前。↑↓で順番を入れ替えられます。
          </DialogDescription>
          <div className="layers-list">
            {[...history.present].reverse().map((s, i) => (
              <div
                key={s.id}
                className={`layer-row ${selected === s.id ? 'selected' : ''}`}
              >
                <Button
                  variant="ghost"
                  className="layer-select"
                  disabled={busy || exporting}
                  aria-label={`手前から${i + 1}番目の${specFor(s.stamp).name}を選ぶ${selected === s.id ? '（選択中）' : ''}`}
                  onClick={() => {
                    select(s.id);
                    setLayersOpen(false);
                  }}
                >
                  <img
                    src={
                      assetImages[stampKey(s)]?.url ??
                      stampAssetUrl(s.stamp, 'thumbs')
                    }
                    alt=""
                  />
                  <span className="layer-name">
                    <span>{specFor(s.stamp).name}</span>
                    <span className="layer-position">
                      {i === 0
                        ? 'いちばん手前'
                        : `${i + 1} / ${history.present.length}`}
                      {selected === s.id && ' · 選択中'}
                    </span>
                  </span>
                </Button>
                <div className="layer-order-actions">
                  <Button
                    variant="ghost"
                    className="layer-order-button"
                    disabled={i === 0 || busy || exporting}
                    focusableWhenDisabled
                    aria-label={`手前から${i + 1}番目の${specFor(s.stamp).name}をひとつ手前へ`}
                    title="ひとつ手前へ"
                    onClick={() => changeOrder('forward', s.id)}
                  >
                    <ArrowUp />
                  </Button>
                  <Button
                    variant="ghost"
                    className="layer-order-button"
                    disabled={
                      i === history.present.length - 1 || busy || exporting
                    }
                    focusableWhenDisabled
                    aria-label={`手前から${i + 1}番目の${specFor(s.stamp).name}をひとつ奥へ`}
                    title="ひとつ奥へ"
                    onClick={() => changeOrder('backward', s.id)}
                  >
                    <ArrowDown />
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <p
            className="sr-only"
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            {layerMessage}
          </p>
        </DialogContent>
      </Dialog>
    </main>
  );
}
