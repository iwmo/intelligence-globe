import { useEffect, useRef, useState } from 'react';
import {
  Ion,
  Viewer,
  Color,
  EllipsoidTerrainProvider,
  UrlTemplateImageryProvider,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  Cartesian2,
  Cartesian3,
  Cartographic,
  Matrix4,
  Transforms,
  defined,
  Math as CesiumMath,
} from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import '../styles/globe.css';

interface GlobeViewProps {
  onViewerReady?: (viewer: Viewer) => void;
}

export function GlobeView({ onViewerReady }: GlobeViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current || viewerRef.current) return;

    // Only use ion token if one is actually provided
    const ionToken = import.meta.env.VITE_CESIUM_ION_TOKEN as string | undefined;
    if (ionToken) Ion.defaultAccessToken = ionToken;

    const container = containerRef.current;

    async function initViewer() {
      try {
        if (!containerRef.current || viewerRef.current) return;

        // ESRI World Imagery — high-resolution satellite photos, free, no token
        const imageryProvider = new UrlTemplateImageryProvider({
          url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
          maximumLevel: 19,
          credit: 'Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics',
        });

        if (!containerRef.current || viewerRef.current) return;

        const viewer = new Viewer(containerRef.current, {
          animation: false,
          baseLayerPicker: false,
          fullscreenButton: false,
          geocoder: false,
          homeButton: false,
          infoBox: false,
          sceneModePicker: false,
          selectionIndicator: false,
          timeline: false,
          navigationHelpButton: false,
          useDefaultRenderLoop: true,
          // Flat ellipsoid terrain — no ion token required
          terrainProvider: new EllipsoidTerrainProvider(),
          baseLayer: false, // we'll add imagery ourselves below
        });

        // Add the bundled imagery layer
        viewer.imageryLayers.addImageryProvider(imageryProvider);

        // Cinematic settings
        viewer.scene.globe.enableLighting = true;
        viewer.scene.globe.dynamicAtmosphereLighting = true;
        viewer.scene.backgroundColor = Color.BLACK;
        viewer.scene.screenSpaceCameraController.enableZoom = true;

        // Guard resize — viewer may have been destroyed by StrictMode cleanup
        const rafId = requestAnimationFrame(() => {
          if (viewerRef.current && !viewerRef.current.isDestroyed()) {
            viewerRef.current.resize();
          }
        });

        viewerRef.current = viewer;
        onViewerReady?.(viewer);

        // NAV-01: Remove CesiumJS built-in entity-tracking double-click BEFORE
        // registering custom handler. Without this, two conflicting camera flights
        // fire simultaneously (STATE.md locked decision).
        viewer.cesiumWidget.screenSpaceEventHandler.removeInputAction(
          ScreenSpaceEventType.LEFT_DOUBLE_CLICK
        );

        // NAV-01: Register custom double-click zoom toward cursor point
        const dblHandler = new ScreenSpaceEventHandler(viewer.scene.canvas);
        dblHandler.setInputAction((event: { position: Cartesian2 }) => {
          // Primary: pick terrain/water surface position via depth buffer
          let picked: Cartesian3 | undefined = viewer.scene.pickPosition(event.position);

          // Fallback: project click onto the mathematical ellipsoid via ray cast.
          if (!defined(picked)) {
            const ellipsoidPick = viewer.scene.camera.pickEllipsoid(event.position);
            picked = ellipsoidPick ?? undefined;
          }

          // Sky guard: if still undefined, click hit sky — do nothing
          if (!picked) return;

          const currentAlt = viewer.camera.positionCartographic.height;
          // Zoom ~2.5x per double-click; 500m minimum prevents zooming into terrain
          const targetAlt = Math.max(500, currentAlt * 0.4);

          // Read camera heading and pitch IN THE ENU FRAME AT THE CAMERA POSITION.
          // viewer.camera.pitch and .heading are already ENU-relative (Camera.js getter
          // temporarily sets the ENU-at-camera transform before reading the values).
          const pitch = viewer.camera.pitch;   // negative = looking below horizontal
          const heading = viewer.camera.heading;

          // NAV-01 tilt fix — approach 3: explicit world-space destination.
          //
          // We compute the destination camera position in world space using the ENU
          // frame AT THE TARGET (picked surface point). This is the same transform
          // Cesium's flyToBoundingSphere uses internally, but done explicitly so the
          // math is verifiable line-by-line without relying on flyToBoundingSphere
          // internals.
          //
          // Geometry:
          //   targetAlt ≈ vertical height of camera above surface after zoom.
          //   range = slant distance from camera to target along the look ray.
          //   At pitch p (negative = looking down): range × |sin(p)| = targetAlt
          //   Guard: if pitch nearly horizontal, avoid infinite range.
          const sinPitch = Math.abs(Math.sin(pitch));
          const MIN_SIN = Math.sin(CesiumMath.toRadians(5));
          const range = sinPitch > MIN_SIN ? targetAlt / sinPitch : targetAlt;

          // Build the ENU frame at the picked surface point.
          // Columns: [East, North, Up, picked] in ECEF world space.
          const enuAtTarget = Transforms.eastNorthUpToFixedFrame(picked);

          // In ENU space, the camera offset from target = rotate a unit vector
          // by heading (around Up/Z) then pitch (around North/Y), then negate,
          // then scale by range. This places the camera so that looking FROM the
          // camera TOWARD `picked` reproduces exactly (heading, pitch).
          //
          // headingAdjusted matches Cesium's internal convention (zeroToTwoPi - PI/2).
          const headingAdj = CesiumMath.zeroToTwoPi(heading) - CesiumMath.PI_OVER_TWO;
          const cosH = Math.cos(-headingAdj),  sinH = Math.sin(-headingAdj);
          const cosP = Math.cos(-pitch),       sinP = Math.sin(-pitch);
          // UNIT_X = [1,0,0] rotated by pitch around Y then heading around Z:
          // After pitch around Y: [cosP, 0, -sinP]
          // After heading around Z: [cosP*cosH, cosP*sinH, -sinP]
          // Negate (camera is opposite side from look direction): [-cosP*cosH, -cosP*sinH, sinP]
          const enuOffset = new Cartesian3(-cosP * cosH * range, -cosP * sinH * range, sinP * range);

          // Transform ENU offset to world (ECEF) space and add to target position.
          const destWorld = Matrix4.multiplyByPoint(enuAtTarget, enuOffset, new Cartesian3());

          // Look direction in world space: from destWorld toward picked.
          const dirWorld = Cartesian3.normalize(
            Cartesian3.subtract(picked, destWorld, new Cartesian3()),
            new Cartesian3(),
          );

          // Up direction: ENU "Up" axis transformed to world space.
          // UNIT_Z in ENU = local Up (radially outward from Earth at `picked`).
          // Matrix4.multiplyByPointAsVector transforms a direction vector (no translation).
          const upWorld = Cartesian3.normalize(
            Matrix4.multiplyByPointAsVector(enuAtTarget, Cartesian3.UNIT_Z, new Cartesian3()),
            new Cartesian3(),
          );

          // When nearly top-down (pitch ≈ -90°), dirWorld and upWorld are
          // antiparallel — Cesium cannot build a valid basis from them and the
          // camera flips. Use heading/pitch/roll form instead, which Cesium
          // resolves correctly in the ENU frame at the destination.
          const isNearlyVertical = pitch < -CesiumMath.toRadians(85);

          viewer.camera.flyTo({
            destination: destWorld,
            orientation: isNearlyVertical
              ? { heading, pitch, roll: 0 }
              : { direction: dirWorld, up: upWorld },
            duration: 0.6,
          });
        }, ScreenSpaceEventType.LEFT_DOUBLE_CLICK);

        // Direct wheel handler — bypasses CesiumJS canvas-level listener
        const onWheel = (e: WheelEvent) => {
          e.preventDefault();
          const v = viewerRef.current;
          if (!v || v.isDestroyed()) return;
          const altitude = v.camera.positionCartographic.height;
          const zoomStep = altitude * 0.12;
          if (e.deltaY > 0) v.camera.zoomOut(zoomStep);
          else v.camera.zoomIn(zoomStep);
        };

        container.addEventListener('wheel', onWheel, { passive: false });

        (viewer as unknown as { _cleanup?: () => void; _dblHandler?: ScreenSpaceEventHandler })._dblHandler = dblHandler;
        (viewer as unknown as { _cleanup?: () => void })._cleanup = () => {
          container.removeEventListener('wheel', onWheel);
          cancelAnimationFrame(rafId);
          dblHandler.destroy(); // cleanup double-click handler
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('CesiumJS init error:', err);
        setError(msg);
      }
    }

    initViewer();

    return () => {
      const v = viewerRef.current;
      if (v) {
        (v as unknown as { _cleanup?: () => void })._cleanup?.();
        if (!v.isDestroyed()) v.destroy();
        viewerRef.current = null;
      }
    };
  }, []);

  if (error) {
    return (
      <div style={{
        position: 'absolute', inset: 0, background: '#000', color: '#ff4444',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', fontFamily: 'monospace', padding: '2rem', zIndex: 999,
      }}>
        <div style={{ fontSize: '18px', marginBottom: '1rem' }}>CesiumJS Error</div>
        <div style={{ fontSize: '13px', maxWidth: '600px', wordBreak: 'break-all' }}>{error}</div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      id="cesiumContainer"
      style={{ width: '100%', height: '100%' }}
    />
  );
}
