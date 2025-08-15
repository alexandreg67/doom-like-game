import { Vector2 } from '@babylonjs/core';
import type { DoomLineDef, DoomSector } from '../geometry/doom-geometry';
import { Logger } from '../utils/logger';
import type { CollisionGeometry, CollisionResult } from './types';
import { PHYSICS_CONSTANTS } from './types';

export class CollisionDetector {
  private geometry: CollisionGeometry | null = null;
  private metrics = {
    collisionChecks: 0,
    lineTests: 0,
  };

  constructor() {
    Logger.info('[COLLISION] CollisionDetector initialized');
  }

  public setGeometry(geometry: CollisionGeometry): void {
    this.geometry = geometry;
    Logger.info(
      `[COLLISION] Loaded geometry: ${geometry.lineDefs.length} lines, ${geometry.sectors.length} sectors`
    );
  }

  /**
   * Test collision between a moving circle and line segments
   */
  public testCircleLineCollision(
    position: Vector2,
    radius: number,
    velocity: Vector2,
    deltaTime: number
  ): CollisionResult {
    this.metrics.collisionChecks++;

    if (!this.geometry) {
      return {
        collided: false,
        correction: Vector2.Zero(),
        normal: Vector2.Zero(),
        distance: 0,
      };
    }

    const targetPosition = position.add(velocity.scale(deltaTime));
    let closestCollision: CollisionResult | null = null;
    let closestDistance = Number.POSITIVE_INFINITY;

    for (const lineDef of this.geometry.lineDefs) {
      this.metrics.lineTests++;

      // Skip if line doesn't block movement
      if (!lineDef.flags.blocking) {
        continue;
      }

      const collision = this.testCircleLineSegment(position, targetPosition, radius, lineDef);

      if (collision.collided && collision.distance < closestDistance) {
        closestDistance = collision.distance;
        closestCollision = collision;
      }
    }

    return (
      closestCollision || {
        collided: false,
        correction: Vector2.Zero(),
        normal: Vector2.Zero(),
        distance: 0,
      }
    );
  }

  /**
   * Test collision between a circle and a line segment
   */
  private testCircleLineSegment(
    startPos: Vector2,
    endPos: Vector2,
    radius: number,
    lineDef: DoomLineDef
  ): CollisionResult {
    const lineStart = lineDef.startVertex.position;
    const lineEnd = lineDef.endVertex.position;

    // Line direction and normal
    const lineDir = lineEnd.subtract(lineStart).normalize();
    const lineNormal = new Vector2(-lineDir.y, lineDir.x); // Perpendicular normal

    // Project movement onto line normal
    const movement = endPos.subtract(startPos);
    const normalDot = Vector2.Dot(movement, lineNormal);

    // If moving away from line, no collision
    if (normalDot >= 0) {
      return {
        collided: false,
        correction: Vector2.Zero(),
        normal: Vector2.Zero(),
        distance: 0,
      };
    }

    // Find closest point on line segment to circle center
    const toStart = startPos.subtract(lineStart);
    const lineLength = Vector2.Distance(lineStart, lineEnd);

    if (lineLength === 0) {
      // Degenerate line (point)
      return {
        collided: false,
        correction: Vector2.Zero(),
        normal: Vector2.Zero(),
        distance: 0,
      };
    }

    // Project toStart onto the line direction to find parameter t
    // Since lineDir is normalized, we need the actual projection length
    const projectionLength = Vector2.Dot(toStart, lineDir);
    const t = Math.max(0, Math.min(1, projectionLength / lineLength));
    const closestPoint = lineStart.add(lineDir.scale(t * lineLength));

    // Distance from circle center to line
    const distanceToLine = Vector2.Distance(startPos, closestPoint);

    // Check if collision occurs
    if (distanceToLine > radius) {
      return {
        collided: false,
        correction: Vector2.Zero(),
        normal: Vector2.Zero(),
        distance: 0,
      };
    }

    // Calculate collision response
    const penetration = radius - distanceToLine;
    const collisionNormal =
      distanceToLine > PHYSICS_CONSTANTS.COLLISION_NORMAL_EPSILON
        ? startPos.subtract(closestPoint).normalize()
        : lineNormal;

    const correction = collisionNormal.scale(penetration);

    return {
      collided: true,
      correction,
      normal: collisionNormal,
      distance: distanceToLine,
    };
  }

  /**
   * Find which sector contains the given point
   */
  public findSectorAtPosition(position: Vector2): DoomSector | null {
    if (!this.geometry) return null;

    for (const sector of this.geometry.sectors) {
      if (this.isPointInSector(position, sector)) {
        return sector;
      }
    }

    return null;
  }

  /**
   * Simple point-in-polygon test for sector containment
   */
  private isPointInSector(point: Vector2, sector: DoomSector): boolean {
    // Use bounding box as fast rejection test
    const bounds = sector.boundingBox;
    if (
      point.x < bounds.min.x ||
      point.x > bounds.max.x ||
      point.y < bounds.min.y ||
      point.y > bounds.max.y
    ) {
      return false;
    }

    // Ray casting algorithm for point-in-polygon
    let inside = false;
    const vertices = sector.vertices;

    for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
      const vi = vertices[i];
      const vj = vertices[j];

      if (!vi || !vj) continue; // Safety check

      const viPos = vi.position;
      const vjPos = vj.position;

      if (
        viPos.y > point.y !== vjPos.y > point.y &&
        point.x < ((vjPos.x - viPos.x) * (point.y - viPos.y)) / (vjPos.y - viPos.y) + viPos.x
      ) {
        inside = !inside;
      }
    }

    return inside;
  }

  /**
   * Get collision detection metrics
   */
  public getMetrics() {
    return { ...this.metrics };
  }

  /**
   * Reset metrics counters
   */
  public resetMetrics(): void {
    this.metrics.collisionChecks = 0;
    this.metrics.lineTests = 0;
  }

  public dispose(): void {
    this.geometry = null;
    Logger.info('[COLLISION] CollisionDetector disposed');
  }
}
