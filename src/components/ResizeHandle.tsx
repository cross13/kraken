import { useRef } from 'react';
import { cn } from '../lib/cn';

interface Props {
  /** current width of the panel being resized */
  width: number;
  /** which edge of the panel this handle sits on */
  side: 'left' | 'right' | 'top';
  /** called with the proposed new width as the user drags */
  onResize: (next: number) => void;
  className?: string;
}

/**
 * A 4px draggable divider. `side: 'right'` grows the panel as you drag right
 * (use on a left panel's trailing edge); `side: 'left'` grows it as you drag
 * left (use on a right panel's leading edge). Width clamping is left to the
 * store setter the parent passes into `onResize`.
 */
export function ResizeHandle({ width, side, onResize, className }: Props) {
  const drag = useRef<{ startX: number; startW: number } | null>(null);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { startX: side === 'top' ? e.clientY : e.clientX, startW: width };
    document.body.style.cursor = side === 'top' ? 'row-resize' : 'col-resize';
    document.body.style.userSelect = 'none';
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    // `top` resizes a HEIGHT: the handle is the panel's upper edge, so dragging
    // up grows it. `width` then carries the height being resized.
    const delta = side === 'top' ? e.clientY - drag.current.startX : e.clientX - drag.current.startX;
    const next = side === 'right' ? drag.current.startW + delta : drag.current.startW - delta;
    onResize(next);
  };

  const end = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    drag.current = null;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // pointer already released
    }
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  };

  return (
    <div
      role="separator"
      aria-orientation={side === 'top' ? 'horizontal' : 'vertical'}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={end}
      onPointerCancel={end}
      className={cn(
        'group relative shrink-0 bg-ink-800 hover:bg-accent/60 active:bg-accent transition-colors',
        side === 'top' ? 'h-1 cursor-row-resize' : 'w-1 cursor-col-resize',
        className
      )}
    >
      {/* widen the hit target without taking layout space */}
      <span className={side === 'top' ? 'absolute inset-x-0 -top-1 -bottom-1' : 'absolute inset-y-0 -left-1 -right-1'} />
    </div>
  );
}
