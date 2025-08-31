/**
 * GeometrySimplifier - Simplified mesh decimation for LOD generation
 * Provides basic geometry simplification for performance optimization
 */

import { type AbstractMesh, type IndicesArray, VertexData } from '@babylonjs/core';
import type { GeometryLODOptions } from './lod-types';

export class GeometrySimplifier {
  private options: GeometryLODOptions;

  constructor(options: Partial<GeometryLODOptions> = {}) {
    this.options = {
      preserveBoundary: true,
      preserveUVs: true,
      preserveNormals: true,
      maxSimplificationRatio: 0.5,
      adaptiveThreshold: 0.001,
      ...options,
    };
  }

  /**
   * Simplify mesh to target vertex count
   */
  public simplifyMesh(mesh: AbstractMesh, targetVertexCount: number): VertexData | null {
    try {
      // Extract geometry data
      const vertexData = this.extractVertexData(mesh);
      if (!vertexData) {
        console.warn('[SIMPLIFIER] Failed to extract vertex data from mesh');
        return null;
      }

      // Validate vertex data
      if (!vertexData.positions || !vertexData.indices) {
        console.warn('[SIMPLIFIER] Invalid vertex data - missing positions or indices');
        return null;
      }

      // For now, implement a simple decimation by removing every Nth vertex
      const simplificationRatio = Math.max(
        this.options.maxSimplificationRatio,
        targetVertexCount / (vertexData.positions.length / 3)
      );

      return this.performSimpleDecimation(
        vertexData as {
          positions: Float32Array | number[];
          normals: Float32Array | number[] | null;
          uvs: Float32Array | number[] | null;
          indices: IndicesArray;
        },
        simplificationRatio
      );
    } catch (error) {
      console.error('[SIMPLIFIER] Error during mesh simplification:', error);
      return null;
    }
  }

  /**
   * Extract vertex data from mesh
   */
  private extractVertexData(mesh: AbstractMesh): {
    positions: Float32Array | number[] | null;
    normals: Float32Array | number[] | null;
    uvs: Float32Array | number[] | null;
    indices: IndicesArray | null;
  } | null {
    try {
      const geometry = (
        mesh as unknown as {
          geometry?: { getVerticesData?: (k: string) => unknown; getIndices?: () => unknown };
        }
      ).geometry;
      if (!geometry || !geometry.getVerticesData) return null;

      return {
        positions: geometry.getVerticesData?.('position') as Float32Array | number[] | null,
        normals: geometry.getVerticesData?.('normal') as Float32Array | number[] | null,
        uvs: geometry.getVerticesData?.('uv') as Float32Array | number[] | null,
        indices: geometry.getIndices?.() as IndicesArray | null,
      };
    } catch {
      return null;
    }
  }

  /**
   * Perform simple decimation by vertex removal
   */
  private performSimpleDecimation(
    vertexData: {
      positions: Float32Array | number[];
      normals: Float32Array | number[] | null;
      uvs: Float32Array | number[] | null;
      indices: IndicesArray;
    },
    ratio: number
  ): VertexData {
    const originalPositions = vertexData.positions;
    const originalNormals = vertexData.normals;
    const originalUVs = vertexData.uvs;
    const originalIndices = vertexData.indices;

    const vertexCount = originalPositions.length / 3;
    const targetCount = Math.floor(vertexCount * ratio);
    const step = Math.max(1, Math.floor(vertexCount / targetCount));

    // Build new vertex arrays
    const newPositions: number[] = [];
    const newNormals: number[] = [];
    const newUVs: number[] = [];
    const vertexMap: Map<number, number> = new Map();

    let newIndex = 0;
    for (let i = 0; i < vertexCount; i += step) {
      vertexMap.set(i, newIndex);

      // Add position
      newPositions.push(
        originalPositions[i * 3] || 0,
        originalPositions[i * 3 + 1] || 0,
        originalPositions[i * 3 + 2] || 0
      );

      // Add normal if available
      if (originalNormals && this.options.preserveNormals) {
        newNormals.push(
          originalNormals[i * 3] || 0,
          originalNormals[i * 3 + 1] || 0,
          originalNormals[i * 3 + 2] || 0
        );
      }

      // Add UV if available
      if (originalUVs && this.options.preserveUVs) {
        newUVs.push(originalUVs[i * 2] || 0, originalUVs[i * 2 + 1] || 0);
      }

      newIndex++;
    }

    // Build new index array
    const newIndices: number[] = [];
    for (let i = 0; i < originalIndices.length; i += 3) {
      const v1 = originalIndices[i];
      const v2 = originalIndices[i + 1];
      const v3 = originalIndices[i + 2];

      // Skip if any index is undefined
      if (v1 === undefined || v2 === undefined || v3 === undefined) continue;

      const newV1 = this.findClosestVertex(v1, vertexMap);
      const newV2 = this.findClosestVertex(v2, vertexMap);
      const newV3 = this.findClosestVertex(v3, vertexMap);

      // Only add triangle if all vertices are different
      if (newV1 !== newV2 && newV2 !== newV3 && newV3 !== newV1) {
        newIndices.push(newV1, newV2, newV3);
      }
    }

    // Create vertex data
    const result = new VertexData();
    result.positions = newPositions;

    if (newNormals.length > 0) {
      result.normals = newNormals;
    }

    if (newUVs.length > 0) {
      result.uvs = newUVs;
    }

    result.indices = newIndices;

    console.log(
      `[SIMPLIFIER] Simplified from ${vertexCount} to ${newPositions.length / 3} vertices`
    );
    return result;
  }

  /**
   * Find closest vertex in vertex map
   */
  private findClosestVertex(originalIndex: number, vertexMap: Map<number, number>): number {
    // First try exact match
    if (vertexMap.has(originalIndex)) {
      const mapped = vertexMap.get(originalIndex);
      if (typeof mapped === 'number') return mapped;
    }

    // Find closest available vertex
    let closestIndex = 0;
    let minDistance = Number.MAX_VALUE;

    for (const [oldIndex, newIndex] of vertexMap) {
      const distance = Math.abs(oldIndex - originalIndex);
      if (distance < minDistance) {
        minDistance = distance;
        closestIndex = newIndex;
      }
    }

    return closestIndex;
  }
}
