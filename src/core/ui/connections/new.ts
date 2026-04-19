import colors from "yoctocolors-cjs";
import { menu, server, config as Config, log } from "../../../utils/types";
import { setupInput } from "../../../utils/tui/input";
import {
  ansi,
  ScreenBuffer,
  drawBox,
  writeFullRow,
  getTermSize,
  drawPopup,
  padOrTruncate,
  drawFooter,
} from "../../../utils/tui/index";
import validateServerName from "../../../utils/validateServerName";
import { nanoid } from "nanoid";
import sshConnection from "../../functions/ssh";
import updateConfigs from "../../../utils/updateConfigs";

export default function newConnection(
  initialConfig: Config,
  initialLogs: log[],
): Promise<[menu, any[]]> {
  let config: Config = { ...initialConfig };
  let logs: log[] = [...initialLogs];

  return new Promise((resolve) => {
    let steps = [
      {
        id: "saveConnection",
        prompt: "Save connection?",
        type: "select",
        choices: [
          { name: "YES", value: true },
          { name: "No", value: false },
          { name: "Exit", value: null },
        ],
      },
      {
        id: "host",
        prompt: "Hostname:",
        type: "input",
        required: true,
      },
      {
        id: "username",
        prompt: "Username:",
        type: "input",
        required: true,
      },
      {
        id: "port",
        prompt: "Port:",
        type: "number",
        default: (cfg: Config) => cfg.defaults.port || 22,
      },
      {
        id: "usePassword",
        prompt: "Authentication method:",
        type: "select",
        choices: [
          { name: "Password", value: true },
          { name: "Key", value: false },
        ],
      },
      {
        id: "auth",
        prompt: (data: any) => (data.usePassword ? "Password:" : "Key path:"),
        type: (data: any) => (data.usePassword ? "password" : "input"),
        default: (cfg: Config, data: any) =>
          data.usePassword ? "" : cfg.defaults.privateKey || "",
      },
      {
        id: "name",
        prompt: "Server name:",
        type: "input",
        condition: (data: any) => data.saveConnection,
        default: (cfg: Config, data: any) =>
          `${cfg.defaults.autoSavePrefix || "srv"}-${data.username}@${data.host}`,
        validate: (val: string, cfg: Config) =>
          validateServerName(val, cfg.servers),
      },
    ];

    let currentStepIdx = 0;
    let capturedData: any = {};
    let history: { stepIdx: number; data: any }[] = [];

    let inputBuffer = "";
    let cursorPos = 0;
    let selectedIndex = 0;
    let error = "";
    let showAbortConfirm = false;
    let abortSelectedIndex = 1; // Default to No (index 1)

    const getCurrentStep = () => {
      let step = steps[currentStepIdx];
      if (!step) return null;
      // Skip steps with conditions that are not met
      if (step.condition && !step.condition(capturedData)) {
        return null;
      }
      return step;
    };

    const nextStep = () => {
      // Save current state to history before moving forward
      history.push({ stepIdx: currentStepIdx, data: { ...capturedData } });

      currentStepIdx++;
      error = "";
      inputBuffer = "";
      cursorPos = 0;
      selectedIndex = 0;

      // Check if we finished all steps
      if (currentStepIdx >= steps.length) {
        finish();
        return;
      }

      // If next step should be skipped, go to next next one
      const next = getCurrentStep();
      if (!next) {
        nextStep();
        return;
      }

      // Set default value if applicable
      if (next.type !== "select" && typeof next.default === "function") {
        const def = next.default(config, capturedData);
        inputBuffer = String(def);
        cursorPos = inputBuffer.length;
      }
    };

    const prevStep = () => {
      if (history.length > 0) {
        const last = history.pop()!;
        currentStepIdx = last.stepIdx;
        capturedData = last.data;
        error = "";

        const step = getCurrentStep();
        if (step?.type === "select") {
          // Restore previous selection if possible?
          // Inquirer usually doesn't, it resets.
          // But we can try to find the index of the current value.
          selectedIndex = 0;
          if (step.choices) {
            const val = capturedData[step.id];
            const idx = step.choices.findIndex((c) => c.value === val);
            if (idx !== -1) selectedIndex = idx;
          }
        } else if (step) {
          inputBuffer = String(capturedData[step.id] || "");
          cursorPos = inputBuffer.length;
        }
        render();
      }
    };

    const cleanupTUI = () => {
      process.stdout.removeListener("resize", resizeHandler);
      cleanup();
    };

    const finish = async () => {
      cleanupTUI();
      process.stdout.write(
        ansi.clear() + ansi.moveTo(1, 1) + ansi.showCursor(),
      );

      const data = capturedData;
      if (data.saveConnection === null) {
        resolve(["main", []]);
        return;
      }

      const sshConfig: server = {
        id: nanoid(),
        name: data.name,
        host: data.host,
        username: data.username,
        port: Number(data.port),
        ...(data.usePassword
          ? { usePassword: true, password: data.auth }
          : { usePassword: false, privateKey: data.auth }),
      };

      resolve(["ssh-connect", [JSON.stringify(sshConfig), data.saveConnection ? "true" : "false"]] as any);
    };

    const render = (popupOnly = false) => {
      const { rows, cols } = getTermSize();
      const buf = new ScreenBuffer();

      if (popupOnly && showAbortConfirm) {
        drawPopup(
          buf,
          " Abort? ",
          [
            "Do you want to stop creating this connection?",
            "All progress will be lost.",
          ],
          ["Yes", "No"],
          abortSelectedIndex,
          "160",
        );
        buf.flush();
        return;
      }

      buf.write(ansi.hideCursor());
      if (!popupOnly) {
        buf.write(ansi.clear());
        drawBox(buf, 1, 1, cols, rows - 1, "rounded");
        buf.moveTo(1, 3).write(ansi.fg("255", " New Connection "));
      }

      const footerKeybindings = showAbortConfirm
        ? [
            { action: "Confirm", key: "<enter>" },
            { action: "Cancel", key: "<esc>" },
            { action: "Navigate", key: "← →" },
          ]
        : [
            { action: "Back", key: "<ctrl-z>" },
            { action: "Abort", key: "<esc>" },
            { action: "Confirm", key: "<enter>" },
          ];
      drawFooter(buf, cols, rows, footerKeybindings, 0);

      const contentTop = 3;
      const contentWidth = cols - 4;
      let currentRow = contentTop;

      // Draw history
      for (const hist of history) {
        const step = steps[hist.stepIdx];
        if (step.condition && !step.condition(hist.data)) continue;

        let promptText =
          typeof step.prompt === "function"
            ? step.prompt(hist.data)
            : step.prompt;
        const value =
          hist.stepIdx === currentStepIdx - 1
            ? capturedData[step.id]
            : hist.data[step.id]; // This is getting complex, let's simplify
      }

      // Let's re-think history drawing. We need the final values.
      // Actually, capturedData has all answers so far.
      for (let i = 0; i < currentStepIdx; i++) {
        const step = steps[i];
        if (step.condition && !step.condition(capturedData)) continue;

        let promptText =
          typeof step.prompt === "function"
            ? step.prompt(capturedData)
            : step.prompt;
        let val = capturedData[step.id];
        let displayVal = String(val);

        if (step.id === "saveConnection")
          displayVal = val === true ? "YES" : val === false ? "No" : "Exit";
        if (step.id === "usePassword")
          displayVal = val === true ? "Password" : "Key";
        if (step.id === "auth" && capturedData.usePassword)
          displayVal = "********";

        const line = `${colors.green("✔")} ${colors.bold(promptText)} ${colors.cyan(displayVal)}`;
        buf.moveTo(currentRow++, 3).write(padOrTruncate(line, contentWidth));
      }

      // Draw current step
      const activeStep = getCurrentStep();
      if (activeStep) {
        let promptText =
          typeof activeStep.prompt === "function"
            ? activeStep.prompt(capturedData)
            : activeStep.prompt;
        const activePrompt = `${colors.blue("?")} ${colors.bold(promptText)}`;
        buf
          .moveTo(currentRow++, 3)
          .write(padOrTruncate(activePrompt, contentWidth));

        if (activeStep.type === "select") {
          activeStep.choices?.forEach((choice, i) => {
            const isSelected = i === selectedIndex;
            const prefix = isSelected ? colors.cyan("❯ ") : "  ";
            const text = isSelected ? colors.cyan(choice.name) : choice.name;
            buf
              .moveTo(currentRow++, 5)
              .write(padOrTruncate(`${prefix}${text}`, contentWidth - 2));
          });
        } else {
          // Input mode
          const isPassword =
            activeStep.type === "password" ||
            (typeof activeStep.type === "function" &&
              activeStep.type(capturedData) === "password");
          let displayBuffer = inputBuffer;
          if (isPassword) displayBuffer = "*".repeat(inputBuffer.length);

          const part1 = displayBuffer.slice(0, cursorPos);
          const charAtCursor = displayBuffer[cursorPos] || " ";
          const part2 = displayBuffer.slice(cursorPos + 1);

          const inputLine = `${colors.cyan("❯")} ${part1}${ansi.bg("240", charAtCursor)}${part2}`;
          buf
            .moveTo(currentRow++, 5)
            .write(padOrTruncate(inputLine, contentWidth - 2));
        }
      }

      if (error) {
        buf
          .moveTo(rows - 2, 3)
          .write(ansi.fg("160", padOrTruncate(`>> ${error}`, contentWidth)));
      }

      if (showAbortConfirm) {
        drawPopup(
          buf,
          " Abort? ",
          [
            "Do you want to stop creating this connection?",
            "All progress will be lost.",
          ],
          ["Yes", "No"],
          abortSelectedIndex,
          "160",
        );
      }

      buf.flush();
    };

    const { stdin, cleanup } = setupInput((key, char) => {
      if (showAbortConfirm) {
        if (
          key === "left" ||
          key === "right" ||
          key === "up" ||
          key === "down" ||
          key === "tab"
        ) {
          abortSelectedIndex = abortSelectedIndex === 0 ? 1 : 0;
          render(true);
        } else if (key === "enter") {
          if (abortSelectedIndex === 0) {
            cleanupTUI();
            resolve(["main", []]);
          } else {
            showAbortConfirm = false;
            render();
          }
        } else if (key === "escape") {
          showAbortConfirm = false;
          render();
        }
        return;
      }

      const activeStep = getCurrentStep();
      if (!activeStep) return;

      if (key === "ctrl-z") {
        prevStep();
        return;
      }

      if (key === "ctrl-c") {
        cleanupTUI();
        resolve(["exit", []]);
        return;
      }

      if (activeStep.type === "select") {
        const choices = activeStep.choices || [];
        if (key === "up") {
          selectedIndex = (selectedIndex - 1 + choices.length) % choices.length;
          render();
        } else if (key === "down") {
          selectedIndex = (selectedIndex + 1) % choices.length;
          render();
        } else if (key === "enter") {
          capturedData[activeStep.id] = choices[selectedIndex].value;
          nextStep();
          render();
        } else if (key === "escape") {
          showAbortConfirm = true;
          abortSelectedIndex = 1;
          render(true);
        }
      } else {
        // Input handling
        if (key === "char" && char) {
          if (activeStep.type === "number" && !/[0-9]/.test(char)) return;
          inputBuffer =
            inputBuffer.slice(0, cursorPos) +
            char +
            inputBuffer.slice(cursorPos);
          cursorPos += char.length;
          error = "";
          render();
        } else if (key === "backspace") {
          if (cursorPos > 0) {
            inputBuffer =
              inputBuffer.slice(0, cursorPos - 1) +
              inputBuffer.slice(cursorPos);
            cursorPos--;
            error = "";
            render();
          }
        } else if (key === "left") {
          if (cursorPos > 0) {
            cursorPos--;
            render();
          }
        } else if (key === "right") {
          if (cursorPos < inputBuffer.length) {
            cursorPos++;
            render();
          }
        } else if (key === "enter") {
          const val = inputBuffer.trim();
          if (activeStep.required && !val) {
            error = "This field is required.";
            render();
            return;
          }

          if (activeStep.validate) {
            const validation = activeStep.validate(val, config);
            if (validation !== true) {
              error =
                typeof validation === "string" ? validation : "Invalid input.";
              render();
              return;
            }
          }

          capturedData[activeStep.id] = val;
          nextStep();
          render();
        } else if (key === "escape") {
          if (inputBuffer.length > 0) {
            inputBuffer = "";
            cursorPos = 0;
            render();
          } else {
            showAbortConfirm = true;
            abortSelectedIndex = 1;
            render(true);
          }
        }
      }
    });

    const resizeHandler = () => render();
    process.stdout.on("resize", resizeHandler);

    // Initial value for first step if it has one
    const firstStep = getCurrentStep();
    if (
      firstStep &&
      firstStep.type !== "select" &&
      typeof firstStep.default === "function"
    ) {
      const def = firstStep.default(config, capturedData);
      inputBuffer = String(def);
      cursorPos = inputBuffer.length;
    }

    render();
  });
}
