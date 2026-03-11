import * as satellite from 'satellite.js';

interface OmmRecord {
  norad_cat_id: number;
  omm: Record<string, unknown>;
}

interface SatrecEntry {
  satrec: satellite.SatRec;
  norad: number;
}

let satrecs: SatrecEntry[] = [];

interface LoadOmmMessage {
  type: 'LOAD_OMM';
  payload: OmmRecord[];
}

interface PropagateMessage {
  type: 'PROPAGATE';
  payload: { timestamp: number };
}

interface ComputeOrbitMessage {
  type: 'COMPUTE_ORBIT';
  payload: { omm: Record<string, unknown>; periodSeconds: number };
}

interface GetPositionMessage {
  type: 'GET_POSITION';
  payload: { norad: number };
}

type WorkerMessage = LoadOmmMessage | PropagateMessage | ComputeOrbitMessage | GetPositionMessage;

self.onmessage = (event: MessageEvent<WorkerMessage>) => {
  const { type, payload } = event.data;

  if (type === 'LOAD_OMM') {
    const records = payload as OmmRecord[];
    satrecs = [];
    for (const item of records) {
      const satrec = satellite.json2satrec(item.omm as satellite.OMMJsonObject);
      if (satrec.error !== 0) continue;
      satrecs.push({ satrec, norad: item.norad_cat_id });
    }
    self.postMessage({ type: 'LOADED', count: satrecs.length });
    return;
  }

  if (type === 'PROPAGATE') {
    const { timestamp } = payload as { timestamp: number };
    const now = new Date(timestamp);
    const gmst = satellite.gstime(now);
    const buf = new Float64Array(satrecs.length * 4);

    for (let i = 0; i < satrecs.length; i++) {
      const { satrec, norad } = satrecs[i];
      const pv = satellite.propagate(satrec, now);
      const offset = i * 4;
      buf[offset + 3] = norad;

      if (typeof pv.position === 'boolean' || pv.position === undefined) {
        buf[offset] = NaN;
        buf[offset + 1] = NaN;
        buf[offset + 2] = NaN;
      } else {
        const ecf = satellite.eciToEcf(pv.position, gmst);
        buf[offset] = ecf.x * 1000;     // km -> m
        buf[offset + 1] = ecf.y * 1000; // km -> m
        buf[offset + 2] = ecf.z * 1000; // km -> m
      }
    }

    self.postMessage({ type: 'POSITIONS', buf }, [buf.buffer]);
    return;
  }

  if (type === 'COMPUTE_ORBIT') {
    const { omm, periodSeconds } = payload as { omm: Record<string, unknown>; periodSeconds: number };
    const satrec = satellite.json2satrec(omm as satellite.OMMJsonObject);
    const now = Date.now();
    const stepCount = Math.ceil(periodSeconds / 60);
    const orbitPoints: number[][] = [];
    const groundPoints: number[][] = [];

    for (let i = 0; i <= stepCount; i++) {
      const t = new Date(now + i * 60_000);
      const gmst = satellite.gstime(t);
      const pv = satellite.propagate(satrec, t);

      if (typeof pv.position === 'boolean' || pv.position === undefined) continue;

      const ecf = satellite.eciToEcf(pv.position, gmst);
      orbitPoints.push([ecf.x * 1000, ecf.y * 1000, ecf.z * 1000]);

      const geo = satellite.eciToGeodetic(pv.position, gmst);
      groundPoints.push([geo.longitude, geo.latitude]);
    }

    self.postMessage({ type: 'ORBIT_RESULT', orbitPoints, groundPoints });
    return;
  }

  if (type === 'GET_POSITION') {
    const { norad } = payload as { norad: number };
    const entry = satrecs.find(s => s.norad === norad);
    if (!entry) {
      self.postMessage({ type: 'POSITION_RESULT', norad, position: null });
      return;
    }
    const now = new Date();
    const gmst = satellite.gstime(now);
    const pv = satellite.propagate(entry.satrec, now);
    if (typeof pv.position === 'boolean' || pv.position === undefined) {
      self.postMessage({ type: 'POSITION_RESULT', norad, position: null });
      return;
    }
    const ecf = satellite.eciToEcf(pv.position, gmst);
    self.postMessage({
      type: 'POSITION_RESULT',
      norad,
      position: { x: ecf.x * 1000, y: ecf.y * 1000, z: ecf.z * 1000 },
    });
    return;
  }
};
