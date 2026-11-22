# Football API

Standalone REST API for managing football teams, leagues, seasons, matches, live match lifecycle, match events, standings, and control dashboard data. Designed to remain decoupled from the control frontend and future MQTT broker services.

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
│   │   ├── matches/     # Matches CRUD + lifecycle state machine
│   │   ├── standings/   # League table calculation
│   │   └── teams/       # Teams CRUD
│   ├── routes/          # Central /api router + /health + /docs
│   ├── scripts/         # Admin bootstrap script (seed-admin.ts)
│   ├── utils/           # AppError, pagination, validation, transactions
│   ├── app.ts
│   └── server.ts
├── tests/               # Isolated integration tests
├── .env.example
├── package.json
└── tsconfig.json
```

## Installation

```bash
cd football-api
npm install
```

## Environment Variables & MongoDB Atlas Setup

Copy `.env.example` to `.env` and fill in your values:

```bash
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
| `ADMIN_NAME` | Seed only | Name for initial admin user |
| `ADMIN_EMAIL` | Seed only | Email for initial admin user |
| `ADMIN_PASSWORD` | Seed only | Password (>= 8 chars) for initial admin user |

### Bootstrapping the First Admin Account

Never hardcode admin credentials. Set `ADMIN_NAME`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD` in your environment and run:

```bash
npm run seed:admin
```

## Running the Project

### Development
```bash
npm run dev
```

### Typecheck & Production Build
```bash
npm run typecheck
npm run build
npm start
```

### Running Tests
Tests automatically run against an isolated in-memory MongoDB replica set (`mongodb-memory-server`) and **never** touch your MongoDB Atlas production database.

```bash
npm test
```

## API Documentation (Swagger)

Once the server is running:
- **Swagger UI**: `http://localhost:3000/api/docs`
- **OpenAPI JSON**: `http://localhost:3000/api/docs.json`

## Key Endpoints

- **Health**: `GET /api/health`
- **Auth**: `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`
- **Teams**: `GET/POST /api/teams`, `GET/PATCH/DELETE /api/teams/:id`
- **Leagues & Seasons**: `GET/POST /api/leagues`, `GET/PATCH/DELETE /api/leagues/:id`, `GET/POST /api/leagues/:id/seasons`, `PATCH/DELETE /api/leagues/:id/seasons/:seasonId`
- **Standings**: `GET /api/leagues/:id/standings?season=<seasonId>`
- **Matches**: `GET/POST /api/matches`, `GET /api/matches/{today,upcoming,live,finished}`, `GET /api/matches/team/:teamId`, `GET/PATCH/DELETE /api/matches/:id`
- **Match Lifecycle (Admin)**: `POST /api/matches/:id/{start,halftime,resume,finish,postpone,cancel}`, `PATCH /api/matches/:id/{minute,score}`
- **Match Events**: `GET/POST /api/matches/:id/events`, `GET/PATCH/DELETE /api/matches/:id/events/:eventId`
- **Dashboard**: `GET /api/dashboard/{overview,live-matches,upcoming-matches,recent-results}`
