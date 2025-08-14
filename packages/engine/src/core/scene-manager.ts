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
import type { DoomLineDef, DoomSector, DoomVertex } from '../geometry/doom-geometry';
import { SectorGeometry } from '../geometry/sector-geometry';

export class SceneManager {
  private engine: Engine;
  private currentScene: Scene | null = null;
  private assetLoader: AssetLoader;

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

        // Correction robuste : vérification de frontSide et textureMiddle
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
