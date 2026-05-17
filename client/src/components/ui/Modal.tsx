import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}

export default function Modal({ open, onClose, title, children, wide }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null);
  // Track where the pointer was pressed. We only close on click-outside if
  // BOTH mousedown and mouseup happen on the overlay — otherwise a drag that
  // started inside (e.g. selecting text in a field) and released outside
  // would dismiss the modal.
  const downOnOverlayRef = useRef(false);

  useEffect(() => {
    if (!open) return;

    // Lock body scroll
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);

    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', handler);
      // Reset drag-tracking so a mousedown-then-Escape on one open doesn't
      // leak into the next open and falsely dismiss it on first click.
      downOnOverlayRef.current = false;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
      onMouseDown={(e) => {
        downOnOverlayRef.current = e.target === overlayRef.current;
      }}
      onMouseUp={(e) => {
        const wasDownOnOverlay = downOnOverlayRef.current;
        downOnOverlayRef.current = false;
        if (wasDownOnOverlay && e.target === overlayRef.current) onClose();
      }}
    >
      {/*
        Mobile layout notes:
        - `max-h-[100dvh]` (not `vh`) accounts for browser-chrome resize on iOS/
          Android — otherwise the bottom of long modals lives under the address
          bar and looks "cut off".
        - `pb-[max(...)]` reserves space for the iOS home indicator AND lifts
          the panel above our floating bottom nav (`fixed bottom-3 h-14`), so
          action buttons aren't visually obscured.
      */}
      <div
        className={`relative flex w-full max-h-[100dvh] flex-col rounded-t-2xl sm:rounded-2xl border border-surface-700/50 bg-surface-900 shadow-2xl pb-[max(env(safe-area-inset-bottom),0.75rem)] mb-[88px] sm:mb-0 sm:max-h-[90vh] sm:pb-0 ${
          wide ? 'sm:max-w-2xl' : 'sm:max-w-md'
        }`}
      >
        {/* Drag handle for mobile */}
        <div className="mx-auto mt-2 mb-1 h-1 w-10 rounded-full bg-surface-600 sm:hidden" />

        <div className="flex shrink-0 items-center justify-between px-5 py-4 sm:px-6 sm:py-5">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-surface-400 hover:bg-surface-800 hover:text-surface-200 transition-colors"
          >
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto px-5 pb-5 sm:px-6 sm:pb-6">{children}</div>
      </div>
    </div>
  );
}
