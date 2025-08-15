import { describe, expect, it } from 'vitest';
import { packAtlas } from '../atlas-builder';

describe('packAtlas', () => {
  it('places non-overlapping rectangles and includes all items', () => {
    const images = [
      { id: 'a', width: 64, height: 64 },
      { id: 'b', width: 128, height: 32 },
      { id: 'c', width: 32, height: 128 },
      { id: 'd', width: 256, height: 16 },
      { id: 'e', width: 16, height: 16 },
    ];

    const atlas = packAtlas(images, 256);

    // must include all ids
    const ids = atlas.placements.map((p) => p.id).sort();
    expect(ids).toEqual(['a', 'b', 'c', 'd', 'e'].sort());

    // no overlaps
    for (let i = 0; i < atlas.placements.length; i++) {
      for (let j = i + 1; j < atlas.placements.length; j++) {
        const A = atlas.placements[i];
        const B = atlas.placements[j];

        const overlap = !(
          A.x + A.width <= B.x ||
          B.x + B.width <= A.x ||
          A.y + A.height <= B.y ||
          B.y + B.height <= A.y
        );
        expect(overlap).toBe(false);
      }
    }

    // atlas dimensions should be within maxWidth
    expect(atlas.width).toBeLessThanOrEqual(256);
    expect(atlas.height).toBeGreaterThan(0);
  });
});
