import React from 'react';
import { ChevronDown } from 'lucide-react';

interface CollapsibleSectionProps {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

export function CollapsibleSection({ title, open, onToggle, children }: CollapsibleSectionProps) {
  return (
    <div>
      <button
        onClick={onToggle}
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          width: '100%',
          padding: '10px 12px',
          background: 'none',
          border: 'none',
          borderTop: '1px solid rgba(0,212,255,0.1)',
          cursor: 'pointer',
          color: 'rgba(0,212,255,0.7)',
          fontSize: '10px',
          fontWeight: 700,
          letterSpacing: '0.15em',
          fontFamily: 'monospace',
        }}
      >
        <span>{title}</span>
        <ChevronDown
          size={12}
          style={{
            transform: open ? 'rotate(0deg)' : 'rotate(-90deg)',
            transition: 'transform 0.2s ease',
            color: 'rgba(0,212,255,0.5)',
            flexShrink: 0,
          }}
        />
      </button>
      <div
        data-testid="collapsible-grid"
        style={{
          display: 'grid',
          gridTemplateRows: open ? '1fr' : '0fr',
          transition: 'grid-template-rows 0.2s ease',
        }}
      >
        <div style={{ overflow: 'hidden', minHeight: 0 }}>
          {children}
        </div>
      </div>
    </div>
  );
}
