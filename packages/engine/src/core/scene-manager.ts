import {
  Color3,
  type Engine,
  FreeCamera,
  HemisphericLight,
  Mesh,
  Scene,
  StandardMaterial,
  Vector2,
  Vector3,
  VertexData,
} from '@babylonjs/core';
import type { DoomLineDef, DoomSector, DoomVertex } from '../geometry/doom-geometry';
import { SectorGeometry } from '../geometry/sector-geometry';

export class SceneManager {
  private engine: Engine;
  private currentScene: Scene | null = null;

  constructor(engine: Engine) {
    this.engine = engine;
  }

  public createDefaultScene(): Scene {
    const scene = new Scene(this.engine);

    // Create camera
    const camera = new FreeCamera('camera', new Vector3(0, 5, -10), scene);
    camera.setTarget(new Vector3(0, 2, 0));
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
    floorMaterial.diffuseColor = new Color3(0.5, 0.5, 0.5);
    floorMesh.material = floorMaterial;

    // Create ceiling mesh
    const ceilingTriangulation = sectorGeometry.triangulateCeiling();
    const ceilingMesh = new Mesh(`${sector.id}_ceiling`, scene);
    const ceilingVertexData = new VertexData();
    ceilingVertexData.positions = ceilingTriangulation.vertices.flatMap((v) => [v.x, v.y, v.z]);
    ceilingVertexData.indices = ceilingTriangulation.indices;
    ceilingVertexData.uvs = ceilingTriangulation.uvs.flatMap((v) => [v.x, v.y]);
    ceilingVertexData.applyToMesh(ceilingMesh);

    const ceilingMaterial = new StandardMaterial(`${sector.id}_ceiling_mat`, scene);
    ceilingMaterial.diffuseColor = new Color3(0.2, 0.2, 0.8);
    ceilingMesh.material = ceilingMaterial;

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
        wallMaterial.diffuseColor = new Color3(0.8, 0.2, 0.2); // Red walls
        wallMesh.material = wallMaterial;
      }
    }

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
  }
}
