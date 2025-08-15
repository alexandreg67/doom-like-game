import {
  Color3,
  type Engine,
  FreeCamera,
  HemisphericLight,
  Mesh,
  MeshBuilder,
  Scene,
  StandardMaterial,
  Vector2,
  Vector3,
  VertexData,
} from '@babylonjs/core';
import { AssetLoader } from '../assets/asset-loader';
import { BSPTree } from '../geometry/bsp-tree';
import type { DoomLineDef, DoomSector, DoomVertex } from '../geometry/doom-geometry';
import { SectorGeometry } from '../geometry/sector-geometry';

export interface RenderMetrics {
  frameTime: number;
  culledSectors: number;
  renderedSectors: number;
  culledLines: number;
  renderedLines: number;
  bspTraversalTime: number;
  totalGeometry: number;
}

export class SceneManager {
  private engine: Engine;
  private currentScene: Scene | null = null;
  private assetLoader: AssetLoader;
  private bspTree: BSPTree | null = null;
  private _debugBSP = false; // Toggle for BSP debug visualization
  private enableMetrics = false; // Toggle for performance metrics
  private lastMetrics: RenderMetrics | null = null;

  constructor(engine: Engine) {
    this.engine = engine;
    this.assetLoader = new AssetLoader(engine, {
      maxRetries: 3,
      retryDelay: 1000,
      cacheMaxAge: 5 * 60 * 1000, // 5 minutes
    });
  }

  public createDefaultScene(): Scene {
    console.log('[ENGINE] Creating default scene...');
    const scene = new Scene(this.engine);

    // Create camera - positioned to look forward (horizontal)
    const camera = new FreeCamera('camera', new Vector3(0, 2, 0), scene);
    camera.setTarget(new Vector3(0, 2, 1)); // Look forward horizontally
    // Attach camera controls to canvas
    const canvas = this.engine.getRenderingCanvas();
    if (canvas) {
      camera.attachControl(canvas, true);
    }

    // Create lighting
    const light = new HemisphericLight('light', new Vector3(0, 1, 0), scene);
    light.intensity = 0.7;

    // Define a simple square sector
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
      vertices: vertices,
      lineDefs: [], // Will be populated later
      neighbors: [],
      // Bounding box and other data will be calculated by SectorGeometry
      boundingBox: { min: new Vector2(0, 0), max: new Vector2(0, 0) },
      meshId: 'sector_s1',
    };

    // Define the walls (LineDefs) of the sector
    const v1 = vertices[0]!;
    const v2 = vertices[1]!;
    const v3 = vertices[2]!;
    const v4 = vertices[3]!;

    // Note: A circular dependency exists where LineDefs need a Sector and vice-versa.
    // We define the sector first, then the linedefs, then assign them back to the sector.
    const lineDefs: DoomLineDef[] = [
      {
        id: 'l1',
        startVertex: v1,
        endVertex: v2,
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
          id: 's1_1',
          sector: sector,
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
        normal: new Vector2(0, 1),
      },
      {
        id: 'l2',
        startVertex: v2,
        endVertex: v3,
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
          id: 's1_2',
          sector: sector,
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
        id: 'l3',
        startVertex: v3,
        endVertex: v4,
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
          id: 's1_3',
          sector: sector,
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
        id: 'l4',
        startVertex: v4,
        endVertex: v1,
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
          id: 's1_4',
          sector: sector,
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
        normal: new Vector2(1, 0),
      },
    ];
    sector.lineDefs = lineDefs;

    // Build BSP Tree for culling optimization
    console.log('[ENGINE] Building BSP tree for sector culling...');
    const sectors = [sector]; // For now, single sector
    this.bspTree = new BSPTree(sectors);
    const bspStats = this.bspTree.getStats();
    console.log(
      `[ENGINE] BSP tree built: ${bspStats.nodes} nodes, ${bspStats.leafs} leafs, depth ${bspStats.maxDepth}`
    );

    // Create geometry from the sector data
    const sectorGeometry = new SectorGeometry(sector);

    // Create floor mesh
    const floorTriangulation = sectorGeometry.triangulateFloor();
    const floorMesh = new Mesh(`${sector.id}_floor`, scene);
    const floorVertexData = new VertexData();
    floorVertexData.positions = floorTriangulation.vertices.flatMap((v) => [v.x, v.y, v.z]);
    floorVertexData.indices = floorTriangulation.indices;
    floorVertexData.uvs = floorTriangulation.uvs.flatMap((v) => [v.x, v.y]);
    floorVertexData.applyToMesh(floorMesh);

