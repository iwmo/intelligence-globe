import { useEffect, useRef } from 'react';
import type { Viewer } from 'cesium';
import {
  PostProcessStageLibrary,
  PostProcessStage,
  PostProcessStageComposite,
} from 'cesium';
import { useAppStore } from '../store/useAppStore';
import type { PostProcessUniforms, VisualPreset } from '../store/useAppStore';

interface Props {
  viewer: Viewer | null;
}

export function PostProcessEngine({ viewer }: Props) {
  const visualPreset = useAppStore((s) => s.visualPreset);
  const postProcessUniforms = useAppStore((s) => s.postProcessUniforms);

  const initRef = useRef(false);
  const stagesRef = useRef<Record<string, PostProcessStage | PostProcessStageComposite | object>>({});
  const uniformsRef = useRef<PostProcessUniforms>({
    bloomIntensity: 0.5,
    sharpenAmount: 0.5,
    gainAmount: 1.0,
    scanlineSpacing: 3,
    pixelationLevel: 1,
  });
  const preRenderListenerRef = useRef<(() => void) | null>(null);

  // Stage creation effect — runs once when viewer is available
  useEffect(() => {
    if (!viewer || initRef.current) return;
    initRef.current = true;

    // NVG stage (built-in)
    const nvg = PostProcessStageLibrary.createNightVisionStage();

    // Noir stage (built-in)
    const noir = PostProcessStageLibrary.createBlackAndWhiteStage();

    // FLIR stage — luminance-to-iron-gradient mapping
    const flir = new PostProcessStage({
      fragmentShader: `
        uniform sampler2D colorTexture;
        in vec2 v_textureCoordinates;

        void main() {
          vec4 color = texture(colorTexture, v_textureCoordinates);
          float lum = dot(color.rgb, vec3(0.299, 0.587, 0.114));
          vec3 heat;
          if (lum < 0.25)      heat = mix(vec3(0.0, 0.0, 0.0), vec3(0.0, 0.0, 1.0), lum * 4.0);
          else if (lum < 0.5)  heat = mix(vec3(0.0, 0.0, 1.0), vec3(1.0, 0.0, 0.0), (lum - 0.25) * 4.0);
          else if (lum < 0.75) heat = mix(vec3(1.0, 0.0, 0.0), vec3(1.0, 1.0, 0.0), (lum - 0.5) * 4.0);
          else                 heat = mix(vec3(1.0, 1.0, 0.0), vec3(1.0, 1.0, 1.0), (lum - 0.75) * 4.0);
          out_FragColor = vec4(heat, color.a);
        }
      `,
    });

    // CRT stage — composite with scanlines + barrel distortion
    const crt = new PostProcessStageComposite({
      stages: [
        // Pass 1: scanlines
        new PostProcessStage({
          fragmentShader: `
            uniform sampler2D colorTexture;
            uniform float u_scanlineSpacing;
            in vec2 v_textureCoordinates;

            void main() {
              vec4 color = texture(colorTexture, v_textureCoordinates);
              // Compute scanline pattern from screen-space Y
              float screenY = v_textureCoordinates.y * czm_viewport.w;
              float band = mod(floor(screenY / u_scanlineSpacing), 2.0);
              float dim = mix(0.55, 1.0, band);
              out_FragColor = vec4(color.rgb * dim, color.a);
            }
          `,
          uniforms: {
            u_scanlineSpacing: () => uniformsRef.current.scanlineSpacing,
          },
        }),
        // Pass 2: barrel distortion + chromatic aberration
        new PostProcessStage({
          fragmentShader: `
            uniform sampler2D colorTexture;
            in vec2 v_textureCoordinates;

            void main() {
              vec2 uv = v_textureCoordinates;
              // Center the UV around (0,0)
              vec2 centered = uv - 0.5;
              float r2 = dot(centered, centered);
              // Barrel distortion coefficient
              float k1 = 0.08;
              vec2 distorted = centered * (1.0 + k1 * r2);
              vec2 distUV = distorted + 0.5;

              // Chromatic aberration — shift RGB channels slightly at edges
              float aberration = r2 * 0.004;
              vec2 rUV = distUV + vec2(aberration, 0.0);
              vec2 bUV = distUV - vec2(aberration, 0.0);

              // Clamp to border to avoid texture wrapping artifacts
              vec2 clampMin = vec2(0.001);
              vec2 clampMax = vec2(0.999);
              rUV = clamp(rUV, clampMin, clampMax);
              bUV = clamp(bUV, clampMin, clampMax);
              distUV = clamp(distUV, clampMin, clampMax);

              float r = texture(colorTexture, rUV).r;
              float g = texture(colorTexture, distUV).g;
              float b = texture(colorTexture, bUV).b;
              float a = texture(colorTexture, distUV).a;

              // Vignette at edges
              float vignette = 1.0 - smoothstep(0.35, 0.7, length(centered));
              out_FragColor = vec4(vec3(r, g, b) * vignette, a);
            }
          `,
        }),
      ],
      inputPreviousStageTexture: true,
    });

    // Sharpen stage
    const sharp = new PostProcessStage({
      fragmentShader: `
        uniform sampler2D colorTexture;
        uniform float u_amount;
        in vec2 v_textureCoordinates;

        void main() {
          // Compute texel size
          vec2 texelSize = 1.0 / czm_viewport.zw;
          vec4 center = texture(colorTexture, v_textureCoordinates);

          // Laplacian sharpening kernel
          vec4 up    = texture(colorTexture, v_textureCoordinates + vec2(0.0,  texelSize.y));
          vec4 down  = texture(colorTexture, v_textureCoordinates + vec2(0.0, -texelSize.y));
          vec4 left  = texture(colorTexture, v_textureCoordinates + vec2(-texelSize.x, 0.0));
          vec4 right = texture(colorTexture, v_textureCoordinates + vec2( texelSize.x, 0.0));

          vec4 sharpened = center + u_amount * (4.0 * center - up - down - left - right);
          out_FragColor = clamp(sharpened, 0.0, 1.0);
        }
      `,
      uniforms: {
        u_amount: () => uniformsRef.current.sharpenAmount,
      },
    });

    // Gain stage
    const gain = new PostProcessStage({
      fragmentShader: `
        uniform sampler2D colorTexture;
        uniform float u_gain;
        in vec2 v_textureCoordinates;

        void main() {
          vec4 color = texture(colorTexture, v_textureCoordinates);
          out_FragColor = vec4(color.rgb * u_gain, color.a);
        }
      `,
      uniforms: {
        u_gain: () => uniformsRef.current.gainAmount,
      },
    });

    // Pixelation stage
    const pixel = new PostProcessStage({
      fragmentShader: `
        uniform sampler2D colorTexture;
        uniform float u_level;
        in vec2 v_textureCoordinates;

        void main() {
          vec2 uv = v_textureCoordinates;
          // Block-average by snapping UV to grid
          vec2 snapped = floor(uv * u_level) / u_level;
          out_FragColor = texture(colorTexture, snapped);
        }
      `,
      uniforms: {
        u_level: () => uniformsRef.current.pixelationLevel,
      },
    });

    // Store all custom stages in ref
    stagesRef.current = { nvg, noir, flir, crt, sharp, gain, pixel };

    // Add all custom stages to the collection (all disabled initially)
    [nvg, noir, flir, crt, sharp, gain, pixel].forEach((s) => {
      (s as PostProcessStage).enabled = false;
      viewer.scene.postProcessStages.add(s as PostProcessStage);
    });

    // Bloom is a built-in property of the collection — attach preRender listener
    const preRenderHandler = () => {
      const bloom = viewer.scene.postProcessStages.bloom;
      if (bloom) {
        bloom.uniforms.contrast = uniformsRef.current.bloomIntensity * 128;
      }
    };
    viewer.scene.preRender.addEventListener(preRenderHandler);
    preRenderListenerRef.current = preRenderHandler;

    // Cleanup: remove all added stages and preRender listener
    return () => {
      if (!viewer.isDestroyed()) {
        [nvg, noir, flir, crt, sharp, gain, pixel].forEach((s) => {
          try {
            viewer.scene.postProcessStages.remove(s as PostProcessStage);
          } catch {
            // Stage may already be removed or viewer destroyed
          }
        });
        if (preRenderListenerRef.current) {
          viewer.scene.preRender.removeEventListener(preRenderListenerRef.current);
        }
      }
      initRef.current = false;
    };
  }, [viewer]);

  // Preset effect — runs when visualPreset changes
  useEffect(() => {
    const stages = stagesRef.current as Record<string, { enabled: boolean }>;
    if (!stages.nvg) return; // stages not yet initialized

    // Disable all custom stages first
    ['nvg', 'noir', 'flir', 'crt', 'sharp', 'gain', 'pixel'].forEach((key) => {
      if (stages[key]) stages[key].enabled = false;
    });

    const applyPreset = (preset: VisualPreset) => {
      switch (preset) {
        case 'normal':
          // All disabled
          if (viewer && !viewer.isDestroyed()) {
            viewer.scene.postProcessStages.bloom.enabled = false;
          }
          break;
        case 'nvg':
          stages.nvg.enabled = true;
          break;
        case 'crt':
          stages.crt.enabled = true;
          break;
        case 'flir':
          stages.flir.enabled = true;
          break;
        case 'noir':
          stages.noir.enabled = true;
          break;
      }
    };

    applyPreset(visualPreset);
  }, [visualPreset, viewer]);

  // Uniforms sync effect — runs when postProcessUniforms changes
  useEffect(() => {
    uniformsRef.current = { ...uniformsRef.current, ...postProcessUniforms };

    // Also set bloom contrast directly for immediate feedback
    if (viewer && !viewer.isDestroyed()) {
      const bloom = viewer.scene.postProcessStages.bloom;
      if (bloom) {
        bloom.uniforms.contrast = postProcessUniforms.bloomIntensity * 128;
      }
    }
  }, [postProcessUniforms, viewer]);

  return null;
}

export default PostProcessEngine;
