import { useAppStore } from '../store/useAppStore';

export function DisplayChips() {
  const hudVisible = useAppStore(s => s.hudVisible);
  const setHudVisible = useAppStore(s => s.setHudVisible);
  const cleanUI = useAppStore(s => s.cleanUI);
  const setCleanUI = useAppStore(s => s.setCleanUI);

  return (
    <div style={{
      position: 'fixed',
      top: 10,
      right: 16,
      zIndex: 210,
      display: 'flex',
      gap: 6,
      fontFamily: 'monospace',
      fontSize: 10,
      letterSpacing: '0.1em',
    }}>
      <Chip active={hudVisible} onClick={() => setHudVisible(!hudVisible)} label="HUD" />
      <Chip active={false} onClick={() => undefined} label="DETECT" title="Detection overlay — Wave 4" />
      <Chip active={cleanUI} onClick={() => setCleanUI(!cleanUI)} label="CLEAN" />
    </div>
  );
}

function Chip({ active, onClick, label, title }: { active: boolean; onClick: () => void; label: string; title?: string }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      style={{
        padding: '3px 7px',
        background: active ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.55)',
        border: `1px solid ${active ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.12)'}`,
        borderRadius: 3,
        color: active ? '#fff' : 'rgba(255,255,255,0.55)',
        cursor: 'pointer',
        fontFamily: 'inherit',
        fontSize: 'inherit',
        letterSpacing: 'inherit',
      }}
    >
      {label}
    </button>
  );
}