    const floorMaterial = new StandardMaterial(`${sector.id}_floor_mat`, scene);
    // Set fallback color immediately
    floorMaterial.diffuseColor = new Color3(0.5, 0.5, 0.5); // Fallback gray

    // Try to load texture asynchronously (non-blocking)
    this.assetLoader
      .loadBabylonTexture('/textures/floor.jpg', scene)
      .then((texture) => {
        floorMaterial.diffuseTexture = texture;
        // Strong concrete appearance: very matte and gray
        floorMaterial.diffuseColor = new Color3(0.6, 0.6, 0.6); // Much more gray/concrete
        // Very matte finish for concrete
        floorMaterial.specularColor = new Color3(0.05, 0.05, 0.05); // Almost no reflections
        floorMaterial.specularPower = 4; // Very diffuse, rough concrete surface
        console.log('[ENGINE] Floor texture applied with concrete properties');
      })
      .catch((error) => {
        console.warn('[ENGINE] Failed to load floor texture, using fallback color:', error);
      });
    floorMesh.material = floorMaterial;
    console.log('[ENGINE] Floor mesh created, material assigned');

    // Create ceiling mesh
    const ceilingMesh = MeshBuilder.CreateBox(
      'test_ceiling',
      {
        width: 8,
        height: 0.5, // Thicker so we can see it better
        depth: 8,
      },
      scene
    );
    ceilingMesh.position.y = 3.8; // High up
    const ceilingMaterial = new StandardMaterial('ceiling_mat', scene);
    ceilingMaterial.diffuseColor = new Color3(0, 1, 0); // Green fallback
    // Try with backFaceCulling enabled first
    ceilingMaterial.backFaceCulling = true;
    // Add some emission to make sure it's visible
    ceilingMaterial.emissiveColor = new Color3(0.1, 0.3, 0.1); // Slight green emission
    console.log('[ENGINE] Ceiling material created with green fallback and emission');

    // Load ceiling texture with proper brightness settings
    this.assetLoader
      .loadBabylonTexture('/textures/ceiling-metal.jpg', scene, 'ceiling')
      .then((texture) => {
        console.log('[ENGINE] Ceiling texture loaded and applied successfully');
        ceilingMaterial.diffuseTexture = texture;
        // Strong metallic appearance: chrome-like with high reflectivity
        ceilingMaterial.diffuseColor = new Color3(2.2, 2.8, 4.2); // Much more blue-tinted metal
        ceilingMaterial.emissiveColor = new Color3(0.3, 0.5, 1.0); // Strong blue emission
        // Enhanced metallic properties
        ceilingMaterial.specularColor = new Color3(1.2, 1.3, 1.5); // Very bright reflections
        ceilingMaterial.specularPower = 128; // Very sharp, mirror-like reflections
        // Note: metallicFactor is not available on StandardMaterial, using specular properties instead
        console.log('[ENGINE] Ceiling texture applied with metallic properties');
      })
      .catch((error) => {
        console.warn('[ENGINE] Failed to load ceiling texture, using fallback:', error);
      });

    ceilingMesh.material = ceilingMaterial;
    console.log('[ENGINE] Debug ceiling created at:', ceilingMesh.position);

