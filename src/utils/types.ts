type connectivity =
  | {
      usePassword: true;
      password: string;
    }
  | {
      usePassword: false;
      privateKey: string;
    };

export type server = {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
} & connectivity;

export type config = {
  version?: string;
  defaults: {
    privateKey?: string;
    port?: number;
    autoSavePrefix?: string;
  };
  servers: server[];
  recentServers: server[];
};

export type log = {
  time: string;
  server: string;
  serverName: string;
};

export type menu =
  | "main"
  | "exit"
  | "settings"
  | "ssh-new"
  | "ssh-list"
  | "ssh-connect"
  | "ssh-display"
  | "ssh-delete"
  | "ssh-edit"
  | "ssh-search"
  | "manual"
  | "settings-defaults-edit"
  | "logs";

export type json = {
  [key: string | number]: any;
};

type editDefaultOptionsVar =
  | {
      defaultValue: number;
      type: "number";
    }
  | {
      defaultValue: string;
      type: "private-key" | "server-name";
    };

export type editDefaultOptions = {
  message: string;
} & editDefaultOptionsVar;
