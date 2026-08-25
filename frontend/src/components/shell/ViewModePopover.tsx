import { Check, Eye, ScanSearch, SlidersHorizontal } from 'lucide-react';
import { useAppStore, type VisualPreset } from '../../store/useAppStore';
import { Button } from '../ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';

const PRESETS: Array<{ id: VisualPreset; key: string; label: string }> = [
  { id: 'normal', key: '1', label: 'Normal' },
  { id: 'nvg', key: '2', label: 'Night vision' },
  { id: 'crt', key: '3', label: 'CRT' },
  { id: 'flir', key: '4', label: 'FLIR' },
  { id: 'noir', key: '5', label: 'Noir' },
];

export function ViewModePopover({ trigger = 'strip' }: { trigger?: 'strip' | 'menu' }) {
  const visualPreset = useAppStore(s => s.visualPreset);
  const setVisualPreset = useAppStore(s => s.setVisualPreset);
  const hudVisible = useAppStore(s => s.hudVisible);
  const setHudVisible = useAppStore(s => s.setHudVisible);
  const detectEnabled = useAppStore(s => s.detectOverlayEnabled);
  const setDetectEnabled = useAppStore(s => s.setDetectOverlayEnabled);

  return (
    <Popover>
      <PopoverTrigger
        render={
          trigger === 'strip'
            ? (
              <Button
                variant="ghost"
                size="sm"
                className="command-strip__view"
                aria-label={`View mode: ${visualPreset}`}
              />
            )
            : (
              <button
                type="button"
                className="command-overflow__action"
                aria-label={`View mode: ${visualPreset}`}
              />
            )
        }
      >
        <SlidersHorizontal aria-hidden="true" />
        <span className={trigger === 'strip' ? 'command-strip__action-label' : undefined}>
          {trigger === 'strip' ? visualPreset.toUpperCase() : `View mode · ${visualPreset.toUpperCase()}`}
        </span>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="view-mode-popover">
        <div className="view-mode-popover__header">
          <span>View mode</span>
          <span>1–5</span>
        </div>
        <div className="view-mode-popover__presets">
          {PRESETS.map(preset => (
            <button
              type="button"
              key={preset.id}
              className="view-mode-popover__option"
              data-active={visualPreset === preset.id}
              onClick={() => setVisualPreset(preset.id)}
            >
              <span className="view-mode-popover__key">{preset.key}</span>
              <span>{preset.label}</span>
              {visualPreset === preset.id && <Check aria-hidden="true" />}
            </button>
          ))}
        </div>
        <div className="view-mode-popover__toggles">
          <button
            type="button"
            className="view-mode-popover__toggle"
            aria-pressed={hudVisible}
            onClick={() => setHudVisible(!hudVisible)}
          >
            <Eye aria-hidden="true" />
            <span>Telemetry HUD</span>
            <span>{hudVisible ? 'ON' : 'OFF'}</span>
          </button>
          <button
            type="button"
            className="view-mode-popover__toggle"
            aria-pressed={detectEnabled}
            onClick={() => setDetectEnabled(!detectEnabled)}
          >
            <ScanSearch aria-hidden="true" />
            <span>Detection overlay</span>
            <span>{detectEnabled ? 'ON' : 'OFF'}</span>
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
