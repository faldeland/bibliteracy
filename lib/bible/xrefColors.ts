import { TOTAL_VERSES } from "./globalVerseIndex";

const RAMP_SIZE = 256;

function buildColorRamp(): string[] {
  const out = new Array<string>(RAMP_SIZE);
  for (let i = 0; i < RAMP_SIZE; i++) {
    const hue = Math.round((i / (RAMP_SIZE - 1)) * 280);
    out[i] = `hsl(${hue}deg 80% 50%)`;
  }
  return out;
}

const COLOR_RAMP = buildColorRamp();

/** Color by canonical distance — red (near) → violet (far). */
export function xrefColorForDistance(distance: number): string {
  const t = Math.min(1, distance / TOTAL_VERSES);
  return COLOR_RAMP[Math.min(RAMP_SIZE - 1, Math.floor(t * RAMP_SIZE))]!;
}
