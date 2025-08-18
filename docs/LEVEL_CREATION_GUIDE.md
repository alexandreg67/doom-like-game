# Guide de Création de Niveaux DOOM-Like

## 🎯 Objectif

Ce guide explique comment créer des niveaux cohérents et complets pour le moteur DOOM-like, évitant les problèmes de collision et de rendu. Il détaille tous les éléments nécessaires pour créer une pièce et un niveau fonctionnel.

## 🚨 Problèmes Typiques Rencontrés

### 1. **Murs manquants**

- **Symptôme** : Secteurs sans contours visuels complets
- **Cause** : Secteurs définis sans `lineDefs` pour tous leurs bords
- **Solution** : Créer des `lineDefs` pour chaque arête de secteur

### 2. **Collision unidirectionnelle** ✅ CORRIGÉ

- **Symptôme** : Passage possible dans un sens mais pas l'autre
- **Cause** : Ancienne limitation du système de collision (résolu en v0.1.0)
- **Solution** : Le système de collision bidirectionnelle est maintenant actif automatiquement

### 3. **Z-fighting / Clignotement**

- **Symptôme** : Surfaces qui clignotent ou se chevauchent
- **Cause** : Murs dupliqués ou surfaces à la même profondeur
- **Solution** : Éviter les doublons, vérifier l'unicité des `lineDefs`

## 🏗️ Éléments Nécessaires pour Créer une Pièce

### Composants Obligatoires

#### 1. **Vertices (Points)**

```json
{
  "id": "v1", // Identifiant unique
  "position": {
    // Coordonnées 2D
    "x": -10,
    "y": -10
  }
}
```

- **Minimum requis** : 3 vertices pour un triangle, 4 pour un rectangle
- **Convention** : Ordre anti-horaire pour définir l'intérieur du secteur
- **Précision** : Utiliser des entiers ou décimaux avec max 2 décimales

#### 2. **Secteur (Zone)**

```json
{
  "id": "room_main", // Identifiant unique
  "floorHeight": 0, // Hauteur du sol (Y)
  "ceilingHeight": 4, // Hauteur du plafond (Y)
  "floorTexture": "FLOOR_MAIN", // Texture du sol
  "ceilingTexture": "CEIL_MAIN", // Texture du plafond
  "lightLevel": 200, // Éclairage (0-255)
  "vertices": ["v1", "v2", "v3", "v4"] // Liste des vertices (ordre anti-horaire)
}
```

- **floorHeight < ceilingHeight** : Obligatoire pour éviter les erreurs
- **lightLevel** : 0 = noir complet, 255 = éclairage max
- **vertices** : DOIT former un polygone fermé et valide

#### 3. **LineDefs (Murs/Arêtes)**

```json
{
  "id": "wall_south", // Identifiant unique
  "startVertex": "v1", // Vertex de départ
  "endVertex": "v2", // Vertex d'arrivée
  "flags": {
    // Propriétés du mur
    "blocking": true, // Collision physique
    "twoSided": false, // Mur simple (false) ou passage (true)
    "dontDraw": false, // Rendre visible (false) ou invisible (true)
    "mapped": true, // Visible sur la carte
    "soundBlock": false, // Bloque le son
    "secret": false, // Mur secret
    "lowerUnpegged": false, // Alignement texture basse
    "upperUnpegged": false, // Alignement texture haute
    "blockMonsters": true // Bloque les ennemis
  },
  "frontSide": {
    // Côté intérieur du secteur
    "id": "wall_south_f",
    "sector": "room_main", // Secteur associé
    "textureMiddle": "WALL_STONE", // Texture principale
    "textureUpper": "-", // Texture haute (- = invisible)
    "textureLower": "-", // Texture basse (- = invisible)
    "offsetX": 0, // Décalage horizontal texture
    "offsetY": 0, // Décalage vertical texture
    "needsUpperTexture": false, // Calcul automatique
    "needsLowerTexture": false, // Calcul automatique
    "needsMiddleTexture": true // Calcul automatique
  },
  "backSide": null // null pour mur simple, objet pour passage
}
```

### Composants Optionnels

#### 4. **Point de Départ Joueur**

```json
{
  "position": { "x": 0, "y": 0 }, // Position dans le secteur
  "angle": 0, // Orientation (0-360°)
  "sector": "room_main" // Secteur de départ
}
```

## 🔒 Règles et Contraintes Obligatoires

### Structure du Niveau

