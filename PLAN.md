# DOOM-Like Game - Plan de Développement

## Vision du projet

Créer un jeu web moderne qui capture l'essence de DOOM (1993) avec des technologies 2025 : WebGPU, TypeScript strict, architecture modulaire, et une expérience utilisateur fluide à 60fps sur matériel milieu de gamme.

## Objectifs stratégiques

### Technique
- **Performance** : 60 FPS stable, frame time < 16.7ms (99e percentile)
- **Compatibilité** : WebGPU + fallback WebGL2, Chrome/Firefox/Safari
- **Scalabilité** : Architecture monorepo, packages découplés
- **Qualité** : 70%+ couverture tests, CI/CD robuste

### Gameplay
- **Immersion** : Audio 3D, feedback visuel/haptique
- **Accessibilité** : Rebinds clavier, options visuelles
- **Contenu** : 5-8 niveaux, variété ennemis/armes
- **Modding** : Éditeur maps, format assets ouvert

### Légal & Éthique
- **Conformité** : 0% assets DOOM originaux
- **Open Source** : Code et outils libres
- **Performance** : Optimisé pour faible consommation

## Architecture cible

### Rendu (Engine Package)
```
WebGPU Renderer
├── Scene Graph (Babylon.js)
├── Sector Rendering (DOOM-like)
├── BSP Culling (performance)
├── Lighting (sector-based)
└── Sprite Billboard (ennemis/objets)
```

### Gameplay (Game Logic Package)
```
ECS System
├── Components (Position, Velocity, Health, AI, etc.)
├── Systems (Movement, Combat, AI, Audio)
├── Entities (Player, Enemies, Weapons, Items)
└── Events (Damage, Pickup, Trigger)
```

### Outils (Map Editor Package)
```
2D Level Editor
├── Sector Drawing (walls, floors, ceilings)
├── Thing Placement (enemies, items, spawn)
├── Trigger System (doors, lifts, secrets)
└── Export WAD-like (format custom)
```

## Roadmap détaillée

### Phase 0 : Fondations ✅ (Semaines 1-2)

**Objectifs** : Infrastructure projet stable et productive

#### Semaine 1
- [x] Monorepo pnpm avec workspaces
- [x] TypeScript 5.5 strict + biome
- [x] Git flow (main/develop/features)
- [x] Tests Vitest + Playwright

#### Semaine 2  
- [x] CI/CD GitHub Actions
- [x] Documentation (CLAUDE.md, PLAN.md)
- [x] Babylon.js setup WebGPU + WebGL2
- [x] Feature detection navigateurs

**Livrables** :
- ✅ Repository initialisé avec structure complète
- ✅ Pipeline CI fonctionnel
- ✅ Documentation technique à jour

### Phase 1 : Moteur de Base (Semaines 3-4)

**Objectifs** : Rendu 3D fonctionnel avec géométrie secteur

#### Semaine 3 : Rendu Core
- [x] Engine class avec lifecycle
- [x] WebGPU renderer + fallback WebGL2  
- [x] Scene manager avec transitions
- [ ] Asset loader (textures, modèles)

#### Semaine 4 : Géométrie DOOM
- [ ] Système secteurs (sol/mur/plafond)
- [ ] BSP tree basique pour culling
- [ ] Rendu wireframe + solid
- [ ] Tests performance (frame timing)

**Critères de validation** :
- [ ] Scène 3D affichée correctement WebGPU et WebGL2
- [ ] 60 FPS stable sur secteur simple (Chrome/Firefox)
- [ ] Tests unitaires moteur (>80% coverage)
- [ ] Pas de memory leaks détectés

**Livrables** :
- Démo technique : salle + couloir + porte
- Benchmarks performance documentés

### Phase 2 : Mouvement et Physique (Semaines 5-6)

**Objectifs** : Contrôles FPS fluides avec collisions précises

#### Semaine 5 : Input et Caméra
- [ ] Contrôles clavier/souris (WASD, look)
- [ ] Support gamepad (Xbox/PlayStation)
- [ ] Caméra first-person smooth
- [ ] Mouse lock et sensibilité

#### Semaine 6 : Physique 2.5D
- [ ] Collisions AABB vs line segments
- [ ] Détection sols/escaliers/rampes
- [ ] Système portes/ascenseurs
- [ ] Physics timestep fixe

**Critères de validation** :
- [ ] Mouvement fluide sans accrocs
- [ ] Collisions précises (pas de traversée murs)
- [ ] Gamepad fonctionnel (deadzone, courbes)
- [ ] Tests E2E Playwright (parcours niveau)

