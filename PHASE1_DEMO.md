# Phase 1 Demo - Multi-Sector Level

## 🎯 Ce qui fonctionne

✅ **Géométrie multi-secteurs** : La démo charge un niveau avec 2 secteurs connectés :
- `main_room` : Salle principale (sol marron, plafond gris clair)
- `side_room` : Salle latérale surélevée (sol bleu, plafond gris, murs brique)

✅ **Transitions de hauteur** : Le `side_room` a un sol à 1m de hauteur et un plafond à 3m, démontrant les capacités de `generatePartialWalls()` pour créer des murs upper/lower.

✅ **Interaction porte** : Appuyez sur **E** pour ouvrir/fermer la porte entre les deux secteurs.

✅ **BSP Tree** : Culling automatique basé sur la position de la caméra.

✅ **WebGPU/WebGL2** : Fallback automatique vers WebGL2 si WebGPU n'est pas disponible.

## 🎮 Contrôles

- **Souris** : Regarder autour
- **WASD** : Se déplacer (ou flèches directionnelles)
- **E** : Ouvrir/fermer la porte

## 🔧 Architecture technique

### Fichiers clés créés/modifiés :
- `packages/engine/src/fixtures/demo_level_simple.json` : Définition du niveau
- `packages/engine/src/geometry/level-loader.ts` : Parseur de niveau JSON
- `packages/engine/src/core/scene-manager.ts` : Chargement et rendu multi-secteurs

### Fonctionnalités démontrées :
1. **Parser de niveau** : Format JSON → Structures DoomGeometry
2. **Géométrie complexe** : Floor/ceiling/walls avec transitions de hauteur
3. **Matériaux différenciés** : Couleurs par secteur
4. **BSP Culling** : Performance optimisée
5. **Interaction** : Système porte simple

## 📊 Métriques

- **Secteurs** : 2 secteurs avec géométries différentes
- **LineDefs** : 9 lignes incluant porte interactive
- **Vertices** : 8 points définissant la géométrie
- **Performance** : ~60 FPS stable

## 🔄 Prochaines étapes (Phase 2)

- Système de collision avec les murs
- Contrôles FPS plus fluides
- Support gamepad
- Physique 2.5D (escaliers, rampes)
- Tests E2E Playwright

## 🧪 Tests

Pour lancer les tests du moteur :
```bash
pnpm test  # Tests unitaires (couverture actuelle: 96.45% geometry)
```

Pour installer et lancer les tests E2E :
```bash
pnpm exec playwright install
pnpm test:e2e
```

---
*Démo créée le 15 août 2025 - Phase 1 Validation*