```json
{
  "name": "Nom du Niveau", // OBLIGATOIRE
  "description": "Description", // OBLIGATOIRE
  "version": "1.0.0", // OBLIGATOIRE
  "vertices": [], // OBLIGATOIRE (min 3)
  "sectors": [], // OBLIGATOIRE (min 1)
  "lineDefs": [], // OBLIGATOIRE (min 3)
  "playerStart": {} // OBLIGATOIRE
}
```

### Contraintes Géométriques

#### 1. **Vertices**

- **Unicité** : Chaque `id` doit être unique
- **Précision** : Coordonnées avec max 2 décimales
- **Limites** : Éviter les coordonnées extrêmes (±1000)

#### 2. **Secteurs**

- **Polygone valide** : Minimum 3 vertices, ordre anti-horaire
- **Hauteurs** : `floorHeight < ceilingHeight` (strictement)
- **Vertices consécutifs** : Pas de vertices dupliqués dans la liste
- **Fermeture** : Le dernier vertex doit connecter au premier

#### 3. **LineDefs**

- **Couverture complète** : Chaque arête de secteur DOIT avoir un lineDef
- **Orientation** : `startVertex` → `endVertex` suit le contour anti-horaire
- **Unicité** : Pas de lineDefs dupliqués sur la même arête
- **FrontSide obligatoire** : Toujours présent, référence un secteur valide

### Contraintes de Collision

#### Murs Infranchissables

```json
{
  "flags": {
    "blocking": true, // OBLIGATOIRE pour collision
    "twoSided": false // OBLIGATOIRE pour mur plein
  },
  "frontSide": {
    "textureMiddle": "WALL_TEXTURE" // OBLIGATOIRE
  },
  "backSide": null // OBLIGATOIRE (null)
}
```

#### Passages entre Secteurs

```json
{
  "flags": {
    "blocking": false, // OBLIGATOIRE pour passage
    "twoSided": true // OBLIGATOIRE pour connexion
  },
  "frontSide": {
    "sector": "secteur_a",
    "textureMiddle": "-", // Invisible
    "textureUpper": "WALL_UPPER", // Si différence hauteur plafond
    "textureLower": "WALL_LOWER" // Si différence hauteur sol
  },
  "backSide": {
    // OBLIGATOIRE pour twoSided
    "sector": "secteur_b"
    // Même structure que frontSide
  }
}
```

## 📋 Méthodologie Recommandée : Pièce par Pièce

### Étape 1 : Planification

1. **Dessiner le niveau** sur papier/logiciel 2D
2. **Définir les secteurs** : Identifier chaque zone fermée
3. **Numéroter les vertices** : Créer un plan de câblage
4. **Identifier les connexions** : Portes, passages entre secteurs

### Étape 2 : Création Incrémentale

```
1. Créer UN secteur simple (4 vertices, 4 lineDefs)
2. Tester le chargement et la navigation
3. Ajouter UN secteur adjacent avec connexion
4. Tester la transition entre secteurs
5. Répéter jusqu'à complétion
```

### Étape 3 : Validation Continue

- Utiliser `validateLevel()` après chaque ajout
- Vérifier les logs pour warnings/erreurs
- Tester ingame pour validation physique

## 📝 Exemple Complet : Pièce Simple

### Pièce Rectangulaire (4x4 unités)

