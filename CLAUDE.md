# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Dev
yarn start:dev          # watch mode
yarn start:debug        # debug + watch

# Build & Prod
yarn build
yarn start:prod         # run dist/main

# Test
yarn test               # unit tests (src/**/*.spec.ts)
yarn test:watch
yarn test:cov
yarn test:e2e           # jest --config ./test/jest-e2e.json
yarn test:debug         # single test with inspector

# Lint / Format
yarn lint               # eslint --fix
yarn format             # prettier --write

# Database
yarn db:generate        # drizzle-kit generate (after schema change)
yarn db:migrate         # run pending migrations
yarn db:fresh           # drop + recreate + migrate
yarn db:fresh:force     # same, skip confirmation
yarn db:reset           # alias for fresh reset
yarn db:studio          # Drizzle Studio UI
yarn db:check           # validate migration consistency

# Seeding
yarn seed:users         # ts-node src/seeders/user.seeder.ts
```

**Package manager: Yarn only. Never use npm.**

## Architecture

NestJS 11 on Fastify (not Express). Three mandatory constraints apply everywhere:

| Concern | Required | Forbidden |
|---|---|---|
| ORM | Drizzle ORM | TypeORM, Prisma, Sequelize, raw SQL |
| Config | `@itgorillaz/configify` | `@nestjs/config`, `process.env` direct access |
| HTTP | Fastify / `@fastify` plugins | Express, Koa, Hapi, any Express middleware |

## Reuse First (mandatory)

Before implementing any feature, search for an existing reusable piece. Do not write a module-local copy of something `src/common/` already solves.

1. **Look first.** Run `graphify query "<the thing you need>"` and check `src/common/` (`dto/`, `decorators/`, `interceptors/`, `filters/`, `pipes/`, `middleware/`, `utils/`). Also check whether another module already solved it.
2. **Reuse it as-is** if it fits. If it almost fits, extend the shared piece (add an option/generic) instead of forking it.
3. **If nothing exists, build it reusable** when the need is plausibly not module-specific: put it in `src/common/`, make it generic over the caller's DTO, export it from the matching barrel (`src/common/index.ts`), and document usage in a short doc comment. Only keep something module-local when it is genuinely domain-specific.
4. **Never duplicate a shared shape.** Two classes with the same name and different fields (e.g. a per-module paginated DTO) will silently desync from runtime. One definition, one source of truth.
5. **After adding a shared piece**, use it from at least one call site in the same change, and cover it with a spec if it shapes wire output.

Already shared — use these, don't recreate:

| Need | Use |
|---|---|
| Paginated payload | `PaginatedResponseDto.create(data, total, page, limit)` + `PaginationUtil` |
| Pagination metadata | `PaginationMetaDto` (`hasNextPage` / `hasPreviousPage`) |
| Message-only response | `MessageResponseDto` |
| Swagger response docs | `ApiEnvelopeResponse`, `ApiEnvelopePaginatedResponse`, `ApiEnvelopeMessageResponse`, `ApiErrorResponse` |
| Success envelope | `TransformInterceptor` (global — handlers return bare payloads) |
| Raw/streamed response | `@SkipTransform()` — opts a route out of the envelope |
| File storage | `StorageService` (never talk to a driver directly) |
| Error envelope | `GlobalExceptionFilter` (global — throw Nest `HttpException` subclasses, never bare `Error`) |
| Filtering / sorting helpers | `FilterUtil`, `PaginationUtil` |

## Module Structure

```
src/
  config/          # @Configuration() classes — one per domain
  database/
    schema/        # Drizzle table definitions (index.ts exports all)
    connection.ts  # createDatabaseConnection()
    database.module.ts   # Global module, provides DATABASE_CONNECTION token
    database.service.ts  # DatabaseService wraps db for injection
  common/
    dto/           # ApiResponseDto, ErrorResponseDto, MessageResponseDto, PaginatedResponseDto
    decorators/    # ApiEnvelope*/ApiErrorResponse Swagger decorators
    interceptors/  # TransformInterceptor (global response envelope)
    middleware/    # SecurityHeadersMiddleware, SanitizationMiddleware (applied globally)
    pipes/         # CustomValidationPipe (global)
    filters/       # GlobalExceptionFilter (global)
    utils/         # pagination.util, filter.util
  auth/
    guards/        # JwtAuthGuard (default global), RolesGuard, ApiKeyGuard, RateLimitGuard
    decorators/    # @Public(), @Roles(), @CurrentUser(), @RateLimit()
    strategies/    # JWT passport strategy
  users/           # CRUD module — service, controller, DTOs
  storage/         # File uploads — driver per backend, selected by STORAGE_DRIVER
    interfaces/    # StorageDriver contract + STORAGE_DRIVER token
    drivers/       # local, s3, appwrite
  bull-board/      # BullMQ dashboard at /queues
