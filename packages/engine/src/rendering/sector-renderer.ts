import {
  Color3,
  Mesh,
  type Scene,
  StandardMaterial,
  type Vector2,
  type Vector3,
  VertexData,
} from '@babylonjs/core';
import type { DoomLineDef, DoomSector } from '../geometry/doom-geometry';
import { SectorGeometry } from '../geometry/sector-geometry';

/**
 * Rendering modes for sector visualization
 */
export type RenderMode = 'solid' | 'wireframe' | 'debug';

/**
 * SectorRenderer handles the rendering of DOOM-like sectors
 * Compatible with both WebGPU and WebGL2 pipelines
 */
export class SectorRenderer {
  private scene: Scene;
  private sectorMeshes = new Map<string, SectorMeshes>();
  private materials = new Map<string, StandardMaterial>();
  private renderMode: RenderMode = 'solid';

  constructor(scene: Scene) {
    this.scene = scene;
  }

  /**
   * Renders a DOOM sector with floor, ceiling, and walls
   */
  public renderSector(sector: DoomSector): SectorMeshes {
    const geometry = new SectorGeometry(sector);
    const meshes: SectorMeshes = {
      floor: null,
      ceiling: null,
      walls: [],
    };

    // Create floor mesh
    const floorResult = geometry.triangulateFloor();
    if (floorResult.vertices.length > 0) {
      meshes.floor = this.createMesh(
        `${sector.id}_floor`,
        floorResult,
        this.getMaterial(sector.floorTexture, sector.lightLevel)
      );
    }

    // Create ceiling mesh
    const ceilingResult = geometry.triangulateCeiling();
    if (ceilingResult.vertices.length > 0) {
      meshes.ceiling = this.createMesh(
        `${sector.id}_ceiling`,
        ceilingResult,
        this.getMaterial(sector.ceilingTexture, sector.lightLevel)
      );
    }

    // Create wall meshes
    for (const lineDef of sector.lineDefs) {
      const wallResult = geometry.generateWallGeometry(lineDef);
      if (wallResult && wallResult.vertices.length > 0) {
        const wallMesh = this.createMesh(
          `${sector.id}_wall_${lineDef.id}`,
          wallResult,
          this.getWallMaterial(lineDef, sector.lightLevel)
        );
        meshes.walls.push(wallMesh);
      }
    }

    // Apply current render mode to new meshes
    this.applyRenderModeToMeshes(meshes);

    // Cache the meshes
    this.sectorMeshes.set(sector.id, meshes);

    console.log(`[SectorRenderer] Rendered sector ${sector.id}:`, {
      floor: meshes.floor !== null,
      ceiling: meshes.ceiling !== null,
      walls: meshes.walls.length,
      renderMode: this.renderMode,
      vertices: {
        floor: floorResult.vertices.length,
        ceiling: ceilingResult.vertices.length,
        walls: meshes.walls.reduce((sum, wall) => sum + (wall.getTotalVertices() || 0), 0),
      },
    });

    return meshes;
  }

  /**
   * Renders multiple sectors efficiently
   */
  public renderSectors(sectors: DoomSector[]): void {
    console.log(`[SectorRenderer] Rendering ${sectors.length} sectors`);

    const startTime = performance.now();
    let totalVertices = 0;
    let totalMeshes = 0;

    for (const sector of sectors) {
      const meshes = this.renderSector(sector);

      // Count vertices and meshes for performance metrics
      if (meshes.floor) {
        totalVertices += meshes.floor.getTotalVertices() || 0;
        totalMeshes++;
      }
      if (meshes.ceiling) {
        totalVertices += meshes.ceiling.getTotalVertices() || 0;
        totalMeshes++;
      }
      totalVertices += meshes.walls.reduce((sum, wall) => sum + (wall.getTotalVertices() || 0), 0);
      totalMeshes += meshes.walls.length;
    }

    const renderTime = performance.now() - startTime;

    console.log('[SectorRenderer] Batch render complete:', {
      sectors: sectors.length,
      meshes: totalMeshes,
      vertices: totalVertices,
      renderTime: `${renderTime.toFixed(2)}ms`,
      avgTimePerSector: `${(renderTime / sectors.length).toFixed(2)}ms`,
    });
  }

