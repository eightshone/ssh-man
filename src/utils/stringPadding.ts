function stringPadding(
  input: string,
  totalLength = 40,
  paddingPosition: "start" | "end" = "end",
  paddingCharacter: string = " "
): string {
  const trimmedStr =
    input.length > totalLength ? input.slice(0, totalLength - 1) + "…" : input;
  let paddedStr;
  if (paddingPosition === "end") {
    paddedStr = trimmedStr.padEnd(totalLength, paddingCharacter);
  } else {
    paddedStr = trimmedStr.padStart(totalLength, paddingCharacter);
  }

  return paddedStr;
}

export default stringPadding;
