import { Parameter } from "../analysis/params";
import { DatabaseSchema } from "../schema/generate";

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
) => {
  const schema = parameter.schema || defaultSchemaName;
  const dbSchema = schemaJson[schema];
  const dbTable = dbSchema && dbSchema[parameter.table];
  const dbColumn = dbTable && dbTable[parameter.column];
  if (dbColumn) {
    return parameter.jsonPath && parameter.jsonPath.isText
      ? "string"
      : dbColumn.type;
  }
};
