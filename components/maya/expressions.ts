import type { Expression } from "@/lib/contract";
import type { Lens } from "./shapes";
import { EYE_L } from "./shapes";
import { MOUTHS } from "./visemes";

export type { Expression };

export interface ExpressionPose {
  eye: Lens;          // shape for both eyes, centred on each eye anchor (y is relative: 0 = anchor)
  eyeScale: number;
  eyeTilt: number;    // degrees, positive leans tops inward
  mouth: Lens;        // rest mouth for this expression
  gazeBias: [number, number]; // fraction of max gaze, added before clamping
  tracks: boolean;    // closed-eye expressions do not follow the pointer
}

const EYE_OPEN: Lens = { w: 36, y: 0, top: 24.5, bot: 24.5, kt: 0.5523, kb: 0.5523, tilt: 0, sw: 0 };
const EYE_LINE: Lens = { w: 24, y: 0, top: 1, bot: 1, kt: 0.55, kb: 0.55, tilt: 0, sw: 14 };
const EYE_ARC: Lens = { w: 28, y: 4, top: 9, bot: -5, kt: 0.55, kb: 0.55, tilt: 0, sw: 10 };

export const EXPRESSIONS: Record<Expression, ExpressionPose> = {
  neutral: { eye: EYE_OPEN, eyeScale: 1, eyeTilt: 0, mouth: MOUTHS.rest, gazeBias: [0, 0], tracks: true },
  listening: {
    eye: EYE_OPEN, eyeScale: 1.06, eyeTilt: 0,
    mouth: { ...MOUTHS.A_s, w: 48, bot: 14 },
    gazeBias: [0, 0], tracks: true,
  },
  thinking: {
    eye: EYE_OPEN, eyeScale: 1, eyeTilt: 0,
    mouth: { w: 30, y: 517.5, top: 0.5, bot: 0.5, kt: 0.9, kb: 0.9, tilt: 0, sw: 14 },
    gazeBias: [-0.6, -0.6], tracks: true,
  },
  happy: {
    eye: EYE_ARC, eyeScale: 1, eyeTilt: 0,
    mouth: { w: 75, y: 514, top: 0, bot: 37, kt: 0.55, kb: 0.64, tilt: 0, sw: 6 },
    gazeBias: [0, 0], tracks: false,
  },
  relieved: {
    eye: EYE_LINE, eyeScale: 1, eyeTilt: 0,
    mouth: { w: 50, y: 515, top: -6, bot: 9, kt: 0.55, kb: 0.55, tilt: 0, sw: 11 },
    gazeBias: [0, 0], tracks: false,
  },
  concerned: {
    eye: EYE_OPEN, eyeScale: 1, eyeTilt: 6,
    mouth: { w: 52, y: 524, top: 11, bot: -8, kt: 0.55, kb: 0.55, tilt: 0, sw: 12 },
    gazeBias: [0, 0], tracks: true,
  },
  surprised: {
    eye: EYE_OPEN, eyeScale: 1.12, eyeTilt: 0,
    mouth: { w: 40, y: 539, top: 24, bot: 25, kt: 0.5523, kb: 0.5523, tilt: 0, sw: 6 },
    gazeBias: [0, 0], tracks: true,
  },
};

export const EYE_CENTER_Y = EYE_L.y;
