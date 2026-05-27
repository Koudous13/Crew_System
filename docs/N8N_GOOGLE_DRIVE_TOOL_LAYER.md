# Couche Google Drive n8n - Crew_System

## 1. Décision

La couche Google Drive est maintenant présente dans le workflow n8n principal :

```text
CS_CHAT_DIRECTOR_NATIVE
```

Contrairement à Supabase, les tools Google Drive sont des nodes **Google Drive Tool** visibles dans le canvas.

Important :

```text
Ne pas brancher le node classique `Google Drive` en ai_tool.
Pour un agent IA n8n, utiliser le node `Google Drive Tool`.
```

Le node classique `Google Drive` exécute des opérations Drive dans un flux normal.
Le node `Google Drive Tool` expose Google Drive comme capacité utilisable par un AI Agent.

Raison :

- Koudous peut vérifier lui-même le bon credential Google Drive avant tout test ;
- les opérations Drive restent lisibles dans l'interface n8n ;
- le Directeur peut utiliser Drive comme espace documentaire une fois le credential validé.

## 2. Statut

```text
Workflow : CS_CHAT_DIRECTOR_NATIVE
Actif : oui
Tools Google Drive Tool visibles : 7
Connexions ai_tool vers le Directeur : oui
Credential Google Drive Crew System : oui
Test lecture Drive : succès
Test création dossier + document Markdown : succès
Test vérification après création : succès
```

Le credential Google Drive a été sélectionné par Koudous puis vérifié par test contrôlé.

## 3. Tools Ajoutés

```text
cs_drive_search_project_folders
cs_drive_create_project_folder
cs_drive_search_documents
cs_drive_download_document_text
cs_drive_create_markdown_document
cs_drive_create_document_version
cs_drive_rename_document
```

## 4. Rôle De Chaque Tool

### cs_drive_search_project_folders

Cherche les dossiers projet dans Google Drive.

Usage attendu :

- retrouver l'espace documentaire d'un projet ;
- éviter de recréer un dossier déjà existant ;
- confirmer ou demander à Koudous si plusieurs dossiers correspondent.

### cs_drive_create_project_folder

Crée un dossier projet.

Usage attendu :

- uniquement si le dossier n'existe pas ;
- uniquement si Koudous veut créer ou structurer un projet ;
- jamais avant une recherche Drive.

### cs_drive_search_documents

Cherche les documents lisibles d'un projet.

Usage attendu :

- retrouver stratégie, calendrier, briefs, contenus, révisions ;
- éviter de produire sans contexte ;
- préparer la lecture de documents importants.

### cs_drive_download_document_text

Télécharge ou exporte un document en texte.

Usage attendu :

- lire un document utile avant de produire ;
- exporter un Google Doc en texte ;
- récupérer un Markdown ou document textuel.

Point de vigilance : ce tool doit être validé avec le credential Drive avant de l'utiliser en production.

### cs_drive_create_markdown_document

Crée un document Markdown lisible dans Google Drive.

Usage attendu :

- stratégie ;
- calendrier éditorial ;
- plan de contenu ;
- analyse ;
- compte rendu de décisions ;
- livrable final lisible par Koudous.

Règle : pas de JSON brut comme livrable utilisateur.

### cs_drive_create_document_version

Crée une nouvelle version d'un document.

Usage attendu :

- corriger un document existant ;
- produire une V2, V3, etc. ;
- garder l'historique propre ;
- éviter l'écrasement silencieux.

### cs_drive_rename_document

Renomme un document sans modifier son contenu.

Usage attendu :

- corriger un nom de fichier ;
- harmoniser une nomenclature ;
- garder le Drive propre.

Ce tool ne doit pas être utilisé pour supprimer ou remplacer du contenu.

## 5. Règles Du Directeur

Le prompt du Directeur a été mis à jour avec ces règles :

- ne pas appeler Google Drive tant que Koudous n'a pas confirmé que le credential Drive est valide ;
- chercher le dossier projet avant toute création ;
- chercher les documents existants avant de produire ;
- créer des documents Markdown lisibles ;
- ne jamais supprimer un fichier Drive ;
- ne jamais écraser un document important ;
- créer une version datée ou numérotée si une révision est nécessaire ;
- indexer ensuite le document dans Supabase quand c'est utile.

## 6. Séparation Des Rôles

```text
Supabase
  = état opérationnel, jobs, progress, décisions, erreurs, index documentaire.

Google Drive
  = documents lisibles, stratégiques, consultables par Koudous.

n8n Memory
  = confort conversationnel de la session courante.
```

Google Drive ne remplace pas Supabase.
Supabase ne remplace pas les documents lisibles.

## 7. Avant Premier Test

Koudous doit ouvrir le workflow `CS_CHAT_DIRECTOR_NATIVE`, puis vérifier les nodes :

```text
cs_drive_search_project_folders
cs_drive_create_project_folder
cs_drive_search_documents
cs_drive_download_document_text
cs_drive_create_markdown_document
cs_drive_create_document_version
cs_drive_rename_document
```

Pour chaque node :

1. sélectionner le bon credential Google Drive OAuth2 ;
2. sauvegarder le workflow ;
3. confirmer dans le chat que le credential Drive est valide.

Ensuite seulement, on lance un test contrôlé.

Statut actuel : fait.

## 8. Premier Test Conseillé

Ne pas commencer par une génération lourde.

Test recommandé :

```text
Credential Drive valide. Cherche si le projet ecole_229 a déjà un dossier Drive. Ne crée rien pour l'instant.
```

Puis :

```text
Si aucun dossier n'existe, crée un dossier Drive pour ecole_229 et enregistre la référence dans Supabase.
```

Puis :

```text
Crée un document Markdown très court dans le dossier ecole_229 : "test_drive_crew_system.md".
```

Cette progression teste lecture, création de dossier, création de fichier et indexation sans risquer de gros livrable inutile.

Résultat du test :

```text
Le dossier ecole_229 a été trouvé.
Le document test_drive_crew_system.md a été trouvé.
Le workflow ne déclenche plus l'erreur supplyData.
La réponse publique ne laisse plus passer de phrase interne.
```

## 9. Règle Pour Tous Les Prochains Tools

Pour tout outil branché à un AI Agent n8n :

```text
Utiliser le node Tool dédié quand il existe.
Ne pas brancher le node applicatif classique directement en ai_tool.
```

Exemples :

```text
Google Drive classique  -> flux normal
Google Drive Tool       -> tool pour AI Agent

Gmail classique         -> flux normal
Gmail Tool              -> tool pour AI Agent

Supabase classique      -> flux normal
Call n8n Workflow Tool  -> tool robuste quand le Tool natif n'est pas adapté
```

Si un node Tool natif existe, il est prioritaire pour l'agent.
Si l'opération est trop complexe ou nécessite une réponse formatée, utiliser `Call n8n Workflow Tool` avec un sous-flux intégré ou séparé.
