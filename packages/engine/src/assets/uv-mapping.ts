import type { Placement } from './atlas-builder';

export type UVRect = { u0: number; v0: number; u1: number; v1: number };

/**
 * Convert a placement (pixel coords) into normalized UV coordinates (0..1)
 * Note: V axis is assumed top-to-bottom in placements and normalized accordingly.
 */
export function placementToUV(p: Placement, atlasW: number, atlasH: number): UVRect {
  const u0 = p.x / atlasW;
  const v0 = p.y / atlasH;
  const u1 = (p.x + p.width) / atlasW;
  const v1 = (p.y + p.height) / atlasH;
  return { u0, v0, u1, v1 };
}