```json
{
  "name": "Ma Première Pièce",
  "description": "Pièce rectangulaire simple pour apprendre",
  "version": "1.0.0",
  "vertices": [
    { "id": "v1", "position": { "x": 0, "y": 0 } },
    { "id": "v2", "position": { "x": 4, "y": 0 } },
    { "id": "v3", "position": { "x": 4, "y": 4 } },
    { "id": "v4", "position": { "x": 0, "y": 4 } }
  ],
  "sectors": [
    {
      "id": "main_room",
      "floorHeight": 0,
      "ceilingHeight": 3,
      "floorTexture": "FLOOR_TILE",
      "ceilingTexture": "CEIL_BASIC",
      "lightLevel": 200,
      "vertices": ["v1", "v2", "v3", "v4"]
    }
  ],
  "lineDefs": [
    {
      "id": "wall_south",
      "startVertex": "v1",
      "endVertex": "v2",
      "flags": {
        "blocking": true,
        "twoSided": false,
        "dontDraw": false,
        "mapped": true,
        "soundBlock": false,
        "secret": false,
        "lowerUnpegged": false,
        "upperUnpegged": false,
        "blockMonsters": true
      },
      "frontSide": {
        "id": "main_south_f",
        "sector": "main_room",
        "textureMiddle": "WALL_BRICK",
        "textureUpper": "-",
        "textureLower": "-",
        "offsetX": 0,
        "offsetY": 0,
        "needsUpperTexture": false,
        "needsLowerTexture": false,
        "needsMiddleTexture": true
      }
    },
    {
      "id": "wall_east",
      "startVertex": "v2",
      "endVertex": "v3",
      "flags": {
        "blocking": true,
        "twoSided": false,
        "dontDraw": false,
        "mapped": true,
        "soundBlock": false,
        "secret": false,
        "lowerUnpegged": false,
        "upperUnpegged": false,
        "blockMonsters": true
      },
      "frontSide": {
        "id": "main_east_f",
        "sector": "main_room",
        "textureMiddle": "WALL_BRICK",
        "textureUpper": "-",
        "textureLower": "-",
        "offsetX": 0,
        "offsetY": 0,
        "needsUpperTexture": false,
        "needsLowerTexture": false,
        "needsMiddleTexture": true
      }
    },
    {
      "id": "wall_north",
      "startVertex": "v3",
      "endVertex": "v4",
      "flags": {
        "blocking": true,
        "twoSided": false,
        "dontDraw": false,
        "mapped": true,
        "soundBlock": false,
        "secret": false,
        "lowerUnpegged": false,
        "upperUnpegged": false,
        "blockMonsters": true
      },
      "frontSide": {
        "id": "main_north_f",
        "sector": "main_room",
        "textureMiddle": "WALL_BRICK",
        "textureUpper": "-",
        "textureLower": "-",
        "offsetX": 0,
        "offsetY": 0,
        "needsUpperTexture": false,
        "needsLowerTexture": false,
        "needsMiddleTexture": true
      }
    },
    {
      "id": "wall_west",
      "startVertex": "v4",
      "endVertex": "v1",
      "flags": {
        "blocking": true,
        "twoSided": false,
        "dontDraw": false,
        "mapped": true,
        "soundBlock": false,
        "secret": false,
        "lowerUnpegged": false,
        "upperUnpegged": false,
        "blockMonsters": true
      },
      "frontSide": {
        "id": "main_west_f",
        "sector": "main_room",
        "textureMiddle": "WALL_BRICK",
        "textureUpper": "-",
        "textureLower": "-",
        "offsetX": 0,
        "offsetY": 0,
        "needsUpperTexture": false,
        "needsLowerTexture": false,
        "needsMiddleTexture": true
      }
    }
  ],
  "playerStart": {
    "position": { "x": 2, "y": 2 },
    "angle": 0,
    "sector": "main_room"
  }
}
```

**Analyse de cet exemple :**

- ✅ 4 vertices en ordre anti-horaire
- ✅ 1 secteur avec hauteurs valides (0 < 3)
- ✅ 4 lineDefs couvrant toutes les arêtes
- ✅ Tous les murs avec `blocking: true`
- ✅ Point de départ centré dans la pièce

## 🔧 Structure JSON Recommandée

### Exemple : Niveau 3 Pièces Connectées

```json
{
  "name": "Example Level",
  "description": "3 connected rooms example",
  "version": "1.0.0",
  "vertices": [
    { "id": "v1", "position": { "x": -10, "y": -10 } },
    { "id": "v2", "position": { "x": 10, "y": -10 } },
    { "id": "v3", "position": { "x": 10, "y": 10 } },
    { "id": "v4", "position": { "x": -10, "y": 10 } }
  ],
  "sectors": [
    {
      "id": "main_room",
      "floorHeight": 0,
      "ceilingHeight": 4,
      "floorTexture": "FLOOR_MAIN",
      "ceilingTexture": "CEIL_MAIN",
      "lightLevel": 200,
      "vertices": ["v1", "v2", "v3", "v4"]
    }
  ],
  "lineDefs": [
    {
      "id": "wall_south",
      "startVertex": "v1",
      "endVertex": "v2",
      "flags": {
        "blocking": true,
        "twoSided": false,
        "dontDraw": false,
        "mapped": true,
        "soundBlock": false,
        "secret": false,
        "lowerUnpegged": false,
        "upperUnpegged": false,
        "blockMonsters": true
      },
      "frontSide": {
        "id": "main_south_f",
        "sector": "main_room",
        "textureMiddle": "WALL_STONE",
        "textureUpper": "-",
        "textureLower": "-",
        "offsetX": 0,
        "offsetY": 0,
        "needsUpperTexture": false,
        "needsLowerTexture": false,
        "needsMiddleTexture": true
      }
    }
  ],
  "playerStart": {
    "position": { "x": 0, "y": 0 },
    "angle": 0,
    "sector": "main_room"
  }
}
```

