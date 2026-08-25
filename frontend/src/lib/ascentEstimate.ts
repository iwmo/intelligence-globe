export interface AscentSample {
  lon: number;
  lat: number;
  altM: number;
  tSec: number;
}

/** Reconstructed ballistic-ish ascent. Always label as an estimate. */
export function estimateAscentPath(
  lon: number,
  lat: number,
  headingDeg = 90,
  durationSec = 180,
  stepSec = 5,
): AscentSample[] {
  const heading = (headingDeg * Math.PI) / 180;
  const samples: AscentSample[] = [];
  for (let t = 0; t <= durationSec; t += stepSec) {
    const altM = Math.min(120_000, 0.55 * 28 * t * t);
    const downrangeM = 40 * t + 0.9 * t * t;
    const dLat = (downrangeM * Math.cos(heading)) / 111_320;
    const dLon = (downrangeM * Math.sin(heading)) / (111_320 * Math.max(0.2, Math.cos((lat * Math.PI) / 180)));
    samples.push({ lon: lon + dLon, lat: lat + dLat, altM, tSec: t });
  }
  return samples;
}
