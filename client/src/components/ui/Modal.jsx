import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from './cn';

const Modal = ({ open, onClose, title, description, children, className }) => {
  const dialogRef = useRef(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return undefined;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
    return undefined;
  }, [open]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <dialog
      ref={dialogRef}
      className={cn(
        'm-auto max-h-[min(90dvh,800px)] w-[min(94vw,640px)] overflow-y-auto rounded-2xl border border-border bg-surface p-0 text-ink shadow-2xl backdrop:bg-[#10131b]/55 backdrop:backdrop-blur-sm',
        className
      )}
      onClose={onClose}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      aria-labelledby="modal-title"
    >
      <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-5">
        <div>
          <h2 id="modal-title" className="font-heading text-xl font-bold">{title}</h2>
          {description && <p className="mt-1 text-sm text-muted">{description}</p>}
        </div>
        <button
          type="button"
          className="rounded-lg p-2 text-muted transition hover:bg-cream hover:text-ink "
          aria-label="Close dialog"
          onClick={onClose}
        >
          <X size={18} />
        </button>
      </div>
      <div className="px-6 py-5">{children}</div>
    </dialog>,
    document.body
  );
};

export default Modal;
