# Football API

Standalone REST API for managing football teams, leagues, seasons, matches, live match lifecycle, deterministic match simulation, match events, standings, and control dashboard data. Designed to remain decoupled from the control frontend and future MQTT broker services.

## Tech Stack

- **Runtime**: Node.js + TypeScript (strict mode)
- **Framework**: Express 5
- **Database**: MongoDB (Atlas or local) + Mongoose
- **Validation**: Zod
- **Security**: JWT (`jsonwebtoken`) + Password Hashing (`bcryptjs`) + Role-based Admin guard
- **Documentation**: OpenAPI 3.0.3 + Swagger UI (`/api/docs`)
- **Testing**: Node built-in test runner (`node:test`) + `tsx` + `mongodb-memory-server` (isolated replica set)

## Architecture

```text
football-api/
├── src/
│   ├── config/          # MongoDB connection & health check
│   ├── docs/            # OpenAPI 3.0.3 specification
│   ├── middleware/      # Auth, 404, and central error handlers
│   ├── modules/
│   │   ├── auth/        # User model, JWT auth, register/login/me
│   │   ├── dashboard/   # Control app overview & feed endpoints
│   │   ├── leagues/     # Leagues & seasons CRUD
│   │   ├── match-events/# Match events + transactional score recalculation
│   │   ├── matches/     # Matches CRUD, lifecycle state machine & simulation engine
│   │   ├── standings/   # League table calculation
│   │   └── teams/       # Teams CRUD
│   ├── routes/          # Central /api router + /health + /docs
│   ├── scripts/         # seed-admin.ts & optional seed-demo.ts
│   ├── utils/           # AppError, pagination, validation, transactions
│   ├── app.ts
│   └── server.ts
├── tests/               # Isolated integration tests
├── .env.example
├── package.json
└── tsconfig.json
```

## Installation & Environment

```bash
cd football-api
npm install
cp .env.example .env
```

| Variable | Required | Description |
| --- | --- | --- |
| `PORT` | No | HTTP server port (default: `3000`) |
| `NODE_ENV` | No | `development`, `test`, or `production` |
| `MONGODB_URI` | Yes | MongoDB Atlas or local connection string |
| `CORS_ORIGIN` | No | Allowed CORS origin(s), comma-separated or `*` |
| `JWT_SECRET` | Yes | Strong secret key (>= 16 chars, recommended >= 32 chars) |
| `JWT_EXPIRES_IN` | No | Token lifetime (default: `1d`) |
| `ADMIN_NAME` / `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Seed only | Used exclusively by `npm run seed:admin` |

## Running & Testing

```bash
npm run seed:admin   # Bootstrap initial admin from env vars
npm run dev          # Development server (port 3000)
npm run typecheck    # TypeScript strict check
npm run build        # Compile to dist/
npm start            # Run production build
npm test             # Isolated in-memory replica set integration tests (never touches Atlas)
```

## Match Simulation Mode

### Architecture & Determinism
- Matches with `isSimulation: true` use a deterministic **Mulberry32** PRNG seeded via FNV-1a hash of `simulationSeed` (zero `Math.random()` usage).
- The full event schedule (`kickoff`, 1st-half events, `halftime`, `second_half`, 2nd-half events, `fulltime`) is persisted on the `Match` document with per-step `executed` flags.
- Every simulated transition and event delegates strictly to the existing `match-lifecycle.service` and `match-events` services, preserving transactional score calculation and validation.
- Simulated `MatchEvent` documents carry `isSimulated: true` and a unique partial index on `(match, simulationStepId)` to guarantee database-level idempotency.

### Configuration Options & Defaults

| Parameter | Default | Range | Description |
| --- | --- | --- | --- |
| `simulationSpeed` | `10` | `1`–`120` | Speed multiplier for minute progression |
| `matchDuration` | `90` | `10`–`120` | Match length in minutes |
| `eventFrequency` | `12` | `2`–`30` | Target number of generated events (<= `matchDuration`) |
| `goalProbability` | `0.22` | `0`–`1` | Probability weight for goals / penalties / own goals |
| `cardProbability` | `0.38` | `0`–`1` | Probability weight for yellow / red cards |
| `substitutionProbability` | `0.32` | `0`–`1` | Probability weight for 2nd-half substitutions |
| `maxSubstitutionsPerTeam` | `5` | `0`–`7` | Maximum substitutions allowed per team |

*Constraint*: `goalProbability + cardProbability + substitutionProbability <= 1.0`.

### Lifecycle, Standings & Recovery
- **Statuses**: `idle` → `running` ↔ `paused` → `completed` (reached fulltime) or `stopped` (halted early).
- **Standings Isolation**: Only simulations that reach `fulltime` (`status: 'finished'`, `simulationStatus: 'completed'`) affect league standings. Calling `/simulation/stop` cancels the match (`status: 'cancelled'`, `simulationStatus: 'stopped'`) so premature stops never contaminate standings.
- **Recovery**: On server boot, `recoverRunningSimulations()` re-attaches workers for any `running` simulations without duplicating already-executed steps.
- **Known Limitations**: Simulation workers run in-process on a single Node.js instance (for multi-instance horizontal scaling, a distributed lock/queue would be added in a future phase).

### Simulation Endpoints
- `GET /api/matches/:id/simulation`
- `POST /api/matches/:id/simulation/start` *(Admin)*
- `POST /api/matches/:id/simulation/pause` *(Admin)*
- `POST /api/matches/:id/simulation/resume` *(Admin)*
- `PATCH /api/matches/:id/simulation/speed` *(Admin)*
- `POST /api/matches/:id/simulation/next` *(Admin)*
- `POST /api/matches/:id/simulation/stop` *(Admin)*
- `POST /api/matches/:id/simulation/reset` *(Admin)*

## API Documentation (Swagger)
- **Swagger UI**: `http://localhost:3000/api/docs`
- **OpenAPI JSON**: `http://localhost:3000/api/docs.json`