## ✅ Règles de Cohérence

### 1. **Orientation des Vertices**

- **Secteurs** : Vertices dans le sens **anti-horaire**
- **LineDefs** : `startVertex` → `endVertex` suit le contour du secteur
- **FrontSide** : Toujours du côté intérieur du secteur

### 2. **Connexions entre Secteurs**

```json
{
  "id": "door_connection",
  "flags": {
    "blocking": false,
    "twoSided": true
  },
  "frontSide": {
    "sector": "room_a",
    "textureMiddle": "-",
    "textureUpper": "WALL_UPPER",
    "textureLower": "WALL_LOWER"
  },
  "backSide": {
    "sector": "room_b",
    "textureMiddle": "-",
    "textureUpper": "WALL_UPPER",
    "textureLower": "WALL_LOWER"
  }
}
```

### 3. **Textures Secteur par Secteur**

- **textureMiddle** : Mur plein (`blocking: true, twoSided: false`)
- **textureUpper** : Partie haute entre secteurs de hauteurs différentes
- **textureLower** : Partie basse entre secteurs de hauteurs différentes
- **"-"** : Pas de texture (invisible)

### 4. **Validation Automatique**

Le système détecte automatiquement :

- ✅ Vertices manquants
- ✅ Secteurs sans lineDefs
- ✅ lineDefs mal orientés
- ✅ Références brisées
- ✅ Hauteurs incohérentes

## 🧪 Workflow de Test

### Test d'un Secteur Isolé

1. Créer le JSON avec 1 secteur simple
2. Charger dans le sélecteur de niveau
3. Vérifier que tous les murs sont visibles
4. Tester collision dans toutes les directions
5. Passer au secteur suivant

### Test de Connexion

1. Ajouter un secteur adjacent
2. Créer la connexion avec `twoSided: true`
3. Tester passage bidirectionnel
4. Vérifier textures upper/lower correctes
5. Valider lighting transitions

### Test de Performance

1. Activer les métriques BSP (`setMetricsEnabled(true)`)
2. Vérifier culling efficiency dans les logs
3. S'assurer que FPS reste stable
4. Optimiser si nécessaire

## 🛠️ Outils de Debug

### 1. Validation Automatique

```typescript
import { validateLevel } from "@doom-like/engine";

const result = validateLevel(levelData);
if (!result.isValid) {
  console.error("Errors:", result.errors);
}
console.warn("Warnings:", result.warnings);
```

### 2. Debug BSP

```typescript
sceneManager.setDebugBSP(true); // Wireframe partitions
sceneManager.setMetricsEnabled(true); // Performance metrics
```

### 3. Logs Console

```
[LevelValidator] Validation complete: VALID
[LevelValidator] Errors: 0, Warnings: 2
[LevelValidator] Warnings found:
  - Sector 'pillar_1' has no lineDefs (isolated)
  - Sector 'main_room' edge v1-v2 has no corresponding lineDef
```

## 📚 Exemples de Référence

### Niveaux Inclus

1. **`demo_level_phase1.json`** : Niveau simple 2 secteurs
2. **`test_level_complete.json`** : 3 pièces connectées (référence)
3. **`physics_playground.json`** : Niveau complexe (problématique, à éviter)

### Patterns Courants

- **Couloir** : 2 secteurs connectés en ligne
- **Salle avec piliers** : Secteur principal + obstacles intérieurs
- **Escaliers** : Secteurs à hauteurs croissantes
- **Portes interactives** : Configuration spéciale (voir section dédiée)

## 🧩 Éléments Réutilisables (Props) et Éclairage

Cette section décrit des "props" simples (piliers/colonnes) et une configuration d'éclairage modulable que vous pouvez recopier d'un niveau à l'autre.

### 1) Piliers (obstacles intérieurs)

Principe DOOM-like: un pilier est juste un petit secteur fermé à l'intérieur d'un plus grand secteur, avec 4 lineDefs bloquants. Il participe à la collision et au rendu des murs, sans nécessiter de backSide.

Exemple (dans `room_west_corridor`):

