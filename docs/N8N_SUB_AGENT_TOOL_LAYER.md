# Couche Sous-Agents n8n - Crew_System

## 0. Mise à Jour Importante

Les sous-agents ne sont plus des `workflowJson` cachés dans le workflow principal.

Chaque agent est maintenant un vrai sub-workflow visible et appelable par ID :

```text
CS_AGENT_FILE_ARCHITECT
CS_AGENT_STRATEGIST
CS_AGENT_AUDIENCE_PSYCHOLOGIST
CS_AGENT_GROWTH_HACKER
CS_AGENT_HOOK_MASTER
```

## 0.1 Deuxieme Vague Production

Les sous-agents suivants sont maintenant crees comme vrais sub-workflows n8n separes et exposes au Directeur comme tools :

```text
cs_agent_calendar_architect  -> CS_AGENT_CALENDAR_ARCHITECT  -> ZrYnC5h62cxTnNG7
cs_agent_facebook_native     -> CS_AGENT_FACEBOOK_NATIVE     -> bMyHsvzbOcSq2er2
cs_agent_linkedin_native     -> CS_AGENT_LINKEDIN_NATIVE     -> XIcYN5ox2pf8BXxr
cs_agent_copywriter          -> CS_AGENT_COPYWRITER          -> wkpAuT6QUUbB5d8D
cs_agent_creative_director   -> CS_AGENT_CREATIVE_DIRECTOR   -> fcK2074Gtm0IDcsE
```

Contrat technique commun :

```text
When called by Directeur
  -> Prepare Agent Input
  -> Basic LLM Chain / Gemini
  -> Validate Agent Response
```

Chaque workflow contient aussi un `Structured Output Parser` visible sur le canvas, non bloquant, avec exemple de schema. La validation fiable reste faite par `Validate Agent Response`.

## 0.2 Roles De La Deuxieme Vague

### cs_agent_calendar_architect

Transforme une strategie en sequence editoriale longue : arcs, mois, semaines, objectifs psychologiques, mecanismes growth, production et mesure.

A utiliser pour :

- calendrier annuel ;
- sequence trimestrielle ;
- architecture de campagne longue ;
- planification avant production de batchs.

Note runtime : cet agent est lent avec le modele gratuit actuel. Il doit etre privilegie dans les jobs asynchrones pour les vrais calendriers.

### cs_agent_facebook_native

Adapte une strategie a Facebook : proximite, emotion, conversation, formats natifs, visuels utiles et dynamique communautaire.

### cs_agent_linkedin_native

Adapte une strategie a LinkedIn : autorite, preuve, point de vue professionnel, reputation et conversion douce.

### cs_agent_copywriter

Redige les contenus finaux apres strategie, audience, growth, hooks et adaptation plateforme.

### cs_agent_creative_director

Decide si un visuel sert vraiment le contenu et produit une direction creative exploitable : role du visuel, composition, assets, limites de preuve.

## 0.3 Tests Deuxieme Vague

Tests directs via le chat natif n8n :

```text
Copywriter          : succes, format_valid=true
Facebook Native     : succes, format_valid=true
LinkedIn Native     : succes, format_valid=true
Creative Director   : succes, format_valid=true
Calendar Architect  : succes, format_valid=true, mais lent
```

Test worker asynchrone route :

```text
job_mpnq3t97_0f0a800c
Demande : 2 publications Facebook + 1 publication LinkedIn + brief visuel.
Agents appeles : strategist, audience_psychologist, growth_hacker, hook_master, facebook_native_agent, linkedin_native_agent, copywriter, creative_director.
Resultat : completed, 100%, document Drive cree.
```

Corrections appliquees :

```text
Credential Gemini ajoute sur les nouveaux agents.
Le garde-fuite public preserve les reponses Markdown propres et retire les notes internes.
Les validateurs acceptent maintenant ready_to_handoff comme sortie exploitable.
```

Decision actuelle :

```text
Les nouveaux agents sont disponibles pour le Directeur.
Ils sont maintenant integres dans le worker asynchrone deterministe.
Le worker route les jobs selon leur type :
- strategy_brief : strategist + audience + growth + hook si utile
- annual_calendar : strategist + audience + growth + plateformes natives + calendar_architect
- content_batch : strategist + audience + growth + hook + platform native + copywriter + creative_director
- creative_batch : strategist + audience + growth + hook + creative_director
La reprise ciblée utilise les mêmes familles d'agents et saute les checkpoints déjà completed.
```

Le Directeur garde les mêmes tools :

```text
cs_agent_file_architect
cs_agent_strategist
cs_agent_audience_psychologist
cs_agent_growth_hacker
cs_agent_hook_master
```

Mais chaque tool pointe maintenant vers un workflow n8n séparé, pas vers un JSON intégré.

Point important sur `Require Specific Output Format` :

- le paramètre a été testé sur les `Basic LLM Chain` ;
- les `Structured Output Parser` et `Gemini AutoFix Model` existent dans les workflows agents ;
- avec le modèle gratuit Gemma actuel, l'activation bloquante du parser casse certains runs à cause de la couche LangChain/prompt-template ;
- donc, en production, le parser reste visible mais non bloquant ;
- la validation fiable est faite par le noeud `Validate Agent Response`, qui extrait le dernier JSON valide, normalise les petites erreurs et retourne `format_valid`.

