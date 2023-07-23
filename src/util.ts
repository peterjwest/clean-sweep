/** Expands a named type to show its contents */
type Expand<Type> = Type extends infer Obj ? { [Key in keyof Obj]: Obj[Key] } : never;

/** Takes a string tuple and converts it into an object where the key & value are identical */
type ObjectFromTuple<Type extends readonly string[]> = {
  [Key in (keyof Type & `${number}`) as Type[Key]]: Type[Key]
}

/** Creates an enum from a string tuple */
export function createEnum<const T extends readonly string[]>(arr: T): Expand<ObjectFromTuple<T>> {
  return Object.fromEntries(arr.map((value) => [value, value])) as Expand<ObjectFromTuple<T>>;
}