    // Create wall meshes
    for (const lineDef of sector.lineDefs) {
      const wallTriangulation = sectorGeometry.generateWallGeometry(lineDef);
      if (wallTriangulation) {
        const wallMesh = new Mesh(`${lineDef.id}_wall`, scene);
        const wallVertexData = new VertexData();
        wallVertexData.positions = wallTriangulation.vertices.flatMap((v) => [v.x, v.y, v.z]);
        wallVertexData.indices = wallTriangulation.indices;
        wallVertexData.uvs = wallTriangulation.uvs.flatMap((v) => [v.x, v.y]);
        wallVertexData.applyToMesh(wallMesh);

        const wallMaterial = new StandardMaterial(`${lineDef.id}_wall_mat`, scene);
        // Set fallback color immediately
        wallMaterial.diffuseColor = new Color3(0.6, 0.6, 0.8); // Fallback light blue

        // Robust correction: check for frontSide and textureMiddle
        const rawTextureName = lineDef.frontSide?.textureMiddle;
        console.log(`[ENGINE] Wall ${lineDef.id} - Raw texture name: '${rawTextureName}'`);

        // Guard against '-' or empty strings
        let wallTextureName = 'wall'; // default
        if (rawTextureName && rawTextureName.trim() !== '' && rawTextureName !== '-') {
          wallTextureName = rawTextureName.toLowerCase().trim();
        }

        const wallTexturePath = `/textures/${wallTextureName}.jpg`;
        console.log(`[ENGINE] Wall ${lineDef.id} - Resolved texture path: '${wallTexturePath}'`);

        this.assetLoader
          .loadBabylonTexture(wallTexturePath, scene)
          .then((texture) => {
            wallMaterial.diffuseTexture = texture;
            // Remove fallback color when texture is loaded
            wallMaterial.diffuseColor = new Color3(1, 1, 1);
            console.log(
              `[ENGINE] Wall texture loaded and applied successfully for ${lineDef.id} (${wallTexturePath})`
            );
            console.log(
              `[ENGINE] Wall ${lineDef.id} material diffuseTexture:`,
              wallMaterial.diffuseTexture
            );
            console.log(`[ENGINE] Wall ${lineDef.id} texture isReady:`, texture.isReady());
          })
          .catch((error) => {
            console.warn(
              `[ENGINE] Failed to load wall texture for ${lineDef.id} (${wallTexturePath}), using fallback color:`,
              error
            );
          });
        wallMesh.material = wallMaterial;
        console.log(`[ENGINE] Wall mesh ${lineDef.id} created, material assigned`);
      }
    }

