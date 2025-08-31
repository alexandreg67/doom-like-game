# Fix du système d'impact - Fenêtre temporelle des animations

## Problème identifié

L'utilisateur rapportait une "fenêtre temporelle" où les animations d'impact fonctionnaient au début puis disparaissaient complètement. L'analyse des logs révèle que le problème était causé par plusieurs facteurs :

### Causes principales :

1. **Nettoyage trop agressif des particules** :

   - Les systèmes de particules étaient nettoyés trop rapidement (2-4.5 secondes)
   - La durée de vie des particules individuelles était trop courte

2. **Pool exhaustion** :

   - Limite de 50 systèmes actifs simultanés
   - Une fois cette limite atteinte, plus aucun nouvel effet ne pouvait être créé

3. **Durées de vie configurées trop courtes** :
   - Config par défaut : 2000ms
   - Particules individuelles : 0.3-4 secondes max

## Solutions appliquées

### 1. Extension des durées de nettoyage automatique

**Fichier** : `packages/effects/src/particle/particle-system.ts`

- **createImpactParticles** : De `config.lifetime + 500` à `Math.max(config.lifetime * 2, 5000)`
- **createSparks** : De 2 secondes à 6 secondes
- **createDebris** : De 3.5 secondes à 8 secondes
- **createDust** : De 4.5 secondes à 10 secondes

### 2. Augmentation des durées de vie des particules individuelles

**Particules Sparks** :

- minLifeTime : 0.3s → 1.0s
- maxLifeTime : 0.8s → 2.5s

**Particules Debris** :

- minLifeTime : 1.0s → 2.0s
- maxLifeTime : 3.0s → 5.0s

**Particules Dust** :

- minLifeTime : 2.0s → 4.0s
- maxLifeTime : 4.0s → 8.0s

**Configuration générale** :

- Multiplication par 2 pour minLifeTime
- Multiplication par 3 pour maxLifeTime

### 3. Augmentation des limites du pool

- Pool actif : 50 → 100 systèmes simultanés
- Permet plus d'effets visuels simultanés

### 4. Extension des durées dans la base de données des matériaux

**Fichier** : `packages/effects/src/impact/impact-manager.ts`

- **Metal** : 2000ms → 6000ms
- **Concrete** : 3000ms → 8000ms
- **Wood** : 2500ms → 7000ms
- **Glass** : 4000ms → 10000ms
- **Default** : 2000ms → 5000ms

### 5. Configuration par défaut étendue

- Durée de vie de base : 2000ms → 6000ms

## Résultat attendu

Après ces modifications :

1. **Plus de fenêtre temporelle** : Les effets persistent beaucoup plus longtemps
2. **Meilleure capacité** : Le système peut gérer plus d'effets simultanés
3. **Visibilité améliorée** : Les particules restent visibles suffisamment longtemps
4. **Pool réutilisable** : Recyclage efficace des systèmes de particules

## Test

Pour tester les corrections :

1. Lancer le serveur de développement : `cd apps/web && npm run dev`
2. Ouvrir http://localhost:5173/
3. Tirer plusieurs fois rapidement dans le jeu
4. Observer que les animations d'impact persistent maintenant beaucoup plus longtemps

## Logs de validation

Les logs montrent maintenant :

- Création continue d'effets même après plusieurs tirs
- Recyclage approprié des systèmes via le pool
- Durées de nettoyage étendues visible dans les timeouts
