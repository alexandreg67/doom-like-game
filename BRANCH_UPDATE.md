# Mise à jour de la branche par défaut

## Changements effectués

✅ **Branche `main` créée et définie comme branche par défaut**
- La branche `main` a été créée à partir de `develop`
- Elle a été définie comme branche par défaut sur GitHub
- Toutes les futures PRs doivent maintenant cibler `main`

## Configuration CI/CD

✅ **Workflows GitHub Actions correctement configurés**
- `ci.yml` : Se déclenche sur les branches `main` et `develop` pour les push et PR
- `deploy.yml` : Se déclenche sur `main` pour le staging et sur les tags pour la production

## Instructions pour les développeurs

### Mise à jour des clones locaux

```bash
# Récupérer les dernières branches
git fetch origin

# Basculer vers la nouvelle branche main
git checkout main

# Mettre à jour
git pull origin main

# Optionnel : définir main comme branche par défaut locale
git config branch.autosetupmerge always
git config branch.autosetuprebase always
```

### Nouvelle workflow de développement

1. **Créer une nouvelle feature branch** à partir de `main`
2. **Ouvrir une PR** vers `main`
3. **La CI se déclenchera automatiquement** et validera les changements

## Tests effectués

- [x] Création de la branche `main`
- [x] Définition comme branche par défaut
- [x] Vérification des workflows CI/CD
- [ ] Test d'une PR vers `main` (cette PR)
- [ ] Validation du déclenchement de la CI

## Notes

Cette PR teste le bon fonctionnement de la CI après les changements.
