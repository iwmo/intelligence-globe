import { describe, it, expect, beforeEach } from 'vitest';
import { applyGlobePick } from '../applyGlobePick';
import { useAppStore } from '../../store/useAppStore';

describe('applyGlobePick Wave 3 prefixes', () => {
  beforeEach(() => {
    useAppStore.getState().clearSelection();
  });

  it('does not treat quake/fire/launch ids as aircraft', () => {
    applyGlobePick('quake:us7000');
    expect(useAppStore.getState().selectedAircraftId).toBeNull();
    applyGlobePick('fire:12');
    expect(useAppStore.getState().selectedAircraftId).toBeNull();
    applyGlobePick('launch:abc');
    expect(useAppStore.getState().selectedAircraftId).toBeNull();
    applyGlobePick('osm:99');
    expect(useAppStore.getState().selectedAircraftId).toBeNull();
  });
});
