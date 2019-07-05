import { PgNode } from "pg-query-native";

export const assignMap = <K, V>(
  dst: Map<K, V>,
  ...maps: Array<Map<K, V> | undefined>
) => {
  for (const map of maps) {
    if (map) {
      for (const [key, value] of map.entries()) {
        dst.set(key, value);
      }
    }
  }
};

export const notSupported = (what: string, node?: PgNode) =>
  console.warn(`${what} not supported`, node);
