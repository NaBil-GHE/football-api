export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Football API',
    version: '1.0.0',
    description:
      'REST API for managing football teams, leagues, seasons, matches, live match lifecycle, match events, league standings, and control dashboard data.',
  },
  servers: [
    {
      url: '/api',
      description: 'API Base Path',
    },
  ],
  tags: [
    { name: 'Health', description: 'Server and database health status' },
    { name: 'Auth', description: 'Authentication and admin authorization' },
    { name: 'Teams', description: 'Football teams management' },
    { name: 'Leagues', description: 'Leagues, seasons, and standings' },
    { name: 'Matches', description: 'Match scheduling, querying, and lifecycle' },
    { name: 'Match Events', description: 'Goals, cards, substitutions, and VAR events' },
    { name: 'Dashboard', description: 'Control application overview endpoints' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
    schemas: {
      ErrorResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          error: {
            type: 'object',
            properties: {
              code: { type: 'string', example: 'VALIDATION_ERROR' },
              message: { type: 'string', example: 'Validation failed' },
              details: { type: 'array', items: { type: 'object' } },
            },
          },
        },
      },
      PaginationMeta: {
        type: 'object',
        properties: {
          page: { type: 'integer', example: 1 },
          limit: { type: 'integer', example: 20 },
          total: { type: 'integer', example: 42 },
          totalPages: { type: 'integer', example: 3 },
          hasNextPage: { type: 'boolean', example: true },
          hasPrevPage: { type: 'boolean', example: false },
        },
      },
      TeamInput: {
        type: 'object',
        required: ['name', 'shortName', 'country'],
        properties: {
          name: { type: 'string', example: 'Real Madrid' },
          shortName: { type: 'string', example: 'RMA' },
          country: { type: 'string', example: 'Spain' },
          logo: { type: 'string', format: 'uri', example: 'https://example.com/rma.png' },
          founded: { type: 'integer', example: 1902 },
          stadium: { type: 'string', example: 'Santiago Bernabeu' },
          description: { type: 'string', example: 'Spanish football club' },
        },
      },
      LeagueInput: {
        type: 'object',
        required: ['name', 'country'],
        properties: {
          name: { type: 'string', example: 'La Liga' },
          country: { type: 'string', example: 'Spain' },
          logo: { type: 'string', format: 'uri', example: 'https://example.com/laliga.png' },
          type: {
            type: 'string',
            enum: ['league', 'cup', 'tournament', 'friendly'],
            default: 'league',
          },
        },
      },
      SeasonInput: {
        type: 'object',
        required: ['name', 'startDate', 'endDate'],
        properties: {
          name: { type: 'string', example: '2025/2026' },
          startDate: { type: 'string', format: 'date-time', example: '2025-08-15T00:00:00.000Z' },
          endDate: { type: 'string', format: 'date-time', example: '2026-05-25T00:00:00.000Z' },
          current: { type: 'boolean', default: false },
        },
      },
      MatchInput: {
        type: 'object',
        required: ['league', 'season', 'homeTeam', 'awayTeam', 'kickoff'],
        properties: {
          league: { type: 'string', example: '65f1a2b3c4d5e6f7a8b9c0d1' },
          season: { type: 'string', example: '65f1a2b3c4d5e6f7a8b9c0d2' },
          homeTeam: { type: 'string', example: '65f1a2b3c4d5e6f7a8b9c0d3' },
          awayTeam: { type: 'string', example: '65f1a2b3c4d5e6f7a8b9c0d4' },
          kickoff: { type: 'string', format: 'date-time', example: '2026-11-22T19:00:00.000Z' },
          venue: { type: 'string', example: 'Santiago Bernabeu' },
          status: {
            type: 'string',
            enum: ['scheduled', 'live', 'halftime', 'finished', 'postponed', 'cancelled'],
            default: 'scheduled',
          },
          homeScore: { type: 'integer', minimum: 0, default: 0 },
          awayScore: { type: 'integer', minimum: 0, default: 0 },
          minute: { type: 'integer', minimum: 0, maximum: 150, default: 0 },
          round: { type: 'string', example: 'Matchday 12' },
        },
      },
      MatchEventInput: {
        type: 'object',
        required: ['team', 'type', 'minute'],
        properties: {
          team: { type: 'string', example: '65f1a2b3c4d5e6f7a8b9c0d3' },
          type: {
            type: 'string',
            enum: [
              'goal',
              'own_goal',
              'penalty',
              'yellow_card',
              'red_card',
              'substitution',
              'injury',
              'var',
              'other',
            ],
          },
          minute: { type: 'integer', minimum: 0, maximum: 150, example: 45 },
          addedTime: { type: 'integer', minimum: 0, maximum: 30, example: 2 },
          player: { type: 'string', example: 'Vinicius Jr' },
          playerIn: { type: 'string', example: 'Luka Modric' },
          playerOut: { type: 'string', example: 'Eduardo Camavinga' },
          description: { type: 'string', example: 'Right-footed shot from inside the box' },
        },
      },
      RegisterInput: {
        type: 'object',
        required: ['name', 'email', 'password'],
        properties: {
          name: { type: 'string', example: 'Control Viewer' },
          email: { type: 'string', format: 'email', example: 'viewer@example.com' },
          password: { type: 'string', minLength: 8, example: 'StrongPass123!' },
        },
      },
      LoginInput: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email', example: 'admin@example.com' },
          password: { type: 'string', example: 'StrongPass123!' },
        },
      },
    },
    parameters: {
      PageParam: {
        name: 'page',
        in: 'query',
        schema: { type: 'integer', minimum: 1, default: 1 },
      },
      LimitParam: {
        name: 'limit',
        in: 'query',
        schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
      },
      SortParam: {
        name: 'sort',
        in: 'query',
        description: 'Comma-separated fields, prefix with "-" for descending (e.g. -kickoff)',
        schema: { type: 'string' },
      },
    },
    responses: {
      BadRequest: {
        description: 'Validation error or invalid input',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
      },
      Unauthorized: {
        description: 'Missing or invalid JWT token',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
      },
      Forbidden: {
        description: 'Admin role required',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
      },
      NotFound: {
        description: 'Resource not found',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
      },
      Conflict: {
        description: 'Duplicate resource or referential integrity conflict',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
      },
    },
  },
  paths: {
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Check server and MongoDB health',
        responses: {
          '200': { description: 'Server and database healthy' },
          '503': { description: 'Database disconnected or unreachable' },
        },
      },
    },
    '/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Register a viewer user account',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/RegisterInput' } } },
        },
        responses: {
          '201': { description: 'User registered and JWT issued' },
          '400': { $ref: '#/components/responses/BadRequest' },
          '409': { $ref: '#/components/responses/Conflict' },
        },
      },
    },
    '/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Authenticate and obtain JWT access token',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginInput' } } },
        },
        responses: {
          '200': { description: 'Login successful' },
          '401': { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },
    '/auth/me': {
      get: {
        tags: ['Auth'],
        summary: 'Get authenticated user profile',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'Authenticated user details' },
          '401': { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },
    '/teams': {
      get: {
        tags: ['Teams'],
        summary: 'List teams with pagination, search, country filter, and sorting',
        parameters: [
          { $ref: '#/components/parameters/PageParam' },
          { $ref: '#/components/parameters/LimitParam' },
          { $ref: '#/components/parameters/SortParam' },
          { name: 'search', in: 'query', schema: { type: 'string' } },
          { name: 'country', in: 'query', schema: { type: 'string' } },
        ],
        responses: { '200': { description: 'Paginated list of teams' } },
      },
      post: {
        tags: ['Teams'],
        summary: 'Create a team (Admin)',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/TeamInput' } } },
        },
        responses: {
          '201': { description: 'Team created' },
          '400': { $ref: '#/components/responses/BadRequest' },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '403': { $ref: '#/components/responses/Forbidden' },
          '409': { $ref: '#/components/responses/Conflict' },
        },
      },
    },
    '/teams/{id}': {
      get: {
        tags: ['Teams'],
        summary: 'Get team by ID',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Team details' },
          '404': { $ref: '#/components/responses/NotFound' },
        },
      },
      patch: {
        tags: ['Teams'],
        summary: 'Update team (Admin)',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/TeamInput' } } },
        },
        responses: {
          '200': { description: 'Team updated' },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '403': { $ref: '#/components/responses/Forbidden' },
          '404': { $ref: '#/components/responses/NotFound' },
        },
      },
      delete: {
        tags: ['Teams'],
        summary: 'Delete team (Admin)',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'Team deleted' },
          '409': { $ref: '#/components/responses/Conflict' },
        },
      },
    },
    '/leagues': {
      get: {
        tags: ['Leagues'],
        summary: 'List leagues with pagination, search, country, and type filters',
        parameters: [
          { $ref: '#/components/parameters/PageParam' },
          { $ref: '#/components/parameters/LimitParam' },
          { $ref: '#/components/parameters/SortParam' },
          { name: 'search', in: 'query', schema: { type: 'string' } },
          { name: 'country', in: 'query', schema: { type: 'string' } },
          {
            name: 'type',
            in: 'query',
            schema: { type: 'string', enum: ['league', 'cup', 'tournament', 'friendly'] },
          },
        ],
        responses: { '200': { description: 'Paginated list of leagues' } },
      },
      post: {
        tags: ['Leagues'],
        summary: 'Create a league (Admin)',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/LeagueInput' } } },
        },
        responses: {
          '201': { description: 'League created' },
          '409': { $ref: '#/components/responses/Conflict' },
        },
      },
    },
    '/leagues/{id}': {
      get: {
        tags: ['Leagues'],
        summary: 'Get league by ID including its seasons',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'League and seasons' } },
      },
      patch: {
        tags: ['Leagues'],
        summary: 'Update league (Admin)',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/LeagueInput' } } },
        },
        responses: { '200': { description: 'League updated' } },
      },
      delete: {
        tags: ['Leagues'],
        summary: 'Delete league (Admin)',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'League deleted' },
          '409': { $ref: '#/components/responses/Conflict' },
        },
      },
    },
    '/leagues/{id}/seasons': {
      get: {
        tags: ['Leagues'],
        summary: 'List seasons for a league',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'List of seasons' } },
      },
      post: {
        tags: ['Leagues'],
        summary: 'Create a season for a league (Admin)',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/SeasonInput' } } },
        },
        responses: { '201': { description: 'Season created' } },
      },
    },
    '/leagues/{id}/seasons/{seasonId}': {
      patch: {
        tags: ['Leagues'],
        summary: 'Update a season (Admin)',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'seasonId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/SeasonInput' } } },
        },
        responses: { '200': { description: 'Season updated' } },
      },
      delete: {
        tags: ['Leagues'],
        summary: 'Delete a season (Admin)',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'seasonId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'Season deleted' },
          '409': { $ref: '#/components/responses/Conflict' },
        },
      },
    },
    '/leagues/{id}/standings': {
      get: {
        tags: ['Leagues'],
        summary: 'Get league standings table computed from finished matches',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'season', in: 'query', schema: { type: 'string' } },
        ],
        responses: { '200': { description: 'League standings sorted by points, GD, GF' } },
      },
    },
    '/matches': {
      get: {
        tags: ['Matches'],
        summary: 'List matches with filtering, sorting, and pagination',
        parameters: [
          { $ref: '#/components/parameters/PageParam' },
          { $ref: '#/components/parameters/LimitParam' },
          { $ref: '#/components/parameters/SortParam' },
          { name: 'league', in: 'query', schema: { type: 'string' } },
          { name: 'season', in: 'query', schema: { type: 'string' } },
          { name: 'team', in: 'query', schema: { type: 'string' } },
          {
            name: 'status',
            in: 'query',
            schema: {
              type: 'string',
              enum: ['scheduled', 'live', 'halftime', 'finished', 'postponed', 'cancelled'],
            },
          },
          { name: 'from', in: 'query', schema: { type: 'string', format: 'date-time' } },
          { name: 'to', in: 'query', schema: { type: 'string', format: 'date-time' } },
        ],
        responses: { '200': { description: 'Paginated list of matches' } },
      },
      post: {
        tags: ['Matches'],
        summary: 'Create a match (Admin)',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/MatchInput' } } },
        },
        responses: { '201': { description: 'Match created' } },
      },
    },
    '/matches/today': {
      get: { tags: ['Matches'], summary: 'List today matches (UTC)', responses: { '200': { description: 'Today matches' } } },
    },
    '/matches/upcoming': {
      get: { tags: ['Matches'], summary: 'List upcoming scheduled matches', responses: { '200': { description: 'Upcoming matches' } } },
    },
    '/matches/live': {
      get: { tags: ['Matches'], summary: 'List live and halftime matches', responses: { '200': { description: 'Live matches' } } },
    },
    '/matches/finished': {
      get: { tags: ['Matches'], summary: 'List finished matches', responses: { '200': { description: 'Finished matches' } } },
    },
    '/matches/team/{teamId}': {
      get: {
        tags: ['Matches'],
        summary: 'List matches for a specific team',
        parameters: [{ name: 'teamId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Team matches' } },
      },
    },
    '/matches/{id}': {
      get: {
        tags: ['Matches'],
        summary: 'Get match by ID',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Match details' } },
      },
      patch: {
        tags: ['Matches'],
        summary: 'Update match (Admin)',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Match updated' } },
      },
      delete: {
        tags: ['Matches'],
        summary: 'Delete match and its events atomically (Admin)',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Match deleted' } },
      },
    },
    '/matches/{id}/start': {
      post: {
        tags: ['Matches'],
        summary: 'Start match (scheduled/postponed -> live) (Admin)',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Match started' } },
      },
    },
    '/matches/{id}/halftime': {
      post: {
        tags: ['Matches'],
        summary: 'Move live match to halftime (Admin)',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Match in halftime' } },
      },
    },
    '/matches/{id}/resume': {
      post: {
        tags: ['Matches'],
        summary: 'Resume match from halftime (Admin)',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Match resumed' } },
      },
    },
    '/matches/{id}/finish': {
      post: {
        tags: ['Matches'],
        summary: 'Finish match (Admin)',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Match finished' } },
      },
    },
    '/matches/{id}/postpone': {
      post: {
        tags: ['Matches'],
        summary: 'Postpone match with optional new kickoff UTC date (Admin)',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Match postponed' } },
      },
    },
    '/matches/{id}/cancel': {
      post: {
        tags: ['Matches'],
        summary: 'Cancel match (Admin)',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Match cancelled' } },
      },
    },
    '/matches/{id}/minute': {
      patch: {
        tags: ['Matches'],
        summary: 'Update live match minute (Admin)',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Match minute updated' } },
      },
    },
    '/matches/{id}/score': {
      patch: {
        tags: ['Matches'],
        summary: 'Update match score manually (Admin)',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Match score updated' } },
      },
    },
    '/matches/{id}/events': {
      get: {
        tags: ['Match Events'],
        summary: 'List match events ordered by minute and addedTime',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Chronological list of match events' } },
      },
      post: {
        tags: ['Match Events'],
        summary: 'Add match event and recalculate score atomically (Admin)',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/MatchEventInput' } } },
        },
        responses: { '201': { description: 'Event added and match score updated' } },
      },
    },
    '/matches/{id}/events/{eventId}': {
      get: {
        tags: ['Match Events'],
        summary: 'Get single match event',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'eventId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: { '200': { description: 'Match event details' } },
      },
      patch: {
        tags: ['Match Events'],
        summary: 'Update match event and recalculate score (Admin)',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'eventId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: { '200': { description: 'Event updated' } },
      },
      delete: {
        tags: ['Match Events'],
        summary: 'Delete match event and recalculate score (Admin)',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'eventId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: { '200': { description: 'Event deleted' } },
      },
    },
    '/dashboard/overview': {
      get: {
        tags: ['Dashboard'],
        summary: 'Get dashboard counts, live matches, upcoming matches, and recent results',
        responses: { '200': { description: 'Dashboard overview' } },
      },
    },
    '/dashboard/live-matches': {
      get: {
        tags: ['Dashboard'],
        summary: 'Get live matches for control dashboard',
        parameters: [{ name: 'limit', in: 'query', schema: { type: 'integer', default: 10 } }],
        responses: { '200': { description: 'Live matches' } },
      },
    },
    '/dashboard/upcoming-matches': {
      get: {
        tags: ['Dashboard'],
        summary: 'Get upcoming matches for control dashboard',
        parameters: [{ name: 'limit', in: 'query', schema: { type: 'integer', default: 10 } }],
        responses: { '200': { description: 'Upcoming matches' } },
      },
    },
    '/dashboard/recent-results': {
      get: {
        tags: ['Dashboard'],
        summary: 'Get recent finished match results',
        parameters: [{ name: 'limit', in: 'query', schema: { type: 'integer', default: 10 } }],
        responses: { '200': { description: 'Recent results' } },
      },
    },
  },
};
