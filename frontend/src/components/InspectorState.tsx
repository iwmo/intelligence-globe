import type { ReactNode } from 'react';
import './contact-card.css';

export function InspectorState({
  state,
  children,
}: {
  state: 'loading' | 'error' | 'empty';
  children: ReactNode;
}) {
  return (
    <div className="inspector-state" data-state={state} role={state === 'error' ? 'alert' : 'status'}>
      {children}
    </div>
  );
}
