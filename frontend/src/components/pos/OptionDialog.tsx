import React, { useId, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import './variant-picker.css';

interface OptionDialogProps {
  title: string;
  subtitle: string;
  anchor?: HTMLElement | null;
  returnFocus?: HTMLElement | null;
  onClose: () => void;
  children: React.ReactNode;
  footer: React.ReactNode;
}

/** Native modal semantics keep focus and POS shortcuts inside this panel. */
export function OptionDialog({ title, subtitle, anchor, returnFocus, onClose, children, footer }: OptionDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const headingId = useId();
  const descriptionId = useId();

  useLayoutEffect(() => {
    const dialog = dialogRef.current!;
    const previousFocus = returnFocus || document.activeElement as HTMLElement;
    const updatePosition = () => {
      const viewport = window.visualViewport;
      const width = viewport?.width || window.innerWidth;
      const height = viewport?.height || window.innerHeight;
      const x = viewport?.offsetLeft || 0;
      const y = viewport?.offsetTop || 0;
      const mobile = window.innerWidth < 640;
      dialog.style.width = `${mobile ? width : Math.min(460, width - 32)}px`;
      dialog.style.maxHeight = `${Math.min(mobile ? 720 : 620, height - 24)}px`;
      const rect = dialog.getBoundingClientRect();
      let left = x + (width - rect.width) / 2;
      let top = y + (height - rect.height) / 2;
      if (mobile) {
        left = x;
        top = y + height - rect.height;
      } else if (anchor?.isConnected) {
        const target = anchor.getBoundingClientRect();
        left = target.right + 12;
        if (left + rect.width > x + width - 16) {
          left = target.left - rect.width - 12;
          if (left < x + 16) left = target.left;
        }
        left = Math.max(x + 16, Math.min(left, x + width - rect.width - 16));
        top = Math.max(y + 12, Math.min(target.top, y + height - rect.height - 12));
      }
      dialog.style.left = `${left}px`;
      dialog.style.top = `${top}px`;
    };
    dialog.showModal();
    updatePosition();
    const initialFocus = dialog.querySelector<HTMLElement>('[data-variant-option][aria-checked="true"]')
      || dialog.querySelector<HTMLElement>('[data-variant-option]');
    (initialFocus || dialog).focus({ preventScroll: true });
    const observer = new ResizeObserver(updatePosition);
    observer.observe(dialog);
    const onScroll = (event: Event) => {
      if (!dialog.contains(event.target as Node)) updatePosition();
    };
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', onScroll, true);
    window.visualViewport?.addEventListener('resize', updatePosition);
    window.visualViewport?.addEventListener('scroll', updatePosition);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', onScroll, true);
      window.visualViewport?.removeEventListener('resize', updatePosition);
      window.visualViewport?.removeEventListener('scroll', updatePosition);
      dialog.close();
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, [anchor, returnFocus]);

  return createPortal(
    <dialog
      ref={dialogRef}
      className="pos-option-dialog"
      aria-labelledby={headingId}
      aria-describedby={descriptionId}
      tabIndex={-1}
      onCancel={event => { event.preventDefault(); event.stopPropagation(); closeRef.current(); }}
      onKeyDown={event => {
        event.stopPropagation();
        if (event.key !== 'Tab') return;
        const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button, input, textarea, select, a[href], [tabindex]'))
          .filter(element => element.tabIndex >= 0 && !element.hasAttribute('disabled') && element.getClientRects().length > 0);
        const first = controls[0];
        const last = controls[controls.length - 1];
        const active = document.activeElement;
        if (!first) { event.preventDefault(); return; }
        if (event.shiftKey && (active === first || active === event.currentTarget)) {
          event.preventDefault(); last.focus();
        } else if (!event.shiftKey && (active === last || active === event.currentTarget)) {
          event.preventDefault(); first.focus();
        }
      }}
      onClick={event => {
        event.stopPropagation();
        if (event.target !== event.currentTarget) return;
        const rect = event.currentTarget.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeRef.current();
      }}
    >
      <header className="pos-option-header">
        <div className="min-w-0">
          <h2 id={headingId}>{title}</h2>
          <p id={descriptionId}>{subtitle}</p>
        </div>
        <button type="button" onClick={onClose} className="pos-option-close" aria-label="Close options"><X size={20} /></button>
      </header>
      <div className="pos-option-body">{children}</div>
      <footer className="pos-option-footer">{footer}</footer>
    </dialog>,
    document.body,
  );
}
