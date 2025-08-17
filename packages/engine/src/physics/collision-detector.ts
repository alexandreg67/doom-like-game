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

    // Find closest point on line segment to start position (current position)
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

    // Project toStart onto the normalized line direction
    // Since lineDir is normalized, projectionLength is the distance along the line
    const projectionLength = Vector2.Dot(toStart, lineDir);
    const clampedProjection = Math.max(0, Math.min(lineLength, projectionLength));
    const closestPointOnLine = lineStart.add(lineDir.scale(clampedProjection));

    // Distance from circle center to line (current position)
    const currentDistanceToLine = Vector2.Distance(startPos, closestPointOnLine);

    // Check if already intersecting with the line
    const isCurrentlyIntersecting = currentDistanceToLine < radius;

    // If currently intersecting, we need to push the player out
    if (isCurrentlyIntersecting) {
      const penetration = radius - currentDistanceToLine;

      // Calculate direction from closest point to player
      let correctionDirection = startPos.subtract(closestPointOnLine);

      // If the distance is too small, use the line normal
      if (correctionDirection.length() < PHYSICS_CONSTANTS.COLLISION_NORMAL_EPSILON) {
        correctionDirection = lineNormal;
      } else {
        correctionDirection = correctionDirection.normalize();
      }

      // Ensure correction pushes player toward the "front" side of the line (into the sector)
      // The line normal points perpendicular to the line; we want to push toward the sector
      const dotWithNormal = Vector2.Dot(correctionDirection, lineNormal);
      if (dotWithNormal < 0) {
        // Player is on the "back" side of the line, push toward front (into sector)
        correctionDirection = lineNormal;
      }

      const correction = correctionDirection.scale(penetration);

      return {
        collided: true,
        correction,
        normal: correctionDirection,
        distance: currentDistanceToLine,
      };
    }

    // Check if movement would cause intersection
    // Find closest point on line segment to target position
    const toTarget = endPos.subtract(lineStart);
    const targetProjectionLength = Vector2.Dot(toTarget, lineDir);
    const targetClampedProjection = Math.max(0, Math.min(lineLength, targetProjectionLength));
    const targetClosestPoint = lineStart.add(lineDir.scale(targetClampedProjection));

    // Distance from target position to line
    const targetDistanceToLine = Vector2.Distance(endPos, targetClosestPoint);

    // Check if target position would cause collision
    if (targetDistanceToLine >= radius) {
      return {
        collided: false,
        correction: Vector2.Zero(),
        normal: Vector2.Zero(),
        distance: targetDistanceToLine,
      };
    }

    // Movement would cause intersection - prevent it
    const penetration = radius - targetDistanceToLine;

    // Calculate direction from closest point to target position (should push away from line)
    let correctionDirection = endPos.subtract(targetClosestPoint);

    // If the distance is too small, use the line normal
    if (correctionDirection.length() < PHYSICS_CONSTANTS.COLLISION_NORMAL_EPSILON) {
      correctionDirection = lineNormal;
    } else {
      correctionDirection = correctionDirection.normalize();
    }

    const correction = correctionDirection.scale(penetration);

    return {
      collided: true,
      correction,
      normal: correctionDirection,
      distance: targetDistanceToLine,
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
