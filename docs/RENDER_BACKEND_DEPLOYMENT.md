# Déploiement du backend Crew_System sur Render

Ce guide déploie uniquement le backend Python. L'interface Next.js restera sur Vercel et appellera ce backend via son URL publique Render.

## 1. Préparer Render

1. Va sur <https://dashboard.render.com>.
2. Connecte ton compte GitHub.
3. Assure-toi que Render a accès au dépôt `Koudous13/Crew_System`.

## 2. Créer le service

Méthode recommandée : utilise le fichier `render.yaml` du dépôt.

1. Dans Render, clique sur **New**.
2. Choisis **Blueprint**.
3. Sélectionne le dépôt `Koudous13/Crew_System`.
4. Choisis la branche qui contient ce fichier.
5. Render doit détecter le service `crew-system-api`.
6. Au moment où Render demande les variables secrètes, renseigne `GEMINI_API_KEY`.

Le service utilise :

```bash
python -m pip install --upgrade pip && python -m pip install -e .
```

comme commande de build, puis :

```bash
python -m crew_system api serve --host 0.0.0.0 --port $PORT --provider auto
```

comme commande de démarrage.

## 3. Pourquoi le disque persistant est obligatoire

Crew_System écrit les projets, conversations, jobs, logs et livrables dans un workspace. Sur Render, seul le contenu écrit dans le chemin du disque persistant est conservé entre les redémarrages.

La configuration utilise donc :

```env
CREW_SYSTEM_WORKSPACE=/var/data/workspace
```

avec un disque monté sur :

```text
/var/data
```

## 4. Variables Render

Variables obligatoires :

```env
GEMINI_API_KEY=ta_cle_google_ai_studio
GEMINI_MODEL=gemma-4-26b-a4b-it
GEMINI_RESPONSE_SCHEMA=false
CREW_SYSTEM_WORKSPACE=/var/data/workspace
```

Variables déjà prévues par `render.yaml` :

```env
GEMINI_TEMPERATURE=0.3
GEMINI_TIMEOUT_SECONDS=240
GEMINI_MAX_RETRIES=3
```

## 5. Vérifier le backend

Quand Render donne l'URL publique, teste :

```text
https://ton-service.onrender.com/health
```

La réponse attendue ressemble à :

```json
{
  "default_provider": "auto",
  "ok": true,
  "service": "crew_system_api",
  "workspace_root": "/var/data/workspace"
}
```

## 6. Brancher Vercel dessus

Dans le projet Vercel de l'interface, ajoute :

```env
CREW_API_URL=https://ton-service.onrender.com
NEXT_PUBLIC_CREW_API_URL=/crew-api
```

Ensuite redéploie l'interface Vercel.

## 7. Premier test complet

1. Ouvre l'interface Vercel.
2. Crée ou sélectionne un projet.
3. Envoie un message simple comme `Salut`.
4. Ensuite envoie une vraie demande de travail, par exemple :

```text
Crée une stratégie de contenu pour mon profil LinkedIn et Facebook.
```

Le chat doit répondre, créer un job, afficher la progression et écrire les livrables dans le workspace Render.
