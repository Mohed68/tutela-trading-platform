import { hasDemoNamespacePrefix } from "./ids.js";

export function containsDemoIdentifier(values: readonly unknown[]): boolean {
  return values.some(hasDemoNamespacePrefix);
}
