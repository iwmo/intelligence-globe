import { useMemo, useState } from 'react';
import { ChevronDown, CircleDot, Layers, SlidersHorizontal } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { useGpsJamming } from '../hooks/useGpsJamming';
import { useEarthquakes } from '../hooks/useEarthquakes';
import { useFires } from '../hooks/useFires';
import { useLaunches } from '../hooks/useLaunches';
import { layerHonesty } from '../lib/layerFreshness';
import { DEFAULT_LEFT_PANEL_WIDTH } from '../lib/panelWidth';
import { useSourceHealthStore } from '../store/useSourceHealthStore';
import { FilterPanel } from './FilterPanel';
import { OperationalDrawer } from './shell/OperationalDrawer';
import './layer-drawer.css';

type LayerKey = keyof ReturnType<typeof useAppStore.getState>['layers'];

interface LayerDefinition {
  key: LayerKey;
  label: string;
  source: string;
  cadence: string;
}

interface LayerGroup {
  label: string;
  layers: LayerDefinition[];
}

const LAYER_GROUPS: LayerGroup[] = [
  {
    label: 'AIR',
    layers: [
      { key: 'aircraft', label: 'Civil aircraft', source: 'ADS-B', cadence: '20–30 seconds' },
      { key: 'militaryAircraft', label: 'Military aircraft', source: 'ADS-B classification', cadence: '20–30 seconds' },
    ],
  },
  {
    label: 'MARITIME',
    layers: [
      { key: 'ships', label: 'Vessels', source: 'AIS', cadence: 'Near real-time' },
    ],
  },
  {
    label: 'SPACE',
    layers: [
      { key: 'satellites', label: 'Satellites', source: 'CelesTrak', cadence: 'TLE refresh' },
      { key: 'launches', label: 'Launches', source: 'Launch Library 2', cadence: 'Scheduled refresh' },
    ],
  },
  {
    label: 'EVENTS',
    layers: [
      { key: 'gdelt', label: 'GDELT events', source: 'GDELT', cadence: '15 minutes' },
      { key: 'earthquakes', label: 'Earthquakes', source: 'USGS', cadence: '5 minutes' },
    ],
  },
  {
    label: 'ENVIRONMENT',
    layers: [
      { key: 'gpsJamming', label: 'GPS interference', source: 'ADS-B NIC/NACp', cadence: 'Near real-time' },
      { key: 'fires', label: 'Active fires', source: 'NASA FIRMS', cadence: 'Configured feed' },
      { key: 'streetTraffic', label: 'Road traffic', source: 'TomTom', cadence: 'Viewport refresh' },
    ],
  },
  {
    label: 'INFRASTRUCTURE',
    layers: [
      { key: 'installations', label: 'Installations', source: 'OpenStreetMap', cadence: 'Viewport refresh' },
    ],
  },
];

const RAIL_ITEMS = [
  { id: 'layers' as const, label: 'Layer drawer', icon: <Layers aria-hidden="true" /> },
  { id: 'filters' as const, label: 'Data filters', icon: <SlidersHorizontal aria-hidden="true" /> },
];

export function LeftSidebar() {
  const activePanel = useAppStore(state => state.activeLeftPanel);
  const setActivePanel = useAppStore(state => state.setActiveLeftPanel);

  function handlePanelClick(panel: 'layers' | 'filters') {
    setActivePanel(activePanel === panel ? null : panel);
  }

  return (
    <OperationalDrawer
      side="left"
      title={activePanel === 'filters' ? 'DATA FILTERS' : 'LAYER DRAWER'}
      open={activePanel !== null}
      activeItem={activePanel}
      items={RAIL_ITEMS}
      widthKey="left-panel-width"
      defaultWidth={DEFAULT_LEFT_PANEL_WIDTH}
      onItemClick={handlePanelClick}
      onClose={() => setActivePanel(null)}
    >
      {activePanel === 'layers' && <LayersTabContent />}
      {activePanel === 'filters' && <FilterPanel />}
    </OperationalDrawer>
  );
}

