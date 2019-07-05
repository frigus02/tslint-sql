import * as ts from "typescript";
import * as Lint from "tslint";
import { analyze, ParseError } from "../analysis";

const SCHEMA: any = {
  payments: {
    payment_id: "string",
    user_id: "number",
    amount: "number",
    description: "string",
    status: "string",
    created_at: "Date",
    updated_at: "Date"
  },
  users: {
    user_id: "number",
    name: "string",
    details: "object"
  }
};

export class Rule extends Lint.Rules.TypedRule {
  public static metadata: Lint.IRuleMetadata = {
    ruleName: "sql-queries",
    type: "functionality",
    description: "Checks SQL queries for syntax and types",
    optionsDescription: "",
    options: {},
    typescriptOnly: true
  };

  public static FAILURE_PREFIX_PARSE = "Parse: ";
  public static FAILURE_PREFIX_TYPES = "Types: ";

  public applyWithProgram(
    sourceFile: ts.SourceFile,
    program: ts.Program
  ): Lint.RuleFailure[] {
    return this.applyWithFunction(sourceFile, walk, undefined, program);
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

function walk(ctx: Lint.WalkContext<void>, program: ts.Program) {
  return ts.forEachChild(ctx.sourceFile, cb);

  function cb(node: ts.Node): void {
    if (ts.isTaggedTemplateExpression(node)) {
      const name = getName(node.tag);
      if (name !== "sql") return;

      const template = getTemplate(node.template, ctx.sourceFile);
      if (!template) return;

      const checker = program.getTypeChecker();
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
            Rule.FAILURE_PREFIX_PARSE + e.message
          );
        } else {
          return ctx.addFailureAtNode(
            node.template,
            Rule.FAILURE_PREFIX_PARSE + e.message
          );
        }
      }

      for (const [index, fullColumn] of analysis.entries()) {
        const [table, column] = fullColumn.split(".");
        const expectedType = SCHEMA[table] && SCHEMA[table][column];
        const actualType = types[index - 1];
        if (expectedType !== actualType) {
          ctx.addFailureAtNode(
            template.expressions[index - 1].expression,
            Rule.FAILURE_PREFIX_TYPES +
              `Column ${fullColumn} is type ${expectedType} but got type ${actualType}`
          );
        }
      }

      return;
    }

    return ts.forEachChild(node, cb);
  }
}
