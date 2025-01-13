import colors from "yoctocolors-cjs";

export const inquirerTheme = {
  prefix: {
    idle: colors.blue(""),
    done: colors.green(""),
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
