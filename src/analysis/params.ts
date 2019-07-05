import {
  PgA_Expr_Kind,
  PgColumnRef,
  PgDeleteStmt,
  PgInsertStmt,
  PgNode,
  PgSelectStmt,
  PgUpdateStmt
} from "pg-query-native";
import {
  isPgA_Expr,
  isPgBoolExpr,
  isPgColumnRef,
  isPgJoinExpr,
  isPgNodeArray,
  isPgNullTest,
  isPgParamRef,
  isPgRangeVar,
  isPgResTarget,
  isPgSelectStmt,
  isPgString,
  isPgSubLink
} from "../gen/pg-type-guards";
import { assignMap, notSupported } from "./utils";

const getColumnName = (
  columnRef: PgColumnRef,
  relations: Map<string, string>
) => {
  if (columnRef.ColumnRef.fields!.length === 0) {
    throw new Error(`ColumnRef has no fields: ${JSON.stringify(columnRef)}`);
  }

  if (columnRef.ColumnRef.fields!.length > 2) {
    console.warn("ColumnRef has more then 2 fields", columnRef);
  }

  const getField = (field: PgNode) => {
    if (isPgString(field)) {
      return field.String.str!;
    } else {
      throw new Error(
        `ColumnRef field has no name: ${JSON.stringify(columnRef)}`
      );
    }
  };

  let table: string;
  let column: string;
  if (columnRef.ColumnRef.fields!.length == 1) {
    table =
      relations.size === 1
        ? Array.from(relations.values())[0]
        : relations.get("") || "<NOT FOUND>";
    column = getField(columnRef.ColumnRef.fields![0]);
  } else {
    const tableOrAlias = getField(columnRef.ColumnRef.fields![0]);
    table = relations.get(tableOrAlias) || tableOrAlias;
    column = getField(columnRef.ColumnRef.fields![1]);
  }

  return `${table}.${column}`;
};

const getRelations = (node: PgNode) => {
  const relations = new Map<string, string>();

  if (isPgJoinExpr(node)) {
    assignMap(
      relations,
      getRelations(node.JoinExpr.larg!),
      getRelations(node.JoinExpr.rarg!)
    );
  } else if (isPgRangeVar(node)) {
    relations.set(
      node.RangeVar.alias ? node.RangeVar.alias.Alias.aliasname! : "",
      node.RangeVar.relname!
    );
  }

  return relations;
};

const getRelationsForFromClause = (fromClause: PgNode[]) => {
  const relations = new Map<string, string>();
  assignMap(relations, ...fromClause.map(getRelations));
  return relations;
};

const getParamMapForWhereClause = (
  whereClause: PgNode,
  relations: Map<string, string>
) => {
  const params = new Map<number, string>();
  if (isPgA_Expr(whereClause)) {
    const expr = whereClause.A_Expr;
    switch (expr.kind) {
      case PgA_Expr_Kind.AEXPR_IN:
        if (isPgNodeArray(expr.rexpr!)) {
          if (isPgColumnRef(expr.lexpr!)) {
            const columnName = getColumnName(expr.lexpr, relations);
            for (const field of expr.rexpr) {
              if (isPgParamRef(field)) {
                params.set(field.ParamRef.number, columnName);
              }
            }
          } else {
            notSupported("where clause", whereClause);
          }
        } else {
          notSupported("where clause", whereClause);
        }
        break;
      case PgA_Expr_Kind.AEXPR_OP:
      case PgA_Expr_Kind.AEXPR_OP_ANY:
      case PgA_Expr_Kind.AEXPR_OP_ALL:
        if (isPgParamRef(expr.rexpr!)) {
          if (isPgColumnRef(expr.lexpr!)) {
            params.set(
              expr.rexpr.ParamRef.number,
              getColumnName(expr.lexpr, relations)
            );
          } else {
            notSupported("where clause", whereClause);
          }
        } else if (
          isPgSubLink(expr.rexpr!) &&
          expr.rexpr.SubLink.subselect &&
          isPgSelectStmt(expr.rexpr.SubLink.subselect)
        ) {
          assignMap(
            params,
            getParamMapForSelect(expr.rexpr.SubLink.subselect, relations)
          );
        } else if (!isPgColumnRef(expr.rexpr!)) {
          notSupported("where clause", whereClause);
        }
        break;
      default:
        notSupported("where clause", whereClause);
    }
  } else if (isPgBoolExpr(whereClause)) {
    const expr = whereClause.BoolExpr;
    for (const arg of expr.args!) {
      assignMap(params, getParamMapForWhereClause(arg, relations));
    }
  } else if (!isPgNullTest(whereClause)) {
    notSupported("where clause", whereClause);
  }

  return params;
};

export const getParamMapForUpdate = (stmt: PgUpdateStmt) => {
  const params = new Map<number, string>();

  const mainRelation = stmt.UpdateStmt.relation!.RangeVar.relname!;
  for (const target of stmt.UpdateStmt.targetList!) {
    if (isPgResTarget(target)) {
      if (isPgParamRef(target.ResTarget.val!)) {
        params.set(
          target.ResTarget.val.ParamRef.number,
          `${mainRelation}.${target.ResTarget.name!}`
        );
      }
    } else {
      console.warn("Target is not a ResTarget", target);
    }
  }

  if (stmt.UpdateStmt.whereClause) {
    const relations = getRelations(stmt.UpdateStmt.relation!);
    if (stmt.UpdateStmt.fromClause) {
      assignMap(
        relations,
        getRelationsForFromClause(stmt.UpdateStmt.fromClause)
      );
    }

    assignMap(
      params,
      getParamMapForWhereClause(stmt.UpdateStmt.whereClause, relations)
    );
  }

  return params;
};

export const getParamMapForInsert = (stmt: PgInsertStmt) => {
  const params = new Map<number, string>();
  const mainRelation = stmt.InsertStmt.relation!.RangeVar.relname!;

  if (isPgSelectStmt(stmt.InsertStmt.selectStmt!)) {
    const select = stmt.InsertStmt.selectStmt.SelectStmt;
    if (select.valuesLists && stmt.InsertStmt.cols) {
      for (const valueList of select.valuesLists) {
        for (let i = 0; i < valueList.length; i++) {
          const value = valueList[i];
          if (isPgParamRef(value)) {
            const column = stmt.InsertStmt.cols[i];
            if (isPgResTarget(column)) {
              params.set(
                value.ParamRef.number,
                `${mainRelation}.${column.ResTarget.name!}`
              );
            } else {
              notSupported("colum type in select clause", column);
            }
          }
        }
      }
    } else {
      notSupported("select clause", select);
    }
  }

  return params;
};

export const getParamMapForSelect = (
  stmt: PgSelectStmt,
  parentRelations?: Map<string, string>
) => {
  const params = new Map<number, string>();

  const relations = new Map<string, string>();
  assignMap(
    relations,
    parentRelations,
    stmt.SelectStmt.fromClause &&
      getRelationsForFromClause(stmt.SelectStmt.fromClause)
  );

  if (stmt.SelectStmt.whereClause) {
    assignMap(
      params,
      getParamMapForWhereClause(stmt.SelectStmt.whereClause, relations)
    );
  }

  return params;
};

export const getParamMapForDelete = (stmt: PgDeleteStmt) => {
  const params = new Map<number, string>();

  if (stmt.DeleteStmt.whereClause) {
    const relations = getRelations(stmt.DeleteStmt.relation!);
    assignMap(
      params,
      getParamMapForWhereClause(stmt.DeleteStmt.whereClause, relations)
    );
  }

  return params;
};
