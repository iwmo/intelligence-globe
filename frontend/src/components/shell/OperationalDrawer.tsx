import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from 'react';
import { X } from 'lucide-react';
import {
  clampPanelWidth,
  loadStoredPanelWidth,
  maxPanelWidth,
  PANEL_MIN,
} from '../../lib/panelWidth';
import './operational-drawer.css';

export interface DrawerRailItem<Id extends string> {
  id: Id;
  label: string;
  icon: ReactNode;
}

interface OperationalDrawerProps<Id extends string> {
  side: 'left' | 'right';
  title: string;
  open: boolean;
  activeItem: Id | null;
  items: DrawerRailItem<Id>[];
  widthKey: string;
  defaultWidth: number;
  onItemClick: (id: Id) => void;
  onClose: () => void;
  children: ReactNode;
  accent?: string;
  railFooter?: ReactNode;
}

export function OperationalDrawer<Id extends string>({
  side,
  title,
  open,
  activeItem,
  items,
  widthKey,
  defaultWidth,
  onItemClick,
  onClose,
  children,
  accent = 'var(--status-connecting)',
  railFooter,
}: OperationalDrawerProps<Id>) {
  const [panelWidth, setPanelWidth] = useState(() =>
    loadStoredPanelWidth(widthKey, defaultWidth),
  );
  const panelWidthRef = useRef(panelWidth);
  panelWidthRef.current = panelWidth;

  useEffect(() => {
    try {
      localStorage.setItem(widthKey, String(panelWidth));
    } catch {
      // Storage is optional.
    }
  }, [panelWidth, widthKey]);

  useEffect(() => {
    const onResize = () => {
      setPanelWidth(width => clampPanelWidth(width, defaultWidth, window.innerWidth));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [defaultWidth]);

  function startResize(event: MouseEvent<HTMLDivElement>) {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = panelWidthRef.current;

    function onMove(moveEvent: globalThis.MouseEvent) {
      const delta = moveEvent.clientX - startX;
      const next = side === 'left' ? startWidth + delta : startWidth - delta;
      setPanelWidth(clampPanelWidth(next, defaultWidth, window.innerWidth));
    }

    function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  function resizeWithKeyboard(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const screenDelta = event.key === 'ArrowRight' ? 16 : -16;
    const widthDelta = side === 'left' ? screenDelta : -screenDelta;
    setPanelWidth(width =>
      clampPanelWidth(width + widthDelta, defaultWidth, window.innerWidth),
    );
  }

  return (
    <div
      className={`operational-drawer operational-drawer--${side}`}
      style={{ '--drawer-accent': accent } as CSSProperties}
    >
      <nav className="operational-drawer__rail" aria-label={`${side} workspace navigation`}>
        {items.map(item => (
          <button
            key={item.id}
            type="button"
            className="operational-drawer__rail-button"
            data-active={activeItem === item.id}
            aria-label={item.label}
            aria-pressed={activeItem === item.id}
            title={item.label}
            onClick={() => onItemClick(item.id)}
          >
            {item.icon}
          </button>
        ))}
        <div className="operational-drawer__rail-spacer" />
        {railFooter}
      </nav>

      {open && (
        <aside
          className="operational-drawer__panel"
          style={{ width: panelWidth }}
          aria-label={title}
        >
          <header className="operational-drawer__header">
            <div>
              <span className="operational-drawer__eyebrow">OPERATIONAL EARTH</span>
              <h2>{title}</h2>
            </div>
            <button
              type="button"
              className="operational-drawer__close"
              onClick={onClose}
              aria-label={`Close ${title}`}
            >
              <X aria-hidden="true" />
            </button>
          </header>
          <div className="operational-drawer__content intel-panel-scroll">
            {children}
          </div>
          <div
            className="operational-drawer__resize"
            role="separator"
            aria-orientation="vertical"
            aria-label={`Resize ${title}`}
            aria-valuemin={PANEL_MIN}
            aria-valuemax={maxPanelWidth(typeof window === 'undefined' ? 1440 : window.innerWidth)}
            aria-valuenow={panelWidth}
            tabIndex={0}
            onMouseDown={startResize}
            onKeyDown={resizeWithKeyboard}
          />
        </aside>
      )}
    </div>
  );
}