```
// Vertices du pilier
{"id": "v39", "position": {"x": -19, "y": -1.5}},
{"id": "v40", "position": {"x": -17, "y": -1.5}},
{"id": "v41", "position": {"x": -17, "y": 1.5}},
{"id": "v42", "position": {"x": -19, "y": 1.5}},

// Secteur pilier
{
  "id": "pillar_west_a",
  "floorHeight": 0,
  "ceilingHeight": 4,
  "floorTexture": "FLOOR_TILE",
  "ceilingTexture": "CEIL_MAIN",
  "lightLevel": 190,
  "vertices": ["v39", "v40", "v41", "v42"]
}

// LineDefs (4 côtés, bloquants)
{
  "id": "l_pillar_a_1",
  "startVertex": "v39",
  "endVertex": "v40",
  "flags": {"blocking": true, "twoSided": false},
  "frontSide": {"id": "l_pillar_a_1f", "sector": "pillar_west_a", "textureMiddle": "WALL_BRICK"}
}
// ... répéter pour les 3 autres arêtes
```

Bonnes pratiques:

- Placez les vertices du pilier à l'intérieur du secteur parent, sans toucher ses bords.
- Utilisez `blocking: true, twoSided: false` pour des murs pleins.
- Gardez un nommage systématique: `pillar_<zone>_<index>`, `l_pillar_<index>_<1..4>`.

### 2) Éclairage — schéma JSON supporté

Le fichier de niveau peut inclure un bloc `lighting` consommé par `LevelLoader.parseLevel()`.

Structure minimale:

```
"lighting": {
  "globalAmbient": {"color": {"r": 0.8, "g": 0.8, "b": 0.85}, "intensity": 0.7},
  "lights": [
    {"id": "torch_west_1", "type": "point", "color": {"r":1,"g":0.85,"b":0.6}, "intensity":1.1, "position": {"x": -22, "y": 3, "z": 0}, "range":18, "enabled": true},
    {"id": "reactor_core", "type": "spot", "color": {"r":0.9,"g":1,"b":0.9}, "intensity":1.3, "position": {"x": -55, "y": 3.5, "z": -20}, "direction": {"x":0,"y":-1,"z":0}, "angle":1.2, "exponent":2, "range":30, "enabled": true}
  ],
  "sectorLighting": [
    {"sectorId": "room_west_corridor", "ambient": {"color": {"r":0.9,"g":0.8,"b":0.7}, "intensity": 0.6}, "lights": ["torch_west_1"]}
  ],
  "performance": {"maxActiveLights": 8, "shadowMapPoolSize": 2, "cullingDistance": 25, "enableLOD": true}
}
```

Types supportés: `point`, `directional`, `spot`, `hemispheric`.

Conseils:

- Limiter le rayon (`range`) et le nombre de lights actives pour de bonnes perfs.
- Activer les ombres seulement si nécessaire (coût élevé) via `shadows.enabled`.
- Harmoniser les `ambient` par secteur pour guider le joueur (zones chaudes/froides).

### 3) Check rapide props/éclairage

- `validateLevel()` ne valide pas le contenu du bloc `lighting` mais loggue les lights/secteurs parsés.
- Vérifiez en jeu avec `sceneManager.setMetricsEnabled(true)` et/ou l’UI debug lighting si activée.

## 🚪 Portes Interactives - Configuration Fonctionnelle

### Structure testée et validée

Basé sur la porte fonctionnelle du `demo_level_phase1` :

```json
{
  "id": "l3_door",
  "startVertex": "v7",
  "endVertex": "v8",
  "flags": {
    "blocking": true, // CRUCIAL: fermée par défaut
    "twoSided": true, // CRUCIAL: visible des deux côtés
    "dontDraw": false,
    "mapped": true,
    "soundBlock": false,
    "secret": false,
    "lowerUnpegged": false,
    "upperUnpegged": false,
    "blockMonsters": true
  },
  "frontSide": {
    "id": "corridor_door_f",
    "sector": "corridor", // Secteur A
    "textureMiddle": "DOOR_WOOD", // Texture de porte visible
    "textureUpper": "-",
    "textureLower": "WALL_LOWER", // Base du mur
    "offsetX": 0,
    "offsetY": 0,
    "needsUpperTexture": false,
    "needsLowerTexture": true, // CRUCIAL: afficher la base
    "needsMiddleTexture": true // CRUCIAL: afficher la porte
  },
  "backSide": {
    "id": "corridor_door_b",
    "sector": "door_room", // Secteur B (différent!)
    "textureMiddle": "DOOR_WOOD", // Même texture
    "textureUpper": "-",
    "textureLower": "WALL_LOWER",
    "offsetX": 0,
    "offsetY": 0,
    "needsUpperTexture": false,
    "needsLowerTexture": true,
    "needsMiddleTexture": true
  }
}
```