  /**
   * Creates a Babylon.js mesh from triangulation result
   */
  private createMesh(
    name: string,
    result: { vertices: Vector3[]; indices: number[]; uvs: Vector2[] },
    material: StandardMaterial
  ): Mesh {
    const mesh = new Mesh(name, this.scene);

    // Create vertex data
    const vertexData = new VertexData();

    // Convert Vector3 array to flat number array
    const positions: number[] = [];
    for (const vertex of result.vertices) {
      positions.push(vertex.x, vertex.y, vertex.z);
    }

    // Convert UV Vector2 array to flat number array
    const uvs: number[] = [];
    for (const uv of result.uvs) {
      uvs.push(uv.x, uv.y);
    }

    vertexData.positions = positions;
    vertexData.indices = result.indices;
    vertexData.uvs = uvs;

    // Calculate normals automatically
    VertexData.ComputeNormals(positions, result.indices, vertexData.normals);

    // Apply to mesh
    vertexData.applyToMesh(mesh);
    mesh.material = material;

    // Optimize for performance
    mesh.freezeWorldMatrix();

    return mesh;
  }

  /**
   * Gets or creates a material for a texture with lighting
   */
  private getMaterial(textureName: string, lightLevel: number): StandardMaterial {
    const materialKey = `${textureName}_${lightLevel}`;

    if (this.materials.has(materialKey)) {
      const existingMaterial = this.materials.get(materialKey);
      if (existingMaterial) {
        return existingMaterial;
      }
    }

    const material = new StandardMaterial(materialKey, this.scene);

    // Convert DOOM light level (0-255) to Color3 (0-1)
    const lightIntensity = lightLevel / 255;
    material.diffuseColor = new Color3(lightIntensity, lightIntensity, lightIntensity);
    material.ambientColor = new Color3(
      lightIntensity * 0.3,
      lightIntensity * 0.3,
      lightIntensity * 0.3
    );

    // TODO: Load actual textures when asset system is ready
    // For now, use solid colors for debugging
    if (textureName.includes('FLOOR')) {
      material.diffuseColor = Color3.FromHexString('#8B4513').scale(lightIntensity); // Brown
    } else if (textureName.includes('CEIL')) {
      material.diffuseColor = Color3.FromHexString('#696969').scale(lightIntensity); // Gray
    } else {
      material.diffuseColor = Color3.FromHexString('#CD853F').scale(lightIntensity); // Peru
    }

    // Optimize material
    material.freeze();

    this.materials.set(materialKey, material);
    return material;
  }

  /**
   * Gets material for wall based on line definition
   */
  private getWallMaterial(lineDef: DoomLineDef, lightLevel: number): StandardMaterial {
    // Determine which texture to use
    let textureName = 'WALL_DEFAULT';

    if (lineDef.frontSide) {
      if (lineDef.frontSide.needsMiddleTexture && lineDef.frontSide.textureMiddle !== '-') {
        textureName = lineDef.frontSide.textureMiddle;
      } else if (lineDef.frontSide.needsUpperTexture && lineDef.frontSide.textureUpper !== '-') {
        textureName = lineDef.frontSide.textureUpper;
      } else if (lineDef.frontSide.needsLowerTexture && lineDef.frontSide.textureLower !== '-') {
        textureName = lineDef.frontSide.textureLower;
      }
    }

    return this.getMaterial(textureName, lightLevel);
  }

  /**
   * Gets cached sector meshes
   */
  public getSectorMeshes(sectorId: string): SectorMeshes | null {
    return this.sectorMeshes.get(sectorId) || null;
  }

  /**
   * Removes and disposes sector meshes
   */
  public disposeSector(sectorId: string): void {
    const meshes = this.sectorMeshes.get(sectorId);
    if (!meshes) return;

    if (meshes.floor) {
      meshes.floor.dispose();
    }
    if (meshes.ceiling) {
      meshes.ceiling.dispose();
    }
    for (const wall of meshes.walls) {
      wall.dispose();
    }

    this.sectorMeshes.delete(sectorId);
    console.log(`[SectorRenderer] Disposed sector ${sectorId}`);
  }

  /**
   * Disposes all resources
   */
  public dispose(): void {
    // Dispose all meshes
    for (const [sectorId] of this.sectorMeshes) {
      this.disposeSector(sectorId);
    }

    // Dispose materials
    for (const [, material] of this.materials) {
      material.dispose();
    }
    this.materials.clear();

    // Dispose wireframe helper - commented out as WireframeHelper is not available
    // this.wireframeHelper?.dispose();

    console.log('[SectorRenderer] All resources disposed');
  }

