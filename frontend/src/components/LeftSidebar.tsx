import { useAppStore } from '../store/useAppStore';

export function LeftSidebar() {
  const { sidebarOpen } = useAppStore();
  if (!sidebarOpen) return null;
  return (
    <div
      style={{
        position: 'fixed',
        left: 0,
        top: 0,
        bottom: '32px',
        width: '280px',
        background: 'rgba(0, 0, 0, 0.9)',
        borderRight: '1px solid rgba(0, 212, 255, 0.15)',
        zIndex: 50,
      }}
    />
  );
}
