import { useEffect, useRef } from 'preact/hooks';
import { Icon } from '../components/icons.jsx';

export function TimelineDialog({ title, onClose, children }) {
  const dialog = useRef(null);
  useEffect(() => {
    const element = dialog.current;
    element.showModal();
    return () => element.close();
  }, []);

  return (
    <dialog class="tl-dialog" ref={dialog} aria-label={title} onCancel={(event) => { event.preventDefault(); onClose(); }}>
      <div class="tl-dialog-content">
        <header class="tl-cmprow">
          <h2>{title}</h2>
          <button class="nx-icon-btn" type="button" aria-label="Close dialog" onClick={onClose}><Icon name="x" size={16} /></button>
        </header>
        {children}
      </div>
    </dialog>
  );
}
