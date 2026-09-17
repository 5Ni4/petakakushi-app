import { ArrowUpRight } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { X_SHARE_URL } from '@/lib/share';

export function XIntroButton({ subtle = false }: { subtle?: boolean }) {
  return (
    <a
      className={
        subtle
          ? 'x-intro-link'
          : buttonVariants({
              variant: 'outline',
              className: 'x-intro-button',
            })
      }
      href={X_SHARE_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="このツールを紹介する（X）・別タブで開く"
    >
      このツールを紹介する（X）
      <ArrowUpRight size={16} aria-hidden="true" />
    </a>
  );
}
