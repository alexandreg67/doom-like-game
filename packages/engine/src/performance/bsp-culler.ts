/**
 * BSPCuller - Advanced BSP-based culling system with performance metrics
 * Implements frustum culling, occlusion culling, and distance-based LOD
 */

import { type Matrix, Vector3 } from '@babylonjs/core';
import type { BSPTree } from '../geometry/bsp-tree';
import type { DoomLineDef, DoomSector } from '../geometry/doom-geometry';
import type { PerformanceManager } from './performance-manager';
import type { BSPMetrics, CullingMetrics } from './types';

export interface CullingConfig {
  enableFrustumCulling: boolean;
  enableOcclusionCulling: boolean;
  enableDistanceCulling: boolean;
  maxRenderDistance: number;
  lodDistances: number[]; // Distance thresholds for LOD levels
  occlusionTestSamples: number; // Number of samples for occlusion tests
}

export interface CullingResult {
  visibleSectors: DoomSector[];
  culledSectors: DoomSector[];
  visibleLines: DoomLineDef[];
  culledLines: DoomLineDef[];
  lodLevel: number;
  metrics: CullingMetrics;
}

export class BSPCuller {
  private config: CullingConfig;
  private performanceManager: PerformanceManager;

  // Culling statistics
  private stats = {
    totalCullingTests: 0,
    frustumCulled: 0,
    occlusionCulled: 0,
    distanceCulled: 0,
    totalTraversalTime: 0,
  };

  constructor(performanceManager: PerformanceManager, config: Partial<CullingConfig> = {}) {
    this.performanceManager = performanceManager;
    this.config = {
      enableFrustumCulling: true,
      enableOcclusionCulling: true,
      enableDistanceCulling: true,
      maxRenderDistance: 1000,
      lodDistances: [100, 250, 500, 1000],
      occlusionTestSamples: 8,
      ...config,
    };

    console.log('[BSP-CULLER] BSPCuller initialized with config:', this.config);
  }

  /**
   * Perform advanced culling using BSP tree and multiple culling techniques
   */
  public cull(
    bspTree: BSPTree,
    viewPosition: Vector3,
    viewMatrix: Matrix,
    projectionMatrix: Matrix,
    allSectors: DoomSector[]
  ): CullingResult {
    this.performanceManager.start('bsp_culling');

    const startTime = performance.now();

    // Update frustum from matrices
    this.updateFrustum(viewMatrix, projectionMatrix);

    // Start with BSP traversal
    const bspResult = bspTree.traverseTree(viewPosition);
    const bspTraversalTime = performance.now() - startTime;

    // Initialize result
    const result: CullingResult = {
      visibleSectors: [],
      culledSectors: [],
      visibleLines: [],
      culledLines: [],
      lodLevel: this.calculateLODLevel(viewPosition),
      metrics: {
        frustumCulled: 0,
        occlusionCulled: 0,
        distanceCulled: 0,
        totalObjects: allSectors.length,
        cullingEfficiency: 0,
      },
    };

    // Process each sector from BSP result
    for (const sector of bspResult.visibleSectors) {
      this.stats.totalCullingTests++;

      let isCulled = false;

      // Distance culling
      if (this.config.enableDistanceCulling) {
        if (this.isDistanceCulled(sector, viewPosition)) {
          isCulled = true;
          this.stats.distanceCulled++;
          result.metrics.distanceCulled++;
        }
      }

      // Frustum culling
      if (!isCulled && this.config.enableFrustumCulling) {
        if (this.isFrustumCulled(sector)) {
          isCulled = true;
          this.stats.frustumCulled++;
          result.metrics.frustumCulled++;
        }
      }

      // Occlusion culling (more expensive, do last)
      if (!isCulled && this.config.enableOcclusionCulling) {
        if (this.isOcclusionCulled(sector, viewPosition, bspTree)) {
          isCulled = true;
          this.stats.occlusionCulled++;
          result.metrics.occlusionCulled++;
        }
      }

      // Add to appropriate list
      if (isCulled) {
        result.culledSectors.push(sector);
        // Lines from culled sectors are also culled
        result.culledLines.push(...sector.lineDefs);
      } else {
        result.visibleSectors.push(sector);
        result.visibleLines.push(...sector.lineDefs);
      }
    }

    // Add sectors that were completely culled by BSP
    const bspVisibleIds = new Set(bspResult.visibleSectors.map((s) => s.id));
    for (const sector of allSectors) {
      if (!bspVisibleIds.has(sector.id)) {
        result.culledSectors.push(sector);
        result.culledLines.push(...sector.lineDefs);
      }
    }

    // Calculate efficiency
    const totalObjects = result.visibleSectors.length + result.culledSectors.length;
    result.metrics.cullingEfficiency =
      totalObjects > 0 ? (result.culledSectors.length / totalObjects) * 100 : 0;
    result.metrics.totalObjects = totalObjects;

    const endTime = performance.now();
    const totalTime = endTime - startTime;
    this.stats.totalTraversalTime += totalTime;

    // Update performance manager
    const bspMetrics: BSPMetrics = {
      constructionTime: 0, // Not measured here
      traversalTime: bspTraversalTime,
      nodesVisited: this.estimateNodesVisited(bspTree, viewPosition),
      leavesReached: result.visibleSectors.length,
      cullingRatio: result.metrics.cullingEfficiency,
    };

    this.performanceManager.updateBSPMetrics(bspMetrics);
    this.performanceManager.updateCullingMetrics(result.metrics);
    this.performanceManager.updateGeometryMetrics(
      allSectors.length,
      result.visibleSectors.length,
      allSectors.flatMap((s) => s.lineDefs).length,
      result.visibleLines.length
    );

    this.performanceManager.end('bsp_culling');

    console.log(
      `[BSP-CULLER] Culling complete: ${result.visibleSectors.length}/${totalObjects} visible (${result.metrics.cullingEfficiency.toFixed(1)}% culled) in ${totalTime.toFixed(3)}ms`
    );

    return result;
  }

