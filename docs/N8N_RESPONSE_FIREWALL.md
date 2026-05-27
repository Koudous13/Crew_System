# Firewall De Réponse n8n - Crew_System

## 1. Problème

Le modèle peut parfois renvoyer une sortie brute contenant :

- brouillons internes ;
- règles système ;
- variantes de réponse ;
- labels comme `Role`, `Constraint`, `Draft`, `Final Polish` ;
- détails techniques ;
- JSON ou résultats de tools.

Ces éléments ne doivent jamais arriver dans le chat utilisateur.

## 2. Décision

La sortie brute du Directeur n'est plus la réponse finale.

Architecture actuelle :

```text
When chat message received
  -> Directeur Crew_System
  -> Public Response Composer
  -> Public Response Leak Guard
  -> réponse visible dans le chat
```

Le `Chat Trigger` reste en mode :

```text
responseMode = lastNode
```

Donc la réponse visible vient du dernier node `Public Response Leak Guard`.

## 3. Rôle Des Nodes

### Directeur Crew_System

Le Directeur comprend la demande, appelle les tools et décide quoi faire.

Il peut produire une sortie brute imparfaite.

Cette sortie est considérée comme privée par défaut.

### Public Response Composer

Node Code déterministe.

Il extrait le vrai bloc final public depuis la sortie du Directeur.

Il cherche notamment :

- le premier bloc non interne après les notes internes ;
- les réponses finales placées après un label ;
- les citations finales utilisables si aucun bloc clair n'existe.

Il ne reformule pas avec un deuxième LLM, parce qu'un deuxième LLM peut lui aussi laisser sortir son raisonnement.

### Public Response Leak Guard

Node Code déterministe.

Il bloque la réponse si elle contient :

- `User input` ;
- `Role:` ;
- `Constraint:` ;
- `Context:` ;
- `Goal:` ;
- `Rule:` ;
- `Draft` ;
- `Final Polish` ;
- `system instructions` ;
- `workflow JSON` ;
- `n8n-nodes` ;
- `cs_supabase_` ;
- `credential` ;
- phrases internes de tools en anglais, par exemple `I should...`, `The file...`, `The search result...` ;
- JSON brut.

Si une fuite est détectée, il renvoie une réponse neutre et sûre.

Mise à jour de robustesse :

- le guard ne supprime plus une ligne uniquement parce qu'elle commence par `*` ou `-` ;
- les vraies puces Markdown publiques sont conservées ;
- seules les puces contenant des signaux internes (`Draft`, `Final check`, `No JSON`, `Checked`, etc.) sont retirées ;
- objectif : garder la lisibilité des documents et synthèses sans laisser sortir les notes internes.

## 4. Tests Validés

### Réponse courte

```text
Demande : Réponds juste: OK. N’utilise aucun outil.
Réponse : OK.
Statut : succès.
Fuite détectée : non.
```

### Tool Supabase

```text
Demande : Utilise Supabase pour lister les projets connus.
Réponse : École 229
Statut : succès.
Fuite détectée : non.
```

### Conversation

```text
Demande : Tu veux les informations qu’il faut ?
Réponse : réponse conversationnelle complète avec les questions de cadrage.
Statut : succès.
Fuite détectée : non.
```

### Puces Markdown

```text
Entrée publique :
Voici la structure :
* 00_STRATÉGIE
* 01_CONTENU
* 02_GROWTH

Résultat attendu :
les puces sont conservées.

Entrée polluée :
* Drafting the response
* Final check
* 00_STRATÉGIE

Résultat attendu :
les lignes internes sont retirées, la vraie structure reste visible.
```

## 5. Règle Pour La Suite

Aucun nouveau flux utilisateur ne doit exposer directement la sortie d'un agent.

Toute réponse chat doit passer par :

```text
Agent privé
  -> composition publique
  -> leak guard déterministe
  -> sortie utilisateur
```

Pour les futurs sous-agents, leurs sorties doivent rester des handoffs internes.

Le Directeur ou un composeur public doit transformer ces handoffs en réponse lisible.

## 6. Sources De Décision

- n8n Chat Trigger : le mode `lastNode` permet de contrôler le node qui répond.
- n8n Basic LLM Chain : utile pour composer une réponse, mais un LLM reste faillible.
- n8n Structured Output Parser : utile pour structurer, mais moins fiable directement avec des agents à tools.
- OWASP LLM guidance : ne pas dépendre uniquement du prompt pour empêcher les fuites.
