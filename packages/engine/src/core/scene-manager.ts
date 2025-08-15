import {
  ActionManager,
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
import { TextureManager } from '../assets/texture-manager';
import demoLevelData from '../fixtures/demo_level_simple.json';
import { BSPTree } from '../geometry/bsp-tree';
import type { BSPNode, DoomLineDef, DoomSector, DoomVertex } from '../geometry/doom-geometry';
import { type ParsedLevel, parseLevel } from '../geometry/level-loader';
import { SectorGeometry } from '../geometry/sector-geometry';

export interface RenderMetrics {
  frameTime: number;
  culledSectors: number;
  renderedSectors: number;
  culledLines: number;
  renderedLines: number;
  bspTraversalTime: number;
  totalGeometry: number;
  totalSectors: number;
  totalLines: number;
}

export class SceneManager {
  private engine: Engine;
  private currentScene: Scene | null = null;
  private assetLoader: AssetLoader;
  private textureManager: TextureManager | null = null;
  private bspTree: BSPTree | null = null;
  private _debugBSP = false; // Toggle for BSP debug visualization
  private enableMetrics = false; // Toggle for performance metrics
  private lastMetrics: RenderMetrics | null = null;
  private currentLevel: ParsedLevel | null = null;
  private doorLineDef: DoomLineDef | null = null; // Reference to the door for interaction
  private doorOpen = false; // Door state

  constructor(engine: Engine) {
    this.engine = engine;
    this.assetLoader = new AssetLoader(engine, {
      maxRetries: 3,
      retryDelay: 1000,
      cacheMaxAge: 5 * 60 * 1000, // 5 minutes
    });
  }

  public async createDefaultScene(): Promise<Scene> {
    console.log('[ENGINE] Creating Phase 1 demo scene...');
    const scene = new Scene(this.engine);

    // Initialize texture manager for this scene
    this.textureManager = new TextureManager(scene, {
      maxEntries: 200,
      ttlMs: 5 * 60 * 1000, // 5 minutes
    });

    // Create camera - positioned inside main room looking towards door
    const camera = new FreeCamera('camera', new Vector3(0, 1.7, 0), scene);
    camera.setTarget(new Vector3(6.5, 1.7, 0)); // Look towards the door

    // Configure camera for FPS-like movement
    camera.minZ = 0.1;
    camera.maxZ = 1000;
    camera.fov = Math.PI / 3; // 60 degrees FOV
    camera.angularSensibility = 2000;
    camera.keysUp = [87]; // W
    camera.keysDown = [83]; // S
    camera.keysLeft = [65]; // A
    camera.keysRight = [68]; // D
    camera.speed = 0.5; // Movement speed

    // Attach camera controls to canvas
    const canvas = this.engine.getRenderingCanvas();
    if (canvas) {
      camera.attachControl(canvas, true);
      camera.setTarget(new Vector3(6.5, 1.7, 0));
    }

    console.log(
      '[ENGINE] Camera positioned at:',
      camera.position,
      'looking at:',
      camera.getTarget()
    );

    // Create lighting
    const light = new HemisphericLight('light', new Vector3(0, 1, 0), scene);
    light.intensity = 1.2; // Increase intensity
    light.diffuse = new Color3(1, 1, 1);
    light.groundColor = new Color3(0.5, 0.5, 0.5);

    // Add a directional light for better visibility
    const directionalLight = new HemisphericLight('dirLight', new Vector3(1, 1, 1), scene);
    directionalLight.intensity = 0.8;
    directionalLight.diffuse = new Color3(1, 1, 0.9);

    // Load the demo level
    await this.loadDemoLevel(scene);

    // Setup keyboard interaction for door
    this.setupKeyboardInteraction(scene);

    this.currentScene = scene;
    return scene;
  }

  /**
   * Loads the Phase 1 demo level with multiple sectors
   */
  private async loadDemoLevel(scene: Scene): Promise<void> {
    console.log('[ENGINE] Loading Phase 1 demo level...');

    try {
      // Parse the demo level
      this.currentLevel = parseLevel(demoLevelData);

      // Find the door lineDef for interaction
      this.doorLineDef = this.currentLevel.lineDefs.find((line) => line.id === 'l3_door') || null;

      // Create meshes for all sectors
      const sectorsArray = Array.from(this.currentLevel.sectors.values());
      await this.createSectorMeshes(sectorsArray, scene);

      // Build BSP tree for culling
      this.bspTree = new BSPTree(sectorsArray);

      console.log('[ENGINE] Demo level loaded successfully');
      console.log(
        `[ENGINE] Sectors: ${this.currentLevel.sectors.size}, LineDefs: ${this.currentLevel.lineDefs.length}`
      );
    } catch (error) {
      console.error('[ENGINE] Failed to load demo level:', error);
      // Fallback to simple scene
      this.createFallbackScene(scene);
    }
  }

  /**
   * Creates a simple fallback scene if demo level loading fails
   */
  private createFallbackScene(scene: Scene): void {
    console.log('[ENGINE] Creating fallback scene...');

    // Define a simple square sector as fallback
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

    // Create simplified LineDefs for fallback
    const lineDefs: DoomLineDef[] = [
      {
        id: 'l1',
        startVertex: vertices[0]!,
        endVertex: vertices[1]!,
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
      // Add other walls...
    ];

    // Assign linedefs to sector
    sector.lineDefs = lineDefs;

    // Create mesh for the sector
    this.createSectorMesh(sector, scene);

    // Build BSP tree for culling
    this.bspTree = new BSPTree([sector]);
  }

  /**
   * Sets up keyboard interaction for door opening/closing
   */
  private setupKeyboardInteraction(scene: Scene): void {
    scene.actionManager = scene.actionManager || new ActionManager(scene);

    // Listen for E key press
    window.addEventListener('keydown', (event) => {
      if (event.code === 'KeyE' && this.doorLineDef) {
        this.toggleDoor();
      }
    });
  }

  /**
   * Toggles the door open/closed state
   */
  private toggleDoor(): void {
    if (!this.doorLineDef || !this.currentScene) {
      return;
    }

    this.doorOpen = !this.doorOpen;

    // Toggle blocking flag
    this.doorLineDef.flags.blocking = !this.doorOpen;

    // Find and toggle door mesh visibility
    const doorMeshes = this.currentScene.meshes.filter((mesh) => mesh.metadata?.isDoor);
    for (const mesh of doorMeshes) {
      mesh.setEnabled(!this.doorOpen);
    }

    console.log(`[ENGINE] Door ${this.doorOpen ? 'opened' : 'closed'}`);
  }

  /**
   * Creates meshes for multiple sectors
   */
  private async createSectorMeshes(sectors: DoomSector[], scene: Scene): Promise<void> {
    for (const sector of sectors) {
      await this.createSectorMesh(sector, scene);
    }
  }

  /**
   * Creates a material with texture support, falling back to solid color if texture is not available
   */
  private async createMaterialWithTexture(
    name: string,
    textureName: string,
    fallbackColor: Color3,
    scene: Scene
  ): Promise<StandardMaterial> {
    const material = new StandardMaterial(name, scene);

    if (this.textureManager) {
      try {
        // Try to load the texture
        const textureHandle = await this.textureManager.load(`/textures/${textureName}.jpg`, {
          wrapU: 'repeat',
          wrapV: 'repeat',
          sampling: 'linear',
          fallback: '/textures/default.jpg',
        });

        material.diffuseTexture = textureHandle.texture;
        console.log(`[ENGINE] Applied texture ${textureName} to material ${name}`);
      } catch (error) {
        console.warn(
          `[ENGINE] Failed to load texture ${textureName}, using fallback color:`,
          error
        );
        material.diffuseColor = fallbackColor;
      }
    } else {
      // No texture manager, use solid color
      material.diffuseColor = fallbackColor;
    }

    // Common material settings
    material.alpha = 1.0;
    material.backFaceCulling = false;
    material.ambientColor = material.diffuseColor?.scale(0.3) || fallbackColor.scale(0.3);

    return material;
  }

  /**
   * Creates a mesh for a sector (floor, ceiling, and walls)
   */
  private async createSectorMesh(sector: DoomSector, scene: Scene): Promise<void> {
    const sectorGeom = new SectorGeometry(sector);

    // Create floor mesh
    const floorGeometry = sectorGeom.triangulateFloor();
    const floorMesh = new Mesh(`${sector.meshId}_floor`, scene);
    const floorVertexData = new VertexData();
    floorVertexData.positions = floorGeometry.vertices.flatMap((v) => [v.x, v.y, v.z]);
    floorVertexData.indices = floorGeometry.indices;
    floorVertexData.uvs = floorGeometry.uvs.flatMap((uv) => [uv.x, uv.y]);

    // Compute normals for proper lighting
    floorVertexData.normals = [];
    VertexData.ComputeNormals(
      floorVertexData.positions,
      floorVertexData.indices,
      floorVertexData.normals
    );
    floorVertexData.applyToMesh(floorMesh);

    console.log(
      `[ENGINE] Floor mesh for ${sector.id}: ${floorGeometry.vertices.length} vertices, ${floorGeometry.indices.length} indices`
    );

    // Create ceiling mesh
    const ceilingGeometry = sectorGeom.triangulateCeiling();
    const ceilingMesh = new Mesh(`${sector.meshId}_ceiling`, scene);
    const ceilingVertexData = new VertexData();
    ceilingVertexData.positions = ceilingGeometry.vertices.flatMap((v) => [v.x, v.y, v.z]);
    ceilingVertexData.indices = ceilingGeometry.indices;
    ceilingVertexData.uvs = ceilingGeometry.uvs.flatMap((uv) => [uv.x, uv.y]);

    // Compute normals for proper lighting
    ceilingVertexData.normals = [];
    VertexData.ComputeNormals(
      ceilingVertexData.positions,
      ceilingVertexData.indices,
      ceilingVertexData.normals
    );
    ceilingVertexData.applyToMesh(ceilingMesh);

    console.log(
      `[ENGINE] Ceiling mesh for ${sector.id}: ${ceilingGeometry.vertices.length} vertices, ${ceilingGeometry.indices.length} indices`
    );

    // Create materials with texture support and fallback colors
    const floorTextureName =
      sector.floorTexture ||
      (sector.id === 'main_room'
        ? 'wood_floor'
        : sector.id === 'side_room'
          ? 'stone_floor'
          : 'concrete_floor');
    const floorFallbackColor =
      sector.id === 'main_room'
        ? new Color3(0.6, 0.4, 0.2)
        : sector.id === 'side_room'
          ? new Color3(0.3, 0.5, 0.7)
          : new Color3(0.6, 0.4, 0.2);

    const ceilingTextureName = sector.ceilingTexture || 'concrete_ceiling';
    const ceilingFallbackColor = new Color3(0.8, 0.8, 0.9);

    const wallTextureName = sector.id === 'side_room' ? 'brick_wall' : 'stone_wall';
    const wallFallbackColor =
      sector.id === 'side_room' ? new Color3(0.8, 0.6, 0.4) : new Color3(0.7, 0.7, 0.7);

    // Create materials using our texture system
    const floorMaterial = await this.createMaterialWithTexture(
      `${sector.meshId}_floor_mat`,
      floorTextureName,
      floorFallbackColor,
      scene
    );

    const ceilingMaterial = await this.createMaterialWithTexture(
      `${sector.meshId}_ceiling_mat`,
      ceilingTextureName,
      ceilingFallbackColor,
      scene
    );

    const wallMaterial = await this.createMaterialWithTexture(
      `${sector.meshId}_wall_mat`,
      wallTextureName,
      wallFallbackColor,
      scene
    );

    floorMesh.material = floorMaterial;
    ceilingMesh.material = ceilingMaterial;

    console.log(
      `[ENGINE] Applied materials to ${sector.id}: floor=${floorTextureName}, ceiling=${ceilingTextureName}, wall=${wallTextureName}`
    );

    // Optimize static geometry (floors and ceilings are typically static in Phase 1)
    // Note: Don't freeze matrices for walls that might be animated (doors, moving platforms)
    floorMesh.freezeWorldMatrix();
    ceilingMesh.freezeWorldMatrix();

    // Create wall meshes for each LineDef
    for (const lineDef of sector.lineDefs) {
      const wallGeometry = sectorGeom.generateWallGeometry(lineDef);
      if (wallGeometry && wallGeometry.vertices.length > 0) {
        const wallMesh = new Mesh(`${sector.meshId}_wall_${lineDef.id}`, scene);
        const wallVertexData = new VertexData();
        wallVertexData.positions = wallGeometry.vertices.flatMap((v) => [v.x, v.y, v.z]);
        wallVertexData.indices = wallGeometry.indices;
        wallVertexData.uvs = wallGeometry.uvs.flatMap((uv) => [uv.x, uv.y]);
        wallVertexData.applyToMesh(wallMesh);

        // Use different material for door
        if (lineDef.id === 'l3_door') {
          const doorMaterial = await this.createMaterialWithTexture(
            'door_material',
            'wood_door',
            new Color3(0.6, 0.3, 0.1), // Wood color fallback
            scene
          );
          wallMesh.material = doorMaterial;
          // Tag for easy identification
          wallMesh.metadata = { isDoor: true, lineDefId: lineDef.id };
        } else {
          wallMesh.material = wallMaterial;
        }
      }
    }
  }

  /**
   * Enables or disables BSP debug visualization
   */
  public setDebugBSP(enabled: boolean): void {
    this._debugBSP = enabled;
    if (enabled) {
      this.createBSPDebugWireframe();
    } else {
      this.removeBSPDebugWireframe();
    }
    console.log(`[ENGINE] BSP debug visualization ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Gets current BSP debug state
   */
  public get debugBSP(): boolean {
    return this._debugBSP;
  }

  /**
   * Creates wireframe visualization of BSP tree structure
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
  private createNodeWireframe(node: BSPNode, depth: number): void {
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
    const totalSectors = this.bspTree.getTotalSectors?.() ?? 0;
    const totalLines = this.bspTree.getTotalLines?.() ?? 0;
    return {
      visibleSectors: traversalResult.visibleSectors.length,
      visibleLines: traversalResult.visibleLines.length,
      totalSectors,
      totalLines,
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
    const totalSectors = this.bspTree.getTotalSectors?.() ?? 0;
    const totalLines = this.bspTree.getTotalLines?.() ?? 0;
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
      totalSectors,
      totalLines,
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
      `  Rendered sectors: ${metrics.renderedSectors} / ${
        metrics.renderedSectors + metrics.culledSectors
      }`
    );
    console.log(
      `  Rendered lines: ${metrics.renderedLines} / ${metrics.renderedLines + metrics.culledLines}`
    );
    // Report sector and line culling efficiency separately — more meaningful units
    if (metrics.totalSectors === 0) {
      console.log('  Sector culling efficiency: N/A (total sectors is zero)');
    } else {
      console.log(
        `  Sector culling efficiency: ${(
          (metrics.culledSectors / metrics.totalSectors) * 100
        ).toFixed(1)}%`
      );
    }

    if (metrics.totalLines === 0) {
      console.log('  Line culling efficiency: N/A (total lines is zero)');
    } else {
      console.log(
        `  Line culling efficiency: ${((metrics.culledLines / metrics.totalLines) * 100).toFixed(
          1
        )}%`
      );
    }
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
