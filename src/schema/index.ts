import { writeFile as writeFileCallback } from "fs";
import { promisify } from "util";
import { generateSchema } from "./schema";

const writeFile = promisify(writeFileCallback);

export const updateFile = async (filePath: string, schemaNames: string[]) => {
  const schema = await generateSchema(schemaNames);
  await writeFile(filePath, JSON.stringify(schema, null, 4), "utf8");
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
