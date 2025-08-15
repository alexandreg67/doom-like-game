import { Vector2 } from '@babylonjs/core';
import { describe, expect, it } from 'vitest';
import type { DoomLineDef, DoomVertex } from '../doom-geometry';
import { segmentsIntersect, splitLineByPartition } from '../geometry-utils';

function makeVertex(id: string, x: number, y: number): DoomVertex {
  return { id, position: new Vector2(x, y) } as DoomVertex;
}

function makeLine(id: string, x1: number, y1: number, x2: number, y2: number): DoomLineDef {
  return {
    id,
    startVertex: makeVertex(`${id}_a`, x1, y1),
    endVertex: makeVertex(`${id}_b`, x2, y2),
    flags: {
      blocking: true,
      twoSided: false,
      dontDraw: false,
      mapped: true,
      soundBlock: false,
      secret: false,
      lowerUnpegged: false,
      upperUnpegged: false,
      blockMonsters: true,
    },
    length: Math.hypot(x2 - x1, y2 - y1),
    normal: new Vector2(0, 1),
  } as DoomLineDef;
}

describe('geometry-utils', () => {
  it('should split a spanning line at the partition', () => {
    // Partition is vertical line x=0 from (0,-10) to (0,10)
    const partition = makeLine('p', 0, -10, 0, 10);
    // Line crossing partition from left to right
    const line = makeLine('l', -5, 0, 5, 0);

    const result = splitLineByPartition(line, partition);
    expect(result.front).toBeDefined();
    expect(result.back).toBeDefined();

    // The two segments should together cover the original length
    const total = (result.front?.length ?? 0) + (result.back?.length ?? 0);
    expect(Math.abs(total - line.length)).toBeLessThan(1e-6);
  });

  it('should not split parallel lines', () => {
    const partition = makeLine('p', 0, 0, 10, 0);
    const line = makeLine('l', 0, 1, 10, 1); // parallel offset

    const result = splitLineByPartition(line, partition);
    expect(result.front).toBeUndefined();
    expect(result.back).toBeUndefined();
  });

  it('segmentsIntersect should detect proper intersections', () => {
    const a1 = new Vector2(-1, 0);
    const a2 = new Vector2(1, 0);
    const b1 = new Vector2(0, -1);
    const b2 = new Vector2(0, 1);

    expect(segmentsIntersect(a1, a2, b1, b2)).toBe(true);

    // Non intersecting
    const c1 = new Vector2(2, 2);
    const c2 = new Vector2(3, 2);
    expect(segmentsIntersect(a1, a2, c1, c2)).toBe(false);
  });
});
