import { homedir } from "os";
import { config } from "./types";

export const VERSION: string = "0.1.2";
export const DEFAULT_CONFIG: config = {
  servers: [],
  recentServers: [],
  defaults: {
    privateKey: `${homedir()}/.shh/id_rsa`,
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
