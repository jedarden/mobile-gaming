# Level `difficulty` convention

Levels carry a **numeric** `difficulty`. The tier name (`easy` / `medium` /
`hard`) is an *input* to the generators and appears in level IDs, but it is not
what gets stored on the level.

```js
// generator signature — tier name in
generateLevel(seed, 'medium', 0)

// level object — number out
{ id: 'mg-gen-medium-0-100', difficulty: 2, ... }
```

The mapping is `easy → 1`, `medium → 2`, `hard → 3`, written inline in each
generator. `pull-the-pin/generator.js` and `scripts/gen-new-game-levels.js` are
the reference implementations.

## Why this is worth writing down

`difficulty` has **four** producers, and they must agree:

| producer | where |
|---|---|
| static level files | `levels/<game>/*.json` |
| pre-generated levels | `src/games/<game>/levels.json` |
| runtime generator | `src/games/<game>/generator.js` |
| the schema that validates them all | `schemas/<game>.schema.json` |

On 2026-08-02 `merge-games` and `satisfying-asmr` had schemas demanding
`{"type": "string", "enum": ["easy","medium","hard"]}` while their static level
files stored integers. `npm run test:levels` failed with 25 errors and exited 1,
which blocked every deploy of this repo.

The first fix changed only the schemas, which made the static files pass and
immediately broke the other two producers — CI then failed on
`tests/integration/schema-validation.test.js` with
`mg-gen-easy-0-1: .difficulty should be integer`. **Changing one producer
without the other three just moves the failure.**

Not every game uses the same scale, so check the game's own schema before
assuming:

| game | `difficulty` |
|---|---|
| most games | `integer` 1–10 |
| `parking-escape` | `integer` 1–10, derived from BFS solve cost |
| `water-sort`, `bus-jam` | `number` 0.0–1.0 normalized |
| `bridge-race` | not defined in its schema |

## Before changing anything about `difficulty`

Run both gates locally. `npm test` alone is not enough — it does not run the
level generators over every tier:

```bash
npx vitest run        # expect 121 files, 5378 tests
npm run test:levels   # expect Schema 330/0, Generator 31 tiers/0, exit 0
```

> `vitest.config.js` sets `bail: 1`, so a failing run reports only the **first**
> failing file. "One failure" never means "one failure" — fix it and run again
> until the suite is green, rather than assuming the count.
