import { homedir } from "os";
import { config } from "./types";
import packageJson from "../../package.json";

export const VERSION: string = packageJson.version;
export const DEFAULT_CONFIG: config = {
  servers: [],
  recentServers: [],
  debug: false,
  defaults: {
    privateKey: `${homedir()}/.ssh/id_rsa`,
    port: 22,
    autoSavePrefix: "auto-save",
  },
};
export const GOODBYES: string[] = [
  "Thanks for stopping by! Take care! 😊",
  "See you next time! 👋",
  "Bye for now! Stay awesome! 🌟",
  "Take care and have a great day! 🌈",
  "Catch you later! 👋✨",
  "Farewell, and don’t forget to smile! 😄",
  "Until we meet again! 🐾",
  "Thanks for chatting! Bye-bye! 💬",
  "Wishing you all the best! 🙌",
  "Goodbye and stay safe! ❤️",
  "See you later, alligator! 🐊",
  "Peace out! ✌️",
  "Take it easy! Bye! 🧘‍♀️",
  "Au revoir! Keep smiling! 😊",
  "Bye-bye! Keep shining! ✨",
  "Goodbye! Have a fantastic day! 🥳",
];
export const CONFIG_DIR = `${homedir()}/.sshman`;
export const CONNECTION_REGEX = /^(?:([^@:]+)(?::([^@:]+))?@)?([^@:]+)(?::(\d+))?$/;
export const UPDATE_COMMANDS = {
  yarn: "yarn global add @eightshone/sshman",
  npm: "npm install -g @eightshone/sshman",
  pnpm: "pnpm add -g @eightshone/sshman",
  bun: "bun add -g @eightshone/sshman",
};

// Telemetry paths and constants
export const TELEMETRY_CONFIG_FILE = `${CONFIG_DIR}/.telemetry.json`;
export const TELEMETRY_EVENTS_FILE = `${CONFIG_DIR}/.telemetry-events.json`;
export const TELEMETRY_LOG_FILE = `${CONFIG_DIR}/telemetry.log`;
export const TELEMETRY_SYNC_INTERVAL_MS = 86_400_000; // 24 hours
