import { useEffect, useState } from 'react';
import type { RefObject } from 'react';
import {
  Check,
  Crosshair,
  Focus,
  Info,
  MoreHorizontal,
  Play,
  Radio,
  RotateCcw,
  Settings,
  Share2,
} from 'lucide-react';
import { queryClient } from '../../lib/queryClient';
import { resetGlobe } from '../../lib/viewerRegistry';
import { writeShareHash } from '../../lib/shareView';
import { useAppStore } from '../../store/useAppStore';
import { Button } from '../ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
import { SearchBar } from '../SearchBar';
import { MapFallbackNotice } from './MapFallbackNotice';
import { SystemHealthBadge } from './SystemHealthBadge';
import { ViewModePopover } from './ViewModePopover';
import './shell.css';

const ATTRIBUTION = [
  'USGS Earthquake Hazards Program',
  'NASA FIRMS / VIIRS',
  'Open-Meteo (CC BY 4.0)',
  'Launch Library 2 / The Space Devs',
  'ADS-B (adsb.lol) · AIS · CelesTrak',
  'OpenStreetMap installations and roads (ODbL)',
  'Nominatim geocoding (ODbL)',
  'TomTom Traffic Flow when configured',
  'Cesium ion / Google Photorealistic 3D Tiles',
];

interface IconActionProps {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}
function IconAction({ label, onClick, children, className }: IconActionProps) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label={label}
            className={className}
            onClick={onClick}
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}

interface CommandStripProps {
  workerRef: RefObject<Worker | null>;
}

export function CommandStrip({ workerRef }: CommandStripProps) {
  const replayMode = useAppStore(s => s.replayMode);
  const replayTs = useAppStore(s => s.replayTs);
  const setReplayMode = useAppStore(s => s.setReplayMode);
  const cleanUI = useAppStore(s => s.cleanUI);
  const setCleanUI = useAppStore(s => s.setCleanUI);
  const setActiveRightPanel = useAppStore(s => s.setActiveRightPanel);
  const [utcTime, setUtcTime] = useState(() => new Date());
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (replayMode !== 'live') return;
    const id = window.setInterval(() => setUtcTime(new Date()), 1000);
    return () => window.clearInterval(id);
  }, [replayMode]);

  function changeMode() {
    if (replayMode === 'live') {
      setReplayMode('playback');
      return;
    }
    useAppStore.getState().setIsPlaying(false);
    setReplayMode('live');
    useAppStore.getState().setReplayTs(Date.now());
    void queryClient.invalidateQueries();
  }

  async function shareView() {
    writeShareHash();
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  const displayedTime = replayMode === 'live'
    ? utcTime.toISOString().slice(11, 19)
    : new Date(replayTs).toISOString().slice(11, 19);

  return (
    <header className={`command-strip${cleanUI ? ' command-strip--focus' : ''}`} aria-label="Global controls">
      <div className="command-strip__identity">
        <div className="command-strip__mark" aria-hidden="true">
          <Crosshair />
        </div>
        <div className="command-strip__brand">
          <strong>INTELLIGENCE GLOBE</strong>
          <span>OPERATIONAL EARTH</span>
        </div>
        <div className={`command-strip__mode-state command-strip__mode-state--${replayMode}`}>
          {replayMode === 'live' ? <Radio aria-hidden="true" /> : <Play aria-hidden="true" />}
          <span>{replayMode === 'live' ? 'LIVE' : 'REPLAY'}</span>
        </div>
        <SystemHealthBadge />
      </div>

      {!cleanUI && <SearchBar workerRef={workerRef} compact />}

      <div className="command-strip__time telemetry" aria-label={`${replayMode} time`}>
        <span>{replayMode === 'live' ? 'UTC' : 'POSITION'}</span>
        <strong>{displayedTime}</strong>
      </div>

      <div className="command-strip__actions">
        <Button
          variant="ghost"
          size="sm"
          onClick={changeMode}
          aria-label={replayMode === 'live' ? 'Open playback' : 'Return to live'}
          className="command-strip__mode-switch"
        >
          {replayMode === 'live' ? <Play aria-hidden="true" /> : <Radio aria-hidden="true" />}
          <span>{replayMode === 'live' ? 'PLAYBACK' : 'RETURN LIVE'}</span>
        </Button>

        {!cleanUI && <ViewModePopover />}

        <Button
          variant={cleanUI ? 'secondary' : 'ghost'}
          size="sm"
          aria-pressed={cleanUI}
          aria-label={cleanUI ? 'Exit focus mode' : 'Enter focus mode'}
          onClick={() => setCleanUI(!cleanUI)}
          className="command-strip__focus"
        >
          <Focus aria-hidden="true" />
          <span className="command-strip__action-label">{cleanUI ? 'EXIT FOCUS' : 'FOCUS'}</span>
        </Button>

        {!cleanUI && (
          <>
            <div className="command-strip__desktop-actions">
              <IconAction label="Reset globe" onClick={resetGlobe}>
                <RotateCcw />
              </IconAction>
              <IconAction label={copied ? 'Link copied' : 'Copy share link'} onClick={() => void shareView()}>
                {copied ? <Check /> : <Share2 />}
              </IconAction>
              <AttributionPopover />
              <IconAction label="Open settings" onClick={() => setActiveRightPanel('settings')}>
                <Settings />
              </IconAction>
            </div>
            <MobileOverflow
              copied={copied}
              onReset={resetGlobe}
              onShare={() => void shareView()}
              onSettings={() => setActiveRightPanel('settings')}
            />
          </>
        )}
      </div>
      <MapFallbackNotice />
    </header>
  );
}

function AttributionPopover({ trigger = 'icon' }: { trigger?: 'icon' | 'menu' }) {
  return (
    <Popover>
      <PopoverTrigger
        render={
          trigger === 'icon'
            ? <Button variant="ghost" size="icon" aria-label="Data attribution" />
            : <button type="button" className="command-overflow__action" aria-label="Data attribution" />
        }
      >
        <Info />
        {trigger === 'menu' && <span>Data attribution</span>}
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="attribution-popover">
        <div className="attribution-popover__title">Data attribution</div>
        {ATTRIBUTION.map(line => <div key={line}>{line}</div>)}
      </PopoverContent>
    </Popover>
  );
}
function MobileOverflow({
  copied,
  onReset,
  onShare,
  onSettings,
}: {
  copied: boolean;
  onReset: () => void;
  onShare: () => void;
  onSettings: () => void;
}) {
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="command-strip__overflow"
            aria-label="More global controls"
          />
        }
      >
        <MoreHorizontal />
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="command-overflow">
        <ViewModePopover trigger="menu" />
        <button type="button" onClick={onReset}><RotateCcw />Reset globe</button>
        <button type="button" onClick={onShare}>{copied ? <Check /> : <Share2 />}{copied ? 'Link copied' : 'Copy share link'}</button>
        <button type="button" onClick={onSettings}><Settings />Settings</button>
        <AttributionPopover trigger="menu" />
      </PopoverContent>
    </Popover>
  );
}
