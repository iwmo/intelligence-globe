import { useEffect, useRef } from 'react';
import {
  Viewer,
  PointPrimitiveCollection,
  Cartesian3,
  Color,
} from 'cesium';
import { useStreetTraffic, RoadSegment } from '../hooks/useStreetTraffic';
import { useAppStore } from '../store/useAppStore';

const MAX_PARTICLES = 500;
const SHOW_THRESHOLD = 500_000; // hide layer above 500 km altitude
const PARTICLE_ALTITUDE_M = 10; // constant 10m — PointPrimitive does not support CLAMP_TO_GROUND
// Color is computed lazily to avoid calling CesiumJS at module load time (breaks test mocks)
let _particleColor: Color | null = null;
function getParticleColor(): Color {
  if (!_particleColor) {
    _particleColor = Color.fromCssColorString('#38BDF8'); // sky blue
  }
  return _particleColor;
}

interface Particle {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  primitive: any; // PointPrimitive
  roadIndex: number;  // which road segment
  segIndex: number;   // which segment pair within the road
  t: number;          // position along segment [0.0, 1.0)
  speed: number;      // t-units per frame
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function getPosition(roads: RoadSegment[], roadIndex: number, segIndex: number, t: number): Cartesian3 {
  const road = roads[roadIndex];
  const coordA = road.coordinates[segIndex];
  const coordB = road.coordinates[segIndex + 1] ?? road.coordinates[segIndex];
  const lon = lerp(coordA[0], coordB[0], t);
  const lat = lerp(coordA[1], coordB[1], t);
  return Cartesian3.fromDegrees(lon, lat, PARTICLE_ALTITUDE_M);
}

export function StreetTrafficLayer({ viewer }: { viewer: Viewer | null }) {
  const layerVisible = useAppStore(s => s.layers.streetTraffic);
  const { roads } = useStreetTraffic(viewer);

  const collectionRef = useRef<PointPrimitiveCollection | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const rafHandleRef = useRef<number | null>(null);
  const layerVisibleRef = useRef<boolean>(layerVisible);
  const roadsRef = useRef<RoadSegment[] | null>(roads);

  // Keep refs in sync with latest props/state for rAF loop
  layerVisibleRef.current = layerVisible;
  roadsRef.current = roads;

  // Effect 1: Initialize PointPrimitiveCollection
  useEffect(() => {
    if (!viewer || viewer.isDestroyed()) return;

    if (!collectionRef.current || collectionRef.current.isDestroyed()) {
      collectionRef.current = viewer.scene.primitives.add(
        new PointPrimitiveCollection()
      );
    }

    return () => {
      // Cancel rAF on unmount
      if (rafHandleRef.current !== null) {
        cancelAnimationFrame(rafHandleRef.current);
        rafHandleRef.current = null;
      }
      const col = collectionRef.current;
      if (col && !col.isDestroyed()) {
        viewer.scene.primitives.remove(col);
      }
      collectionRef.current = null;
      particlesRef.current = [];
    };
  }, [viewer]);

  // Effect 2: Altitude-gate visibility via camera.moveEnd
  useEffect(() => {
    if (!viewer || viewer.isDestroyed()) return;

    function handleMoveEnd() {
      if (!viewer || viewer.isDestroyed()) return;
      const altM = viewer.camera.positionCartographic.height;
      const show = altM <= SHOW_THRESHOLD && layerVisibleRef.current;

      const col = collectionRef.current;
      if (!col || col.isDestroyed()) return;

      for (const p of particlesRef.current) {
        p.primitive.show = show;
      }
    }

    viewer.camera.moveEnd.addEventListener(handleMoveEnd);
    return () => {
      viewer.camera.moveEnd.removeEventListener(handleMoveEnd);
    };
  }, [viewer]);

  // Effect 3: Rebuild particles when roads change
  useEffect(() => {
    const col = collectionRef.current;
    if (!col || col.isDestroyed()) return;

    // Clear existing particles
    if (rafHandleRef.current !== null) {
      cancelAnimationFrame(rafHandleRef.current);
      rafHandleRef.current = null;
    }
    particlesRef.current = [];
    // Remove all points from the collection
    col.removeAll?.();

    if (!roads || roads.length === 0) return;

    // Only include roads that have at least 2 coordinate pairs
    const validRoads = roads.filter(r => r.coordinates.length >= 2);
    if (validRoads.length === 0) return;

    const count = Math.min(MAX_PARTICLES, validRoads.length * 5);
    const newParticles: Particle[] = [];

    for (let i = 0; i < count; i++) {
      const roadIndex = Math.floor(Math.random() * validRoads.length);
      const road = validRoads[roadIndex];
      const maxSegIdx = road.coordinates.length - 2;
      const segIndex = maxSegIdx > 0 ? Math.floor(Math.random() * maxSegIdx) : 0;
      const t = Math.random();
      const speed = 0.00005 + Math.random() * (0.0002 - 0.00005);

      const position = getPosition(validRoads, roadIndex, segIndex, t);
      const primitive = col.add({
        position,
        pixelSize: 3,
        color: getParticleColor(),
        show: layerVisible,
      });

      newParticles.push({ primitive, roadIndex, segIndex, t, speed });
    }

    particlesRef.current = newParticles;

    // Start rAF loop
    function animate() {
      const currentRoads = roadsRef.current;
      const currentVisible = layerVisibleRef.current;

      if (!currentVisible || !currentRoads || currentRoads.length === 0) {
        rafHandleRef.current = requestAnimationFrame(animate);
        return;
      }

      const validCurrentRoads = currentRoads.filter(r => r.coordinates.length >= 2);

      for (const p of particlesRef.current) {
        if (p.roadIndex >= validCurrentRoads.length) continue;
        const road = validCurrentRoads[p.roadIndex];

        p.t += p.speed;

        // When t reaches 1.0, advance to next segment or wrap to start
        if (p.t >= 1.0) {
          p.t = 0.0;
          const maxSeg = road.coordinates.length - 2;
          if (maxSeg > 0) {
            p.segIndex = (p.segIndex + 1) % (maxSeg + 1);
          }
        }

        p.primitive.position = getPosition(validCurrentRoads, p.roadIndex, p.segIndex, p.t);
      }

      rafHandleRef.current = requestAnimationFrame(animate);
    }

    rafHandleRef.current = requestAnimationFrame(animate);

    // Cleanup handled by next roads change or unmount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roads]);

  // Effect 4: Visibility toggle from store
  useEffect(() => {
    for (const p of particlesRef.current) {
      p.primitive.show = layerVisible;
    }
  }, [layerVisible]);

  return null;
}