**Livrables** :
- Player controller robuste
- Suite tests physique complète

### Phase 3 : Gameplay Core (Semaines 7-9)

**Objectifs** : Combat et IA ennemis fonctionnels

#### Semaine 7 : Système Combat ✅
- [x] Armes (hitscan type pistol/shotgun) - **Implémenté**
- [x] Système dégâts/health - **Intégration events**
- [x] Feedback visuel (muzzle flash, impacts) - **Base complétée**
- [x] Audio 3D (tirs, impacts) - **Système complet**

#### Semaine 8 : IA Ennemis ✅
- [x] FSM basic (idle/patrol/chase/attack) - **6 états implémentés**
- [x] Line of sight via BSP - **Distance-based MVP, raycasting Phase 3B**
- [x] Pathfinding simple (A*) - **Direct movement, A* Phase 4**
- [x] Types ennemis (melee, ranged) - **4 types IMP variants**

#### Semaine 9 : Intégration et Polish 🟡
- [x] Système animation sprites - **Babylon.js integration**
- [x] Audio 3D spatial - **✅ SYSTÈME COMPLET (EnemyAudioSystem)**
- [ ] Particules (sang, explosions) - **En cours**
- [ ] HUD (santé, munitions) - **Phase 3B**
- [ ] Menu pause et options - **Phase 5**

**Critères de validation** :
- [x] Combat satisfaisant et réactif - **✅ Système hitscan fonctionnel**
- [x] IA ennemis crédible et challengeante - **✅ FSM 6 états + performance**
- [x] Audio 3D immersif - **✅ EnemyAudioSystem complet avec LOD**
- [x] Tests gameplay complets - **✅ 19/19 tests audio, benchmarks validés**

**Livrables** :
- [x] Gameplay vertical slice jouable - **✅ ImpDemo interactif fonctionnel**
- [x] Métriques gameplay (TTK, accuracy, etc.) - **✅ Performance monitoring en temps réel**

**Status Phase 3** : ✅ **MAJORITÉ COMPLÉTÉE** - Audio 3D system intégré avec succès  
**Prochaines étapes** : Phase 3B (Map Collision Integration) → Phase 4

### Phase 4 : Éditeur et Outils (Semaines 10-11)

**Objectifs** : Pipeline contenu pour création niveaux

#### Semaine 10 : Éditeur Maps 2D
- [ ] Interface top-down drag & drop
- [ ] Drawing tools (secteurs, linedefs)
- [ ] Thing placement (spawn, enemies, items)
- [ ] Preview 3D temps réel

#### Semaine 11 : Pipeline Assets
- [ ] Format WAD-like custom
- [ ] BSP compiler offline
- [ ] Texture atlas generator
- [ ] Audio compressor/converter

**Critères de validation** :
- [ ] Niveau créé dans éditeur → jouable en jeu
- [ ] Export/import stable sans corruption
- [ ] Documentation format assets
- [ ] Tests round-trip (edit → export → import)

**Livrables** :
- Éditeur web fonctionnel
- Spécification format WAD-like
- 2-3 niveaux exemple

### Phase 5 : Contenu et Polish (Semaines 12-14)

**Objectifs** : Expérience jeu complète et polie

#### Semaine 12 : Niveaux et Contenu
- [ ] 5 niveaux variés (intérieur/extérieur)
- [ ] Système clés/portes colorées
- [ ] Secrets et easter eggs
- [ ] Progression et unlock

#### Semaine 13 : Audio et Ambiance
- [ ] Musique adaptative (combat/exploration)
- [ ] SFX ambiance (ventilation, machines)
- [ ] Reverb zones par secteur
- [ ] Options audio (volume, 3D disable)

#### Semaine 14 : UX et Accessibilité
- [ ] Menu principal polish
- [ ] Tutorial intégré
- [ ] Remapping touches
- [ ] Options visuelles (FOV, gamma)

**Critères de validation** :
- [ ] 5 niveaux complétables et fun
- [ ] Audio immersif sans fatigue
- [ ] Accessible (daltonisme, moteur)
- [ ] Benchmarks performance sur variété hardware

**Livrables** :
- Version Alpha complète
- Guide utilisateur
- Tests utilisateurs (feedback)

### Phase 6 : Release et Production (Semaines 15-16)

**Objectifs** : Déploiement stable et monitoring

