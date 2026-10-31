# Family Meal Planner

Pick the week's meals and say who is eating. Family Meal Planner works out exact grocery quantities for your household, merges shared ingredients across meals, rounds up to real pack sizes, and hands the list to your Instacart family cart. You check out in Instacart; the planner never places or pays for an order.

Built for the Meta Global AI Developer Hackathon (Indie track, Build for Your World).

## Try it

```
npm install
npm run dev
```

Open http://localhost:3000. With no keys set, the app runs in demo mode: a sample family of four (2 adults, one kid 4 to 10, one kid 11 to 18) and a planned week. Nothing to sign in to.

## How it works

The model reads meals; plain code does the math; adapters hand off the list.

| Piece | What it does | Where |
|---|---|---|
| Meal library | 33 family meals (6 breakfasts, 12 lunches, 15 dinners) with ingredients and per serving amounts | `src/data/meals.json`, `src/data/amounts.json` |
| Pack catalog | 73 grocery items with store section and pack size | `src/data/catalog.json` |
| Quantity engine | Weighs each age band, scales per serving amounts, converts units, merges across meals, rounds up to whole packs, keeps staples home, and records a trace for every line | `src/lib/engine` |
| Meal parser | Breaks a meal typed outside the library into ingredients per serving with Muse Spark, validated against a schema; asks a short question when a meal is ambiguous | `src/lib/parser.ts` |
| Instacart adapter | Builds one shopping list page per week through the Instacart Developer Platform; a copy the list fallback works with no key | `src/lib/instacart.ts` |
| Household store | Household, second adult and saved week, keyed by Google account id | `src/lib/store.ts` |

### The quantity math

Servings per meal = adults × 1.0 + kids 4 to 10 × 0.5 + kids 11 to 18 × 0.85 (all three multipliers are editable). Each ingredient's need is its per serving amount times those servings, summed over every meal that uses it, then rounded up to whole packs. The same week always produces the same cart; `npm test` covers the engine.

Leftover lunches add no groceries of their own; each adds a lunch's servings to the dinner it comes from. Takeout night adds nothing. Salt, pepper, olive oil, butter, garlic and dried herbs start as pantry staples and stay out of the cart until unticked.

### Google sign in

Sign in uses Auth.js with Google, asking only for openid, email and profile. The app keeps the Google account id, name and email; no passwords of its own and no access to Gmail, Calendar or Drive. The first person to sign in owns the household and can add a second adult by Google email.

## Configuration

Copy `.env.example` to `.env.local` and fill in what you need. Every setting is optional.

| Setting | Turns on |
|---|---|
| `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` | Google sign in and saved households |
| `MODEL_API_KEY` | Muse Spark for typed meals (Meta Model API, `muse-spark-1.3`) |
| `INSTACART_API_KEY`, `INSTACART_ENV` | Live Instacart shopping list links |

Without `MODEL_API_KEY`, typed meals replay sample parser answers in `src/data/parser-fixtures.json` (tacos, chicken tikka masala, shrimp stir fry). Those samples were written by hand to match the parser's schema; they are not recorded model output.

## Prior work

This is a new public codebase written during the hackathon. It shares its name and some ideas with the author's private family meal planner project, and the 33 preloaded meals and their ingredient lists come from that project's seed data (imported with `npm run import-meals`). Per serving amounts and pack sizes were drafted for this project and reviewed by hand.

## License

MIT

## Homelab test deploy

The `deploy/` folder and `.github/workflows/deploy.yml` follow the homelab app factory pattern. Each push to `main` builds `ghcr.io/jaccrocker/family-meal-planner:latest` on a GitHub hosted runner. VM 110 runs it from `deploy/compose-service.yml` behind NPM, the Cloudflare tunnel and Cloudflare Access at `meals.example.com`, and Watchtower pulls each new image. Runtime settings are listed in `deploy/runtime.env.example`; saved households live in a SQLite file on the `/data` volume.
