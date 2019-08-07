import * as ts from "typescript";

const isSameLiteral = (
  a: ts.BooleanLiteral | ts.LiteralExpression | ts.PrefixUnaryExpression,
  b: ts.BooleanLiteral | ts.LiteralExpression | ts.PrefixUnaryExpression
): boolean => {
  if (
    a.kind === ts.SyntaxKind.TrueKeyword ||
    a.kind === ts.SyntaxKind.FalseKeyword ||
    b.kind === ts.SyntaxKind.TrueKeyword ||
    b.kind === ts.SyntaxKind.FalseKeyword
  ) {
    return a.kind === b.kind;
  }

  if (
    a.kind === ts.SyntaxKind.PrefixUnaryExpression ||
    b.kind === ts.SyntaxKind.PrefixUnaryExpression
  ) {
    return false;
  }

  return (<ts.LiteralExpression>a).text === (<ts.LiteralExpression>b).text;
};

export const isAssignableTo = (
  source: ts.TypeNode,
  target: ts.TypeNode
): boolean => {
  if (ts.isLiteralTypeNode(source) && ts.isLiteralTypeNode(target)) {
    return isSameLiteral(source.literal, target.literal);
  }

  if (target.kind === source.kind) {
    return true;
  }

  if (ts.isUnionTypeNode(target)) {
    return target.types.some(t => isAssignableTo(source, t));
  }

  return false;

  //   switch (source.kind) {
  //     case ts.SyntaxKind.AnyKeyword:
  //     case ts.SyntaxKind.UnknownKeyword:
  //     case ts.SyntaxKind.NumberKeyword:
  //     case ts.SyntaxKind.BigIntKeyword:
  //     case ts.SyntaxKind.ObjectKeyword:
  //     case ts.SyntaxKind.BooleanKeyword:
  //     case ts.SyntaxKind.StringKeyword:
  //     case ts.SyntaxKind.SymbolKeyword:
  //     case ts.SyntaxKind.ThisKeyword:
  //     case ts.SyntaxKind.VoidKeyword:
  //     case ts.SyntaxKind.UndefinedKeyword:
  //     case ts.SyntaxKind.NullKeyword:
  //     case ts.SyntaxKind.NeverKeyword:
  //       return "KeywordType";
  //     case ts.SyntaxKind.UnionType:
  //       return "UnionType";
  //     case ts.SyntaxKind.TypeReference:
  //       return "TypeReference";
  //     default:
  //       return "unknown";
  //   }
};