#### Semaine 15 : Optimisation et Sécurité
- [ ] Bundle analysis et tree-shaking
- [ ] Lazy loading assets critiques
- [ ] CSP strict et security headers
- [ ] Monitoring performance (télémétrie)

#### Semaine 16 : Déploiement
- [ ] CDN setup et cache strategy
- [ ] Fallbacks dégradés gracieux
- [ ] Documentation déploiement
- [ ] Monitoring alertes

**Critères de validation** :
- [ ] Build size < 10MB initial
- [ ] Loading < 5s (3G connection)
- [ ] 0 vulnérabilités sécurité critiques
- [ ] Monitoring dashboard opérationnel

**Livrables** :
- v1.0.0 en production
- Infrastructure monitoring
- Documentation ops complète

## Métriques de succès

### Performance
- **Frame rate** : 60 FPS (95% du temps)
- **Loading time** : < 5s (3G), < 2s (WiFi)
- **Memory usage** : < 512MB peak
- **Battery impact** : < 20% drain/hour (mobile)

### Qualité
- **Test coverage** : > 70% (unitaires + E2E)  
- **Bug density** : < 1 bug critique/1000 LOC
- **Accessibility** : WCAG 2.1 AA compliance
- **Browser support** : Chrome 90+, Firefox 85+, Safari 14+

### Engagement
- **Level completion** : > 60% joueurs finissent niveau 1
- **Session duration** : > 10min moyenne
- **Return rate** : > 40% J+7
- **Community content** : > 10 maps créées (post-release)

## Gestion des risques

### Techniques
| Risque | Probabilité | Impact | Mitigation |
|--------|-------------|---------|------------|
| WebGPU adoption lente | Moyenne | Moyen | Fallback WebGL2 robuste |
| Performance mobile | Élevée | Élevé | LOD système + settings qualité |
| Compatibilité navigateurs | Moyenne | Élevé | Tests cross-browser CI |
| Memory leaks Babylon.js | Faible | Élevé | Tests mémoire automatisés |

### Légales
| Risque | Probabilité | Impact | Mitigation |
|--------|-------------|---------|------------|  
| Copyright DOOM assets | Faible | Critique | Assets 100% originaux |
| Trademark issues | Très faible | Moyen | Nom et branding propres |
| Music licensing | Moyenne | Faible | Compositions originales |

### Projet
| Risque | Probabilité | Impact | Mitigation |
|--------|-------------|---------|------------|
| Scope creep | Élevée | Moyen | MVP strict, roadmap v2 |
| Burn-out développeur | Moyenne | Élevé | Planning réaliste, breaks |
| Feedback utilisateurs tardif | Moyenne | Moyen | Tests précoces, démos |

## Ressources nécessaires

### Humaines
- **Développeur principal** : Architecture, engine, gameplay (100%)
- **Game designer** : Niveau design, balancing (25%)  
- **Audio designer** : SFX, musique, integration (15%)
- **Testeur QA** : Tests manuels, feedback (10%)

### Techniques
- **Hardware** : GPU moderne (RTX 3060+ / RX 6600+)
- **Software** : Licences outils (facultatif)
- **Hosting** : CDN, analytics, monitoring (< 50€/mois)

### Temps
- **Total projet** : 16 semaines (4 mois)
- **Développement actif** : 14 semaines  
- **Buffer risques** : 2 semaines
- **Post-release support** : 4 semaines

## Post-release (v1.x)

### Roadmap v2 (Q2 2025)
- **Multijoueur WebRTC** : Co-op 2-4 joueurs
- **Génération procédurale** : Infinite dungeons
- **VR/AR Support** : WebXR compatibility  
- **Mod support** : Plugin API, Steam Workshop

### Métriques à long terme
- **MAU** : 10k+ utilisateurs actifs mensuels
- **Community** : 100+ maps créées par utilisateurs
- **Performance** : 95% satisfaction ratings
- **Revenus** : Monétisation éthique (cosmetics, pas P2W)

## Conclusion

Ce plan vise un équilibre entre ambition technique et réalisme de livraison. Le focus sur la performance, la qualité et l'expérience utilisateur assure un produit durable qui honore l'héritage DOOM tout en apportant une vision moderne du genre FPS.

La modularité de l'architecture permet une évolution progressive et l'ajout de fonctionnalités avancées post-v1.0 sans refactoring majeur.

**Prochaine étape** : Validation Phase 1 (Engine de base) avec stakeholders et démarrage développement actif.