import { useRef, useState, useEffect, useCallback } from 'react';

const MIN_WIDTH = 160;
const DEFAULT_WIDTH = 240;

interface PanelState {
  x: number;
  y: number;
  width: number;
  collapsed: boolean;
}

interface DraggablePanelProps {
  id: string;
  title: string;
  defaultPos: { x: number; y: number };
  defaultWidth?: number;
  minWidth?: number;
  children: React.ReactNode;
}

function load(id: string, defaultPos: { x: number; y: number }, defaultWidth: number): PanelState {
  try {
    const raw = localStorage.getItem(`panel-${id}`);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { x: defaultPos.x, y: defaultPos.y, width: defaultWidth, collapsed: false };
}

function save(id: string, state: PanelState) {
  try {
    localStorage.setItem(`panel-${id}`, JSON.stringify(state));
  } catch {}
}

export function DraggablePanel({ id, title, defaultPos, defaultWidth = DEFAULT_WIDTH, children }: DraggablePanelProps) {
  const [state, setState] = useState<PanelState>(() => load(id, defaultPos, defaultWidth));
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    save(id, state);
  }, [id, state]);

  // --- Drag ---
  const onHeaderMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest('[data-nodrag]')) return;
    e.preventDefault();

    let originX = state.x;
    let originY = state.y;
    let prevMouseX = e.clientX;
    let prevMouseY = e.clientY;

    function onMouseMove(ev: MouseEvent) {
      if (!panelRef.current) return;
      const w = parseFloat(panelRef.current.style.width) || state.width;
      const nx = Math.max(0, Math.min(originX + ev.clientX - prevMouseX, window.innerWidth - w));
      const ny = Math.max(0, Math.min(originY + ev.clientY - prevMouseY, window.innerHeight - 40));
      panelRef.current.style.left = `${nx}px`;
      panelRef.current.style.top = `${ny}px`;
      originX = nx; originY = ny;
      prevMouseX = ev.clientX; prevMouseY = ev.clientY;
    }

    function onMouseUp() {
      if (!panelRef.current) return;
      const left = parseFloat(panelRef.current.style.left) || 0;
      const top = parseFloat(panelRef.current.style.top) || 0;
      setState(s => ({ ...s, x: left, y: top }));
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    }

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [state.x, state.y, state.width]);

  // --- Resize ---
  const onResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    let currentWidth = state.width;
    let prevMouseX = e.clientX;

    function onMouseMove(ev: MouseEvent) {
      if (!panelRef.current) return;
      const delta = ev.clientX - prevMouseX;
      currentWidth = Math.max(MIN_WIDTH, currentWidth + delta);
      panelRef.current.style.width = `${currentWidth}px`;
      prevMouseX = ev.clientX;
    }

    function onMouseUp() {
      if (!panelRef.current) return;
      const w = parseFloat(panelRef.current.style.width) || DEFAULT_WIDTH;
      setState(s => ({ ...s, width: w }));
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    }

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [state.width]);

  const toggleCollapsed = useCallback(() => {
    setState(s => ({ ...s, collapsed: !s.collapsed }));
  }, []);

  return (
    <div
      ref={panelRef}
      style={{
        position: 'fixed',
        left: state.x,
        top: state.y,
        width: state.width,
        zIndex: 70,
        background: 'rgba(0,0,0,0.88)',
        border: '1px solid rgba(0,212,255,0.2)',
        borderRadius: '4px',
        boxShadow: '0 2px 12px rgba(0,0,0,0.6)',
        userSelect: 'none',
      }}
    >
      {/* Header — drag handle */}
      <div
        onMouseDown={onHeaderMouseDown}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 10px',
          cursor: 'grab',
          borderBottom: state.collapsed ? 'none' : '1px solid rgba(0,212,255,0.12)',
        }}
      >
        <span style={{
          fontFamily: 'monospace',
          fontSize: '10px',
          fontWeight: 700,
          letterSpacing: '0.15em',
          color: 'rgba(0,212,255,0.75)',
          pointerEvents: 'none',
        }}>
          {title}
        </span>
        <button
          data-nodrag
          onClick={toggleCollapsed}
          title={state.collapsed ? 'Expand' : 'Collapse'}
          style={{
            background: 'none',
            border: '1px solid rgba(0,212,255,0.3)',
            borderRadius: '2px',
            color: 'rgba(0,212,255,0.7)',
            cursor: 'pointer',
            fontSize: '14px',
            lineHeight: 1,
            width: '18px',
            height: '18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            padding: 0,
          }}
        >
          {state.collapsed ? '+' : '−'}
        </button>
      </div>

      {/* Content — grid collapse animation */}
      <div style={{
        display: 'grid',
        gridTemplateRows: state.collapsed ? '0fr' : '1fr',
        transition: 'grid-template-rows 0.18s ease',
      }}>
        <div style={{ overflow: 'hidden', minHeight: 0 }}>
          {children}
        </div>
      </div>

      {/* Resize handle — bottom-right corner, hidden when collapsed */}
      {!state.collapsed && (
        <div
          onMouseDown={onResizeMouseDown}
          title="Resize"
          style={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            width: '14px',
            height: '14px',
            cursor: 'ew-resize',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'flex-end',
            padding: '3px',
          }}
        >
          {/* Three diagonal dots — classic resize affordance */}
          <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
            <circle cx="6" cy="6" r="1" fill="rgba(0,212,255,0.4)" />
            <circle cx="3" cy="6" r="1" fill="rgba(0,212,255,0.25)" />
            <circle cx="6" cy="3" r="1" fill="rgba(0,212,255,0.25)" />
          </svg>
        </div>
      )}
    </div>
  );
}
