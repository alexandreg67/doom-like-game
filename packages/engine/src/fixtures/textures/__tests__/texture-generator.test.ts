import { describe, expect, test } from 'vitest';
import { TEXTURE_DATA_URLS } from '../texture-generator';

describe('TextureGenerator', () => {
  test('should have predefined texture data URLs', () => {
    expect(TEXTURE_DATA_URLS.default).toBeDefined();
    expect(TEXTURE_DATA_URLS.wood_floor).toBeDefined();
    expect(TEXTURE_DATA_URLS.stone_floor).toBeDefined();
    expect(TEXTURE_DATA_URLS.concrete_floor).toBeDefined();
    expect(TEXTURE_DATA_URLS.concrete_ceiling).toBeDefined();
    expect(TEXTURE_DATA_URLS.brick_wall).toBeDefined();
    expect(TEXTURE_DATA_URLS.stone_wall).toBeDefined();
    expect(TEXTURE_DATA_URLS.wood_door).toBeDefined();

    // All should be data URLs
    for (const url of Object.values(TEXTURE_DATA_URLS)) {
      expect(url).toMatch(/^data:image\/jpeg;base64,/);
    }
  });

  test('should provide fallback textures in test environment', () => {
    // In test environment, we should get the fallback data URL
    const expectedFallback =
      'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAALCAABAAEBAREA/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwA/wD';

    expect(TEXTURE_DATA_URLS.default).toBe(expectedFallback);
    expect(TEXTURE_DATA_URLS.wood_floor).toBe(expectedFallback);
    expect(TEXTURE_DATA_URLS.stone_floor).toBe(expectedFallback);
    expect(TEXTURE_DATA_URLS.concrete_floor).toBe(expectedFallback);
    expect(TEXTURE_DATA_URLS.concrete_ceiling).toBe(expectedFallback);
    expect(TEXTURE_DATA_URLS.brick_wall).toBe(expectedFallback);
    expect(TEXTURE_DATA_URLS.stone_wall).toBe(expectedFallback);
    expect(TEXTURE_DATA_URLS.wood_door).toBe(expectedFallback);
  });

  test('should have consistent texture names', () => {
    const expectedTextures = [
      'default',
      'wood_floor',
      'stone_floor',
      'concrete_floor',
      'concrete_ceiling',
      'brick_wall',
      'stone_wall',
      'wood_door',
    ];

    const actualTextures = Object.keys(TEXTURE_DATA_URLS);
    expect(actualTextures.sort()).toEqual(expectedTextures.sort());
  });
});
