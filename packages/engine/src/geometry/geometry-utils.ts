import { Vector2 } from '@babylonjs/core';
import type { DoomLineDef, DoomVertex } from './doom-geometry';
import { createDoomVertex } from './doom-geometry';

export const EPSILON = 1e-8;

export const orient = (p: Vector2, q: Vector2, r: Vector2): number =>
  (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);

export function segmentsIntersect(a: Vector2, b: Vector2, c: Vector2, d: Vector2): boolean {
  const o1 = orient(a, b, c);
  const o2 = orient(a, b, d);
  const o3 = orient(c, d, a);
  const o4 = orient(c, d, b);

  if (
    Math.abs(o1) < EPSILON &&
    Math.abs(o2) < EPSILON &&
    Math.abs(o3) < EPSILON &&
    Math.abs(o4) < EPSILON
  ) {
    return false; // colinear (conservative)
  }

  return o1 * o2 < 0 && o3 * o4 < 0;
}

// Splits a line by an infinite partition line. Returns optional front/back segments using createDoomVertex for intersection.
export function splitLineByPartition(
  line: DoomLineDef,
  partition: DoomLineDef,
  intersectionIdPrefix = 'i'
): { front?: DoomLineDef; back?: DoomLineDef } {
  const a = line.startVertex.position;
  const b = line.endVertex.position;
  const p1 = partition.startVertex.position;
  const p2 = partition.endVertex.position;

  const ax = a.x;
  const ay = a.y;
  const bx = b.x;
  const by = b.y;
  const px = p1.x;
  const py = p1.y;
  const qx = p2.x;
  const qy = p2.y;

  const rdx = bx - ax;
  const rdy = by - ay;
  const sdx = qx - px;
  const sdy = qy - py;

  const denom = rdx * sdy - rdy * sdx;
  if (Math.abs(denom) < EPSILON) return {};

  const t = ((px - ax) * sdy - (py - ay) * sdx) / denom;
  const ix = ax + t * rdx;
  const iy = ay + t * rdy;

  const interVertex: DoomVertex = createDoomVertex(
    `${line.id}_${intersectionIdPrefix}_${t.toFixed(6)}`,
    new Vector2(ix, iy)
  );

  const startSide = orient(
    line.startVertex.position,
    line.endVertex.position,
    partition.startVertex.position
  );

  const segments: { front?: DoomLineDef; back?: DoomLineDef } = {};

  if (startSide >= 0) {
    segments.front = {
      id: `${line.id}_front`,
      startVertex: line.startVertex,
      endVertex: interVertex,
      flags: { ...line.flags },
      frontSide: line.frontSide,
      backSide: line.backSide,
      normal: line.normal,
      length: Math.hypot(ix - ax, iy - ay),
    } as DoomLineDef;
    segments.back = {
      id: `${line.id}_back`,
      startVertex: interVertex,
      endVertex: line.endVertex,
      flags: { ...line.flags },
      frontSide: line.frontSide,
      backSide: line.backSide,
      normal: line.normal,
      length: Math.hypot(bx - ix, by - iy),
    } as DoomLineDef;
  } else {
    segments.front = {
      id: `${line.id}_front`,
      startVertex: interVertex,
      endVertex: line.endVertex,
      flags: { ...line.flags },
      frontSide: line.frontSide,
      backSide: line.backSide,
      normal: line.normal,
      length: Math.hypot(bx - ix, by - iy),
    } as DoomLineDef;
    segments.back = {
      id: `${line.id}_back`,
      startVertex: line.startVertex,
      endVertex: interVertex,
      flags: { ...line.flags },
      frontSide: line.frontSide,
      backSide: line.backSide,
      normal: line.normal,
      length: Math.hypot(ix - ax, iy - ay),
    } as DoomLineDef;
  }

  return segments;
}
