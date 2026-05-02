## Bug
`POST /rest/v1/catalogues` renvoie 400 car `organization_id` (NOT NULL depuis la migration multi-tenant) n'est pas fourni à l'INSERT.

## 1. Nouveau helper `src/lib/auth.ts`

```ts
export async function getCurrentOrgId(): Promise<string | null>
export function clearCurrentOrgIdCache(): void
```

- Cache module-level (`let cached: string | null | undefined`).
- Lookup : `auth.getUser()` → `organization_members.select('organization_id').eq('user_id', user.id).limit(1).maybeSingle()` → renvoie le 1er org (Super Admin Hub & Up : on prendra le premier, sélecteur d'org plus tard).
- Sur `null` (pas de user / pas de membership) → renvoie null sans throw, met le cache à null.
- Listener `supabase.auth.onAuthStateChange` au chargement du module : invalide le cache sur `SIGNED_OUT` et `USER_UPDATED`.

## 2. `src/pages/admin/AdminCatalogues.tsx`

**Bouton "Ajouter"** (l. ~135) :
- Avant l'INSERT : `const orgId = await getCurrentOrgId()`. Si null → toast `"Aucune organisation associée à votre compte. Contactez l'administrateur."` + `console.error` + abort.
- Ajouter `organization_id: orgId` au payload.
- En cas d'erreur retour Supabase : `console.error("Insert catalogue failed", error)` (objet complet) + toast existant.

**`handleSave`** (l. ~88) :
- Si `editing.isNew` → résoudre `orgId` comme ci-dessus, l'inclure dans le payload INSERT.
- Si update → ne pas toucher à `organization_id`.
- `console.error` sur échec.

## 3. `src/components/admin/CatalogueWorkflowDialog.tsx`

- `logRejection` (l. 170) : déjà OK (utilise `orgIdRef` chargé depuis le catalogue lui-même). Garder, mais `console.error` au lieu de `console.warn` sur échec INSERT.
- `statsRows` INSERT (l. 1217) : ajouter `organization_id: orgIdRef.current` à chaque row (skip l'INSERT si orgIdRef est null + `console.error`). `console.error` détaillé sur erreur.
- Autres `update` sur `catalogues` (l. 314, 1224) : pas de changement, l'org ne bouge pas en update.
- Sauvegarde brouillon `catalogue_extractions` (l. 242) : la table a `organization_id NOT NULL` → ajouter `organization_id: orgIdRef.current` au payload upsert. Si null → skip + `console.error`.

## 4. Edge function `supabase/functions/extract-catalogue-promos/index.ts`

Audit des INSERT serveur :
- L. 449 (`catalogue_extraction_stats`) : `organization_id: organizationId` déjà présent ✅.
- Lectures `catalogue_extraction_rejections` (l. 201) : c'est un `.select`, pas un INSERT → OK.
- Pas d'INSERT manquant détecté côté edge function.

→ **Aucun changement nécessaire** dans l'edge function. Pas de redéploiement.

## 5. Logging d'erreurs (transverse)

Sur tous les `INSERT/UPDATE` patchés ci-dessus, le `catch`/branch erreur fait :
```ts
console.error("[<context>] Supabase error", { message: error.message, code: error.code, details: error.details, hint: error.hint });
```
en plus du toast utilisateur existant.

## Fichiers touchés

- **Nouveau** : `src/lib/auth.ts`
- **Modifié** : `src/pages/admin/AdminCatalogues.tsx`
- **Modifié** : `src/components/admin/CatalogueWorkflowDialog.tsx`

Pas de migration DB, pas de changement edge function, pas de changement de types.

## Test manuel attendu après implém

1. `/admin/catalogues` → "Ajouter" → catalogue créé sans 400, ouvre directement le workflow.
2. Workflow extraction → publication → pas d'erreur sur `catalogue_extraction_stats` ni `catalogue_extractions` (autosave brouillon).
3. Rejet de bbox dans le workflow → INSERT rejection OK (déjà fonctionnel mais logs nettoyés).
4. Si on simule un user sans membership : toast clair au lieu de 400 silencieux.