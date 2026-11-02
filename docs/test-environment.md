# Test environment verification

Verified on 10/30/26. The workflow reaches a shoppable Instacart development list; publishing the adapter fix to the deployed app remains pending approval for its container restart.

## Scope and results

| Check | Evidence |
|---|---|
| Deployed app | Healthy container on VM 110; upstream health 200; unauthenticated public request redirects to Cloudflare Access (302). |
| Google account | Existing browser session displays the signed-in owner and saved household. Fresh OAuth login and second-adult sharing were not exercised. |
| Configuration | Google, Meta and Instacart credentials already present. Inspected presence and lengths only. Instacart environment confirmed development. No keys created, copied or changed. |
| Household scaling | Local test household changed from 3.35 to 4.35 servings when one adult was added. Saved account was not changed. |
| Typed meals | Local fixture tacos asks beef/chicken/fish, then adds Chicken Tacos. Separate deployed Meta request for Lemon chicken with quinoa and zucchini returned 200 and nine ingredients. |
| Review | Custom meal changes local cart from 19 to 23 ingredients; Have it reduces it to 22, add back restores 23. |
| Keyless shopping | Local Shop returns preview and Copy the list changes to Copied. |
| Instacart | Original adapter returned a development URL but incorrect product quantities. Final adapter request returns 200 and renders all 19 expected ingredients at Ralphs. |
| Sandbox cart | Add 19 items to cart reaches the development Ralphs cart. Reconciled all 19 cart product names against the matched shopping-list products, with 19 quantity rows, zero duplicates and zero unmatched products. Chicken remains one pack, tortillas two packs and salmon three portions. Stopped before checkout. |
| Linked dashboards | Instacart and Meta developer dashboards show development credentials for this project. Inspected readiness only, without displaying credential values. |
| Consumer family account | Existing consumer sign-in resolves successfully. Account settings exposes Family Account management and family-cart information. Read-only inspection; no invitations, membership changes or live cart additions. |
| Count reconciliation | Demo engine produces 19 unique ingredient names. Final request has those same 19 names in order, no duplicates, no omitted ingredients. Instacart shows Add 19 items to cart and all 19 full-list entries. |
| Final quantities | Chicken 56.95 oz selects one approximately 3.98 lb pack; tortillas 20 each selects two 10-count packs; salmon 20.1 oz with three-pack fallback selects three portions; sour cream 6.7 oz selects one 14 oz tub. |
| Automated gates | 34 tests pass, ESLint passes, TypeScript passes, standard Next.js production build passes. |

## Adapter decision

The old request put catalog package counts before physical amounts. These are estimates and can differ from the retailer's product. Package-first measurements undercounted tortillas and overbought chicken. Sending fractional each values also selected 14 tortilla packs for 13.4 tortillas, even without display text.

Send whole purchased item counts for counted multipacks, required physical amounts first for measured ingredients, and estimated package counts second for products without weight metadata (observed with salmon). Omit custom display text so Instacart displays its own measurements. Keep local pack estimates and the plain-text fallback unchanged. Store selections still require review.

An independent review identified the fractional-count verification gap and recommended whole-count testing and fixed expected values in regression tests. Final full-list browser testing covers the revised request, including the pack fallback.

## Reproduction

1. Run `npm ci --ignore-scripts`, then `npm test`, `npm run lint`, `npm run typecheck`, and `npm run build`.
2. Run the local app with no credentials and exercise setup, custom tacos clarification, review exclusions and copy fallback. Use a separate browser origin from the deployed app.
3. Generate a request with `buildShoppingList(cartFor(DEMO_STATE).lines, { title: "Test week" })`. Reconcile every name and count against the engine before sending.
4. Submit only to the Instacart development server with the existing server-side key. Open the returned URL; wait for all product matching to finish. Check all 19 identities and representative quantities, not just HTTP success.

The sandbox list used for this check expired after seven days and is not linked here.
