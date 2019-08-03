import { Parameter } from "../analysis/params";
import { ColumnDefinition, DatabaseSchema } from "../schema/ts";

export const stringify = (parameter: Parameter): string => {
  return [
    parameter.schema,
    parameter.table,
    parameter.column,
    parameter.jsonPath && parameter.jsonPath.path
  ]
    .filter(x => x)
    .join(".");
};

export const getExpectedType = (
  parameter: Parameter,
  schemaJson: DatabaseSchema,
  defaultSchemaName: string
): ColumnDefinition | undefined => {
  const schema = parameter.schema || defaultSchemaName;
  const dbSchema = schemaJson[schema];
  const dbTable = dbSchema && dbSchema[parameter.table];
  const dbColumn = dbTable && dbTable[parameter.column];
  if (dbColumn) {
    return parameter.jsonPath && parameter.jsonPath.isText
      ? "string | null"
      : dbColumn;
  }
};
