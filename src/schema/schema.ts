import * as PgPromise from "pg-promise";

const pgp = PgPromise();

const sql = (strings: TemplateStringsArray, ...values: any[]) => ({
  text: String.raw(strings, ...values.map((_, i) => `$${i + 1}`)),
  values
});

export interface ColumnDefinition {
  type: string;
  nullable: boolean;
}

export interface TableDefinition {
  [columnName: string]: ColumnDefinition | undefined;
}

export interface SchemaDefinition {
  [tableName: string]: TableDefinition | undefined;
}

export interface DatabaseSchema {
  [schemaName: string]: SchemaDefinition | undefined;
}

interface Table {
  schema: string;
  table: string;
}

interface Enums {
  [schema: string]: SchemaEnums | undefined;
}

interface SchemaEnums {
  [enumName: string]: any[] | undefined;
}

export const generateSchema = async (connectionString: string) => {
  const db = pgp(connectionString);
  const tables = await getTables(db);
  const enums = await getEnums(db);

  const result: DatabaseSchema = {};

  for (const { table, schema } of tables) {
    if (!result[schema]) {
      result[schema] = {};
    }

    result[schema]![table] = await getTableDefinition(
      db,
      table,
      schema,
      enums[schema] || {}
    );
  }

  return result;
};

const mapPostgresToTypeScriptType = (
  udtName: string,
  enumTypes: SchemaEnums
): string => {
  switch (udtName) {
    case "bpchar":
    case "char":
    case "varchar":
    case "text":
    case "citext":
    case "uuid":
    case "bytea":
    case "inet":
    case "time":
    case "timetz":
    case "interval":
    case "name":
      return "string";
    case "int2":
    case "int4":
    case "int8":
    case "float4":
    case "float8":
    case "numeric":
    case "money":
    case "oid":
      return "number";
    case "bool":
      return "boolean";
    case "json":
    case "jsonb":
      return "Object";
    case "date":
    case "timestamp":
    case "timestamptz":
      return "Date";
    case "_int2":
    case "_int4":
    case "_int8":
    case "_float4":
    case "_float8":
    case "_numeric":
    case "_money":
      return "Array<number>";
    case "_bool":
      return "Array<boolean>";
    case "_varchar":
    case "_text":
    case "_citext":
    case "_uuid":
    case "_bytea":
      return "Array<string>";
    case "_json":
    case "_jsonb":
      return "Array<Object>";
    case "_timestamptz":
      return "Array<Date>";
    default:
      if (enumTypes[udtName]) {
        return enumTypes[udtName]!.join(" | ");
      } else {
        console.log(
          `Type [${udtName}] has been mapped to [any] because no specific type has been found.`
        );
        return "any";
      }
  }
};

const getTables = async (
  db: PgPromise.IDatabase<unknown>
): Promise<Table[]> => {
  return await db.any<Table>(
    sql`
      SELECT
        table_name AS table,
        table_schema AS schema
      FROM
        information_schema.columns
      GROUP BY
        table_name,
        table_schema
    `
  );
};

const getEnums = async (db: PgPromise.IDatabase<unknown>): Promise<Enums> => {
  type T = { schema: string; name: string; value: any };
  const enums: Enums = {};
  await db.each<T>(
    sql`
      SELECT
        n.nspname AS schema,
        t.typname AS name,
        e.enumlabel AS value
      FROM
        pg_type t
        JOIN pg_enum e ON t.oid = e.enumtypid
        JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
      ORDER BY
        t.typname ASC,
        e.enumlabel ASC
    `,
    null,
    ({ schema, name, value }: T) => {
      if (!enums[schema]) {
        enums[schema] = {};
      }

      if (!enums[schema]![name]) {
        enums[schema]![name] = [];
      }

      enums[schema]![name]!.push(value);
    }
  );
  return enums;
};

const getTableDefinition = async (
  db: PgPromise.IDatabase<unknown>,
  table: string,
  schema: string,
  enumTypes: SchemaEnums
): Promise<TableDefinition> => {
  const tableDefinition: TableDefinition = {};
  type T = { column_name: string; udt_name: string; is_nullable: string };
  await db.each<T>(
    sql`
      SELECT
        column_name,
        udt_name,
        is_nullable
      FROM
        information_schema.columns
      WHERE
        table_name = ${table}
        AND table_schema = ${schema}
    `,
    null,
    (schemaItem: T) => {
      tableDefinition[schemaItem.column_name] = {
        type: mapPostgresToTypeScriptType(schemaItem.udt_name, enumTypes),
        nullable: schemaItem.is_nullable === "YES"
      };
    }
  );
  return tableDefinition;
};
