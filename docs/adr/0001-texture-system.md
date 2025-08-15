# ADR 0001: Texture System — découpage et cache

Date: 2025-08-15

Contexte

- Phase 2 requiert un système de textures robuste avec cache, atlasing et metadata.

Décision

- Introduire `TextureManager` centralisé dans `packages/engine/src/assets`.
- Utiliser un cache LRU en mémoire avec TTL par défaut 5 minutes.
- Supporter fallback textures et préchargement par priorité.

Conséquences

- Simplifie l'intégration texture/scene.
- Permet éviction contrôlée pour limiter l'empreinte mémoire.