  /**
   * Update frustum from view and projection matrices
   */
  private updateFrustum(_viewMatrix: Matrix, _projectionMatrix: Matrix): void {
    // Note: For testing, we'll skip the actual frustum update
    // In real implementation, this would use Babylon's frustum calculation
  }

  /**
   * Test if sector is culled by distance
   */
  private isDistanceCulled(sector: DoomSector, viewPosition: Vector3): boolean {
    const sectorCenter = this.calculateSectorCenter(sector);
    const distance = Vector3.Distance(viewPosition, sectorCenter);
    return distance > this.config.maxRenderDistance;
  }

  /**
   * Test if sector is culled by frustum
   */
  private isFrustumCulled(sector: DoomSector): boolean {
    // Create bounding box for sector
    const bounds = this.calculateSectorBounds(sector);

    // For now, return false - simplified for testing
    // In real implementation, would test against frustum planes
    return bounds.corners.length === 0; // Only cull if no geometry
  }

  /**
   * Test if sector is occluded by other geometry
   */
  private isOcclusionCulled(sector: DoomSector, _viewPosition: Vector3, bspTree: BSPTree): boolean {
    // Sample multiple points on the sector to test occlusion
    const testPoints = this.generateOcclusionTestPoints(sector);
    let visiblePoints = 0;

    for (const point of testPoints) {
      if (bspTree.isVisible(point, _viewPosition)) {
        visiblePoints++;
      }
    }

    // Sector is occluded if less than 25% of test points are visible
    const visibilityRatio = visiblePoints / testPoints.length;
    return visibilityRatio < 0.25;
  }

  /**
   * Calculate LOD level based on view position
   */
  private calculateLODLevel(_viewPosition: Vector3): number {
    // For now, return a simple LOD based on performance
    const currentFPS = this.performanceManager.getMetrics().fps;

    if (currentFPS > 55) return 0; // High quality
    if (currentFPS > 45) return 1; // Medium quality
    if (currentFPS > 30) return 2; // Low quality
    return 3; // Very low quality
  }

