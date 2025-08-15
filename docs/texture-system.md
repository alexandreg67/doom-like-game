# Texture System — Spécification

But : définir l'architecture du système de textures pour la Phase 2.

Principes

- Chargement asynchrone et parallèle des textures
- Cache LRU pour limiter l'empreinte mémoire
- Support des formats PNG/JPG/WebP
- Texture atlas pour réduction des draw calls
- Metadata par texture: scale, offset, rotation, wrapMode, samplingMode

API proposée (high-level)

- `TextureManager.load(path: string, options?: LoadOptions): Promise<TextureHandle>`
- `TextureManager.get(handleOrPath): TextureHandle | undefined`
- `TextureManager.preload(paths: string[], priority?: number)`
- `TextureManager.release(handleOrPath)`

LoadOptions

- `wrapU`/`wrapV` (repeat/clamp)
- `scale` (number)
- `offset` ({u:number,v:number})
- `rotation` (radians)
- `sampling` (nearest/linear/trilinear)
- `fallback` (path to fallback texture)

Cache

- LRU avec TTL configurable
- Taille max en MB et nombre max d'entrées
- Eviction strategy: oldest unused or largest first (configurable)

Integration avec `asset-loader`

- Priorité et groupement par niveau
- Preload smart (player vicinity)
- Atlas builder: runtime ou build-time (préférer build-time pour perf)

Mapping UV

- Utility `computeSectorUV(sector: Sector, textureMeta: TextureMeta)`
- Support tiling basé sur texture.scale et longueur des edges

Fichiers fixtures

- Étendre `packages/engine/src/fixtures/*.json` pour inclure champs `textures` et metadata

Notes d'implémentation

- Reprendre les conventions Babylon.js (invertY, samplingMode)
- Tests unitaires: loader, cache, atlas packing
- E2E: chargement d'un niveau complet avec textures

Prochaines étapes

1. Implémenter prototype minimal `TextureManager` (Promise-based)
2. Brancher dans `SceneManager` et remplacer couleurs par textures
3. Ajouter fixtures étendues et tests
