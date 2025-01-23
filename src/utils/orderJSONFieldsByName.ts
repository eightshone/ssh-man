function orderJSONFieldsByName<T>(obj: T): T {
  if (Array.isArray(obj)) {
    // If it's an array, recursively process each element
    return obj.map(orderJSONFieldsByName) as unknown as T;
  } else if (obj !== null && typeof obj === "object") {
    // If it's an object, sort its keys and recursively process values
    const sortedObj: Record<string, unknown> = {};
    Object.keys(obj)
      .sort()
      .forEach((key) => {
        (sortedObj as Record<string, unknown>)[key] = orderJSONFieldsByName(
          (obj as Record<string, unknown>)[key]
        );
      });
    return sortedObj as T;
  } else {
    // If it's a primitive value, return it as is
    return obj;
  }
}

export default orderJSONFieldsByName;
