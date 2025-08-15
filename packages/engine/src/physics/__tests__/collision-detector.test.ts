import { describe, expect, it, beforeEach } from 'vitest';
import { Vector2 } from '@babylonjs/core';
import { CollisionDetector } from '../collision-detector';
import type { DoomLineDef, DoomSector, DoomVertex } from '../../geometry/doom-geometry';
import type { CollisionGeometry } from '../types';

describe('CollisionDetector', () => {
  let detector: CollisionDetector;
  let testGeometry: CollisionGeometry;

  beforeEach(() => {
    detector = new CollisionDetector();

    // Create test geometry
    const vertices: DoomVertex[] = [
      { id: 'v1', position: new Vector2(0, 0) },
      { id: 'v2', position: new Vector2(10, 0) },
      { id: 'v3', position: new Vector2(10, 10) },
      { id: 'v4', position: new Vector2(0, 10) },
    ];

    const testLineDefs: DoomLineDef[] = [
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
        frontSide: {
          id: 's1',
          sector: {} as DoomSector,
          textureMiddle: 'WALL1',
          textureUpper: '-',
          textureLower: '-',
          offsetX: 0,
          offsetY: 0,
          needsUpperTexture: false,
          needsLowerTexture: false,
          needsMiddleTexture: true,
        },
        length: 10,
        normal: new Vector2(0, -1),
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
        frontSide: {
          id: 's2',
          sector: {} as DoomSector,
          textureMiddle: 'WALL1',
          textureUpper: '-',
          textureLower: '-',
          offsetX: 0,
          offsetY: 0,
          needsUpperTexture: false,
          needsLowerTexture: false,
          needsMiddleTexture: true,
        },
        length: 10,
        normal: new Vector2(-1, 0),
      },
      {
        id: 'l3_door',
        startVertex: vertices[2],
        endVertex: vertices[3],
        flags: {
          blocking: false, // Door is open
          twoSided: true,
          dontDraw: false,
          mapped: true,
          soundBlock: false,
          secret: false,
          lowerUnpegged: false,
          upperUnpegged: false,
          blockMonsters: false,
        },
        frontSide: {
          id: 's3',
          sector: {} as DoomSector,
          textureMiddle: '-',
          textureUpper: '-',
          textureLower: '-',
          offsetX: 0,
          offsetY: 0,
          needsUpperTexture: false,
          needsLowerTexture: false,
          needsMiddleTexture: false,
        },
        length: 10,
        normal: new Vector2(0, 1),
      },
    ];

    const testSector: DoomSector = {
      id: 'test_sector',
      floorHeight: 0,
      ceilingHeight: 8,
      floorTexture: 'FLOOR1',
      ceilingTexture: 'CEIL1',
      lightLevel: 200,
      vertices,
      lineDefs: testLineDefs,
      neighbors: [],
      boundingBox: { min: new Vector2(0, 0), max: new Vector2(10, 10) },
      meshId: 'test_mesh',
    };

    testGeometry = {
      lineDefs: testLineDefs,
      sectors: [testSector]
    };

    detector.setGeometry(testGeometry);
  });

  describe('Circle-Line Collision', () => {
    it('should detect collision with blocking wall', () => {
      const position = new Vector2(5, 0.4); // Closer to wall (at y=0)
      const velocity = new Vector2(0, -1); // Moving toward wall
      const radius = 0.5;
      const deltaTime = 0.1; // Shorter time step

      const result = detector.testCircleLineCollision(position, radius, velocity, deltaTime);

      expect(result.collided).toBe(true);
      expect(result.correction.length()).toBeGreaterThan(0);
      expect(result.normal.length()).toBeCloseTo(1); // Normalized normal
    });

    it('should not detect collision when moving away from wall', () => {
      const position = new Vector2(5, 1);
      const velocity = new Vector2(0, 2); // Moving away from wall
      const radius = 0.5;
      const deltaTime = 1.0;

      const result = detector.testCircleLineCollision(position, radius, velocity, deltaTime);

      expect(result.collided).toBe(false);
    });

    it('should not detect collision with non-blocking line', () => {
      const position = new Vector2(5, 9);
      const velocity = new Vector2(0, 2); // Moving toward door (non-blocking)
      const radius = 0.5;
      const deltaTime = 1.0;

      const result = detector.testCircleLineCollision(position, radius, velocity, deltaTime);

      expect(result.collided).toBe(false);
    });

    it('should not detect collision when far from wall', () => {
      const position = new Vector2(5, 5); // Center of room
      const velocity = new Vector2(0, -1);
      const radius = 0.5;
      const deltaTime = 1.0;

      const result = detector.testCircleLineCollision(position, radius, velocity, deltaTime);

      expect(result.collided).toBe(false);
    });
  });

  describe('Sector Detection', () => {
    it('should find sector at valid position', () => {
      const position = new Vector2(5, 5); // Center of test sector
      const sector = detector.findSectorAtPosition(position);

      expect(sector).toBeDefined();
      expect(sector?.id).toBe('test_sector');
    });

    it('should return null for position outside all sectors', () => {
      const position = new Vector2(15, 15); // Outside test sector
      const sector = detector.findSectorAtPosition(position);

      expect(sector).toBeNull();
    });

    it('should handle position at sector boundary', () => {
      const position = new Vector2(0, 0); // Exactly on corner
      const sector = detector.findSectorAtPosition(position);

      // Our implementation includes boundaries, so this should find the sector
      expect(sector).toBeDefined();
      expect(sector?.id).toBe('test_sector');
    });
  });

  describe('Metrics', () => {
    it('should track collision detection metrics', () => {
      const position = new Vector2(5, 1);
      const velocity = new Vector2(0, -2);
      const radius = 0.5;
      const deltaTime = 1.0;

      // Reset metrics
      detector.resetMetrics();
      
      // Perform multiple collision tests
      detector.testCircleLineCollision(position, radius, velocity, deltaTime);
      detector.testCircleLineCollision(position, radius, velocity, deltaTime);

      const metrics = detector.getMetrics();
      expect(metrics.collisionChecks).toBe(2);
      expect(metrics.lineTests).toBeGreaterThan(0);
    });

    it('should reset metrics correctly', () => {
      const position = new Vector2(5, 1);
      const velocity = new Vector2(0, -2);
      const radius = 0.5;
      const deltaTime = 1.0;

      // Generate some metrics
      detector.testCircleLineCollision(position, radius, velocity, deltaTime);
      
      // Reset and verify
      detector.resetMetrics();
      const metrics = detector.getMetrics();
      
      expect(metrics.collisionChecks).toBe(0);
      expect(metrics.lineTests).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero velocity', () => {
      const position = new Vector2(5, 5);
      const velocity = new Vector2(0, 0);
      const radius = 0.5;
      const deltaTime = 1.0;

      const result = detector.testCircleLineCollision(position, radius, velocity, deltaTime);

      expect(result.collided).toBe(false);
    });

    it('should handle zero radius', () => {
      const position = new Vector2(5, 1);
      const velocity = new Vector2(0, -2);
      const radius = 0;
      const deltaTime = 1.0;

      const result = detector.testCircleLineCollision(position, radius, velocity, deltaTime);

      expect(result.collided).toBe(false);
    });

    it('should handle negative delta time gracefully', () => {
      const position = new Vector2(5, 1);
      const velocity = new Vector2(0, -2);
      const radius = 0.5;
      const deltaTime = -1.0;

      // Should not crash or produce invalid results
      const result = detector.testCircleLineCollision(position, radius, velocity, deltaTime);
      expect(result).toBeDefined();
    });
  });
});
