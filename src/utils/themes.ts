import colors from "yoctocolors-cjs";

export const inquirerTheme = {
  prefix: {
    idle: "",
    done: "",
  },
  spinner: {
    interval: 80,
    frames: ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"].map((frame) =>
      colors.yellow(frame)
    ),
  },
  style: {
    answer: () => "",
    message: () => "",
    error: (text) => colors.red(`> ${text}`),
    defaultAnswer: (text) => colors.dim(`(${text})`),
    help: colors.dim,
    highlight: colors.cyan,
    key: (text: string) => colors.cyan(colors.bold(`<${text}>`)),
    disabled: (text: string) => `  ${text}`,
  },
};

export const logsTheme = {
  prefix: {
    idle: "",
    done: "",
  },
  spinner: {
    interval: 80,
    frames: ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"].map((frame) =>
      colors.yellow(frame)
    ),
  },
  style: {
    answer: () => "",
    message: (msg) => msg,
    error: (text) => colors.red(`> ${text}`),
    defaultAnswer: (text) => colors.dim(`(${text})`),
    help: () => colors.dim("\nUse ↑ ↓ to navigate. Press ENTER↵ to exit"),
    highlight: (txt) => colors.bgWhite(colors.black(txt)),
    key: (text: string) => colors.cyan(colors.bold(`<${text}>`)),
    disabled: (text: string) => `  ${text}`,
  },
  helpMode: "always" as "always" | "never" | "auto",
};