```

## Key Patterns

**Config classes** use `@Configuration()` + `@Value('ENV_VAR')` decorators. All configs are injected via `ConfigifyModule.forRootAsync()` — never read `process.env` directly in application code.

**Database access**: Inject `DatabaseService` for common ops. For complex queries, call `databaseService.getDatabase()` to get the raw Drizzle `db` instance and use the query builder. Schema types come from `typeof users.$inferSelect` / `$inferInsert`.

**Auth flow**: `JwtAuthGuard` is applied globally in `AuthModule`. Mark public routes with `@Public()` decorator. JWT payload shape is `JwtPayload` (sub=userId, email, username, role). Both access token and refresh token are issued on login/register.

**Cache**: `CacheModule` (global) uses Redis as primary store with in-memory LRU fallback. Cache namespace is `app-cache`. Falls back to memory-only if Redis is unreachable on startup.

**Queue**: BullMQ connects to Redis via `BullMQRedisConfig`. Bull Board UI available at `/queues` (dev only).

**Storage**: `STORAGE_DRIVER` (`local` | `s3` | `appwrite`) picks one `StorageDriver` implementation at startup; `StorageService` is the only thing callers inject. The `s3` driver also covers MinIO, Cloudflare R2, DigitalOcean Spaces and Wasabi via `STORAGE_S3_ENDPOINT` + `STORAGE_S3_FORCE_PATH_STYLE`. Uploads are recorded in the `files` table and addressed by a generated key, never by the client-supplied filename. To add a backend: implement `StorageDriver`, add a `StorageDriverName` entry, register it in `STORAGE_DRIVERS` in `storage.module.ts` — nothing else changes.

## Adding a New Module

0. Run the **Reuse First** check above before writing anything
1. Schema changes → `src/database/schema/index.ts` → `yarn db:generate` → `yarn db:migrate`
2. New config env vars → add `@Configuration()` class in `src/config/`
3. Service injects `DatabaseService` or `@Inject('DATABASE_CONNECTION')` for raw db
4. All DTOs use `class-validator` decorators + `@ApiProperty()` for Swagger
5. Routes are JWT-protected by default; use `@Public()` to opt out
6. Document responses with the `ApiEnvelope*` decorators — a bare `@ApiResponse({ type: Dto })` is wrong, since `TransformInterceptor` wraps every payload in `{ success, statusCode, message, data }`
7. Let query DTOs generate their own Swagger params (`@Query() dto: QueryDto`) — do not hand-write `@ApiQuery` per field, it drifts

## Environment Variables

Copy `.env.example` to `.env`. Required groups: `APP` (PORT, NODE_ENV, API_PREFIX), `DB_*` (PostgreSQL), `REDIS_*` + `CACHE_TTL`, `JWT_*` + `BCRYPT_ROUNDS`, `RATE_LIMIT_*`.

Swagger UI available at path configured by `SWAGGER_*` vars (enabled by default in dev).

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
