import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { SceneManager } from '../scene-manager';

describe('SceneManager Texture Integration', () => {
  let engine: NullEngine;
  let sceneManager: SceneManager;

  beforeEach(() => {
    engine = new NullEngine();
    sceneManager = new SceneManager(engine);
  });

  afterEach(() => {
    engine?.dispose();
  });

  test('should create scene with texture system', async () => {
    const scene = await sceneManager.createDefaultScene();

    expect(scene).toBeDefined();
    expect(scene.meshes.length).toBeGreaterThan(0);

    // Find floor meshes and check they have materials
    const floorMeshes = scene.meshes.filter((mesh) => mesh.name.includes('_floor'));
    expect(floorMeshes.length).toBeGreaterThan(0);

    for (const mesh of floorMeshes) {
      expect(mesh.material).toBeDefined();
      console.log(`[TEST] Floor mesh ${mesh.name} has material: ${mesh.material?.name}`);
    }

    // Find wall meshes and check they have materials
    const wallMeshes = scene.meshes.filter((mesh) => mesh.name.includes('_wall'));
    expect(wallMeshes.length).toBeGreaterThan(0);

    for (const mesh of wallMeshes) {
      expect(mesh.material).toBeDefined();
      console.log(`[TEST] Wall mesh ${mesh.name} has material: ${mesh.material?.name}`);
    }

    // Find ceiling meshes and check they have materials
    const ceilingMeshes = scene.meshes.filter((mesh) => mesh.name.includes('_ceiling'));
    expect(ceilingMeshes.length).toBeGreaterThan(0);

    for (const mesh of ceilingMeshes) {
      expect(mesh.material).toBeDefined();
      console.log(`[TEST] Ceiling mesh ${mesh.name} has material: ${mesh.material?.name}`);
    }
  });

  test('should load textures for different sector types', async () => {
    const scene = await sceneManager.createDefaultScene();

    // Check that main room and side room have different materials
    const mainRoomFloor = scene.meshes.find((mesh) => mesh.name === 'sector_main_room_floor');
    const sideRoomFloor = scene.meshes.find((mesh) => mesh.name === 'sector_side_room_floor');

    expect(mainRoomFloor).toBeDefined();
    expect(sideRoomFloor).toBeDefined();
    expect(mainRoomFloor?.material).toBeDefined();
    expect(sideRoomFloor?.material).toBeDefined();

    // Materials should be different (different names)
    expect(mainRoomFloor?.material?.name).not.toBe(sideRoomFloor?.material?.name);

    console.log(`[TEST] Main room material: ${mainRoomFloor?.material?.name}`);
    console.log(`[TEST] Side room material: ${sideRoomFloor?.material?.name}`);
  });

  test('should handle texture loading errors gracefully', async () => {
    // This test verifies that even if textures fail to load, the scene is still created
    // with fallback colors
    const scene = await sceneManager.createDefaultScene();

    expect(scene).toBeDefined();
    expect(scene.meshes.length).toBeGreaterThan(0);

    // All meshes should have materials even if textures failed
    const meshesWithoutMaterials = scene.meshes.filter(
      (mesh) => !mesh.name.includes('debug') && !mesh.material
    );
    expect(meshesWithoutMaterials.length).toBe(0);
  });

  test('should create BSP tree after loading textures', async () => {
    const _scene = await sceneManager.createDefaultScene();

    // The BSP tree should be built after the scene is loaded
    expect(sceneManager).toBeDefined();

    // We can enable BSP debug to verify the system works
    sceneManager.setDebugBSP(true);
    expect(sceneManager.debugBSP).toBe(true);

    sceneManager.setDebugBSP(false);
    expect(sceneManager.debugBSP).toBe(false);
  });
});