### Points critiques ⚠️

1. **ID obligatoire** : Exactement `"l3_door"` (reconnue par le moteur)
2. **Deux secteurs différents** : frontSide et backSide dans des secteurs adjacents
3. **Flags essentiels** :
   - `blocking: true` → fermée par défaut
   - `twoSided: true` → accessible des deux côtés
4. **Textures requises** :
   - `textureMiddle: "DOOR_WOOD"` → texture visible de la porte
   - `textureLower: "WALL_LOWER"` → base du mur
5. **Activation** : Appuyez sur **E** près de la porte

### Usage et comportement

- **Fermée** : `blocking: true` → collision active
- **Ouverte** : `blocking: false` → passage libre (moteur change automatiquement)
- **Toggle** : Appuyer sur E alterne l'état
- **Visuel** : Porte apparaît/disparaît selon l'état

### Erreurs courantes ❌

- **Mauvais ID** : Autre que "l3_door" → porte non reconnue
- **Même secteur** : frontSide et backSide identiques → dysfonctionnement
- **Textures vides** : `textureMiddle: "-"` → porte invisible
- **Superposition** : Porte ajoutée sur mur existant → z-fighting

## 🎮 Conseils Pratiques

### Do ✅

- Commencer simple (1 pièce carrée)
- Tester après chaque modification
- Utiliser la validation automatique
- Respecter l'orientation anti-horaire
- Documenter les connexions complexes

### Don't ❌

- Créer tous les secteurs d'un coup
- Ignorer les warnings de validation
- Dupliquer les lineDefs
- Négliger les textures upper/lower
- Oublier le playerStart dans un secteur valide

### En Cas de Problème

1. **Revenir à la dernière version fonctionnelle**
2. **Isoler le secteur problématique**
3. **Utiliser validateLevel() pour identifier l'erreur**
4. **Tester pièce par pièce**
5. **Demander une review de la structure JSON**

## ✅ Checklist de Validation

### Avant de Sauvegarder

- [ ] Tous les `id` sont uniques (vertices, sectors, lineDefs, sides)
- [ ] Vertices en ordre anti-horaire pour chaque secteur
- [ ] `floorHeight < ceilingHeight` pour tous les secteurs
- [ ] Chaque arête de secteur a son lineDef correspondant
- [ ] Tous les lineDefs ont un `frontSide` valide
- [ ] `playerStart` est dans un secteur existant
- [ ] Pas de références cassées (vertices/sectors inexistants)

### Avant de Tester

- [ ] `validateLevel()` retourne `isValid: true`
- [ ] Aucune erreur dans les logs de validation
- [ ] Warnings résolus ou documentés
- [ ] Textures référencées existent dans le système

### Pendant le Test

- [ ] Tous les murs sont visibles et solides
- [ ] Pas de passage à travers les murs (bidirectionnel)
- [ ] Transitions entre secteurs fonctionnelles
- [ ] Éclairage cohérent dans toutes les zones
- [ ] Performance stable (>30 FPS)

## 🐛 Erreurs Communes et Solutions

### "Sector has no lineDefs"

```
Cause: Secteur défini sans lineDefs pour ses arêtes
Solution: Créer un lineDef pour chaque arête du secteur
```

### "Missing vertex reference"

```
Cause: Vertex référencé mais non défini dans vertices[]
Solution: Ajouter le vertex manquant ou corriger la référence
```

### "Invalid sector height"

```
Cause: floorHeight >= ceilingHeight
Solution: Ajuster les hauteurs (ex: floor=0, ceiling=3)
```

### "Player stuck in walls"

```
Cause: playerStart en dehors du secteur ou dans un mur
Solution: Placer playerStart au centre géométrique du secteur
```

### "Flickering walls (Z-fighting)"

```
Cause: LineDefs dupliqués ou surfaces superposées
Solution: Supprimer les doublons, vérifier l'unicité des arêtes
```

### "Cannot enter room from outside"

```
Cause: Problème résolu en v0.1.0 - collision bidirectionnelle active
Solution: Aucune action requise, collision fonctionne dans les deux sens
```

---

**Cette méthode garantit des niveaux stables et jouables ! 🎯**

_Dernière mise à jour : v0.1.0 - Correction collision bidirectionnelle_
