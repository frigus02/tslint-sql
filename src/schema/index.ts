import { writeFile as writeFileCallback } from "fs";
import { promisify } from "util";
import { generateSchema } from "./schema";

const writeFile = promisify(writeFileCallback);

export const updateFile = async (filePath: string) => {
  const schema = await generateSchema();
  await writeFile(filePath, JSON.stringify(schema, null, 4), "utf8");
};

if (!module.parent) {
  const main = async () => {
    const args = process.argv.slice(2);
    if (args.length !== 1) {
      throw new Error("Please provide 1 positional arguments: filePath");
    }

    const [filePath] = args;
    await updateFile(filePath);
  };

  main().catch(err => {
    console.error(err);
    process.exitCode = 1;
  });
}
