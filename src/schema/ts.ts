import {
  ColumnDefinition as DbColumnDefinition,
  DatabaseSchema as DbDatabaseSchema,
  SchemaDefinition as DbSchemaDefinition
} from "./db";

export type ColumnDefinition = string;

export interface TableDefinition {
  [columnName: string]: ColumnDefinition | undefined;
}

export interface SchemaDefinition {
  [tableName: string]: TableDefinition | undefined;
}

export interface DatabaseSchema {
  [schemaName: string]: SchemaDefinition | undefined;
}

export const mapSchemaToTypeScriptTypes = (
  dbSchema: DbDatabaseSchema
): DatabaseSchema => {
  const result: DatabaseSchema = {};

  for (const schemaName of Object.keys(dbSchema)) {
    if (!result[schemaName]) {
      result[schemaName] = {};
    }

    const schema = dbSchema[schemaName]!;
    for (const tableName of Object.keys(schema.tables)) {
      if (!result[schemaName]![tableName]) {
        result[schemaName]![tableName] = {};
      }

      for (const columnName of Object.keys(schema.tables[tableName]!)) {
        result[schemaName]![tableName]![
          columnName
        ] = mapPostgresToTypeScriptType(
          schema.tables[tableName]![columnName]!,
          schema.enums
        );
      }
    }
  }

  return result;
};

const getBaseType = (
  column: DbColumnDefinition,
  enums: DbSchemaDefinition["enums"]
) => {
  if (column.userDefined) {
    const values = enums[column.type];
    if (values) {
      return values.map(v => JSON.stringify(v)).join(" | ");
    }

    console.warn(
      `Could not find enum for user-defined type [${
        column.type
      }]; mapping to [any] instead.`
    );
    return "any";
  }

  // https://www.postgresql.org/docs/11/datatype.html
  switch (column.type) {
    case "bytea":
      return "Buffer";
    case "bit":
    case "bit varying":
    case "character":
    case "character varying":
    case "money":
    case "text":
    case "time with time zone":
    case "time without time zone":
    case "uuid":
      return "string";
    case "bigint":
    case "bigserial":
    case "double precision":
    case "integer":
    case "numeric":
    case "real":
    case "smallint":
    case "smallserial":
    case "serial":
      return "number";
    case "boolean":
      return "boolean";
    case "json":
    case "jsonb":
      return "Object";
    case "date":
    case "timestamp with time zone":
    case "timestamp without time zone":
      return "Date";
    default:
      console.warn(
        `Could not map type [${column.type}]; mapping to [any] instead.`
      );
      return "any";
  }
};

const mapPostgresToTypeScriptType = (
  column: DbColumnDefinition,
  enums: DbSchemaDefinition["enums"]
): ColumnDefinition => {
  let type = getBaseType(column, enums);
  if (column.array) {
    type = `Array<${type}>`;
  }

  if (column.nullable) {
    type = `${type} | null`;
  }

  return type;
};
