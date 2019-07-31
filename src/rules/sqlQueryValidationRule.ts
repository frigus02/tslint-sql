import { readFileSync } from "fs";
import * as ts from "typescript";
import * as Lint from "tslint";
import { analyze, ParseError, Analysis } from "../analysis";
import { Parameter } from "../analysis/params";
import { parse as parseSchema } from "../schema/file";
import { DatabaseSchema } from "../schema/generate";
import { getExpectedType, stringify } from "./dbParameter";
import {
  getName,
  getTemplateData,
  templatePositionToFilePosition,
  SqlTemplateData
} from "./tsTemplate";

const OPTION_PATH_TO_SCHEMA_JSON = "path-to-schema-json";
const OPTION_DEFAULT_SCHEMA_NAME = "default-schema-name";

interface Options {
  pathToSchemaJson: string;
  defaultSchemaName: string;
}

export class Rule extends Lint.Rules.TypedRule {
  public static metadata: Lint.IRuleMetadata = {
    ruleName: "sql-queries",
    type: "functionality",
    description: "Checks SQL queries for syntax and types",
    optionsDescription: Lint.Utils.dedent`
      In order to validate types in the SQL queries, you have to tell this rule
      about your database schema. Create a JSON and specify the path to it in
      the \`${OPTION_PATH_TO_SCHEMA_JSON}\` option.

      In case your database uses a different default schema name, specify it
      with the option \`${OPTION_DEFAULT_SCHEMA_NAME}\`.`,
    options: {
      type: "object",
      properties: {
        [OPTION_DEFAULT_SCHEMA_NAME]: {
          type: "string"
        },
        [OPTION_PATH_TO_SCHEMA_JSON]: {
          type: "string"
        }
      },
      additionalProperties: false
    },
    optionExamples: [
      {
        options: {
          [OPTION_PATH_TO_SCHEMA_JSON]: "./db-schema.json"
        }
      },
      {
        options: {
          [OPTION_PATH_TO_SCHEMA_JSON]: "./db-schema.json",
          [OPTION_DEFAULT_SCHEMA_NAME]: "public"
        }
      }
    ],
    typescriptOnly: true
  };

  public static FAILURE_STRING_SCHEMA_JSON(
    schemaJsonPath: string,
    error: string
  ): string {
    return `Options: could not read schema JSON file from ${schemaJsonPath}: ${error}`;
  }

  public static FAILURE_STRING_PARSE(message: string): string {
    return `Parse: ${message}`;
  }

  public static FAILURE_STRING_TYPE_MISSING(parameter: Parameter): string {
    return `Types: Cannot find type for parameter ${stringify(
      parameter
    )} in schema`;
  }

  public static FAILURE_STRING_TYPE_MISMATCH(
    parameter: Parameter,
    expectedType: string,
    actualType: string
  ): string {
    return `Types: Parameter ${stringify(
      parameter
    )} is type ${expectedType} but got type ${actualType}`;
  }

  public applyWithProgram(
    sourceFile: ts.SourceFile,
    program: ts.Program
  ): Lint.RuleFailure[] {
    const rawOptions = { ...this.ruleArguments[0] } as {
      [OPTION_PATH_TO_SCHEMA_JSON]: string;
      [OPTION_DEFAULT_SCHEMA_NAME]?: string;
    };
    return this.applyWithFunction(
      sourceFile,
      walk,
      {
        pathToSchemaJson: rawOptions[OPTION_PATH_TO_SCHEMA_JSON],
        defaultSchemaName: rawOptions[OPTION_DEFAULT_SCHEMA_NAME] || "public"
      },
      program
    );
  }
}

const loadSchema = (ctx: Lint.WalkContext<Options>) => {
  try {
    return parseSchema(readFileSync(ctx.options.pathToSchemaJson, "utf8"));
  } catch (e) {
    ctx.addFailure(
      0,
      0,
      Rule.FAILURE_STRING_SCHEMA_JSON(ctx.options.pathToSchemaJson, e.message)
    );
  }
};

const analyzeTemplate = (
  ctx: Lint.WalkContext<Options>,
  template: ts.TemplateLiteral,
  templateData: SqlTemplateData
) => {
  try {
    return analyze(templateData.text);
  } catch (e) {
    if (e instanceof ParseError) {
      ctx.addFailureAt(
        templatePositionToFilePosition(templateData, e.cursorPosition),
        1,
        Rule.FAILURE_STRING_PARSE(e.message)
      );
    } else {
      ctx.addFailureAtNode(template, Rule.FAILURE_STRING_PARSE(e.message));
    }
  }
};

const printWarnings = (analysis: Analysis) => {
  for (const { type, what, node } of analysis.warnings) {
    console.warn(type, what, JSON.stringify(node));
  }
};

const checkParameterType = (
  ctx: Lint.WalkContext<Options>,
  checker: ts.TypeChecker,
  expression: ts.Expression,
  schema: DatabaseSchema,
  parameter: Parameter
) => {
  const actualType = checker.typeToString(
    checker.getTypeAtLocation(expression)
  );
  const expectedType = getExpectedType(
    parameter,
    schema,
    ctx.options.defaultSchemaName
  );

  if (!expectedType) {
    ctx.addFailureAtNode(
      expression,
      Rule.FAILURE_STRING_TYPE_MISSING(parameter)
    );
  } else if (expectedType !== actualType) {
    ctx.addFailureAtNode(
      expression,
      Rule.FAILURE_STRING_TYPE_MISMATCH(parameter, expectedType, actualType)
    );
  }
};

function walk(ctx: Lint.WalkContext<Options>, program: ts.Program): void {
  const schemaJson = loadSchema(ctx);
  if (!schemaJson) return;

  const checker = program.getTypeChecker();

  return ts.forEachChild(ctx.sourceFile, cb);

  function cb(node: ts.Node): void {
    if (ts.isTaggedTemplateExpression(node)) {
      const name = getName(node.tag);
      if (name !== "sql") return;

      const templateData = getTemplateData(node.template, ctx.sourceFile);
      if (!templateData) return;

      const analysis = analyzeTemplate(ctx, node.template, templateData);
      if (!analysis) return;

      printWarnings(analysis);

      for (const [index, parameter] of analysis.parameters.entries()) {
        const expression = templateData.expressions[index - 1].expression;
        checkParameterType(ctx, checker, expression, schemaJson!, parameter);
      }

      return;
    }

    return ts.forEachChild(node, cb);
  }
}
