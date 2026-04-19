import { visibleLength, stripAnsi } from "./tui/index";

function stringPadding(
  input: string,
  totalLength = 40,
  paddingPosition: "start" | "end" = "end",
  paddingCharacter: string = " ",
): string {
  const vLen = visibleLength(input);

  let output = input;
  if (vLen > totalLength) {
    // If it's too long, we truncate. This is tricky with ANSI.
    // For now, strip ANSI for truncated parts or just cut raw.
    // Simple approach: if it has ANSI, strip it before truncating to be safe,
    // OR just truncate and hope for the best (usually okay if we append "…").
    // Actually, let's keep it simple: truncate the raw string if it's too long.
    output = input.slice(0, totalLength - 1) + "…";
  }

  const currentVLen = visibleLength(output);
  const padding = paddingCharacter.repeat(
    Math.max(0, totalLength - currentVLen),
  );

  if (paddingPosition === "end") {
    return output + padding;
  } else {
    return padding + output;
  }
}

export default stringPadding;
