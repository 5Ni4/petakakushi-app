'use client';

import { useEffect, useState } from 'react';
import { LoaderCircle, ImageOff } from 'lucide-react';
import {
  createStampSvg,
  stampAssetUrl,
  stampPreviewUrl,
  type StampId,
} from '@/lib/stamps';

type Props = { id: StampId; color: string; palette: number };

// WebMCP can supply colors outside the standard swatches. Render only these
// previews locally, at thumbnail size and outside the placed-stamp bitmap cache.
function CustomThumbnail({ id, color, palette }: Props) {
  const [url, setUrl] = useState<string>();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    let disposed = false;
    let objectUrl: string | undefined;
    void fetch(stampAssetUrl(id, 'stamps'), { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('Stamp preview unavailable');
        const source = await response.text();
        if (disposed) return;
        const { svg } = createStampSvg(source, id, color, palette, 240);
        objectUrl = URL.createObjectURL(
          new Blob([svg], { type: 'image/svg+xml' }),
        );
        setUrl(objectUrl);
      })
      .catch(() => {
        if (!disposed) setFailed(true);
      });
    return () => {
      disposed = true;
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [id, color, palette]);
  if (!url || failed) {
    return (
      <span className="stamp-thumbnail-placeholder" aria-hidden="true">
        {failed ? (
          <ImageOff size={18} />
        ) : (
          <LoaderCircle size={18} className="spin" />
        )}
      </span>
    );
  }
  return <img src={url} alt="" onError={() => setFailed(true)} />;
}

export function StampThumbnail(props: Props) {
  const prepared = stampPreviewUrl(props.id, props.color, props.palette);
  if (prepared)
    return <img key={prepared} src={prepared} alt="" loading="lazy" />;
  return (
    <CustomThumbnail
      key={`${props.id}:${props.palette}:${props.color}`}
      {...props}
    />
  );
}
