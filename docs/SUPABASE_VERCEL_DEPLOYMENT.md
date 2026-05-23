# Déploiement gratuit avec Vercel + Supabase

Cette voie remplace le disque serveur par Supabase. Elle évite Render, évite un tunnel local et permet d'utiliser l'interface en ligne sans dépendre de ton PC.

## 1. Créer le projet Supabase

1. Va sur <https://supabase.com/dashboard>.
2. Crée un nouveau projet gratuit.
3. Ouvre **SQL Editor**.
4. Copie le contenu de `supabase/schema.sql`.
5. Exécute le script.

Les tables créées stockent :

- projets ;
- conversations ;
- messages ;
- jobs ;
- progression ;
- documents Markdown ;
- validations humaines.

## 2. Récupérer les clés

Dans Supabase :

1. Va dans **Project Settings**.
2. Ouvre **API**.
3. Récupère :
   - `Project URL` ;
   - `service_role key`.

Important : la `service_role key` ne doit jamais aller dans le navigateur. Elle doit rester uniquement dans Vercel, en variable serveur.

## 3. Configurer Vercel

Dans le projet Vercel de Crew_System :

1. utilise `apps/web` comme **Root Directory** ;
2. laisse Vercel détecter Next.js ;
3. ajoute ces variables :

```env
SUPABASE_URL=https://ton-projet.supabase.co
SUPABASE_SERVICE_ROLE_KEY=ta_service_role_key
GEMINI_API_KEY=ta_cle_google_ai_studio
GEMINI_MODEL=gemma-4-26b-a4b-it
GEMINI_RESPONSE_SCHEMA=false
```

Ne mets pas `CREW_API_URL` pour le mode Supabase. Quand `CREW_API_URL` est absent, l'interface utilise le backend Next.js interne disponible sur `/crew-api`.

Tu peux laisser `NEXT_PUBLIC_CREW_API_URL` absent aussi : l'interface utilise `/crew-api` par défaut.

## 4. Redéployer Vercel

Après avoir ajouté les variables :

1. Va dans **Deployments**.
2. Clique **Redeploy**.
3. Ouvre ton URL Vercel.

## 5. Tester

Teste d'abord :

```text
/crew-api/health
```

La réponse doit indiquer :

```json
{
  "ok": true,
  "service": "crew_system_cloud_api",
  "storage": "supabase"
}
```

Ensuite, dans l'interface :

1. crée un projet ;
2. envoie `Salut` ;
3. envoie une demande de travail réelle ;
4. ouvre les documents générés.

## 6. Limite actuelle assumée

Cette première version cloud exécute le job dans la requête Vercel au lieu d'un worker permanent. C'est volontaire : on évite les services payants.

La prochaine amélioration sera de découper les jobs longs en étapes relançables afin que l'interface puisse avancer agent par agent sans dépendre d'un serveur permanent.
