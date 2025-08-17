import { Vector2 } from '@babylonjs/core';
import { beforeEach, describe, expect, it } from 'vitest';
import type { DoomLineDef, DoomSector, DoomVertex } from '../../geometry/doom-geometry';
import { CollisionDetector } from '../collision-detector';
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
      sectors: [testSector],
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

  describe('Bidirectional Collision Detection', () => {
    it('should detect collision when player is already inside wall and trying to exit', () => {
      // Position player inside the wall (very close to y=0 wall)
      const position = new Vector2(5, -0.3); // Inside the wall
      const velocity = new Vector2(0, 1); // Moving away from wall
      const radius = 0.5;
      const deltaTime = 0.1;

      const result = detector.testCircleLineCollision(position, radius, velocity, deltaTime);

      expect(result.collided).toBe(true);
      expect(result.correction.length()).toBeGreaterThan(0);
      expect(result.normal.length()).toBeCloseTo(1); // Normalized normal
    });

    it('should detect collision when moving toward wall from outside', () => {
      const position = new Vector2(5, 0.4); // Outside wall
      const velocity = new Vector2(0, -1); // Moving toward wall
      const radius = 0.5;
      const deltaTime = 0.1;

      const result = detector.testCircleLineCollision(position, radius, velocity, deltaTime);

      expect(result.collided).toBe(true);
      expect(result.correction.length()).toBeGreaterThan(0);
      expect(result.normal.length()).toBeCloseTo(1);
    });

    it('should prevent passage through wall in both directions', () => {
      const radius = 0.3;
      const deltaTime = 0.1;

      // Test moving from outside (above y=0) toward wall (y=0)
      // Movement should cause collision because final position would be too close
      const outsidePosition = new Vector2(5, 0.5);
      const insideVelocity = new Vector2(0, -3); // Stronger movement: from y=0.5 to y=0.2

      const outsideResult = detector.testCircleLineCollision(
        outsidePosition,
        radius,
        insideVelocity,
        deltaTime
      );

      // Final position would be y=0.2, which means distance to wall = 0.2 < radius 0.3
      expect(outsideResult.collided).toBe(true);

      // Test moving from inside (below y=0) to outside
      const insidePosition = new Vector2(5, -0.2); // Inside/below the wall
      const outsideVelocity = new Vector2(0, 2); // Strong movement away from wall

      const insideResult = detector.testCircleLineCollision(
        insidePosition,
        radius,
        outsideVelocity,
        deltaTime
      );

      expect(insideResult.collided).toBe(true);
    });

    it('should provide appropriate correction when player is stuck in wall', () => {
      // Player is deep inside the wall (below y=0 line)
      const position = new Vector2(5, -0.4);
      const velocity = new Vector2(0, 0); // Not moving
      const radius = 0.5;
      const deltaTime = 0.1;

      const result = detector.testCircleLineCollision(position, radius, velocity, deltaTime);

      expect(result.collided).toBe(true);
      expect(result.correction.y).toBeGreaterThan(0); // Should push player up (away from wall)
      expect(result.correction.length()).toBeCloseTo(0.1, 1); // Penetration depth should be radius - distance = 0.5 - 0.4 = 0.1
    });

    it('should handle corner cases at line segment endpoints', () => {
      const radius = 0.5;
      const deltaTime = 0.1;

      // Test collision near start vertex (0,0)
      const nearStartPos = new Vector2(0.3, 0.3);
      const towardStartVel = new Vector2(-1, -1);

      const startResult = detector.testCircleLineCollision(
        nearStartPos,
        radius,
        towardStartVel,
        deltaTime
      );

      expect(startResult.collided).toBe(true);

      // Test collision near end vertex (10,0)
      const nearEndPos = new Vector2(9.7, 0.3);
      const towardEndVel = new Vector2(1, -1);

      const endResult = detector.testCircleLineCollision(
        nearEndPos,
        radius,
        towardEndVel,
        deltaTime
      );

      expect(endResult.collided).toBe(true);
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

    it('should handle player starting exactly on wall boundary', () => {
      // Player exactly on the wall surface
      const position = new Vector2(5, 0.5); // Exactly radius distance from wall
      const velocity = new Vector2(0, -0.1); // Tiny movement toward wall
      const radius = 0.5;
      const deltaTime = 0.1;

      const result = detector.testCircleLineCollision(position, radius, velocity, deltaTime);

      // Should detect collision because movement would cause intersection
      expect(result.collided).toBe(true);
    });
  });
});
