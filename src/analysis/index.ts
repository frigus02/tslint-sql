import { parse, PgParseError } from "pg-query-native";
import {
  isPgDeleteStmt,
  isPgInsertStmt,
  isPgSelectStmt,
  isPgUpdateStmt
} from "../gen/pg-type-guards";
import {
  getParamMapForDelete,
  getParamMapForInsert,
  getParamMapForSelect,
  getParamMapForUpdate,
  Column
} from "./params";
import { notSupported } from "./utils";

export class ParseError extends Error {
  public cursorPosition: number;

  constructor(error: PgParseError) {
    super(error.message);
    this.cursorPosition = error.cursorPosition;
  }
}

export const analyze = (query: string): Map<number, Column> => {
  const result = parse(query);
  if (result.error) {
    throw new ParseError(result.error);
  } else if (result.query) {
    const stmt = result.query[0];
    if (isPgUpdateStmt(stmt)) {
      return getParamMapForUpdate(stmt);
    } else if (isPgInsertStmt(stmt)) {
      return getParamMapForInsert(stmt);
    } else if (isPgSelectStmt(stmt)) {
      return getParamMapForSelect(stmt);
    } else if (isPgDeleteStmt(stmt)) {
      return getParamMapForDelete(stmt);
    } else {
      notSupported("statement", stmt);
      return new Map<number, Column>();
    }
  } else {
    throw new Error("Got no result");
  }
};
