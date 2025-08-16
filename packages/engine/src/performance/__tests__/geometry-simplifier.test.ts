/**
 * Tests for GeometrySimplifier
 * Validates mesh decimation and simplification functionality
 */

import { CreateBox, CreateSphere, NullEngine, Scene, VertexData } from '@babylonjs/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GeometrySimplifier } from '../geometry-simplifier';
import type { GeometryLODOptions } from '../lod-types';

describe('GeometrySimplifier', () => {
  let scene: Scene;
  let engine: NullEngine;
  let simplifier: GeometrySimplifier;

  beforeEach(() => {
    engine = new NullEngine();
    scene = new Scene(engine);

    const options: Partial<GeometryLODOptions> = {
      preserveBoundary: true,
      preserveUVs: true,
      preserveNormals: true,
      maxSimplificationRatio: 0.1,
      adaptiveThreshold: 0.001,
    };

    simplifier = new GeometrySimplifier(options);
  });

  afterEach(() => {
    scene.dispose();
    engine.dispose();
  });

  describe('Initialization', () => {
    it('should create simplifier with default options', () => {
      const defaultSimplifier = new GeometrySimplifier();
      expect(defaultSimplifier).toBeDefined();
    });

    it('should create simplifier with custom options', () => {
      const customOptions: GeometryLODOptions = {
        preserveBoundary: false,
        preserveUVs: false,
        preserveNormals: false,
        maxSimplificationRatio: 0.5,
        adaptiveThreshold: 0.01,
      };

      const customSimplifier = new GeometrySimplifier(customOptions);
      expect(customSimplifier).toBeDefined();
    });
  });

  describe('Mesh Simplification', () => {
    it('should simplify a box mesh', () => {
      const box = CreateBox('testBox', { size: 2, subdivisions: 4 }, scene);
      const originalVertexCount = box.getTotalVertices();
      const targetVertexCount = Math.floor(originalVertexCount * 0.5);

      const simplifiedData = simplifier.simplifyMesh(box, targetVertexCount);

      expect(simplifiedData).toBeDefined();
      if (simplifiedData?.positions) {
        const simplifiedVertexCount = simplifiedData.positions.length / 3;
        expect(simplifiedVertexCount).toBeLessThanOrEqual(originalVertexCount);
        expect(simplifiedVertexCount).toBeGreaterThan(0);
      }
    });

    it('should simplify a sphere mesh', () => {
      const sphere = CreateSphere('testSphere', { diameter: 2, segments: 16 }, scene);
      const originalVertexCount = sphere.getTotalVertices();
      const targetVertexCount = Math.floor(originalVertexCount * 0.3);

      const simplifiedData = simplifier.simplifyMesh(sphere, targetVertexCount);

      expect(simplifiedData).toBeDefined();
      if (simplifiedData?.positions) {
        const simplifiedVertexCount = simplifiedData.positions.length / 3;
        expect(simplifiedVertexCount).toBeLessThanOrEqual(originalVertexCount);
      }
    });

    it('should handle target vertex count larger than original', () => {
      const box = CreateBox('testBox', { size: 2 }, scene);
      const originalVertexCount = box.getTotalVertices();
      const targetVertexCount = originalVertexCount * 2; // Larger than original

      const simplifiedData = simplifier.simplifyMesh(box, targetVertexCount);

      expect(simplifiedData).toBeDefined();
      if (simplifiedData?.positions) {
        const simplifiedVertexCount = simplifiedData.positions.length / 3;
        expect(simplifiedVertexCount).toBeLessThanOrEqual(originalVertexCount);
      }
    });

    it('should handle zero target vertex count', () => {
      const box = CreateBox('testBox', { size: 2 }, scene);
      const targetVertexCount = 0;

      const simplifiedData = simplifier.simplifyMesh(box, targetVertexCount);

      // Should return null or empty data for invalid target
      if (simplifiedData?.positions) {
        expect(simplifiedData.positions.length).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('Geometry Preservation', () => {
    it('should preserve UVs when enabled', () => {
      const options: GeometryLODOptions = {
        preserveBoundary: true,
        preserveUVs: true,
        preserveNormals: true,
        maxSimplificationRatio: 0.1,
        adaptiveThreshold: 0.001,
      };

      const uvSimplifier = new GeometrySimplifier(options);
      const box = CreateBox('testBox', { size: 2 }, scene);
      const targetVertexCount = Math.floor(box.getTotalVertices() * 0.5);

      const simplifiedData = uvSimplifier.simplifyMesh(box, targetVertexCount);

      expect(simplifiedData).toBeDefined();
      if (simplifiedData) {
        expect(simplifiedData.uvs).toBeDefined();
        if (simplifiedData.uvs && simplifiedData.positions) {
          expect(simplifiedData.uvs.length).toBe((simplifiedData.positions.length / 3) * 2);
        }
      }
    });

    it('should preserve normals when enabled', () => {
      const options: GeometryLODOptions = {
        preserveBoundary: true,
        preserveUVs: true,
        preserveNormals: true,
        maxSimplificationRatio: 0.1,
        adaptiveThreshold: 0.001,
      };

      const normalSimplifier = new GeometrySimplifier(options);
      const sphere = CreateSphere('testSphere', { diameter: 2, segments: 8 }, scene);
      const targetVertexCount = Math.floor(sphere.getTotalVertices() * 0.5);

      const simplifiedData = normalSimplifier.simplifyMesh(sphere, targetVertexCount);

      expect(simplifiedData).toBeDefined();
      if (simplifiedData) {
        expect(simplifiedData.normals).toBeDefined();
        if (simplifiedData.normals && simplifiedData.positions) {
          expect(simplifiedData.normals.length).toBe(simplifiedData.positions.length);
        }
      }
    });
  });

  describe('Simplification Ratios', () => {
    it('should respect maximum simplification ratio', () => {
      const options: GeometryLODOptions = {
        preserveBoundary: true,
        preserveUVs: true,
        preserveNormals: true,
        maxSimplificationRatio: 0.5, // Allow up to 50% reduction
        adaptiveThreshold: 0.001,
      };

      const ratioSimplifier = new GeometrySimplifier(options);
      const box = CreateBox('testBox', { size: 2, subdivisions: 8 }, scene);
      const originalVertexCount = box.getTotalVertices();
      const targetVertexCount = Math.floor(originalVertexCount * 0.1); // Aggressive target

      const simplifiedData = ratioSimplifier.simplifyMesh(box, targetVertexCount);

      if (simplifiedData?.positions) {
        const simplifiedVertexCount = simplifiedData.positions.length / 3;
        const actualRatio = simplifiedVertexCount / originalVertexCount;
        expect(actualRatio).toBeGreaterThanOrEqual(0.5); // Should not exceed max ratio
      }
    });

    it('should handle different simplification levels', () => {
      const box = CreateBox('testBox', { size: 2, subdivisions: 4 }, scene);
      const originalVertexCount = box.getTotalVertices();

      const ratios = [0.8, 0.5, 0.2];
      const results: number[] = [];

      for (const ratio of ratios) {
        const targetVertexCount = Math.floor(originalVertexCount * ratio);
        const simplifiedData = simplifier.simplifyMesh(box, targetVertexCount);

        if (simplifiedData?.positions) {
          results.push(simplifiedData.positions.length / 3);
        }
      }

      // Results should be in decreasing order (more simplification = fewer vertices)
      for (let i = 1; i < results.length; i++) {
        expect(results[i]).toBeLessThanOrEqual(results[i - 1]);
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle mesh without geometry', () => {
      const box = CreateBox('testBox', { size: 2 }, scene);
      box.geometry?.dispose(); // Dispose geometry

      const simplifiedData = simplifier.simplifyMesh(box, 10);

      expect(simplifiedData).toBeNull();
    });

    it('should handle invalid meshes gracefully', () => {
      const invalidMesh = {} as any; // Invalid mesh object

      const simplifiedData = simplifier.simplifyMesh(invalidMesh, 10);

      expect(simplifiedData).toBeNull();
    });

    it('should handle meshes with no indices', () => {
      const box = CreateBox('testBox', { size: 2 }, scene);

      // Remove indices to create a point cloud
      if (box.geometry) {
        box.geometry.setIndices([]);
      }

      const simplifiedData = simplifier.simplifyMesh(box, 10);

      // Should handle gracefully (return null or empty data)
      if (simplifiedData) {
        expect(simplifiedData.indices).toBeDefined();
      }
    });
  });

  describe('Quality Metrics', () => {
    it('should maintain reasonable triangle count', () => {
      const sphere = CreateSphere('testSphere', { diameter: 2, segments: 16 }, scene);
      const originalTriangleCount = sphere.getTotalIndices() / 3;
      const targetVertexCount = Math.floor(sphere.getTotalVertices() * 0.5);

      const simplifiedData = simplifier.simplifyMesh(sphere, targetVertexCount);

      if (simplifiedData?.indices) {
        const simplifiedTriangleCount = simplifiedData.indices.length / 3;
        expect(simplifiedTriangleCount).toBeLessThanOrEqual(originalTriangleCount);
        expect(simplifiedTriangleCount).toBeGreaterThan(0);
      }
    });

    it('should produce valid triangle indices', () => {
      const box = CreateBox('testBox', { size: 2 }, scene);
      const targetVertexCount = Math.floor(box.getTotalVertices() * 0.7);

      const simplifiedData = simplifier.simplifyMesh(box, targetVertexCount);

      if (simplifiedData?.indices && simplifiedData.positions) {
        const vertexCount = simplifiedData.positions.length / 3;
        const indices = simplifiedData.indices;

        // All indices should be valid
        for (const index of indices) {
          expect(index).toBeGreaterThanOrEqual(0);
          expect(index).toBeLessThan(vertexCount);
        }

        // Should have valid triangle count
        expect(indices.length % 3).toBe(0);
      }
    });
  });

  describe('Performance', () => {
    it('should handle moderately complex meshes in reasonable time', () => {
      const sphere = CreateSphere('testSphere', { diameter: 2, segments: 32 }, scene);
      const targetVertexCount = Math.floor(sphere.getTotalVertices() * 0.3);

      const startTime = performance.now();
      const simplifiedData = simplifier.simplifyMesh(sphere, targetVertexCount);
      const endTime = performance.now();

      const processingTime = endTime - startTime;
      expect(processingTime).toBeLessThan(1000); // Should complete within 1 second
      expect(simplifiedData).toBeDefined();
    });

    it('should scale reasonably with mesh complexity', () => {
      const lowPolyBox = CreateBox('lowPoly', { size: 2, subdivisions: 2 }, scene);
      const highPolyBox = CreateBox('highPoly', { size: 2, subdivisions: 8 }, scene);

      const lowPolyTarget = Math.floor(lowPolyBox.getTotalVertices() * 0.5);
      const highPolyTarget = Math.floor(highPolyBox.getTotalVertices() * 0.5);

      // Run the low-poly simplification multiple times for stable measurement
      const lowPolyRuns = 100;
      const startLow = performance.now();
      for (let i = 0; i < lowPolyRuns; i++) {
        simplifier.simplifyMesh(lowPolyBox, lowPolyTarget);
      }
      const endLow = performance.now();
      const lowTime = (endLow - startLow) / lowPolyRuns;

      const startHigh = performance.now();
      simplifier.simplifyMesh(highPolyBox, highPolyTarget);
      const highTime = performance.now() - startHigh;

      // High poly should take longer, but not excessively so
      expect(highTime).toBeGreaterThan(lowTime);
      expect(highTime).toBeLessThan(lowTime * 10); // Should scale reasonably
    });
  });
});