    console.log('[ENGINE] Default scene created successfully');
    this.currentScene = scene;
    return scene;
  }

  /**
   * Enables or disables BSP debug visualization
   */
  public setDebugBSP(enabled: boolean): void {
    this._debugBSP = enabled;
    console.log(`[ENGINE] BSP debug visualization ${enabled ? 'enabled' : 'disabled'}`);

    if (this.currentScene && this.bspTree) {
      if (enabled) {
        this.createBSPDebugWireframe();
      } else {
        this.removeBSPDebugWireframe();
      }
    }
  }

  /**
   * Returns whether BSP debug visualization is enabled
   */
  public isDebugBSPEnabled(): boolean {
    return this._debugBSP;
  }

  /**
   * Creates wireframe visualization of the BSP tree partitions
   */
  private createBSPDebugWireframe(): void {
    if (!this.currentScene || !this.bspTree) return;

    // Remove existing debug wireframes
    this.removeBSPDebugWireframe();

    const root = this.bspTree.getRoot();
    if (root) {
      this.createNodeWireframe(root, 0);
    }
  }

  /**
   * Recursively creates wireframe for BSP nodes
   */
  private createNodeWireframe(node: any, depth: number): void {
    if (!this.currentScene) return;

    if (!node.isLeaf && node.splitLine) {
      const line = node.splitLine;
      const start = line.startVertex.position;
      const end = line.endVertex.position;

      // Create line mesh for the partition
      const points = [
        new Vector3(start.x, 0, start.y),
        new Vector3(start.x, 4, start.y), // Extend to ceiling height
        new Vector3(end.x, 4, end.y),
        new Vector3(end.x, 0, end.y),
        new Vector3(start.x, 0, start.y), // Close the line
      ];

      const lineMesh = MeshBuilder.CreateLines(
        `bsp_debug_${line.id}`,
        { points },
        this.currentScene
      );

      // Color based on depth for better visualization
      const colors = [
        new Color3(1, 0, 0), // Red
        new Color3(0, 1, 0), // Green
        new Color3(0, 0, 1), // Blue
        new Color3(1, 1, 0), // Yellow
        new Color3(1, 0, 1), // Magenta
        new Color3(0, 1, 1), // Cyan
      ];

      const material = new StandardMaterial(`bsp_debug_mat_${line.id}`, this.currentScene);
      material.emissiveColor = colors[depth % colors.length] || new Color3(1, 1, 1);
      material.disableLighting = true;
      lineMesh.material = material;

      // Tag for easy removal
      lineMesh.metadata = { isBSPDebug: true };

      // Recursively create wireframes for children
      if (node.frontChild) {
        this.createNodeWireframe(node.frontChild, depth + 1);
      }
      if (node.backChild) {
        this.createNodeWireframe(node.backChild, depth + 1);
      }
    }
  }

  /**
   * Removes all BSP debug wireframes
   */
  private removeBSPDebugWireframe(): void {
    if (!this.currentScene) return;

    const meshesToRemove = this.currentScene.meshes.filter((mesh) => mesh.metadata?.isBSPDebug);

    for (const mesh of meshesToRemove) {
      mesh.dispose();
    }
  }

  /**
   * Performs BSP-based culling and returns visible geometry
   */
  public performBSPCulling(cameraPosition: Vector3): {
    visibleSectors: number;
    visibleLines: number;
    totalSectors: number;
    totalLines: number;
  } {
    if (!this.bspTree) {
      return {
        visibleSectors: 0,
        visibleLines: 0,
        totalSectors: 0,
        totalLines: 0,
      };
    }

    const traversalResult = this.bspTree.traverseTree(cameraPosition);

    return {
      visibleSectors: traversalResult.visibleSectors.length,
      visibleLines: traversalResult.visibleLines.length,
      totalSectors: 1, // Single sector for now
      totalLines: 4, // Square sector has 4 lines
    };
  }

  /**
   * Enables or disables performance metrics collection
   */
  public setMetricsEnabled(enabled: boolean): void {
    this.enableMetrics = enabled;
    console.log(`[ENGINE] Performance metrics ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Collects performance metrics for the current frame
   */
  public collectFrameMetrics(): RenderMetrics | null {
    if (!this.enableMetrics || !this.currentScene || !this.bspTree) {
      return null;
    }

    const frameStartTime = performance.now();

    // Get camera position
    const camera = this.currentScene.activeCamera;
    if (!camera) {
      return null;
    }

    const cameraPosition = camera.position;

    // Measure BSP traversal time
    const bspStartTime = performance.now();
    const traversalResult = this.bspTree.traverseTree(cameraPosition);
    const bspEndTime = performance.now();
    const bspTraversalTime = bspEndTime - bspStartTime;

    // Calculate geometry statistics
    const totalSectors = 1; // Single sector for now
    const totalLines = 4; // Square sector has 4 lines
    const renderedSectors = traversalResult.visibleSectors.length;
    const uniqueVisibleLines = Array.from(
      new Set(traversalResult.visibleLines.map((line) => line.id))
    );
    const renderedLines = uniqueVisibleLines.length;

    const culledSectors = totalSectors - renderedSectors;
    const culledLines = totalLines - renderedLines;

    const frameEndTime = performance.now();
    const frameTime = frameEndTime - frameStartTime;

    const metrics: RenderMetrics = {
      frameTime,
      culledSectors: Math.max(0, culledSectors),
      renderedSectors,
      culledLines: Math.max(0, culledLines),
      renderedLines,
      bspTraversalTime,
      totalGeometry: totalSectors + totalLines,
    };

    this.lastMetrics = metrics;
    return metrics;
  }

  /**
   * Returns the last collected metrics
   */
  public getLastMetrics(): RenderMetrics | null {
    return this.lastMetrics;
  }

  /**
   * Logs current performance metrics to console
   */
  public logMetrics(): void {
    const metrics = this.collectFrameMetrics();
    if (!metrics) {
      console.log('[ENGINE] Metrics not available (disabled or no BSP tree)');
      return;
    }

    console.log('[ENGINE] Performance Metrics:');
    console.log(`  Frame time: ${metrics.frameTime.toFixed(3)}ms`);
    console.log(`  BSP traversal: ${metrics.bspTraversalTime.toFixed(3)}ms`);
    console.log(
      `  Rendered sectors: ${metrics.renderedSectors} / ${metrics.renderedSectors + metrics.culledSectors}`
    );
    console.log(
      `  Rendered lines: ${metrics.renderedLines} / ${metrics.renderedLines + metrics.culledLines}`
    );
    console.log(
      `  Culling efficiency: ${(((metrics.culledSectors + metrics.culledLines) / metrics.totalGeometry) * 100).toFixed(1)}%`
    );
  }

  public render(): void {
    if (this.currentScene) {
      this.currentScene.render();
    }
  }

  public getCurrentScene(): Scene {
    if (!this.currentScene) {
      throw new Error('No active scene. Call createDefaultScene() first.');
    }
    return this.currentScene;
  }

  public dispose(): void {
    if (this.currentScene) {
      this.currentScene.dispose();
      this.currentScene = null;
    }
    this.assetLoader.dispose();
  }
}
