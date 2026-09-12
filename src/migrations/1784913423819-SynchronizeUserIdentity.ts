import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Aligns the users table with the account contract used by the backend:
 * phone is the required login identifier, email is optional, and account
 * roles are limited to user/admin.
 *
 * The migration fails before adding constraints if existing data cannot be
 * made valid. This is intentional: silently dropping or merging accounts
 * would be much more dangerous than stopping the deployment for a data fix.
 */
export class SynchronizeUserIdentity1784913423819
  implements MigrationInterface
{
  name = 'SynchronizeUserIdentity1784913423819';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE users
      SET email = NULL
      WHERE email IS NULL OR TRIM(email) = ''
    `);

    await queryRunner.query(`
      UPDATE users
      SET email = LOWER(TRIM(email))
      WHERE email IS NOT NULL
    `);

    await queryRunner.query(`
      UPDATE users
      SET phonenumber = TRIM(phonenumber)
      WHERE phonenumber IS NOT NULL
    `);

    await queryRunner.query(`
      UPDATE users
      SET role = 'user'
      WHERE role IS NULL OR role = 'soldier'
    `);

    await queryRunner.query(`
      UPDATE users
      SET status = 'active'
      WHERE status IS NULL OR TRIM(status) = ''
    `);

    await queryRunner.query(`
      UPDATE users
      SET uuid = UUID()
      WHERE uuid IS NULL OR TRIM(uuid) = ''
    `);

    const invalidDataChecks: Array<{ name: string; sql: string }> = [
      {
        name: 'phone number is missing',
        sql: `SELECT COUNT(*) AS count FROM users WHERE phonenumber IS NULL OR TRIM(phonenumber) = ''`,
      },
      {
        name: 'username is missing',
        sql: `SELECT COUNT(*) AS count FROM users WHERE username IS NULL OR TRIM(username) = ''`,
      },
      {
        name: 'phone number is too long',
        sql: `SELECT COUNT(*) AS count FROM users WHERE CHAR_LENGTH(phonenumber) > 30`,
      },
      {
        name: 'duplicate phone number',
        sql: `SELECT phonenumber FROM users GROUP BY phonenumber HAVING COUNT(*) > 1 LIMIT 1`,
      },
      {
        name: 'duplicate username',
        sql: `SELECT username FROM users GROUP BY username HAVING COUNT(*) > 1 LIMIT 1`,
      },
      {
        name: 'duplicate email',
        sql: `SELECT email FROM users WHERE email IS NOT NULL GROUP BY email HAVING COUNT(*) > 1 LIMIT 1`,
      },
      {
        name: 'duplicate uuid',
        sql: `SELECT uuid FROM users GROUP BY uuid HAVING COUNT(*) > 1 LIMIT 1`,
      },
      {
        name: 'invalid account role',
        sql: `SELECT role FROM users WHERE role NOT IN ('user', 'admin') OR role IS NULL LIMIT 1`,
      },
    ];

    for (const check of invalidDataChecks) {
      const rows = await queryRunner.query(check.sql);
      const isCountCheck = check.sql.startsWith('SELECT COUNT(*)');
      const hasInvalidData = isCountCheck
        ? Number(rows[0]?.count ?? 0) > 0
        : rows.length > 0;

      if (hasInvalidData) {
        throw new Error(`Cannot synchronize users table: ${check.name}.`);
      }
    }

    await queryRunner.query(`
      ALTER TABLE users
      MODIFY username VARCHAR(255) NOT NULL,
      MODIFY email VARCHAR(255) NULL,
      MODIFY phonenumber VARCHAR(30) NOT NULL,
      MODIFY uuid VARCHAR(255) NOT NULL,
      MODIFY role ENUM('user', 'admin') NOT NULL DEFAULT 'user',
      MODIFY status VARCHAR(255) NOT NULL DEFAULT 'active'
    `);

    await queryRunner.query(
      `CREATE UNIQUE INDEX UQ_users_username ON users (username)`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX UQ_users_email ON users (email)`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX UQ_users_phonenumber ON users (phonenumber)`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX UQ_users_uuid ON users (uuid)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX UQ_users_uuid ON users`);
    await queryRunner.query(`DROP INDEX UQ_users_phonenumber ON users`);
    await queryRunner.query(`DROP INDEX UQ_users_email ON users`);
    await queryRunner.query(`DROP INDEX UQ_users_username ON users`);

    await queryRunner.query(`
      ALTER TABLE users
      MODIFY username VARCHAR(255) NULL,
      MODIFY email VARCHAR(255) NULL,
      MODIFY phonenumber VARCHAR(255) NULL,
      MODIFY uuid VARCHAR(255) NULL,
      MODIFY role VARCHAR(255) NULL,
      MODIFY status VARCHAR(255) NULL
    `);
  }
}
