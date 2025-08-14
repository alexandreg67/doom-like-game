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
import type { DoomSector, DoomVertex } from '../geometry/doom-geometry';
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
