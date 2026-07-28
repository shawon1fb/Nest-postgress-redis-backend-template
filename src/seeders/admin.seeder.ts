import * as bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';
import * as dotenv from 'dotenv';
dotenv.config();
import {
  createDatabaseConnection,
  closeDatabaseConnection,
} from '../database/connection';
import { users, UserRole } from '../database/schema';

// Simple database configuration class without decorators for standalone usage
class SimpleDatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl: boolean;

  constructor() {
    this.host = process.env.DB_HOST || 'localhost';
    this.port = parseInt(process.env.DB_PORT || '5432');
    this.database = process.env.DB_NAME || 'task_db';
    this.username = process.env.DB_USER || 'task_user';
    this.password = process.env.DB_PASSWORD || 'task_password_2024';
    this.ssl = process.env.DB_SSL === 'true';
  }

  getDatabaseUrl(): string {
    const sslParam = this.ssl ? '?sslmode=require' : '';
    return `postgresql://${this.username}:${this.password}@${this.host}:${this.port}/${this.database}${sslParam}`;
  }
}

// Simple configuration class without decorators for standalone usage
class SimpleAdminSeederConfig {
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  password: string;
  forceResetPassword: boolean;
  environment: string;
  saltRounds: number;

  /** True when no ADMIN_PASSWORD was supplied and the dev default was used */
  readonly usedDefaultPassword: boolean;

  private static readonly DEV_DEFAULT_PASSWORD = 'Admin@12345';

  constructor() {
    this.environment =
      process.env.SEEDER_ENVIRONMENT || process.env.NODE_ENV || 'development';

    this.email = (process.env.ADMIN_EMAIL || 'admin@example.com')
      .trim()
      .toLowerCase();
    this.username = (process.env.ADMIN_USERNAME || 'admin').trim();
    this.firstName = process.env.ADMIN_FIRST_NAME || 'Super';
    this.lastName = process.env.ADMIN_LAST_NAME || 'Admin';
    this.forceResetPassword = process.env.ADMIN_FORCE_RESET === 'true';
    this.saltRounds = parseInt(process.env.BCRYPT_ROUNDS || '12');

    const envPassword = process.env.ADMIN_PASSWORD;
    this.usedDefaultPassword = !envPassword;
    this.password = envPassword || SimpleAdminSeederConfig.DEV_DEFAULT_PASSWORD;
  }

  isProductionEnvironment(): boolean {
    return (
      this.environment?.toLowerCase()?.includes('prod') ||
      this.environment?.toLowerCase()?.includes('production') ||
      false
    );
  }

  /**
   * Validate the resolved configuration before touching the database
   */
  validate(): void {
    if (this.isProductionEnvironment() && this.usedDefaultPassword) {
      throw new Error(
        '🚫 ADMIN_PASSWORD is required in a production environment. ' +
          'Refusing to seed an admin with the well-known development default.',
      );
    }

    if (this.password.length < 8) {
      throw new Error('🚫 ADMIN_PASSWORD must be at least 8 characters long.');
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email)) {
      throw new Error(`🚫 ADMIN_EMAIL is not a valid email: ${this.email}`);
    }

    if (this.username.length < 3) {
      throw new Error('🚫 ADMIN_USERNAME must be at least 3 characters long.');
    }
  }
}

export class AdminSeeder {
  private db: ReturnType<typeof createDatabaseConnection>;
  private databaseConfig: SimpleDatabaseConfig;
  private seederConfig: SimpleAdminSeederConfig;

  constructor() {
    this.databaseConfig = new SimpleDatabaseConfig();
    this.seederConfig = new SimpleAdminSeederConfig();
    this.db = createDatabaseConnection(this.databaseConfig);
  }

  /**
   * Main seeder execution method
   */
  async run(): Promise<void> {
    try {
      this.log('🌱 Starting Admin Seeder...');

      this.seederConfig.validate();
      this.log(`🔍 Environment: ${this.seederConfig.environment}`);

      const existing = await this.findExistingAdmin();

      if (existing) {
        await this.updateExistingAdmin(existing);
      } else {
        await this.createAdmin();
      }

      this.printCredentials();
      this.log('✅ Admin seeding completed successfully!');
    } catch (error) {
      this.logError('❌ Admin seeding failed:', error);
      throw error;
    } finally {
      await this.cleanup();
    }
  }

