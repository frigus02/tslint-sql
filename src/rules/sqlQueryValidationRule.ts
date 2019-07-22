import { readFileSync } from "fs";
import * as ts from "typescript";
import * as Lint from "tslint";
import { analyze, ParseError } from "../analysis";
import { Column } from "../analysis/params";
import { DatabaseSchema } from "../schema/schema";

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

  public static FAILURE_STRING_TYPE_MISSING(column: string): string {
    return `Types: Cannot find type for column ${column} in schema`;
  }

  public static FAILURE_STRING_TYPE_MISMATCH(
    column: string,
    expectedType: string,
    actualType: string
  ): string {
    return `Types: Column ${column} is type ${expectedType} but got type ${actualType}`;
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

function getName(expr: ts.LeftHandSideExpression) {
  if (ts.isCallExpression(expr) && ts.isIdentifier(expr.expression)) {
    return expr.expression.text;
  }
}

interface SqlTemplateData {
  position: number;
  text: string;
  expressions: ReadonlyArray<SqlTemplateExpression>;
}

interface SqlTemplateExpression {
  position: number;
  width: number;
  placeholderWidth: number;
  expression: ts.Expression;
}

function getTemplate(
  expr: ts.TemplateLiteral,
  sourceFile: ts.SourceFile
): SqlTemplateData | undefined {
  if (ts.isTemplateExpression(expr)) {
    const headText = expr.head.text;
    const spanTexts = expr.templateSpans.map(
      (span, i) => `$${i + 1}` + span.literal.text
    );
    return {
      position: expr.getStart(sourceFile),
      text: headText + spanTexts.join(""),
      expressions: expr.templateSpans.map((span, i) => ({
        position:
          headText.length +
          spanTexts.slice(0, i).reduce((acc, curr) => acc + curr.length, 0),
        placeholderWidth: `$${i + 1}`.length,
        width:
          span.literal.getStart(sourceFile) -
          span.expression.getStart(sourceFile) +
          span.expression.getLeadingTriviaWidth(sourceFile) +
          "${}".length,
        expression: span.expression
      }))
    };
  } else if (ts.isNoSubstitutionTemplateLiteral(expr)) {
    return {
      position: expr.getStart(sourceFile),
      text: expr.text,
      expressions: []
    };
  }
}

function readSchemaJson(path: string): DatabaseSchema {
  const data = readFileSync(path, "utf8");
  return JSON.parse(data);
}

function stringifyColumn(column: Column): string {
  return [column.schema, column.table, column.column].filter(x => x).join(".");
}

function walk(ctx: Lint.WalkContext<Options>, program: ts.Program): void {
  const checker = program.getTypeChecker();

  let schemaJson: DatabaseSchema;
  try {
    schemaJson = readSchemaJson(ctx.options.pathToSchemaJson);
  } catch (e) {
    return ctx.addFailure(
      0,
      0,
      Rule.FAILURE_STRING_SCHEMA_JSON(ctx.options.pathToSchemaJson, e.message)
    );
  }

  return ts.forEachChild(ctx.sourceFile, cb);

  function cb(node: ts.Node): void {
    if (ts.isTaggedTemplateExpression(node)) {
      const name = getName(node.tag);
      if (name !== "sql") return;

      const template = getTemplate(node.template, ctx.sourceFile);
      if (!template) return;

      const types = template.expressions.map(expr =>
        checker.typeToString(checker.getTypeAtLocation(expr.expression))
      );

      let analysis;
      try {
        analysis = analyze(template.text);
      } catch (e) {
        if (e instanceof ParseError) {
          return ctx.addFailureAt(
            template.position +
              e.cursorPosition +
              template.expressions
                .filter(expr => expr.position < e.cursorPosition - 1)
                .reduce(
                  (acc, curr) => acc + curr.width - curr.placeholderWidth,
                  0
                ),
            1,
            Rule.FAILURE_STRING_PARSE(e.message)
          );
        } else {
          return ctx.addFailureAtNode(
            node.template,
            Rule.FAILURE_STRING_PARSE(e.message)
          );
        }
      }

      for (const [index, column] of analysis.entries()) {
        const actualType = types[index - 1];

        const schema = column.schema || ctx.options.defaultSchemaName;
        const dbSchema = schemaJson[schema];
        const dbTable = dbSchema && dbSchema[column.table];
        const expectedType = dbTable && dbTable[column.column];

        if (!expectedType) {
          ctx.addFailureAtNode(
            template.expressions[index - 1].expression,
            Rule.FAILURE_STRING_TYPE_MISSING(stringifyColumn(column))
          );
        } else if (expectedType.type !== actualType) {
          ctx.addFailureAtNode(
            template.expressions[index - 1].expression,
            Rule.FAILURE_STRING_TYPE_MISMATCH(
              stringifyColumn(column),
              expectedType.type,
              actualType
            )
          );
        }
      }

      return;
    }

    return ts.forEachChild(node, cb);
  }
}
