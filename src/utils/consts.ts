import { homedir } from "os";
import { config } from "./types";
import packageJson from "../../package.json";

export const VERSION: string = packageJson.version;
export const DEFAULT_CONFIG: config = {
  servers: [],
  recentServers: [],
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
export const CONNECTION_REGEX = /^(.*?)(?::(.*?))?@(.*?)(?::(\d+))?$/;
export const UPDATE_COMMANDS = {
  yarn: "yarn global add @eightshone/sshman",
  npm: "npm install -g @eightshone/sshman",
  pnpm: "pnpm add -g @eightshone/sshman",
};
