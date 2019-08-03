import { exportSchema } from "./db";
import { mapSchemaToTypeScriptTypes } from "./ts";
import { write } from "./file";

const updateFile = async (filePath: string, schemaNames: string[]) => {
  const schema = await exportSchema(schemaNames);
  const mappedSchema = mapSchemaToTypeScriptTypes(schema);
  await write(filePath, mappedSchema);
};

if (!module.parent) {
  const main = async () => {
    const args = process.argv.slice(2);
    if (args.length < 1) {
      console.log(
        `Usage: ${process.argv[0]} ${process.argv[1]} OUT_FILE [SCHEMA_NAME...]`
      );
      process.exit(1);
    }

    const [filePath, ...schemaNames] = args;
    await updateFile(filePath, schemaNames);
  };

  main().catch(err => {
    console.error(err);
    process.exitCode = 1;
  });
}
