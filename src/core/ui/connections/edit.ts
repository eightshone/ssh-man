import colors from "yoctocolors-cjs";
import { config as Config, log, menu, server } from "../../../utils/types";
import { setupInput } from "../../../utils/tui/input";
import {
  ansi,
  ScreenBuffer,
  drawBox,
  getTermSize,
  drawPopup,
  padOrTruncate,
  drawFooter,
} from "../../../utils/tui/index";
import validateServerName from "../../../utils/validateServerName";
import saveFile from "../../../utils/saveFile";
import { CONFIG_DIR } from "../../../utils/consts";
import { homedir } from "os";

export default function editConnection(
  initialConfig: Config,
  index: number,
  initialLogs: log[],
): Promise<[menu, any[], Config]> {
  let config: Config = { ...initialConfig };
  let logs: log[] = [...initialLogs];
  const sshConfig: server = config.servers[index];

  return new Promise((resolve) => {
    let steps = [
      {
        id: "name",
        prompt: "Server name:",
        type: "input",
        required: true,
        validate: (val: string, cfg: Config) => {
          if (val === sshConfig.name) return true; // unchanged is fine
          return validateServerName(val, cfg.servers);
        },
        default: () => sshConfig.name,
      },
      {
        id: "host",
        prompt: "Hostname:",
        type: "input",
        required: true,
        default: () => sshConfig.host,
      },
      {
        id: "username",
        prompt: "Username:",
        type: "input",
        required: true,
        default: () => sshConfig.username,
      },
      {
        id: "port",
        prompt: "Port:",
        type: "number",
        default: () => sshConfig.port,
      },
      {
        id: "usePassword",
        prompt: "Authentication method:",
        type: "select",
        choices: [
          { name: "Password", value: true },
          { name: "Key", value: false },
        ],
        default: () => sshConfig.usePassword,
      },
      {
        id: "updateAuth",
        prompt: (data: any) => `Update ${data.usePassword ? "password" : "key"}?`,
        type: "select",
        choices: [
          { name: "No - Keep existing", value: false },
          { name: "Yes - Change it", value: true },
        ],
        condition: (data: any) => data.usePassword === sshConfig.usePassword,
      },
      {
        id: "auth",
        prompt: (data: any) => (data.usePassword ? "New Password:" : "New Key path:"),
        type: (data: any) => (data.usePassword ? "password" : "input"),
        condition: (data: any) =>
          data.usePassword !== sshConfig.usePassword || data.updateAuth === true,
        default: (cfg: Config, data: any) =>
          data.usePassword ? "" : cfg.defaults.privateKey || `${homedir()}/.ssh/id_rsa`,
      },
      {
        id: "confirm",
        prompt: "Confirm changes:",
        type: "select",
        choices: [
          { name: "Confirm and save", value: true },
          { name: "No, Redo", value: false },
          { name: "Exit without saving", value: null },
        ],
      },
    ];

    let currentStepIdx = 0;
    let capturedData: any = {
      name: sshConfig.name,
      host: sshConfig.host,
      username: sshConfig.username,
      port: sshConfig.port,
      usePassword: sshConfig.usePassword,
    };
    let history: { stepIdx: number; data: any }[] = [];

    let inputBuffer = "";
    let cursorPos = 0;
    let selectedIndex = 0;
    let error = "";
    let showAbortConfirm = false;
    let abortSelectedIndex = 1;

    const getCurrentStep = () => {
      let step = steps[currentStepIdx];
      if (!step) return null;
      if (step.condition && !step.condition(capturedData)) {
        return null;
      }
      return step;
    };

    const nextStep = () => {
      history.push({ stepIdx: currentStepIdx, data: { ...capturedData } });
      currentStepIdx++;
      error = "";
      inputBuffer = "";
      cursorPos = 0;
      selectedIndex = 0;

      if (currentStepIdx >= steps.length) {
        finish();
        return;
      }

      const next = getCurrentStep();
      if (!next) {
        nextStep();
        return;
      }

      // Pre-fill selection if it's a select step and we have data
      if (next.type === "select") {
        if (next.id === "usePassword") {
          const val = capturedData.usePassword;
          selectedIndex = next.choices.findIndex((c) => c.value === val);
        } else if (next.id === "updateAuth") {
            selectedIndex = 0; // Default to "No"
        }
      } else if (next.type !== "select") {
        const val = capturedData[next.id];
        if (val !== undefined && next.id !== "auth") {
          inputBuffer = String(val);
          cursorPos = inputBuffer.length;
        } else if (typeof next.default === "function") {
          const def = next.default(config, capturedData);
          inputBuffer = String(def);
          cursorPos = inputBuffer.length;
        }
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
          const val = capturedData[step.id];
          selectedIndex = step.choices.findIndex((c) => c.value === val);
          if (selectedIndex === -1) selectedIndex = 0;
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
      process.stdout.write(ansi.clear() + ansi.moveTo(1, 1) + ansi.showCursor());

      const data = capturedData;
      if (data.confirm === null) {
        resolve(["ssh-list", [JSON.stringify(sshConfig)], config] as any);
        return;
      }
      if (data.confirm === false) {
        // Redo: restart the loop
        // We can just call editConnection again or reset state.
        // Re-calling is cleaner but might cause stack issues if done 1000 times? 
        // Not a worry for TUI.
        resolve(editConnection(initialConfig, index, initialLogs));
        return;
      }

      // Determine final auth value
      let auth = data.auth;
      if (data.usePassword === sshConfig.usePassword && data.updateAuth === false) {
        auth = sshConfig.usePassword ? (sshConfig as any).password : (sshConfig as any).privateKey;
      }

      const updatedSshConfig: server = {
        id: sshConfig.id,
        name: data.name,
        host: data.host,
        username: data.username,
        port: Number(data.port),
        ...(data.usePassword
          ? { usePassword: true, password: auth }
          : { usePassword: false, privateKey: auth }),
      };

      config.servers[index] = updatedSshConfig;
      await saveFile(`${CONFIG_DIR}/config.json`, config, undefined, true);

      if (updatedSshConfig.name !== sshConfig.name) {
        logs = logs.map((currentLog) => {
          if (currentLog.serverName === sshConfig.name) {
            return { ...currentLog, serverName: updatedSshConfig.name };
          }
          return currentLog;
        });
        await saveFile(`${CONFIG_DIR}/logs.json`, logs);
      }

      resolve(["ssh-list", [JSON.stringify(updatedSshConfig)], config] as any);
    };

    const render = (popupOnly = false) => {
      const { rows, cols } = getTermSize();
      const buf = new ScreenBuffer();

      if (popupOnly && showAbortConfirm) {
        drawPopup(buf, " Abort? ", ["Do you want to stop editing?", "All changes will be lost."], ["Yes", "No"], abortSelectedIndex, "160");
        buf.flush();
        return;
      }

      buf.write(ansi.hideCursor());
      if (!popupOnly) {
        buf.write(ansi.clear());
        drawBox(buf, 1, 1, cols, rows - 1, "rounded");
        buf.moveTo(1, 3).write(ansi.fg("255", " Edit Connection "));
      }

      const footerKeybindings = showAbortConfirm
        ? [{ action: "Confirm", key: "<enter>" }, { action: "Cancel", key: "<esc>" }, { action: "Navigate", key: "← →" }]
        : [{ action: "Back", key: "<ctrl-z>" }, { action: "Abort", key: "<esc>" }, { action: "Confirm", key: "<enter>" }];
      drawFooter(buf, cols, rows, footerKeybindings, 0);

      const contentTop = 3;
      const contentWidth = cols - 4;
      let currentRow = contentTop;

      // Draw history
      for (let i = 0; i < currentStepIdx; i++) {
        const step = steps[i];
        if (step.condition && !step.condition(capturedData)) continue;

        let promptText = typeof step.prompt === "function" ? step.prompt(capturedData) : step.prompt;
        let val = capturedData[step.id];
        let displayVal = String(val);

        if (step.id === "usePassword") displayVal = val === true ? "Password" : "Key";
        if (step.id === "updateAuth") displayVal = val === true ? "Yes" : "No";
        if (step.id === "auth" && capturedData.usePassword) displayVal = "********";
        if (step.id === "confirm") {
            if (val === true) displayVal = "Save";
            else if (val === false) displayVal = "Redo";
            else displayVal = "Exit";
        }

        const line = `${colors.green("✔")} ${colors.bold(promptText)} ${colors.cyan(displayVal)}`;
        buf.moveTo(currentRow++, 3).write(padOrTruncate(line, contentWidth));
      }

      // Draw current step
      const activeStep = getCurrentStep();
      if (activeStep) {
        let promptText = typeof activeStep.prompt === "function" ? activeStep.prompt(capturedData) : activeStep.prompt;
        const activePrompt = `${colors.blue("?")} ${colors.bold(promptText)}`;
        buf.moveTo(currentRow++, 3).write(padOrTruncate(activePrompt, contentWidth));

        if (activeStep.type === "select") {
          activeStep.choices?.forEach((choice, i) => {
            const isSelected = i === selectedIndex;
            const prefix = isSelected ? colors.cyan("❯ ") : "  ";
            const text = isSelected ? colors.cyan(choice.name) : choice.name;
            buf.moveTo(currentRow++, 5).write(padOrTruncate(`${prefix}${text}`, contentWidth - 2));
          });
        } else {
          const isPassword = activeStep.type === "password" || (typeof activeStep.type === "function" && activeStep.type(capturedData) === "password");
          let displayBuffer = inputBuffer;
          if (isPassword) displayBuffer = "*".repeat(inputBuffer.length);

          const part1 = displayBuffer.slice(0, cursorPos);
          const charAtCursor = displayBuffer[cursorPos] || " ";
          const part2 = displayBuffer.slice(cursorPos + 1);

          const inputLine = `${colors.cyan("❯")} ${part1}${ansi.bg("240", charAtCursor)}${part2}`;
          buf.moveTo(currentRow++, 5).write(padOrTruncate(inputLine, contentWidth - 2));
        }
      }

      if (error) {
        buf.moveTo(rows - 2, 3).write(ansi.fg("160", padOrTruncate(`>> ${error}`, contentWidth)));
      }

      if (showAbortConfirm) {
        drawPopup(buf, " Abort? ", ["Do you want to stop editing?", "All changes will be lost."], ["Yes", "No"], abortSelectedIndex, "160");
      }

      buf.flush();
    };

    const { stdin, cleanup } = setupInput((key, char) => {
      if (showAbortConfirm) {
        if (key === "left" || key === "right" || key === "up" || key === "down" || key === "tab") {
          abortSelectedIndex = abortSelectedIndex === 0 ? 1 : 0;
          render(true);
        } else if (key === "enter") {
          if (abortSelectedIndex === 0) {
            cleanupTUI();
            resolve(["ssh-list", [JSON.stringify(sshConfig)], config] as any);
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
        resolve(["exit", [], config]);
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
        if (key === "char" && char) {
          if (activeStep.type === "number" && !/[0-9]/.test(char)) return;
          inputBuffer = inputBuffer.slice(0, cursorPos) + char + inputBuffer.slice(cursorPos);
          cursorPos += char.length;
          error = "";
          render();
        } else if (key === "backspace") {
          if (cursorPos > 0) {
            inputBuffer = inputBuffer.slice(0, cursorPos - 1) + inputBuffer.slice(cursorPos);
            cursorPos--;
            error = "";
            render();
          }
        } else if (key === "left") {
          if (cursorPos > 0) { cursorPos--; render(); }
        } else if (key === "right") {
          if (cursorPos < inputBuffer.length) { cursorPos++; render(); }
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
              error = typeof validation === "string" ? validation : "Invalid input.";
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

    // Set initial value for first step
    const first = getCurrentStep();
    if (first && first.type !== "select") {
        inputBuffer = String(capturedData[first.id] || "");
        cursorPos = inputBuffer.length;
    }

    render();
  });
}
