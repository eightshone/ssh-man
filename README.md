![sshman banner](readme/banner.png)

# SSH MANAGER (SSHMAN)

**SSHMAN** is a modern, interactive TUI (Terminal User Interface) SSH connection manager built with Node.js. It simplifies managing multiple SSH sessions with a sleek, user-friendly interface and robust CLI commands.

> ⚠️ **Security Notice**: SSHMAN shells out to your system's native `ssh` binary and manages your real `~/.ssh/config`, so connections go through OpenSSH's own host-key verification and config handling. It has not been independently security-audited. Do not treat it as a hardened or compliant SSH client — **use it at your own risk**.

## Key Features

- **Interactive TUI Dashboard**: A good terminal experience with intuitive navigation.
- **Connection Management**: Save, edit, and categorize your SSH connections for quick access.
- **Quick Reconnect**: Jump back into your last session with a single command.
- **Interactive Logs**: Browse and search through your connection history with real-time filtering.
- **Global Search**: Quickly find the server you need from your saved connections.
- **Encrypted Configuration**: Your connection details are stored encrypted at rest (see [Configuration Security](#configuration-security)).
- **Import/Export**: Easily share or backup your server configurations, always password-protected.
- **Built-in Manual**: Accessible interactive help documentation within the app.

---

## Quick Start

### Installation

Install `SSHMAN` globally using your preferred package manager:

| Package Manager | Command                              |
| :-------------- | :----------------------------------- |
| **Yarn**        | `yarn global add @eightshone/sshman` |
| **NPM**         | `npm install -g @eightshone/sshman`  |
| **PNPM**        | `pnpm add -g @eightshone/sshman`     |
| **Bun**         | `bun add -g @eightshone/sshman`      |

### Usage

#### Interactive Mode
Simply run `sshman` to enter the interactive TUI dashboard.
```bash
sshman
```
![interactive menu](readme/main-menu.png)

#### Command Line Interface
SSHMAN also provides a powerful set of CLI commands for direct access:

- **Connect to a new server**:
  ```bash
  sshman connect username@hostname[:port] [--save [name]]
  ```
  *Example*: `sshman connect root@1.2.3.4:22 -s my-server`

- **Quick Reconnect**:
  ```bash
  sshman reconnect
  ```
  Connects to the last server you accessed.

- **Connect to a saved server**:
  ```bash
  sshman connect server-name
  ```

- **Search for a server**:
  ```bash
  sshman search <terms> [--fuzzy]
  ```

- **Logs**:
  ```bash
  sshman logs [-i] [-s <search terms>]
  ```
  Use `-i` for the interactive TUI logs browser.

- **Export/Import Configs**:
  ```bash
  sshman export [servers...] [-a] [-n <filename>] [-p <password>]
  sshman import <config-file> [-f] [-p <password>]
  ```
  Export files are always encrypted: pass `-p <password>` or you'll be prompted for one. Import requires that same password and refuses unencrypted files.

- **Goodbye**:
  ```bash
  sshman goodbye
  ```
  Prints a random farewell message. Mostly here for fun.

---

## Configuration Security

Sshman stores connection metadata in two places: `host`/`port`/`username`/`privateKey` live directly in your real `~/.ssh/config` (in a marked section sshman manages, exactly like any other `Host` entry you'd write by hand), and `config.json` only holds bookkeeping (`id`, `name`, `usePassword`). Saved passwords are never written to disk in either file — they're stored in your OS keychain (via `@napi-rs/keyring`). Export files are the one place secrets leave the keychain: they're always encrypted with AES-256-GCM under a password you choose (`sshman export -p <password>`), and import refuses unencrypted files.

---

## Troubleshooting

- **Debug mode**:
  ```bash
  sshman debug enable   # turn on advanced troubleshooting output
  sshman debug disable
  sshman debug status
  ```

- **Check for updates**:
  ```bash
  sshman check-updates
  ```

---

## Development

### Setup
1. **Clone the repository**:
   ```bash
   git clone git@github.com:eightshone/ssh-man.git
   ```
2. **Install dependencies**:
   ```bash
   npm install # or yarn install / pnpm install
   ```

### Scripts
- `npm run dev`: Start the project in development mode using `tsx`.
- `npm run build`: Compile TypeScript to `dist/`.
- `npm run typecheck`: Type-check the project without emitting output.
- `npm test`: Run the test suite (Node's built-in test runner via `tsx`).

A Husky pre-commit hook runs `typecheck` and `test` before every commit.

---

License: **MIT**
Author: **EIGHTSH ONE**
