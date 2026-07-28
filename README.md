# Backend template

A comprehensive NestJS-based backend application for sports administration, built with modern technologies including Drizzle ORM, Redis, PostgreSQL, and BullMQ for job processing.

## 🏗️ Architecture Overview

- **Framework**: NestJS with Fastify adapter
- **Database**: PostgreSQL with Drizzle ORM
- **Caching**: Redis
- **Job Queue**: BullMQ with Redis
- **Authentication**: JWT with Passport
- **Configuration**: @itgorillaz/configify (validated at startup)
- **File Storage**: pluggable driver — local disk, S3-compatible (MinIO/R2/Spaces/Wasabi), Appwrite
- **Localization**: nestjs-i18n, language from the `x-lang` header
- **Package Manager**: Yarn

Every response is wrapped in a consistent envelope, every user-facing message is
translatable, and invalid configuration stops the app from booting. See
[API Conventions](#-api-conventions) for what that means when writing a module.

## 📋 Prerequisites

Before setting up the project, ensure you have the following installed:

### Required Software

- **Node.js**: v18.0.0 or higher
- **Yarn**: v1.22.0 or higher (Package manager)
- **Docker**: v20.0.0 or higher (for local development)
- **Docker Compose**: v2.0.0 or higher
- **PostgreSQL**: v15.0 or higher (if not using Docker)
- **Redis**: v6.2.0 or higher (if not using Docker)

### Version Verification

```bash
# Check Node.js version
node --version

# Check Yarn version
yarn --version

# Check Docker version
docker --version

# Check Docker Compose version
docker-compose --version
```

## 🚀 Project Setup

### 1. Clone the Repository

```bash
git clone <repository-url>
cd backend-template
```

### 2. Install Dependencies

```bash
# Install all project dependencies
yarn install
```

### 3. Environment Configuration

#### Copy Environment Template

```bash
# Unix/Linux/macOS
cp .env.example .env

# Windows
copy .env.example .env
```

#### Configure Environment Variables

Edit the `.env` file with your specific configuration:

```bash
# Application Configuration
NODE_ENV=development
PORT=3000
# Declared and validated, but not applied as a global route prefix — routes are
# currently served at the root (e.g. /auth/login, not /api/v1/auth/login).
API_PREFIX=api/v1

# Database Configuration
# Note: docker-compose maps PostgreSQL to host port 5433, not 5432
DB_HOST=localhost
DB_PORT=5433
DB_USER=task_user
DB_PASSWORD=task_password_2024
DB_NAME=task_db
DB_SSL=false

# Database Pool Configuration
DB_POOL_MIN=5
DB_POOL_MAX=20
DB_POOL_ACQUIRE=60000
DB_POOL_IDLE=10000

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=redis_password
REDIS_DB=0
REDIS_CONNECT_TIMEOUT=5000
REDIS_LAZY_CONNECT=3000
REDIS_RETRY_DELAY_ON_FAILOVER=3

# JWT & Security
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_REFRESH_SECRET=your-super-secret-refresh-key-change-in-production
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
BCRYPT_ROUNDS=12
RATE_LIMIT_TTL=60
RATE_LIMIT_LIMIT=100

# BullMQ queue Redis (may point at a different instance than the cache)
BULLMQ_REDIS_HOST=localhost
BULLMQ_REDIS_PORT=6379
BULLMQ_REDIS_PASSWORD=

# File Storage — local | s3 | appwrite
STORAGE_DRIVER=local
STORAGE_MAX_FILE_SIZE=10485760
STORAGE_ALLOWED_MIME_TYPES=
STORAGE_URL_EXPIRES_IN=900

# S3 / MinIO (also covers Cloudflare R2, DigitalOcean Spaces, Wasabi)
STORAGE_S3_BUCKET=uploads
STORAGE_S3_ACCESS_KEY_ID=minioadmin
STORAGE_S3_SECRET_ACCESS_KEY=minioadmin
STORAGE_S3_ENDPOINT=http://localhost:9000
STORAGE_S3_FORCE_PATH_STYLE=true
STORAGE_S3_VISIBILITY=private          # private -> signed URLs, public -> permanent URLs
STORAGE_S3_PUBLIC_ENDPOINT=            # address clients use, if it differs

# Localization
I18N_FALLBACK_LANGUAGE=en
I18N_HEADER_NAME=x-lang
I18N_SUPPORTED_LANGUAGES=en,bn
```

`.env.example` carries the full list with comments, including the Appwrite and
local-disk driver blocks.

**⚠️ Security Note**: Always change default passwords and secrets in production!

#### Configuration is validated at boot

Config classes live in `src/config/`, one per domain, using `@Configuration()`
and `@Value()`. Every value is parsed into its real type and validated — the app
**refuses to start** on bad input rather than failing later:

```
BCRYPT_ROUNDS=abc   → exit 1: "bcryptRounds must be an integer number"
STORAGE_DRIVER=gcs  → exit 1: "STORAGE_DRIVER must be one of: local, s3, appwrite"
```

Fields carrying a development default that would be unsafe in production are
marked `@RequiredInProduction('VAR')`. With `NODE_ENV=production`, leaving such a
variable unset aborts startup — `STORAGE_DRIVER` is one, so a production deploy
can never silently write uploads to a container filesystem that vanishes on
restart.

Never read `process.env` directly in application code; inject the config class.

### 4. Start Infrastructure Services

#### Using Docker Compose (Recommended)

```bash
# Start PostgreSQL, Redis, and monitoring services
docker-compose up -d

# Verify services are running
docker-compose ps

# View logs if needed
docker-compose logs -f
```

#### Manual Setup (Alternative)

If you prefer to run services manually:

**PostgreSQL Setup:**
```bash
# Create database and user
psql -U postgres
CREATE DATABASE task_db;
CREATE USER task_user WITH PASSWORD 'task_password_2024';
GRANT ALL PRIVILEGES ON DATABASE task_db TO task_user;
\q
```

**Redis Setup:**
```bash
# Start Redis server
redis-server --requirepass redis_password
```

## 🗄️ Database Migration

### Database Initialization

#### 1. Generate a Migration

```bash
# after editing src/database/schema/index.ts
yarn db:generate
```

#### 2. Apply Migrations

```bash
yarn db:migrate          # apply pending migrations
yarn db:check            # validate migration consistency
```

#### 3. Reset the Database (development only)

```bash
yarn db:fresh            # drop, recreate, migrate (asks for confirmation)
yarn db:fresh:force      # same, no prompt
```

`db:fresh` writes a `pg_dump --schema-only` snapshot into `backups/` first. That
directory is gitignored — the schema's source of truth is
`src/database/schema/` plus the `drizzle/` migrations.

#### 4. Inspect the Schema

```bash
yarn db:studio           # Drizzle Studio UI
```

### Migration Commands Reference

| Command | Description |
|---------|-------------|
| `yarn db:generate` | Generate migration files from the schema |
| `yarn db:migrate` | Apply pending migrations |
| `yarn db:check` | Validate migration consistency |
| `yarn db:fresh` | Drop, recreate and migrate (development) |
| `yarn db:fresh:force` | Same, skipping confirmation |
| `yarn db:studio` | Open Drizzle Studio |

### Seed Data (Optional)

```bash
yarn seed:users     # generates fake users (SEEDER_USER_COUNT, default 50)
yarn seed:admin     # creates the admin account from the ADMIN_* variables
```

Seeders live in `src/seeders/` and run standalone via ts-node, outside the Nest
container. `ADMIN_PASSWORD` is required when `NODE_ENV=production`; in
development it falls back to a documented default.

## 🏃‍♂️ Running the Project

### Local Development

#### Start Development Server

```bash
# Start in watch mode (recommended for development)
yarn start:dev

# Start in debug mode
yarn start:debug

# Start without watch mode
yarn start
```

#### Verify Application

```bash
# Check if application is running
curl http://localhost:8000

# Check health endpoint (if implemented)
curl http://localhost:8000/api/v1/health
```

### Testing

#### Unit Tests

```bash
# Run all unit tests
yarn test

# Run tests in watch mode
yarn test:watch

# Run tests with coverage
yarn test:cov

# Debug tests
yarn test:debug
```

#### End-to-End Tests

```bash
# Run e2e tests
yarn test:e2e
```

#### Test Database Setup

For testing, create a separate test database:

```bash
# Create test database
psql -U postgres
CREATE DATABASE task_db_test;
GRANT ALL PRIVILEGES ON DATABASE task_db_test TO task_user;
\q
```

Update test configuration in `test/jest-e2e.json` if needed.

### Building for Production

#### Build Application

```bash
# Build the application
yarn build

# Verify build output
ls -la dist/
```

#### Production Start

```bash
# Start production build
yarn start:prod
```

### Code Quality

```bash
# Lint code
yarn lint

# Format code
yarn format

# Type checking
yarn build
```

## 🚀 Deployment

### Server Requirements

#### Minimum System Requirements

- **CPU**: 2 cores
- **RAM**: 4GB
- **Storage**: 20GB SSD
- **OS**: Ubuntu 20.04 LTS or CentOS 8+

#### Recommended System Requirements

- **CPU**: 4+ cores
- **RAM**: 8GB+
- **Storage**: 50GB+ SSD
- **OS**: Ubuntu 22.04 LTS

#### Required Software on Server

- Node.js v18+
- Yarn v1.22+
- PostgreSQL 15+
- Redis 6.2+
- PM2 (for process management)
- Nginx (for reverse proxy)

### Deployment Checklist

#### Pre-Deployment

- [ ] Environment variables configured
- [ ] Database migrations tested
- [ ] Security configurations reviewed
- [ ] SSL certificates prepared
- [ ] Backup strategy implemented
- [ ] Monitoring setup configured

#### Deployment Steps

1. **Server Preparation**
   ```bash
   # Update system
   sudo apt update && sudo apt upgrade -y
   
   # Install Node.js
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs
   
   # Install Yarn
   npm install -g yarn
   
   # Install PM2
   npm install -g pm2
   ```

2. **Application Deployment**
   ```bash
   # Clone repository
   git clone <repository-url>
   cd backend-template
   
   # Install dependencies
   yarn install --production
   
   # Build application
   yarn build
   
   # Set up environment
   cp .env.example .env
   # Edit .env with production values
   ```

3. **Database Setup**
   ```bash
   # Run migrations
   NODE_ENV=production yarn db:migrate
   ```

4. **Process Management**
   ```bash
   # Start with PM2
   pm2 start dist/main.js --name "backend-template"
   
   # Save PM2 configuration
   pm2 save
   pm2 startup
   ```

5. **Nginx Configuration**
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;
       
       location / {
           proxy_pass http://localhost:8000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

### Post-Deployment Verification

#### Health Checks

```bash
# Check application status
pm2 status

# Check application logs
pm2 logs backend-template

# Test API endpoints
curl https://your-domain.com/api/v1/health

# Check database connectivity
psql -h localhost -U task_user -d task_db -c "SELECT 1;"

# Check Redis connectivity
redis-cli -h localhost -p 6379 ping
```

#### Performance Monitoring

```bash
# Monitor PM2 processes
pm2 monit

# Check system resources
htop
df -h
free -m
```

#### Security Verification

- [ ] Firewall configured (only necessary ports open)
- [ ] SSL/TLS certificates installed
- [ ] Database access restricted
- [ ] Environment variables secured
- [ ] Log files properly configured

### Monitoring and Maintenance

#### Log Management

```bash
# View application logs
pm2 logs backend-template --lines 100

# Rotate logs
pm2 install pm2-logrotate
```

#### Backup Strategy

```bash
# Database backup
pg_dump -h localhost -U task_user task_db > backup_$(date +%Y%m%d_%H%M%S).sql

# Automated backup script (add to crontab)
#!/bin/bash
BACKUP_DIR="/var/backups/sports-admin"
mkdir -p $BACKUP_DIR
pg_dump -h localhost -U task_user task_db > $BACKUP_DIR/backup_$(date +%Y%m%d_%H%M%S).sql
find $BACKUP_DIR -name "backup_*.sql" -mtime +7 -delete
```

#### Updates and Maintenance

```bash
# Update application
git pull origin main
yarn install --production
yarn build
pm2 restart backend-template

# Update system packages
sudo apt update && sudo apt upgrade -y
```

## 🧩 API Conventions

These apply to every module. Follow them and a new endpoint is consistent with
the rest of the API for free.

### Response envelope

`TransformInterceptor` wraps every successful payload. Handlers return the bare
payload — never build the envelope yourself.

```jsonc
// GET /users/:id
{
  "success": true,
  "statusCode": 200,
  "message": "Success",
  "data": { "id": "…", "email": "…" }
}
```

Return `{ message }` alone and the message is hoisted, with `data: null`:

```jsonc
{ "success": true, "statusCode": 200, "message": "User deleted successfully", "data": null }
```

Errors come from `GlobalExceptionFilter`. Throw Nest `HttpException` subclasses —
never a bare `Error`, which becomes an opaque 500:

```jsonc
{
  "success": false,
  "statusCode": 404,
  "message": "User not found",
  "path": "/users/…",     // non-production only
  "method": "GET"
}
```

Routes returning raw bytes opt out with `@SkipTransform()` — see the file
download endpoint.

### Documenting responses in Swagger

A bare `@ApiResponse({ type: Dto })` is **wrong**: it documents the payload
without the envelope the client actually receives. Use the envelope decorators:

```ts
@ApiEnvelopeResponse(UserResponseDto, { status: 200, description: 'Found' })
@ApiEnvelopePaginatedResponse(UserResponseDto, { status: 200, description: '…' })
@ApiEnvelopeMessageResponse({ status: 200, description: '…', message: 'Deleted' })
@ApiErrorResponse({ status: 404, description: 'Not found', message: 'User not found' })
```

Query parameters are generated from the DTO's `@ApiPropertyOptional` metadata —
do not hand-write `@ApiQuery` per field, it drifts from the DTO.

### Pagination

One shared shape for every module. Do not define a per-module paginated DTO.

```ts
// service
return PaginatedResponseDto.create(items, total, page, limit);

// controller
@ApiEnvelopePaginatedResponse(ItemResponseDto, { status: 200, description: '…' })
findAll(): Promise<PaginatedResponseDto<ItemResponseDto>> { … }
```

`data` and `meta` are lifted onto the envelope:

```jsonc
{
  "success": true, "statusCode": 200, "message": "Success",
  "data": [ … ],
  "meta": { "total": 150, "page": 1, "limit": 10, "totalPages": 15,
            "hasNextPage": true, "hasPreviousPage": false }
}
```

### Localization

Language resolution: `x-lang` header → `?lang=` → `Accept-Language` →
`I18N_FALLBACK_LANGUAGE` (`en`). Unknown codes fall back silently.

```bash
curl localhost:3000/auth/login -H 'x-lang: bn' …
# { "success": false, "statusCode": 401, "message": "ভুল তথ্য দেওয়া হয়েছে" }
```

Services never inject an i18n service. They return or throw a **key enum**, and
the envelope localizes it at the edge:

```ts
throw new NotFoundException(UsersMessage.NOT_FOUND);
return { message: UsersMessage.DELETED };
translate(StorageMessage.FILE_TOO_LARGE, { maxSize });   // with placeholders
```

Never write a key as a string literal. Add a member to the matching enum in
`src/i18n/translation-keys.ts` and an entry in **every** locale file under
`src/i18n/<lang>/`. A spec fails the build if a locale is missing a key, or
defines one the enums do not declare.

Strings that are not keys pass through untouched, so third-party and validation
messages keep working.

## 📁 File Storage

`STORAGE_DRIVER` picks the backend at startup. Callers inject `StorageService`
and never see which one is active.

| Driver | Backend |
|---|---|
| `local` | local disk under `STORAGE_LOCAL_ROOT` |
| `s3` | AWS S3, MinIO, Cloudflare R2, DigitalOcean Spaces, Wasabi |
| `appwrite` | Appwrite Storage buckets |

Adding a backend takes three edits: implement `StorageDriver`, add a
`StorageDriverName` entry, register it in `STORAGE_DRIVERS` in
`storage.module.ts`. Nothing else changes.

### Local MinIO

```bash
docker compose up -d minio minio-init
```

`minio-init` creates `STORAGE_S3_BUCKET` and applies the policy named by
`STORAGE_S3_VISIBILITY`. After changing that variable, re-run:

```bash
docker compose up -d --force-recreate minio-init
```

### Endpoints

| Method | Path | Notes |
|---|---|---|
| `POST` | `/files/upload` | `multipart/form-data`, field `file` |
| `GET` | `/files` | paginated, admin/moderator |
| `GET` | `/files/:id` | metadata only |
| `GET` | `/files/:id/url` | fetchable URL |
| `GET` | `/files/:id/download` | raw bytes, no envelope |
| `DELETE` | `/files/:id` | admin |

Uploads are stored under a generated key (`uploads/YYYY/MM/<uuid>.<ext>`) and
recorded in the `files` table. The client-supplied filename is kept as metadata
but never decides where bytes land.

### Public vs private URLs

`STORAGE_S3_VISIBILITY` controls the bucket policy **and** how URLs are built:

| | `private` | `public` |
|---|---|---|
| `GET /files/:id/url` | presigned, expires | permanent, cacheable |
| `expiresIn` in the response | `STORAGE_URL_EXPIRES_IN` | `0` |
| Anonymous fetch | 403 | 200 |

Use `public` for avatars and other non-sensitive assets — the URL can be stored
on a record and dropped into an image tag. Keep `private` for anything
sensitive; anyone holding a public URL can read that object forever.

> **Mobile / device testing**: `localhost` in a URL means the device itself. Set
> `STORAGE_S3_PUBLIC_ENDPOINT` to a LAN address or CDN domain — the server keeps
> using `STORAGE_S3_ENDPOINT` internally while clients get the reachable one.

### Handling uploads in a controller

Do not touch the raw request. `@UploadedFile()` parses the multipart body,
enforces limits, and hands back a value ready for `StorageService.upload()`.

```ts
@Post('avatar')
@ApiFileUpload('image')                       // Swagger file picker
uploadAvatar(
  @UploadedFile({
    field: 'image',
    maxSize: '5mb',                           // or bytes: 5242880
    mimeTypes: ['image/png', 'image/jpeg', 'application/pdf'],
  })
  image: UploadedFileData,
  @CurrentUser() user: UserResponseDto,
) {
  return this.storageService.upload({
    buffer: image.buffer,
    originalName: image.originalName,
    mimeType: image.mimeType,
    uploadedBy: user.id,
  });
}
```

Other forms:

```ts
@UploadedFile({ required: false }) file?: UploadedFileData   // optional upload
@UploadedFiles() files: UploadedFileData[]                   // several files
@MultipartBody(CreatePhotoDto) dto: CreatePhotoDto           // non-file fields, validated
```

`UploadedFileData` is `{ field, originalName, mimeType, buffer, size }`.

Failure modes are handled for you: **400** when the request is not multipart or a
required file is missing, **413** above `maxSize`, **415** for a MIME type
outside the allow-list — all localized.

The multipart body is parsed once per request and cached, so `@UploadedFile()`
and `@MultipartBody()` can appear on the same handler without racing for the
stream.

## 🔧 Development Tools

### Available Services

Ports below match `docker-compose.yml`; the app port comes from `PORT` in `.env`.

| Service | Address | Notes |
|---|---|---|
| Application | http://localhost:3000 | `PORT` in `.env` |
| Swagger UI | http://localhost:3000/api/docs | `SWAGGER_PATH`, OpenAPI JSON at `/api/docs/json` |
| Bull Board | http://localhost:3001 | job queue monitoring |
| PostgreSQL | localhost:5433 | |
| Redis (cache) | localhost:6381 | |
| Redis (BullMQ) | localhost:6382 | |
| MinIO API | http://localhost:9000 | S3 endpoint the app talks to |
| MinIO Console | http://localhost:9001 | login with `STORAGE_S3_ACCESS_KEY_ID` / `..._SECRET_ACCESS_KEY` |
| Drizzle Studio | `yarn db:studio` | |

### Useful Commands

```bash
# View all available scripts
yarn run

# Check dependencies
yarn list

# Update dependencies
yarn upgrade

# Clean node_modules
rm -rf node_modules yarn.lock && yarn install
```

## 🐛 Troubleshooting

### Common Issues

#### Database Connection Issues

```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Check database connectivity
psql -h localhost -U task_user -d task_db

# Reset database connection
docker-compose restart postgres
```

#### Redis Connection Issues

```bash
# Check Redis status
redis-cli ping

# Restart Redis
docker-compose restart redis
```

#### Port Conflicts

```bash
# Check what's using port 8000
lsof -i :8000

# Kill process using port
kill -9 <PID>
```

#### Migration Issues

```bash
# Rebuild the database from scratch (development only)
yarn db:fresh:force
```

### Getting Help

- Check application logs: `yarn start:dev` or `pm2 logs`
- Review environment configuration
- Verify all services are running
- Check network connectivity
- Review database permissions

## 📝 Additional Notes

### OS-Specific Instructions

#### Windows Users

- Use PowerShell or Command Prompt
- Replace `cp` with `copy`
- Replace `rm -rf` with `rmdir /s`
- Consider using WSL2 for better compatibility

#### macOS Users

- Install Homebrew for package management
- Use `brew install postgresql redis` for local setup

#### Linux Users

- Use your distribution's package manager
- Ensure proper permissions for Docker

### Performance Optimization

- Enable Redis caching for frequently accessed data
- Use connection pooling for database connections
- Implement proper indexing on database tables
- Monitor and optimize slow queries
- Use PM2 cluster mode for production

---

**Last Updated**: 2025-01-24  
**Version**: 1.0.0  
**Maintainer**: Backend template Team
