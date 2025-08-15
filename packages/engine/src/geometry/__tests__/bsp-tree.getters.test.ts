import { Vector2 } from '@babylonjs/core';
import { describe, expect, it } from 'vitest';
import { BSPTree } from '../bsp-tree';
import type { DoomLineDef, DoomSector, DoomVertex } from '../doom-geometry';

describe('BSPTree getters (totals)', () => {
  it('should report total sectors and unique lines for a simple square sector', () => {
    const vertices: DoomVertex[] = [
      { id: 'v1', position: new Vector2(-5, -5) },
      { id: 'v2', position: new Vector2(5, -5) },
      { id: 'v3', position: new Vector2(5, 5) },
      { id: 'v4', position: new Vector2(-5, 5) },
    ];

    const sector: DoomSector = {
      id: 's1',
      floorHeight: 0,
      ceilingHeight: 4,
      floorTexture: 'FLOOR1',
      ceilingTexture: 'CEIL1',
      lightLevel: 200,
      vertices,
      lineDefs: [],
      neighbors: [],
      boundingBox: { min: new Vector2(-5, -5), max: new Vector2(5, 5) },
      meshId: 'sector_s1',
    };

    const lineDefs: DoomLineDef[] = [
      {
        id: 'l1',
        startVertex: vertices[0],
        endVertex: vertices[1],
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
        length: 10,
        normal: new Vector2(0, 1),
      },
      {
        id: 'l2',
        startVertex: vertices[1],
        endVertex: vertices[2],
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
        length: 10,
        normal: new Vector2(-1, 0),
      },
      {
        id: 'l3',
        startVertex: vertices[2],
        endVertex: vertices[3],
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
        length: 10,
        normal: new Vector2(0, -1),
      },
      {
        id: 'l4',
        startVertex: vertices[3],
        endVertex: vertices[0],
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
        length: 10,
        normal: new Vector2(1, 0),
      },
    ];
    sector.lineDefs = lineDefs;

    const bspTree = new BSPTree([sector]);

    expect(bspTree.getTotalSectors()).toBe(1);
    expect(bspTree.getTotalLines()).toBe(4);
  });

  it('should report zeros for an empty BSP', () => {
    const bspTree = new BSPTree([]);
    expect(bspTree.getTotalSectors()).toBe(0);
    expect(bspTree.getTotalLines()).toBe(0);
  });
});
