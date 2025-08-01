import { almebicBackcompatMigrator } from "./db/alembic-kysely-migrator";
import { defineConfig } from "kysely-ctl";
import { Pool } from "pg";
import { getDatabaseConfig } from "./src/db/db-config";

export default defineConfig({
  destroyOnExit: true, // optional. dictates whether the (resolved) `kysely` instance should be destroyed when a command is finished executing. default is `true`.
  dialect: "pg", // a `Kysely` dialect instance OR the name of an underlying driver library (e.g. `'pg'`).
  dialectConfig: {
    pool: new Pool({
      ...getDatabaseConfig(),
      max: 10,
    }),
  }, // optional. when `dialect` is the name of an underlying driver library, `dialectConfig` is the options passed to the Kysely dialect that matches that library.
  migrations: {
    // optional.
    // allowJS, // optional. controls whether `.js`, `.cjs` or `.mjs` migrations are allowed. default is `false`.
    // getMigrationPrefix, // optional. a function that returns a migration prefix. affects `migrate make` command. default is `() => ${Date.now()}_`.
    // migrationFolder, // optional. name of migrations folder. default is `'migrations'`.
    migrator: almebicBackcompatMigrator, // optional. a `Kysely` migrator instance factory of shape `(db: Kysely<any>) => Migrator | Promise<Migrator>`. default is `Kysely`'s `Migrator`.
    // provider, // optional. a `Kysely` migration provider instance. default is `kysely-ctl`'s `TSFileMigrationProvider`.
  },
  plugins: [], // optional. `Kysely` plugins list. default is `[]`.
  seeds: {
    // optional.
    // allowJS, // optional. controls whether `.js`, `.cjs` or `.mjs` seeds are allowed. default is `false`.
    // getSeedPrefix, // optional. a function that returns a seed prefix. affects `seed make` command. default is `() => ${Date.now()}_`.
    // provider, // optional. a seed provider instance. default is `kysely-ctl`'s `FileSeedProvider`.
    // seeder, // optional. a seeder instance factory of shape `(db: Kysely<any>) => Seeder | Promise<Seeder>`. default is `kysely-ctl`'s `Seeder`.
    // seedFolder, // optional. name of seeds folder. default is `'seeds'`.
  },
});
