import { Client } from "pg";

const sql = (strings: TemplateStringsArray, ...values: any[]) => ({
  text: String.raw(strings, ...values.map((_, i) => `$${i + 1}`)),
  values
});

export interface ColumnDefinition {
  type: string;
  array: boolean;
  nullable: boolean;
  userDefined: boolean;
}

export interface TableDefinition {
  [columnName: string]: ColumnDefinition | undefined;
}

export interface SchemaDefinition {
  tables: {
    [tableName: string]: TableDefinition | undefined;
  };
  enums: {
    [enumName: string]: string[] | undefined;
  };
}

export interface DatabaseSchema {
  [schemaName: string]: SchemaDefinition | undefined;
}

export const exportSchema = async (
  schemaNames?: string[]
): Promise<DatabaseSchema> => {
  const client = new Client();
  await client.connect();
  const tables = await getTables(client);
  const enums = await getEnums(client);
  await client.end();

  const result: DatabaseSchema = {};
  const schemas = Object.keys(tables).filter(
    schema =>
      !schemaNames || schemaNames.length === 0 || schemaNames.includes(schema)
  );
  for (const schema of schemas) {
    result[schema] = {
      tables: tables[schema]!,
      enums: enums[schema] || {}
    };
  }

  return result;
};

interface Enums {
  [schemaName: string]: SchemaDefinition["enums"] | undefined;
}

const getEnums = async (db: Client): Promise<Enums> => {
  type Row = {
    schema: string;
    name: string;
    value: string;
  };
  const res = await db.query(
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
    `
  );

  const enums: Enums = {};
  for (const row of res.rows) {
    const { schema, name, value } = <Row>row;
    if (!enums[schema]) {
      enums[schema] = {};
    }

    if (!enums[schema]![name]) {
      enums[schema]![name] = [];
    }

    enums[schema]![name]!.push(value);
  }

  return enums;
};

interface Tables {
  [schemaName: string]: SchemaDefinition["tables"] | undefined;
}

const getTables = async (db: Client): Promise<Tables> => {
  type Row = {
    schema: string;
    table: string;
    column: string;
    type: string;
    is_array: boolean;
    is_nullable: boolean;
    is_user_defined: boolean;
  };
  const res = await db.query(
    sql`
      SELECT
        c.table_schema AS schema,
        c.table_name AS table,
        c.column_name AS column,
        CASE
            WHEN c.data_type = 'ARRAY' THEN CASE
                WHEN e.data_type = 'USER-DEFINED' THEN e.udt_name
                ELSE e.data_type
            END
            WHEN c.data_type = 'USER-DEFINED' THEN c.udt_name
            ELSE c.data_type
        END AS type,
        CASE
            WHEN c.data_type = 'ARRAY' THEN true
            ELSE false
        END AS is_array,
        CASE
            WHEN c.is_nullable = 'YES' THEN true
            ELSE false
        END AS is_nullable,
        CASE
            WHEN c.data_type = 'ARRAY' THEN CASE
                WHEN e.data_type = 'USER-DEFINED' THEN true
                ELSE true
            END
            WHEN c.data_type = 'USER-DEFINED' THEN true
            ELSE false
        END AS is_user_defined
      FROM
        information_schema.columns c
        LEFT JOIN information_schema.element_types e ON (
            (c.table_catalog,  c.table_schema,  c.table_name, 'TABLE',        c.dtd_identifier) =
            (e.object_catalog, e.object_schema, e.object_name, e.object_type, e.collection_type_identifier)
        )
    `
  );

  const tables: Tables = {};
  for (const row of res.rows) {
    const {
      schema,
      table,
      column,
      type,
      is_array,
      is_nullable,
      is_user_defined
    } = <Row>row;

    if (!tables[schema]) {
      tables[schema] = {};
    }

    if (!tables[schema]![table]) {
      tables[schema]![table] = {};
    }

    tables[schema]![table]![column] = {
      type,
      array: is_array,
      nullable: is_nullable,
      userDefined: is_user_defined
    };
  }

  return tables;
};