  /**
   * Look up an existing user by the configured admin email
   */
  private async findExistingAdmin() {
    const [existing] = await this.db
      .select()
      .from(users)
      .where(eq(users.email, this.seederConfig.email))
      .limit(1);

    return existing ?? null;
  }

  /**
   * Insert a fresh admin user
   */
  private async createAdmin(): Promise<void> {
    await this.assertUsernameAvailable();

    const hashedPassword = await bcrypt.hash(
      this.seederConfig.password,
      this.seederConfig.saltRounds,
    );
    const now = new Date();

    await this.db.insert(users).values({
      email: this.seederConfig.email,
      username: this.seederConfig.username,
      firstName: this.seederConfig.firstName,
      lastName: this.seederConfig.lastName,
      password: hashedPassword,
      role: UserRole.ADMIN,
      profilePicture: null,
      isActive: true,
      isEmailVerified: true,
      emailVerificationToken: null,
      passwordResetToken: null,
      passwordResetExpires: null,
      lastLoginAt: null,
      loginAttempts: 0,
      lockUntil: null,
      twoFactorSecret: null,
      isTwoFactorEnabled: false,
      createdAt: now,
      updatedAt: now,
    });

    this.log(`👑 Created admin user: ${this.seederConfig.email}`);
  }

  /**
   * Promote / unlock an existing user, optionally resetting the password
   */
  private async updateExistingAdmin(
    existing: typeof users.$inferSelect,
  ): Promise<void> {
    this.log(`ℹ️  User already exists: ${this.seederConfig.email}`);

    const updates: Partial<typeof users.$inferInsert> = {
      role: UserRole.ADMIN,
      isActive: true,
      isEmailVerified: true,
      loginAttempts: 0,
      lockUntil: null,
      updatedAt: new Date(),
    };

    if (this.seederConfig.forceResetPassword) {
      updates.password = await bcrypt.hash(
        this.seederConfig.password,
        this.seederConfig.saltRounds,
      );
      this.log('🔑 ADMIN_FORCE_RESET=true — password will be reset');
    } else {
      this.log(
        '🔒 Existing password kept. Set ADMIN_FORCE_RESET=true to overwrite it.',
      );
    }

    await this.db.update(users).set(updates).where(eq(users.id, existing.id));

    if (existing.role !== UserRole.ADMIN) {
      this.log(`⬆️  Promoted role: ${existing.role} → ${UserRole.ADMIN}`);
    }

    this.log(`👑 Updated admin user: ${this.seederConfig.email}`);
  }

  /**
   * Usernames are unique — fail early with a clear message instead of a
   * raw Postgres constraint violation
   */
  private async assertUsernameAvailable(): Promise<void> {
    const [conflict] = await this.db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(eq(users.username, this.seederConfig.username))
      .limit(1);

    if (conflict) {
      throw new Error(
        `🚫 Username "${this.seederConfig.username}" is already taken by ${conflict.email}. ` +
          'Set a different ADMIN_USERNAME.',
      );
    }
  }

  /**
   * Print login credentials — plaintext password only when it is the
   * publicly known development default
   */
  private printCredentials(): void {
    const shouldPrintPassword =
      this.seederConfig.usedDefaultPassword &&
      !this.seederConfig.isProductionEnvironment();

    this.log('──────────────────────────────────────────');
    this.log(`📧 Email:    ${this.seederConfig.email}`);
    this.log(`👤 Username: ${this.seederConfig.username}`);
    this.log(
      `🔑 Password: ${
        shouldPrintPassword
          ? this.seederConfig.password
          : '<value of ADMIN_PASSWORD>'
      }`,
    );
    this.log('──────────────────────────────────────────');
  }

  /**
   * Cleanup database connection
   */
  private async cleanup(): Promise<void> {
    try {
      await closeDatabaseConnection();
      this.log('🔌 Database connection closed');
    } catch (error) {
      this.logError('Failed to close database connection:', error);
    }
  }

  /**
   * Log message with timestamp
   */
  private log(message: string): void {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${message}`);
  }

  /**
   * Log error message
   */
  private logError(message: string, error: any): void {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] ${message}`, error);
  }
}

/**
 * Execute the seeder if this file is run directly
 */
if (require.main === module) {
  const seeder = new AdminSeeder();
  seeder
    .run()
    .then(() => {
      console.log('✅ Seeder execution completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Seeder execution failed:', error);
      process.exit(1);
    });
}