Décision actuelle :

```text
Production : Basic LLM Chain -> Validate Agent Response
Parser structuré : conservé sur le canvas, prêt à réactiver quand le modèle/provider sera compatible
```

## 1. Décision

La première vague de sous-agents Crew_System est maintenant branchée dans le workflow n8n principal :

```text
CS_CHAT_DIRECTOR_NATIVE
```

Ces sous-agents sont exposés au Directeur comme tools internes via `Call n8n Workflow Tool`.

Raison :

- garder le canvas principal lisible ;
- éviter de multiplier les workflows visibles trop tôt ;
- donner au Directeur de vrais agents appelables ;
- conserver une sortie structurée exploitable sans exposer le JSON à Koudous.

## 2. Statut

```text
Workflow : CS_CHAT_DIRECTOR_NATIVE
Sous-agents branchés : 5
Connexion ai_tool vers le Directeur : oui
Chaque tool appelle un sub-workflow visible : oui
Modèle utilisé : Gemini/Gemma configuré dans n8n
Réponse directe à Koudous : non, handoff au Directeur uniquement
Test 1 agent : succès
Test 5 agents synchrones : succès
Validation format agent : oui, via Validate Agent Response
```

## 3. Sous-Agents Actifs

```text
cs_agent_file_architect
cs_agent_strategist
cs_agent_audience_psychologist
cs_agent_growth_hacker
cs_agent_hook_master
```

## 4. Rôle De Chaque Sous-Agent

### cs_agent_file_architect

Conçoit le plan durable de dossiers, documents, versioning, fichiers à lire et fichiers à créer.

À appeler pour :

- nouveau projet ;
- structuration documentaire ;
- création de dossier Drive ;
- préparation d'une base stratégique durable ;
- révision qui doit créer une nouvelle version.

### cs_agent_strategist

Produit le diagnostic stratégique : problème caché, perception à changer, décision à déclencher, levier principal et big idea.

À appeler pour :

- base stratégique ;
- campagne ;
- calendrier annuel ;
- contenu de fond ;
- arbitrage entre plusieurs angles.

### cs_agent_audience_psychologist

Cartographie les tensions humaines : douleurs visibles, douleurs cachées, ambitions, peurs, objections, désirs de statut, langage et phrases déclencheuses.

À appeler pour :

- stratégie audience ;
- hooks ;
- contenus émotionnellement précis ;
- repositionnement ;
- révision de ton.

### cs_agent_growth_hacker

Conçoit les boucles growth, les mécanismes d'amplification, les chemins conversationnels, les lead magnets, les expériences et les mesures.

À appeler pour :

- stratégie de domination Facebook/LinkedIn ;
- calendrier avec intention d'acquisition ;
- batch de contenus orienté conversion ;
- système de commentaires/DM ;
- expérimentation.

### cs_agent_hook_master

Crée, score et sélectionne des accroches puissantes mais défendables.

À appeler pour :

- batch de contenus ;
- scripts vidéo ;
- visuels scroll-stopper ;
- amélioration des premières lignes ;
- tests A/B d'accroches.

## 5. Contrat D'Entrée Commun

Chaque sous-agent reçoit au minimum :

```text
user_request
```

Et peut recevoir :

```text
project_slug
normalized_brief
context_summary
previous_agent_outputs
platform_context
constraints
expected_output
language
```

Le Directeur doit préparer le contexte avant d'appeler un sous-agent.

### Contexte Obligatoire Pour `le_robot`

Pour tout travail concernant Koudous, Le Robot, Facebook, LinkedIn, n8n, Python, automatisation, PME ou solopreneurs, le Directeur doit injecter un contexte stable avant chaque appel de sous-agent.

Contexte minimal à transmettre :

```text
project_slug: le_robot
Porteur : Koudous DAOUDA
Marque / surnom : Le Robot
Expertise : automatisation n8n, automatisation Python, systèmes IA, applications web
Cibles : PME, solopreneurs, entrepreneurs
Plateformes : Facebook et LinkedIn
Angle : automatiser l'ennuyeux, réduire le chaos opérationnel, libérer le business des tâches répétitives
Ton : direct, premium, minimaliste, concret
```

Règle anti-amnésie :

- un sous-agent ne doit plus redemander ce qu'est Le Robot ;
- il ne doit plus demander si la cible est PME/solopreneurs ;
- il ne doit plus demander si l'expertise est l'automatisation ;
- il peut seulement demander les détails encore inconnus : prix, offre packagée exacte, capacité de traitement, lead magnet, CTA final, niche sectorielle ou volume.

Test validé :

```text
Chantier complet Le Robot
Agents appelés : 5/5
Formats valides : 5/5
Statuts : success sur les 5 agents après injection du contexte obligatoire
```

## 6. Contrat De Sortie Commun

Chaque sous-agent doit retourner :

```text
agent_id
status
handoff_summary
questions_for_director
self_evaluation
```

