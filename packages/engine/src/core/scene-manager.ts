import {
  Color3,
  type Engine,
  FreeCamera,
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
import { type LevelData, type ParsedLevel, parseLevel } from '../geometry/level-loader';
import { SectorGeometry } from '../geometry/sector-geometry';
import {
  FogManager,
  LightManager,
  LightingDebugUI,
  type LightingSystemConfig,
  SectorLightingManager,
} from '../lighting';
import {
  type CollisionGeometry,
  type MovementInput,
  PHYSICS_CONSTANTS,
  PhysicsController,
} from '../physics';
import { Logger } from '../utils/logger';

// Enemy system imports for Phase 3 integration
// TODO: Re-enable once @doom-like/enemies package is properly built
// import type { Entity } from '@doom-like/game-logic';
// import { EnemyRenderSystem, type EnemyRenderSystemConfig, type EnemyRenderMetrics } from '@doom-like/enemies';

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
  lightingTime?: number;
  activeLights?: number;

  // Enemy rendering metrics (Phase 3)
  enemyMetrics?: {
    totalEnemies: number;
    renderedEnemies: number;
    culledEnemies: number;
    animatedEnemies: number;
    enemyRenderTime: number;
  };
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
  private lightManager: LightManager | null = null;
  private sectorLightingManager: SectorLightingManager | null = null;
  private fogManager: FogManager | null = null;
  private lightingDebugUI: LightingDebugUI | null = null;

  // Enemy rendering system (Phase 3)
  // TODO: Re-enable once @doom-like/enemies package is properly built
  // private enemyRenderSystem: EnemyRenderSystem | null = null;
  // private enemyEntities: Entity[] = []; // Temporary storage for enemy entities

  /**
   * Physics configuration for the game
   */
  private static readonly PHYSICS_CONFIG = {
    gravity: -9.81,
    jumpForce: 4.5,
    walkSpeed: 5.0,
    sprintSpeed: 8.0,
    friction: 0.995, // Very high friction for immediate stop
    airControl: 0.3,
    maxVelocity: 15.0, // Increased max velocity
  } as const;

  // Physics system
  private physicsController: PhysicsController | null = null;
  private camera: FreeCamera | null = null;
  private currentInput: MovementInput = {
    forward: 0,
    strafe: 0,
    jump: false,
    sprint: false,
  };

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
    this.camera = new FreeCamera('camera', new Vector3(0, 1.7, 0), scene);
    this.camera.setTarget(new Vector3(6.5, 1.7, 0)); // Look towards the door

    // Configure camera for FPS-like movement
    this.camera.minZ = 0.1;
    this.camera.maxZ = 1000;
    this.camera.fov = Math.PI / 3; // 60 degrees FOV
    this.camera.angularSensibility = 2000;

    // Disable default movement - we'll use PhysicsController instead
    this.camera.keysUp = [];
    this.camera.keysDown = [];
    this.camera.keysLeft = [];
    this.camera.keysRight = [];
    this.camera.speed = 0;

    // Attach camera controls to canvas for mouse look only
    const canvas = this.engine.getRenderingCanvas();
    if (canvas) {
      this.camera.attachControl(canvas, true);
      this.camera.setTarget(new Vector3(6.5, 1.7, 0));
    }

    console.log(
      '[ENGINE] Camera positioned at:',
      this.camera.position,
      'looking at:',
      this.camera.getTarget()
    );

    // Initialize new lighting system
    this.initializeLightingSystem(scene);

    // Initialize enemy rendering system (Phase 3)
    // TODO: Re-enable once @doom-like/enemies package is properly built
    // this.initializeEnemyRenderingSystem(scene);

    // Load the demo level
    await this.loadDemoLevel(scene);

    // Load lighting configuration from level if available
    if (this.currentLevel?.lighting) {
      this.loadLightingFromLevel(this.currentLevel.lighting);
    }

    this.currentScene = scene;

    // Set up input handling after scene is assigned
    this.setupPhysicsInput();

    // Start physics update loop
    this.startPhysicsLoop();

    // Update lighting system with camera position
    if (this.sectorLightingManager && this.currentLevel && this.camera) {
      const currentSector = this.getCurrentSector(this.camera.position);
      if (currentSector) {
        this.sectorLightingManager.updatePlayerPosition(this.camera.position, currentSector);
      }
    }

    return scene;
  }

  /**
   * Loads the Phase 1 demo level with multiple sectors
   */
  private async loadDemoLevel(scene: Scene): Promise<void> {
    console.log('[ENGINE] Loading Phase 1 demo level...');

    try {
      // Parse the demo level and validate the data format of the imported JSON
      if (!this.isValidLevelData(demoLevelData)) {
        throw new Error('Invalid demo level data format');
      }
      const parsedLevel = parseLevel(demoLevelData);

      // Load the parsed level data
      await this.loadLevelData(parsedLevel, scene);

      console.log('[ENGINE] Demo level loaded successfully');
    } catch (error) {
      console.error('[ENGINE] Failed to load demo level:', error);
      // Fallback to simple scene
      this.createFallbackScene(scene);
    }
  }

  /**
   * Loads level data and sets up all systems (reusable for any level)
   */
  private async loadLevelData(levelData: ParsedLevel, scene: Scene): Promise<void> {
    console.log(
      `[ENGINE] Loading level data with ${levelData.sectors.size} sectors, ${levelData.lineDefs.length} lineDefs...`
    );

    // Set current level
    this.currentLevel = levelData;

    // Find the door lineDef for interaction (if any)
    this.doorLineDef = this.currentLevel.lineDefs.find((line) => line.id === 'l3_door') || null;

    // Create meshes for all sectors
    const sectorsArray = Array.from(this.currentLevel.sectors.values());
    await this.createSectorMeshes(sectorsArray, scene);

    // Build BSP tree for culling
    this.bspTree = new BSPTree(sectorsArray);

    // Initialize physics system with collision geometry
    this.initializePhysicsSystem();

    console.log(
      `[ENGINE] Level data loaded successfully - Sectors: ${this.currentLevel.sectors.size}, LineDefs: ${this.currentLevel.lineDefs.length}`
    );
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
    const startVertex = vertices[0];
    const endVertex = vertices[1];
    if (!startVertex || !endVertex) {
      throw new Error('Invalid fallback vertices: missing start or end vertex');
    }

    const lineDefs: DoomLineDef[] = [
      {
        id: 'l1',
        startVertex,
        endVertex,
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
  /**
   * Toggles the door open/closed state
   */
  private toggleDoor(): void {
    if (!this.doorLineDef || !this.currentScene) {
      Logger.warn('[DOOR] Cannot toggle door: missing doorLineDef or scene');
      return;
    }

    this.doorOpen = !this.doorOpen;
    Logger.info(`[DOOR] Toggling door to ${this.doorOpen ? 'OPEN' : 'CLOSED'}`);

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

        if (textureHandle.texture) {
          material.diffuseTexture = textureHandle.texture;
          console.log(`[ENGINE] Applied texture ${textureName} to material ${name}`);
        } else {
          material.diffuseColor = fallbackColor;
          console.warn(
            `[ENGINE] Texture loaded but invalid for ${textureName}, using fallback color.`
          );
        }
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

        // Compute normals for proper lighting and impacts
        wallVertexData.normals = [];
        VertexData.ComputeNormals(
          wallVertexData.positions,
          wallVertexData.indices,
          wallVertexData.normals
        );

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

    // Collect enemy metrics if available
    // TODO: Re-enable once @doom-like/enemies package is properly built
    /*
    let enemyMetrics = undefined;
    if (this.enemyRenderSystem) {
      const enemyStats = this.enemyRenderSystem.getMetrics();
      enemyMetrics = {
        totalEnemies: enemyStats.totalEnemies,
        renderedEnemies: enemyStats.renderedEnemies,
        culledEnemies: enemyStats.culledEnemies,
        animatedEnemies: enemyStats.animatedEnemies,
        enemyRenderTime: enemyStats.frameTime,
      };
    }
    */

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
      // TODO: Re-enable once @doom-like/enemies package is properly built
      // ...(enemyMetrics && { enemyMetrics }),
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

    // Log enemy metrics if available
    // TODO: Re-enable once @doom-like/enemies package is properly built
    /*
    if (metrics.enemyMetrics) {
      console.log('  Enemy Rendering:');
      console.log(
        `    Enemies: ${metrics.enemyMetrics.renderedEnemies} / ${metrics.enemyMetrics.totalEnemies} rendered`
      );
      console.log(`    Culled enemies: ${metrics.enemyMetrics.culledEnemies}`);
      console.log(`    Animated enemies: ${metrics.enemyMetrics.animatedEnemies}`);
      console.log(`    Enemy render time: ${metrics.enemyMetrics.enemyRenderTime.toFixed(3)}ms`);
    }
    */
  }

  public render(): void {
    if (this.currentScene) {
      this.currentScene.render();
    }
  }

  /**
   * Updates all systems before rendering (Phase 3 addition)
   */
  public updateSystems(deltaTime: number): void {
    if (!this.currentScene || !this.camera) return;

    // Update enemy rendering system
    // TODO: Re-enable once @doom-like/enemies package is properly built
    // if (this.enemyRenderSystem && this.enemyEntities.length > 0) {
    //   this.enemyRenderSystem.update(this.enemyEntities, deltaTime);
    // }

    // Update lighting system
    this.updateLighting(deltaTime, this.camera.position);
  }

  /**
   * Enemy entity management methods (Phase 3)
   * TODO: Re-enable once @doom-like/enemies package is properly built
   */
  /*
  public setEnemyEntities(entities: Entity[]): void {
    this.enemyEntities = entities;
    Logger.debug(`[ENGINE] Updated enemy entities count: ${entities.length}`);
  }

  public addEnemyEntity(entity: Entity): void {
    if (!this.enemyEntities.find(e => e.id === entity.id)) {
      this.enemyEntities.push(entity);
      Logger.debug(`[ENGINE] Added enemy entity: ${entity.id}`);
    }
  }

  public removeEnemyEntity(entityId: string): void {
    const initialCount = this.enemyEntities.length;
    this.enemyEntities = this.enemyEntities.filter(e => e.id !== entityId);
    
    if (this.enemyEntities.length < initialCount) {
      Logger.debug(`[ENGINE] Removed enemy entity: ${entityId}`);
    }
  }
  */

  /**
   * Gets enemy rendering system metrics (Phase 3)
   * TODO: Re-enable once @doom-like/enemies package is properly built
   */
  /*
  public getEnemyRenderingMetrics(): EnemyRenderMetrics | null {
    return this.enemyRenderSystem?.getMetrics() || null;
  }

  public configureEnemyRendering(config: Partial<EnemyRenderSystemConfig>): void {
    if (this.enemyRenderSystem) {
      this.enemyRenderSystem.updateConfig(config);
      Logger.info('[ENGINE] Enemy rendering configuration updated');
    }
  }
  */

  public getCurrentScene(): Scene {
    if (!this.currentScene) {
      throw new Error('No active scene. Call createDefaultScene() first.');
    }
    return this.currentScene;
  }

  /**
   * Initializes the advanced lighting system
   */
  private initializeLightingSystem(scene: Scene): void {
    Logger.info('[ENGINE] Initializing advanced lighting system...');

    // Initialize core lighting managers
    this.lightManager = new LightManager(scene);
    this.fogManager = new FogManager(scene);
    this.sectorLightingManager = new SectorLightingManager(
      scene,
      this.lightManager,
      this.fogManager
    );
    this.lightingDebugUI = new LightingDebugUI(this.lightManager);

    // Connect managers
    this.lightingDebugUI.setSectorLightingManager(this.sectorLightingManager);
    this.lightingDebugUI.setFogManager(this.fogManager);

    // Load default lighting configuration
    this.loadDefaultLights();

    Logger.info('[ENGINE] Advanced lighting system initialized');
  }

  /**
   * Initializes the enemy rendering system (Phase 3)
   * TODO: Re-enable once @doom-like/enemies package is properly built
   */
  /*
  private initializeEnemyRenderingSystem(scene: Scene): void {
    Logger.info('[ENGINE] Initializing enemy rendering system (Phase 3)...');

    if (!this.camera) {
      Logger.warn('[ENGINE] Cannot initialize enemy rendering: no camera available');
      return;
    }

    try {
      // Create enemy render system with default configuration
      const renderConfig: Partial<EnemyRenderSystemConfig> = {
        maxRenderedEnemies: 20,
        enableLOD: true,
        enableAnimations: true,
        enableDebug: false,
        optimizationLevel: 'medium',
      };

      this.enemyRenderSystem = new EnemyRenderSystem(scene, this.camera, renderConfig);
      
      Logger.info('[ENGINE] Enemy rendering system initialized successfully');
    } catch (error) {
      Logger.error('[ENGINE] Failed to initialize enemy rendering system:', error);
      this.enemyRenderSystem = null;
    }
  }
  */

  /**
   * Loads default lighting configuration
   */
  private loadDefaultLights(): void {
    if (!this.lightManager) return;

    // Create default ambient lighting
    this.lightManager.addLight({
      id: 'ambient_light',
      type: 'hemispheric',
      direction: new Vector3(0, 1, 0),
      color: new Color3(1, 1, 1),
      intensity: 0.3,
      enabled: true,
    });

    // Create main directional light (sun/moon)
    this.lightManager.addLight({
      id: 'main_directional',
      type: 'directional',
      direction: new Vector3(0.5, -1, 0.3),
      color: new Color3(1, 0.9, 0.8),
      intensity: 0.8,
      shadows: {
        enabled: true,
        mapSize: 1024,
        bias: 0.0001,
        darkness: 0.3,
        useBlurExponentialShadowMap: true,
        blurKernel: 16,
      },
      enabled: true,
    });

    // Create point lights for atmospheric effect
    this.lightManager.addLight({
      id: 'torch_1',
      type: 'point',
      position: new Vector3(-4, 2, -4),
      color: new Color3(1, 0.6, 0.2),
      intensity: 2.0,
      range: 8,
      enabled: true,
    });

    this.lightManager.addLight({
      id: 'torch_2',
      type: 'point',
      position: new Vector3(4, 2, 4),
      color: new Color3(0.2, 0.6, 1),
      intensity: 1.5,
      range: 6,
      enabled: true,
    });
  }

  /**
   * Gets the current sector based on camera position
   */
  private getCurrentSector(position: Vector3): DoomSector | null {
    if (!this.currentLevel) return null;

    // Simple sector detection - in a full implementation this would use proper point-in-polygon
    for (const sector of this.currentLevel.sectors.values()) {
      if (this.isPointInSector(position, sector)) {
        return sector;
      }
    }

    // Default to first sector if none found
    return Array.from(this.currentLevel.sectors.values())[0] || null;
  }

  /**
   * Simple point-in-sector check (placeholder implementation)
   */
  private isPointInSector(point: Vector3, sector: DoomSector): boolean {
    // For now, just check if within sector bounds (simplified)
    const bounds = sector.boundingBox;
    return (
      point.x >= bounds.min.x &&
      point.x <= bounds.max.x &&
      point.z >= bounds.min.y &&
      point.z <= bounds.max.y
    );
  }

  /**
   * Updates lighting system each frame
   */
  public updateLighting(deltaTime: number, cameraPosition: Vector3): void {
    if (!this.lightManager || !this.sectorLightingManager) return;

    const startTime = performance.now();

    // Update light culling based on camera position
    this.lightManager.updateCulling(cameraPosition);

    // Update sector lighting transitions
    this.sectorLightingManager.update(deltaTime);

    // Update fog transitions
    if (this.fogManager) {
      this.fogManager.updateFogTransition(deltaTime);
    }

    // Update metrics
    if (this.enableMetrics) {
      const lightingTime = performance.now() - startTime;
      const lightingMetrics = this.lightManager.getMetrics();

      if (this.lastMetrics) {
        this.lastMetrics.lightingTime = lightingTime;
        this.lastMetrics.activeLights = lightingMetrics.activeLights;
      }
    }
  }

  /**
   * Loads lighting configuration from level data
   */
  public loadLightingFromLevel(lightingConfig: LightingSystemConfig): void {
    if (!this.lightManager || !this.sectorLightingManager) return;

    Logger.info('[ENGINE] Loading lighting configuration from level data');

    // Clear existing lights (except defaults)
    const existingLights = this.lightManager.getAllLights();
    for (const [lightId] of existingLights) {
      if (!['ambient_light', 'main_directional'].includes(lightId)) {
        this.lightManager.removeLight(lightId);
      }
    }

    // Add lights from configuration
    for (const lightConfig of lightingConfig.lights) {
      this.lightManager.addLight(lightConfig);
    }

    // Setup sector lighting
    this.sectorLightingManager.setSectorConfigs(lightingConfig.sectorLighting);

    // Apply performance settings
    this.lightManager.setPerformanceConfig(lightingConfig.performance);

    Logger.info(
      `[ENGINE] Loaded ${lightingConfig.lights.length} lights and ${lightingConfig.sectorLighting.length} sector configurations`
    );
  }

  /**
   * Toggles the lighting debug UI
   */
  public toggleLightingDebugUI(): void {
    if (this.lightingDebugUI) {
      this.lightingDebugUI.toggle();
    }
  }

  /**
   * Gets lighting system metrics
   */
  public getLightingMetrics() {
    return this.lightManager?.getMetrics() || null;
  }

  /**
   * Validates that imported JSON data conforms to expected LevelData structure
   */
  private isValidLevelData(data: unknown): data is LevelData {
    if (!data || typeof data !== 'object') {
      return false;
    }

    const levelData = data as Partial<LevelData>;

    // Check required properties
    if (!Array.isArray(levelData.sectors) || !Array.isArray(levelData.lineDefs)) {
      return false;
    }

    // Basic validation of sector structure
    if (levelData.sectors.length > 0) {
      const firstSector = levelData.sectors[0];
      if (
        !firstSector ||
        typeof firstSector.id !== 'string' ||
        typeof firstSector.floorHeight !== 'number' ||
        typeof firstSector.ceilingHeight !== 'number' ||
        typeof firstSector.lightLevel !== 'number' ||
        !Array.isArray(firstSector.vertices)
      ) {
        return false;
      }
    }

    // Basic validation of lineDef structure
    if (levelData.lineDefs.length > 0) {
      const firstLineDef = levelData.lineDefs[0];
      if (
        !firstLineDef ||
        typeof firstLineDef.id !== 'string' ||
        !firstLineDef.startVertex ||
        !firstLineDef.endVertex ||
        !firstLineDef.flags
      ) {
        return false;
      }
    }

    return true;
  }

  /**
   * Initialize physics system with collision geometry from current level
   */
  private initializePhysicsSystem(): void {
    if (!this.currentLevel || !this.camera) {
      Logger.warn('[PHYSICS] Cannot initialize physics system: missing level or camera');
      return;
    }

    try {
      // Create collision geometry from level data
      const collisionGeometry: CollisionGeometry = {
        lineDefs: this.currentLevel.lineDefs,
        sectors: Array.from(this.currentLevel.sectors.values()),
      };

      // Initialize physics controller at correct height above floor
      const startPosition = this.camera.position.clone();
      // Get the player start sector to determine correct floor height
      const playerStartSector = this.currentLevel.playerStart.sector;
      const floorHeight = playerStartSector.floorHeight;
      startPosition.y = floorHeight + PHYSICS_CONSTANTS.CAMERA_EYE_HEIGHT; // Player height above floor
      Logger.info(`[PHYSICS] Starting position: floor=${floorHeight}, player Y=${startPosition.y}`);

      this.physicsController = new PhysicsController(startPosition, SceneManager.PHYSICS_CONFIG);

      Logger.info('[PHYSICS] PhysicsController created at position:', this.camera.position);

      // Set collision geometry
      this.physicsController.setGeometry(collisionGeometry);

      Logger.info(
        '[PHYSICS] Collision geometry set with',
        collisionGeometry.lineDefs.length,
        'lines and',
        collisionGeometry.sectors.length,
        'sectors'
      );

      Logger.info('[PHYSICS] Physics system initialized successfully');
    } catch (error) {
      Logger.error('[PHYSICS] Failed to initialize physics system:', error);
    }
  }

  /**
   * Set up keyboard input handling for physics system
   */
  private setupPhysicsInput(): void {
    Logger.info('[INPUT] Setting up physics input system...');
    if (!this.currentScene || !this.camera) {
      Logger.warn('[INPUT] Cannot setup input: missing scene or camera');
      return;
    }

    // Track key states
    const keys: Record<string, boolean> = {};

    // Use window events for better compatibility
    window.addEventListener('keydown', (event) => {
      Logger.debug(`[INPUT] Key pressed: ${event.code}`);
      keys[event.code] = true;
      this.updateMovementInput(keys);

      // Handle door interaction
      if (event.code === 'KeyE') {
        Logger.debug(`[INPUT] E key pressed, doorLineDef exists: ${!!this.doorLineDef}`);
        if (this.doorLineDef) {
          this.toggleDoor();
        }
      }
    });

    window.addEventListener('keyup', (event) => {
      Logger.debug(`[INPUT] Key released: ${event.code}`);
      keys[event.code] = false;
      this.updateMovementInput(keys);
    });

    Logger.info('[INPUT] Physics input system initialized');
  }

  /**
   * Update movement input based on current key states
   */
  private updateMovementInput(keys: Record<string, boolean>): void {
    const newInput = {
      // Support both QWERTY and AZERTY layouts
      forward: (keys.KeyW || keys.KeyZ ? 1 : 0) + (keys.KeyS ? -1 : 0),
      strafe: (keys.KeyD ? 1 : 0) + (keys.KeyA || keys.KeyQ ? -1 : 0),
      jump: keys.Space || false,
      sprint: keys.ShiftLeft || keys.ShiftRight || false,
    };

    // Only log if there's actual input change
    if (
      newInput.forward !== this.currentInput.forward ||
      newInput.strafe !== this.currentInput.strafe ||
      newInput.jump !== this.currentInput.jump ||
      newInput.sprint !== this.currentInput.sprint
    ) {
      Logger.info('[INPUT] Movement input changed:', newInput);
    }

    this.currentInput = newInput;
  }

  /**
   * Start the physics update loop
   */
  private startPhysicsLoop(): void {
    if (!this.currentScene) return;

    let lastTime = performance.now();

    this.currentScene.registerBeforeRender(() => {
      if (!this.physicsController || !this.camera) return;

      const currentTime = performance.now();
      const deltaTime = (currentTime - lastTime) / 1000; // Convert to seconds
      lastTime = currentTime;

      // Update physics
      const cameraDirection = this.camera.getTarget().subtract(this.camera.position).normalize();
      this.physicsController.update(this.currentInput, deltaTime, cameraDirection);

      // Update camera position to match physics controller
      const newPosition = this.physicsController.getPosition();
      // Add camera height offset (eyes are above feet)
      const cameraHeight = PHYSICS_CONSTANTS.CAMERA_EYE_HEIGHT; // Camera at eye level
      this.camera.position.x = newPosition.x;
      this.camera.position.y = newPosition.y + cameraHeight;
      this.camera.position.z = newPosition.z;

      // Update sector lighting if available
      if (this.sectorLightingManager) {
        const currentSector = this.physicsController.getCurrentSector();
        if (currentSector) {
          this.sectorLightingManager.updatePlayerPosition(newPosition, currentSector);
        }
      }
    });
  }

  /**
   * Public method to load a new level dynamically
   */
  public async loadLevel(levelData: ParsedLevel): Promise<void> {
    if (!this.currentScene) {
      throw new Error('Cannot load level: no active scene. Call createDefaultScene() first.');
    }

    console.log('[ENGINE] Starting dynamic level loading...');

    try {
      // Clean up current level
      this.cleanupCurrentLevel();

      // Load new level data
      await this.loadLevelData(levelData, this.currentScene);

      // Reposition camera to player start
      if (this.camera && levelData.playerStart) {
        const spawnPos = levelData.playerStart.position;
        const spawnSector = levelData.playerStart.sector;

        // Set camera position to spawn point + eye height
        this.camera.position.x = spawnPos.x;
        this.camera.position.y = spawnSector.floorHeight + PHYSICS_CONSTANTS.CAMERA_EYE_HEIGHT;
        this.camera.position.z = spawnPos.y; // JSON uses x,y but we map to x,z

        // Set camera direction based on spawn angle
        const spawnAngle = levelData.playerStart.angle;
        const targetOffset = new Vector3(Math.cos(spawnAngle), 0, Math.sin(spawnAngle));
        this.camera.setTarget(this.camera.position.add(targetOffset));

        console.log(
          `[ENGINE] Camera repositioned to spawn: (${this.camera.position.x.toFixed(1)}, ${this.camera.position.y.toFixed(1)}, ${this.camera.position.z.toFixed(1)})`
        );

        // Synchronize physics controller position with camera position
        if (this.physicsController) {
          this.physicsController.setPosition(this.camera.position.clone());
          console.log(
            `[ENGINE] PhysicsController synchronized to: (${this.camera.position.x.toFixed(1)}, ${this.camera.position.y.toFixed(1)}, ${this.camera.position.z.toFixed(1)})`
          );
        }
      }

      // Update lighting system with new level
      if (this.currentLevel?.lighting) {
        this.loadLightingFromLevel(this.currentLevel.lighting);
      }

      console.log('[ENGINE] Dynamic level loading completed successfully');
    } catch (error) {
      console.error('[ENGINE] Failed to load level dynamically:', error);
      throw error;
    }
  }

  /**
   * Cleans up the current level to prepare for loading a new one
   */
  private cleanupCurrentLevel(): void {
    if (!this.currentScene) return;

    console.log('[ENGINE] Cleaning up current level...');

    // Dispose existing meshes (except camera and lights)
    const meshesToDispose = this.currentScene.meshes.filter(
      (mesh) => !mesh.metadata?.isCamera && !mesh.metadata?.isLight
    );

    for (const mesh of meshesToDispose) {
      // Dispose material if it exists
      if (mesh.material) {
        mesh.material.dispose();
      }
      mesh.dispose();
    }

    // Clear BSP tree
    this.bspTree = null;

    // Reset door state
    this.doorLineDef = null;
    this.doorOpen = false;

    // Reset physics controller
    if (this.physicsController) {
      this.physicsController.dispose();
      this.physicsController = null;
    }

    // Clear current level reference
    this.currentLevel = null;

    console.log(`[ENGINE] Cleanup completed - disposed ${meshesToDispose.length} meshes`);
  }

  public dispose(): void {
    // Dispose physics system
    this.physicsController?.dispose();
    this.physicsController = null;

    // Dispose enemy rendering system (Phase 3)
    // TODO: Re-enable once @doom-like/enemies package is properly built
    // this.enemyRenderSystem?.dispose();
    // this.enemyRenderSystem = null;
    // this.enemyEntities = [];

    // Dispose lighting system
    this.lightingDebugUI?.hide();
    this.lightManager?.dispose();
    this.sectorLightingManager = null;
    this.fogManager = null;
    this.lightingDebugUI = null;

    if (this.currentScene) {
      this.currentScene.dispose();
      this.currentScene = null;
    }
    this.assetLoader.dispose();
  }
}
