import { promises as fs } from "fs";
import { DatabaseSchema } from "./ts";

export const parse = (json: string): DatabaseSchema => {
  return JSON.parse(json);
};

export const write = async (filePath: string, schema: DatabaseSchema) => {
  const json = JSON.stringify(schema, null, 4);
  await fs.writeFile(filePath, json, "utf8");
};
