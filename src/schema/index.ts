import { writeFile as writeFileCallback } from "fs";
import { promisify } from "util";
import { generateSchema } from "./schema";

const writeFile = promisify(writeFileCallback);

export const updateFile = async (
  connectionString: string,
  filePath: string
) => {
  const schema = await generateSchema(connectionString);
  await writeFile(filePath, JSON.stringify(schema, null, 4), "utf8");
};

if (!module.parent) {
  const main = async () => {
    const args = process.argv.slice(2);
    if (args.length !== 2) {
      throw new Error(
        "Please provide 2 positional arguments: connectionString and filePath"
      );
    }

    const [connectionString, filePath] = args;
    await updateFile(connectionString, filePath);
  };

  main().catch(err => {
    console.error(err);
    process.exitCode = 1;
  });
}
