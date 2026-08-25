import { useEffect, useRef } from 'react';
import { SceneTransforms, type Viewer } from 'cesium';
import { useAppStore } from '../store/useAppStore';
import { getDetectableObjects } from '../lib/detectable';

const BOX = 22;
const COLOR = 'rgba(0,255,120,0.9)';
const TRACKED = 'rgba(0,212,255,0.95)';

function drawBracket(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string,
  thick: number,
) {
  const arm = size * 0.38;
  ctx.strokeStyle = color;
  ctx.lineWidth = thick;
  ctx.beginPath();
  ctx.moveTo(x - size, y - size + arm);
  ctx.lineTo(x - size, y - size);
  ctx.lineTo(x - size + arm, y - size);
  ctx.moveTo(x + size - arm, y - size);
  ctx.lineTo(x + size, y - size);
  ctx.lineTo(x + size, y - size + arm);
  ctx.moveTo(x + size, y + size - arm);
  ctx.lineTo(x + size, y + size);
  ctx.lineTo(x + size - arm, y + size);
  ctx.moveTo(x - size + arm, y + size);
  ctx.lineTo(x - size, y + size);
  ctx.lineTo(x - size, y + size - arm);
  ctx.stroke();
}

export function DetectionOverlay({ viewer }: { viewer: Viewer | null }) {
  const enabled = useAppStore(s => s.detectOverlayEnabled);
  const layers = useAppStore(s => s.layers);
  const trackedEntity = useAppStore(s => s.trackedEntity);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!viewer || viewer.isDestroyed() || !enabled) return undefined;
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const onPostRender = () => {
      const w = viewer.canvas.clientWidth;
      const h = viewer.canvas.clientHeight;
      const dpr = window.devicePixelRatio || 1;
      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
      }
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.font = '10px monospace';
      ctx.textBaseline = 'bottom';

      const objects = getDetectableObjects(layers, trackedEntity);
      for (const obj of objects) {
        const win = SceneTransforms.worldToWindowCoordinates(viewer.scene, obj.position);
        if (!win) continue;
        if (win.x < -40 || win.y < -40 || win.x > w + 40 || win.y > h + 40) continue;
        const color = obj.tracked ? TRACKED : COLOR;
        drawBracket(ctx, win.x, win.y, obj.tracked ? BOX + 4 : BOX, color, obj.tracked ? 2 : 1);
        ctx.fillStyle = color;
        ctx.fillText(obj.label, win.x + BOX + 4, win.y - BOX + 2);
      }
    };

    viewer.scene.postRender.addEventListener(onPostRender);
    return () => {
      if (!viewer.isDestroyed()) viewer.scene.postRender.removeEventListener(onPostRender);
    };
  }, [viewer, enabled, layers, trackedEntity]);

  if (!enabled) return null;
  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        pointerEvents: 'none',
      }}
    />
  );
}