function LayersTabContent() {
  const { layers, setLayerVisible, gdeltQuadClassFilter, toggleGdeltQuadClass, aircraftLastUpdated, tleLastUpdated } = useAppStore();
  const sourceHealth = useSourceHealthStore(s => s.sources);
  const gpsJamming = useGpsJamming();
  const earthquakes = useEarthquakes();
  const fires = useFires();
  const launches = useLaunches();
  const [query, setQuery] = useState('');
  const [expandedLayer, setExpandedLayer] = useState<LayerKey | null>(null);
  const hasJamCells = (gpsJamming.data?.cells?.length ?? 0) > 0;

  const filteredGroups = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return LAYER_GROUPS;
    return LAYER_GROUPS
      .map(group => ({
        ...group,
        layers: group.layers.filter(layer =>
          `${layer.label} ${layer.source}`.toLowerCase().includes(normalizedQuery),
        ),
      }))
      .filter(group => group.layers.length > 0);
  }, [query]);

  const layerEvidence = (key: LayerKey) => {
    if (key === 'satellites') return { lastUpdated: tleLastUpdated };
    if (key === 'aircraft') return { lastUpdated: aircraftLastUpdated };
    if (key === 'gpsJamming') return { hasData: hasJamCells || undefined };
    if (key === 'earthquakes') return { hasData: (earthquakes.data?.events.length ?? 0) > 0 || undefined };
    if (key === 'fires') {
      return {
        hasData: fires.data?.available === false
          ? false
          : ((fires.data?.cells.length ?? 0) > 0 || undefined),
      };
    }
    if (key === 'launches') return { hasData: (launches.data?.launches.length ?? 0) > 0 || undefined };
    return {};
  };

  function soloLayer(key: LayerKey) {
    (Object.keys(layers) as LayerKey[]).forEach(layerKey => {
      setLayerVisible(layerKey, layerKey === key);
    });
  }

  return (
    <div className="layer-drawer">
      <div className="layer-drawer__summary">
        <label>
          <span className="sr-only">Filter layers</span>
          <input
            type="search"
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Filter layers or sources"
          />
        </label>
        <span>
          {Object.values(layers).filter(Boolean).length}/{Object.keys(layers).length} enabled
        </span>
      </div>

      {filteredGroups.map(group => {
        const enabledCount = group.layers.filter(layer => layers[layer.key]).length;
        return (
          <section className="layer-group" key={group.label}>
            <header className="layer-group__header">
              <div>
                <h3>{group.label}</h3>
                <span>{enabledCount}/{group.layers.length} enabled</span>
              </div>
              <button
                type="button"
                onClick={() => group.layers.forEach(layer => setLayerVisible(layer.key, false))}
                disabled={enabledCount === 0}
              >
                Clear
              </button>
            </header>

            <div className="layer-group__rows">
              {group.layers.map(layer => {
                const active = layers[layer.key];
                const evidence = layerEvidence(layer.key);
                const honesty = layerHonesty({
                  visible: active,
                  status: sourceHealth[layer.key].status,
                  ...evidence,
                });
                const expanded = expandedLayer === layer.key;
                const lastSuccessAt = sourceHealth[layer.key].lastSuccessAt;
                return (
                  <div className="layer-row" data-active={active} key={layer.key}>
                    <div className="layer-row__primary">
                      <button
                        type="button"
                        className="layer-row__toggle"
                        onClick={() => setLayerVisible(layer.key, !active)}
                        aria-pressed={active}
                      >
                        <CircleDot aria-hidden="true" />
                        <span>
                          <strong>{layer.label}</strong>
                          <small>{layer.source}</small>
                        </span>
                        <em data-status={honesty.toLowerCase()}>{honesty}</em>
                      </button>
                      <button
                        type="button"
                        className="layer-row__expand"
                        aria-label={`${expanded ? 'Hide' : 'Show'} ${layer.label} details`}
                        aria-expanded={expanded}
                        onClick={() => setExpandedLayer(expanded ? null : layer.key)}
                      >
                        <ChevronDown aria-hidden="true" />
                      </button>
                    </div>

                    {expanded && (
                      <div className="layer-row__details">
                        <dl>
                          <div><dt>Source</dt><dd>{layer.source}</dd></div>
                          <div><dt>Cadence</dt><dd>{layer.cadence}</dd></div>
                          <div>
                            <dt>Last success</dt>
                            <dd>
                              {lastSuccessAt
                                ? new Date(lastSuccessAt).toLocaleTimeString()
                                : 'No successful update'}
                            </dd>
                          </div>
                        </dl>
                        <button type="button" onClick={() => soloLayer(layer.key)}>Solo layer</button>
                        {layer.key === 'gpsJamming' && hasJamCells && <JammingLegend />}
                        {layer.key === 'gdelt' && active && (
                          <GdeltFilters
                            selected={gdeltQuadClassFilter}
                            onToggle={toggleGdeltQuadClass}
                          />
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}

      {filteredGroups.length === 0 && (
        <div className="layer-drawer__empty">No layers match “{query}”.</div>
      )}
    </div>
  );
}

function JammingLegend() {
  return (
    <div className="layer-legend" aria-label="GPS interference severity legend">
      <span>NIC/NACp severity</span>
      <div><i data-level="high" />High (≥30% bad)</div>
      <div><i data-level="moderate" />Moderate (≥10%)</div>
      <div><i data-level="low" />Low / none</div>
    </div>
  );
}

function GdeltFilters({
  selected,
  onToggle,
}: {
  selected: number[];
  onToggle: (quadClass: number) => void;
}) {
  const labels: Record<number, string> = {
    1: 'Verbal cooperation',
    2: 'Material cooperation',
    3: 'Verbal conflict',
    4: 'Material conflict',
  };

  return (
    <div className="layer-quad-filters">
      <span>Quad class</span>
      {([1, 2, 3, 4] as const).map(quadClass => (
        <button
          type="button"
          key={quadClass}
          data-active={selected.includes(quadClass)}
          onClick={() => onToggle(quadClass)}
        >
          {labels[quadClass]}
        </button>
      ))}
    </div>
  );
}