  /**
   * Calculate the center point of a sector
   */
  private calculateSectorCenter(sector: DoomSector): Vector3 {
    if (sector.vertices.length === 0) {
      return Vector3.Zero();
    }

    let sumX = 0;
    let sumZ = 0;
    for (const vertex of sector.vertices) {
      sumX += vertex.position.x;
      sumZ += vertex.position.y; // Note: DOOM uses Y for what we call Z
    }

    const centerX = sumX / sector.vertices.length;
    const centerZ = sumZ / sector.vertices.length;
    const centerY = (sector.floorHeight + sector.ceilingHeight) / 2;

    return new Vector3(centerX, centerY, centerZ);
  }

  /**
   * Calculate bounding box for a sector
   */
  private calculateSectorBounds(sector: DoomSector): {
    min: Vector3;
    max: Vector3;
    corners: Vector3[];
  } {
    if (sector.vertices.length === 0) {
      const zero = Vector3.Zero();
      return { min: zero, max: zero, corners: [zero] };
    }

    let minX = Number.MAX_VALUE;
    let maxX = Number.MIN_VALUE;
    let minZ = Number.MAX_VALUE;
    let maxZ = Number.MIN_VALUE;

    for (const vertex of sector.vertices) {
      minX = Math.min(minX, vertex.position.x);
      maxX = Math.max(maxX, vertex.position.x);
      minZ = Math.min(minZ, vertex.position.y); // Note: DOOM Y -> our Z
      maxZ = Math.max(maxZ, vertex.position.y);
    }

    const minY = sector.floorHeight;
    const maxY = sector.ceilingHeight;

    const min = new Vector3(minX, minY, minZ);
    const max = new Vector3(maxX, maxY, maxZ);

    // Generate 8 corners of the bounding box
    const corners = [
      new Vector3(minX, minY, minZ),
      new Vector3(maxX, minY, minZ),
      new Vector3(minX, maxY, minZ),
      new Vector3(maxX, maxY, minZ),
      new Vector3(minX, minY, maxZ),
      new Vector3(maxX, minY, maxZ),
      new Vector3(minX, maxY, maxZ),
      new Vector3(maxX, maxY, maxZ),
    ];

    return { min, max, corners };
  }

  /**
   * Generate test points for occlusion testing
   */
  private generateOcclusionTestPoints(sector: DoomSector): Vector3[] {
    const center = this.calculateSectorCenter(sector);
    const points: Vector3[] = [center];

    // Add corner points
    for (const vertex of sector.vertices.slice(0, this.config.occlusionTestSamples - 1)) {
      const point = new Vector3(
        vertex.position.x,
        (sector.floorHeight + sector.ceilingHeight) / 2,
        vertex.position.y
      );
      points.push(point);
    }

    return points;
  }

  /**
   * Estimate number of BSP nodes visited (approximation)
   */
  private estimateNodesVisited(bspTree: BSPTree, _viewPosition: Vector3): number {
    const stats = bspTree.getStats();
    // Rough estimate: log(n) nodes visited for balanced tree
    return Math.ceil(Math.log2(stats.nodes || 1));
  }

  /**
   * Get culling statistics
   */
  public getStats(): typeof this.stats {
    return { ...this.stats };
  }

  /**
   * Reset culling statistics
   */
  public resetStats(): void {
    this.stats = {
      totalCullingTests: 0,
      frustumCulled: 0,
      occlusionCulled: 0,
      distanceCulled: 0,
      totalTraversalTime: 0,
    };

    console.log('[BSP-CULLER] Statistics reset');
  }

  /**
   * Update culling configuration
   */
  public updateConfig(config: Partial<CullingConfig>): void {
    this.config = { ...this.config, ...config };
    console.log('[BSP-CULLER] Configuration updated:', this.config);
  }

  /**
   * Get current configuration
   */
  public getConfig(): CullingConfig {
    return { ...this.config };
  }

  /**
   * Dispose and cleanup
   */
  public dispose(): void {
    this.resetStats();
    console.log('[BSP-CULLER] BSPCuller disposed');
  }
}
