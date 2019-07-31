import * as ts from "typescript";

export const getName = (expr: ts.LeftHandSideExpression) => {
  if (ts.isCallExpression(expr) && ts.isIdentifier(expr.expression)) {
    return expr.expression.text;
  }
};

export interface SqlTemplateData {
  position: number;
  text: string;
  expressions: ReadonlyArray<SqlTemplateExpression>;
}

export interface SqlTemplateExpression {
  position: number;
  width: number;
  placeholderWidth: number;
  expression: ts.Expression;
}

export const getTemplateData = (
  expr: ts.TemplateLiteral,
  sourceFile: ts.SourceFile
): SqlTemplateData | undefined => {
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
};

export const templatePositionToFilePosition = (
  templateData: SqlTemplateData,
  positionInTemplate: number
) =>
  templateData.position +
  positionInTemplate +
  templateData.expressions
    .filter(expr => expr.position < positionInTemplate - 1)
    .reduce((acc, curr) => acc + curr.width - curr.placeholderWidth, 0);
