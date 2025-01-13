type connectivity =
  | {
      usePassword: true;
      password: string;
      privateKey?: string;
    }
  | {
      usePassword: false;
      password?: string;
      privateKey: string;
    };

export type server = {
  name?: string;
  host: string;
  port: number;
  username: string;
} & connectivity;

export type config = {
  defaultPrivateKey: string | null;
  servers: server[];
  recentServers: server[];
};
