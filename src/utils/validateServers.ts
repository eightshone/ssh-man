import { server } from "./types";

function validateServers(value: unknown): value is server[] {
  if (!Array.isArray(value)) return false;

  return value.every((item) => {
    if (
      typeof item !== "object" ||
      item === null ||
      (!!(item as any).id && typeof (item as any).id !== "string") ||
      typeof (item as any).name !== "string" ||
      typeof (item as any).host !== "string" ||
      typeof (item as any).port !== "number" ||
      typeof (item as any).username !== "string" ||
      typeof (item as any).usePassword !== "boolean"
    ) {
      return false;
    }

    const connectivity = item as any;

    // check connectivity union type
    if (connectivity.usePassword === true) {
      return typeof connectivity.password === "string";
    } else if (connectivity.usePassword === false) {
      return typeof connectivity.privateKey === "string";
    }

    return false;
  });
}

export default validateServers;
