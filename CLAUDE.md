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
    middleware/    # SecurityHeadersMiddleware, SanitizationMiddleware (applied globally)
    pipes/         # CustomValidationPipe (global)
    filters/       # GlobalExceptionFilter (global)
    utils/         # pagination.util, filter.util
  auth/
    guards/        # JwtAuthGuard (default global), RolesGuard, ApiKeyGuard, RateLimitGuard
    decorators/    # @Public(), @Roles(), @CurrentUser(), @RateLimit()
    strategies/    # JWT passport strategy
  users/           # CRUD module — service, controller, DTOs
  bull-board/      # BullMQ dashboard at /queues
```

## Key Patterns

**Config classes** use `@Configuration()` + `@Value('ENV_VAR')` decorators. All configs are injected via `ConfigifyModule.forRootAsync()` — never read `process.env` directly in application code.

**Database access**: Inject `DatabaseService` for common ops. For complex queries, call `databaseService.getDatabase()` to get the raw Drizzle `db` instance and use the query builder. Schema types come from `typeof users.$inferSelect` / `$inferInsert`.

**Auth flow**: `JwtAuthGuard` is applied globally in `AuthModule`. Mark public routes with `@Public()` decorator. JWT payload shape is `JwtPayload` (sub=userId, email, username, role). Both access token and refresh token are issued on login/register.

**Cache**: `CacheModule` (global) uses Redis as primary store with in-memory LRU fallback. Cache namespace is `app-cache`. Falls back to memory-only if Redis is unreachable on startup.

**Queue**: BullMQ connects to Redis via `BullMQRedisConfig`. Bull Board UI available at `/queues` (dev only).

## Adding a New Module

1. Schema changes → `src/database/schema/index.ts` → `yarn db:generate` → `yarn db:migrate`
2. New config env vars → add `@Configuration()` class in `src/config/`
3. Service injects `DatabaseService` or `@Inject('DATABASE_CONNECTION')` for raw db
4. All DTOs use `class-validator` decorators + `@ApiProperty()` for Swagger
5. Routes are JWT-protected by default; use `@Public()` to opt out

## Environment Variables

Copy `.env.example` to `.env`. Required groups: `APP` (PORT, NODE_ENV, API_PREFIX), `DB_*` (PostgreSQL), `REDIS_*` + `CACHE_TTL`, `JWT_*` + `BCRYPT_ROUNDS`, `RATE_LIMIT_*`.

Swagger UI available at path configured by `SWAGGER_*` vars (enabled by default in dev).