import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { config } from "dotenv";

const require = createRequire(import.meta.url);
const adapterRequire = createRequire(require.resolve("@prisma/adapter-pg"));
const { Client } = adapterRequire("pg");
const quoteIdentifier = (value) => `"${value.replaceAll('"', '""')}"`;
const quoteLiteral = (value) => `'${value.replaceAll("'", "''")}'`;

export function createDatabaseClient() {
  config({ quiet: true });
  const url = new URL(process.env.DATABASE_URL);
  if (!url.searchParams.has("sslmode")) {
    url.searchParams.set("sslmode", "require");
    url.searchParams.set("uselibpqcompat", "true");
  }
  return new Client({
    connectionString: url.toString(),
    connectionTimeoutMillis: 15_000,
    query_timeout: 15_000,
  });
}

// Run inside a transaction. EXPLAIN without ANALYZE only plans the write probes.
export async function checkDatabaseSecurity(client) {
  const { rows: identity } = await client.query(
    "SELECT current_user AS name, rolbypassrls FROM pg_roles WHERE rolname = current_user",
  );
  const { rows: tables } = await client.query(`
    SELECT c.oid, c.relname AS name, c.relkind AS kind, c.relrowsecurity AS rls,
           pg_get_userbyid(c.relowner) AS owner, c.relforcerowsecurity AS force_rls
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p', 'v', 'm', 'f')
    ORDER BY c.relname
  `);
  assert(tables.some((table) => table.name === "User"), "Application tables were not found.");

  const { rows: roles } = await client.query(
    "SELECT rolname AS name FROM pg_roles WHERE rolname IN ('anon', 'authenticated') ORDER BY rolname",
  );
  assert.equal(roles.length, 2, "Run this check against the Supabase database.");

  for (const table of tables) {
    if (["r", "p"].includes(table.kind)) {
      assert(table.rls, `${table.name}: RLS is disabled.`);
      assert(
        identity[0].rolbypassrls || (table.owner === identity[0].name && !table.force_rls),
        `${table.name}: the Prisma connection cannot bypass the API deny rules.`,
      );
    }
    // Confirm the application's database connection can still read each relation.
    await client.query(`SELECT * FROM public.${quoteIdentifier(table.name)} LIMIT 0`);

    for (const role of roles) {
      const { rows: privileges } = await client.query(`
        SELECT has_table_privilege($1, $2::oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
          OR has_any_column_privilege($1, $2::oid, 'SELECT,INSERT,UPDATE,REFERENCES') AS exposed
      `, [role.name, table.oid]);
      assert(!privileges[0].exposed, `${table.name}: ${role.name} still has table or column access.`);
    }
  }

  const { rows: defaults } = await client.query(`
    SELECT count(*)::int AS exposed
    FROM pg_default_acl d
    CROSS JOIN LATERAL aclexplode(d.defaclacl) acl
    LEFT JOIN pg_roles grantee ON grantee.oid = acl.grantee
    WHERE d.defaclrole = (SELECT oid FROM pg_roles WHERE rolname = current_user)
      AND (d.defaclnamespace = 0 OR d.defaclnamespace = 'public'::regnamespace)
      AND d.defaclobjtype IN ('r', 'S')
      AND (acl.grantee = 0 OR grantee.rolname IN ('anon', 'authenticated'))
  `);
  assert.equal(defaults[0].exposed, 0, "Future tables/sequences still receive automatic public grants.");

  let blockedQueries = 0;
  for (const role of roles) {
    const probes = [];
    await client.query(`SET LOCAL ROLE ${quoteIdentifier(role.name)}`);
    for (const table of tables) {
      const relation = `public.${quoteIdentifier(table.name)}`;
      probes.push(`SELECT * FROM ${relation} LIMIT 0`);
      if (["r", "p"].includes(table.kind)) {
        probes.push(
          `EXPLAIN INSERT INTO ${relation} DEFAULT VALUES`,
          `EXPLAIN UPDATE ${relation} SET "id" = "id" WHERE false`,
          `EXPLAIN DELETE FROM ${relation} WHERE false`,
        );
      }
    }
    // Batch the probes on the server to avoid a network round trip per denial.
    await client.query(`
      DO $check$
      DECLARE probe text; denied boolean;
      BEGIN
        FOREACH probe IN ARRAY ARRAY[${probes.map(quoteLiteral).join(",")}] LOOP
          denied := false;
          BEGIN
            EXECUTE probe;
          EXCEPTION WHEN insufficient_privilege THEN
            denied := true;
          END;
          IF NOT denied THEN
            RAISE EXCEPTION 'Expected permission denial: %', probe;
          END IF;
        END LOOP;
      END;
      $check$;
    `);
    blockedQueries += probes.length;
    await client.query("RESET ROLE");
  }
  return { protectedTables: tables.length, blockedQueries, serverAccess: "OK", futureGrants: "private" };
}

async function main() {
  const client = createDatabaseClient();
  try {
    await client.connect();
    await client.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
    console.log(JSON.stringify(await checkDatabaseSecurity(client), null, 2));
  } finally {
    await client.query("ROLLBACK").catch(() => {});
    await client.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.code === "ERR_ASSERTION" ? error.message : `Security check failed (${error.code ?? error.name}).`);
    process.exitCode = 1;
  });
}