  /**
   * Sets the rendering mode for all sectors
   */
  public setRenderMode(mode: RenderMode): void {
    this.renderMode = mode;

    // Apply render mode to all existing meshes
    for (const [, meshes] of this.sectorMeshes) {
      this.applyRenderModeToMeshes(meshes);
    }

    console.log(`[SectorRenderer] Render mode changed to: ${mode}`);
  }

  /**
   * Gets the current rendering mode
   */
  public getRenderMode(): RenderMode {
    return this.renderMode;
  }

  /**
   * Applies the current render mode to a set of meshes
   */
  private applyRenderModeToMeshes(meshes: SectorMeshes): void {
    const allMeshes: Mesh[] = [];

    if (meshes.floor) allMeshes.push(meshes.floor);
    if (meshes.ceiling) allMeshes.push(meshes.ceiling);
    allMeshes.push(...meshes.walls);

    for (const mesh of allMeshes) {
      switch (this.renderMode) {
        case 'solid':
          mesh.material = this.getSolidMaterialForMesh(mesh);
          mesh.setEnabled(true);
          break;
        case 'wireframe':
          // Enable wireframe on material directly since WireframeHelper is not available
          if (mesh.material && 'wireframe' in mesh.material) {
            (mesh.material as { wireframe: boolean }).wireframe = true;
          }
          mesh.setEnabled(true);
          break;
        case 'debug':
          mesh.material = this.getDebugMaterialForMesh(mesh);
          mesh.setEnabled(true);
          break;
      }
    }
  }

  /**
   * Gets the appropriate solid material for a mesh
   */
  private getSolidMaterialForMesh(mesh: Mesh): StandardMaterial {
    // Extract material info from mesh name
    const meshName = mesh.name;
    if (meshName.includes('_floor')) {
      return this.getMaterial('FLOOR_DEFAULT', 128);
    }
    if (meshName.includes('_ceiling')) {
      return this.getMaterial('CEIL_DEFAULT', 128);
    }
    return this.getMaterial('WALL_DEFAULT', 128);
  }

  /**
   * Gets debug material for a mesh (bright colors for visualization)
   */
  private getDebugMaterialForMesh(mesh: Mesh): StandardMaterial {
    const meshName = mesh.name;
    const debugKey = `debug_${meshName.includes('_floor') ? 'floor' : meshName.includes('_ceiling') ? 'ceiling' : 'wall'}`;

    if (this.materials.has(debugKey)) {
      const cached = this.materials.get(debugKey);
      if (cached) {
        return cached;
      }
    }

    const material = new StandardMaterial(debugKey, this.scene);
    material.wireframe = false;
    material.emissiveColor = meshName.includes('_floor')
      ? Color3.Green()
      : meshName.includes('_ceiling')
        ? Color3.Blue()
        : Color3.Red();
    material.diffuseColor = Color3.Black();

    this.materials.set(debugKey, material);
    return material;
  }

  /**
   * Gets performance metrics
   */
  public getMetrics() {
    let totalMeshes = 0;
    let totalVertices = 0;
    let totalSectors = 0;

    for (const [, meshes] of this.sectorMeshes) {
      totalSectors++;

      if (meshes.floor) {
        totalMeshes++;
        totalVertices += meshes.floor.getTotalVertices() || 0;
      }
      if (meshes.ceiling) {
        totalMeshes++;
        totalVertices += meshes.ceiling.getTotalVertices() || 0;
      }

      totalMeshes += meshes.walls.length;
      totalVertices += meshes.walls.reduce((sum, wall) => sum + (wall.getTotalVertices() || 0), 0);
    }

    return {
      sectors: totalSectors,
      meshes: totalMeshes,
      vertices: totalVertices,
      materials: this.materials.size,
      avgVerticesPerMesh: totalMeshes > 0 ? Math.round(totalVertices / totalMeshes) : 0,
      renderMode: this.renderMode,
    };
  }
}

/**
 * Container for sector mesh components
 */
export interface SectorMeshes {
  floor: Mesh | null;
  ceiling: Mesh | null;
  walls: Mesh[];
}
