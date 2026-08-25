import { useAppStore } from '../store/useAppStore';

export function StyleChip() {
  const visualPreset = useAppStore(s => s.visualPreset);

  return (
    <div
      aria-label="Active visual style"
      style={{
        position: 'fixed',
        top: 10,
        left: 16,
        zIndex: 210,
        pointerEvents: 'none',
        fontFamily: 'monospace',
        fontSize: 10,
        letterSpacing: '0.12em',
        color: 'rgba(255,255,255,0.75)',
        background: 'rgba(0,0,0,0.55)',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 3,
        padding: '3px 8px',
      }}
    >
      STYLE · {visualPreset.toUpperCase()}
    </div>
  );
}