Il peut ensuite ajouter ses sections métier :

- `strategic_diagnosis`
- `audience_intelligence`
- `growth_diagnosis`
- `hook_families`
- `project_file_plan`
- etc.

Le Directeur ne doit pas montrer ces sorties brutes à Koudous.
Il doit les synthétiser en français lisible.

## 7. Règles Du Directeur

Le Directeur doit :

- choisir les agents selon la demande, pas tous par réflexe ;
- appeler `file_architect` avant une structuration de projet ;
- appeler `strategist` avant une stratégie, un calendrier ou une campagne ;
- appeler `audience_psychologist` quand il faut de la psychologie, des hooks ou du contenu ;
- appeler `growth_hacker` quand la demande parle de domination, acquisition, viralité, conversation ou amplification ;
- appeler `hook_master` quand il faut produire ou améliorer des accroches ;
- créer ou mettre à jour un job Supabase pour les travaux lourds ;
- créer un document Markdown Drive quand un livrable durable est prêt ;
- indexer le document dans Supabase.

## 8. Ordre Recommandé Pour Une Base Stratégique

```text
1. Supabase : charger ou créer le projet
2. Drive : chercher/créer le dossier projet
3. cs_agent_file_architect
4. cs_agent_strategist
5. cs_agent_audience_psychologist
6. cs_agent_growth_hacker
7. Directeur : synthèse
8. Drive : document Markdown lisible
9. Supabase : index du document + décision
```

## 9. Ordre Recommandé Pour Des Hooks Ou Posts

```text
1. Supabase : charger contexte projet
2. Drive : lire documents stratégiques utiles
3. cs_agent_strategist si l'angle n'est pas clair
4. cs_agent_audience_psychologist si l'audience ou la tension manque
5. cs_agent_hook_master
6. cs_agent_facebook_native ou cs_agent_linkedin_native selon la plateforme
7. cs_agent_copywriter pour la redaction finale
8. cs_agent_creative_director si le contenu demande un visuel ou une video
9. Directeur : synthèse humaine ou lancement d'un job asynchrone si le volume est lourd
```

## 10. Limite Actuelle

La première vague donne le squelette stratégique.

Un test synchrone avec les 5 sous-agents a fonctionné, mais il est lent car chaque sous-agent lance son propre passage LLM.

Conclusion d'architecture :

```text
Les runs courts peuvent rester conversationnels.
Les runs lourds doivent devenir des jobs asynchrones avec progress events Supabase.
```

Les agents suivants restent a brancher dans n8n :

```text
anti_banality_agent
risk_reviewer
video_agent
performance_analyst
```

La deuxieme vague production est deja branchee : copywriter, facebook_native_agent, linkedin_native_agent, calendar_architect et creative_director.

## 11. Format De Sortie Et Robustesse

Chaque sub-workflow agent suit maintenant ce flux :

```text
When called by Directeur
  -> Prepare Agent Input
  -> Basic LLM Chain
  -> Validate Agent Response
```

Le noeud `Validate Agent Response` fait le vrai contrôle opérationnel :

- il extrait le dernier objet JSON valide si le modèle a écrit des notes avant ;
- il vérifie `agent_id`, `status`, `handoff_summary`, `questions_for_director`, `self_evaluation` ;
- il vérifie les champs métier obligatoires propres à l'agent ;
- il normalise les petites erreurs fréquentes, par exemple `self_evaluation` en texte ;
- il accepte un statut `needs_context` sans transformer cela en erreur système ;
- il retourne `ok`, `format_valid`, `missing_required_fields`, `invalid_reasons`, `parse_strategy`, `output`.

Le Directeur ne doit jamais montrer ces champs techniques à Koudous.
Il doit transformer le handoff en réponse humaine ou en question métier.

## 12. Tests Validés

### Test Sous-Agent Unique

Demande :

```text
Appeler uniquement cs_agent_strategist pour analyser le positionnement de Koudous DAOUDA / Le Robot.
```

Résultat :

```text
Succès.
Le sub-workflow CS_AGENT_STRATEGIST a tourné.
Le validateur a retourné format_valid=true.
Le Directeur a produit une synthèse française avec exactement 2 décisions stratégiques.
```

### Test Boucle 5 Sous-Agents

Demande :

```text
Appeler file_architect, strategist, audience_psychologist, growth_hacker et hook_master.
```

Résultat :

```text
Succès.
Les 5 exécutions agents sont passées.
Le Directeur a synthétisé les sorties.
```

Point corrigé après test :

```text
Le prompt Directeur a été durci pour respecter strictement les formats demandés par Koudous :
nombre exact d'éléments, sections, hooks, prochaine action, longueur, etc.
```

### Test Require Specific Output Format

Résultat :

```text
Testé.
Structured Output Parser ajouté sur les workflows agents.
AutoFix Model ajouté.
Mode bloquant désactivé en production avec Gemma actuel.
Cause : conflit LangChain/prompt-template et erreurs INVALID_PROMPT_INPUT.
Solution retenue : validation Code robuste non bloquante + parser conservé pour réactivation future.
```
