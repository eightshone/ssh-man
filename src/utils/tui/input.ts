/**
 * input.ts — Raw stdin key parser.
 *
 * Puts stdin into raw mode, reads individual key-presses,
 * and emits a normalised key name to a callback.
 */

export function setupInput(onKey: (name: string, ch?: string) => void): { stdin: NodeJS.ReadStream; cleanup: () => void } {
  const stdin = process.stdin;
  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding('utf8');

  const onData = (data: string) => {
    // Ctrl-C — always allow exit
    if (data === '\x03') {
      onKey('ctrl-c');
      return;
    }

    // Escape sequences
    if (data === '\x1b[A') { onKey('up');    return; }
    if (data === '\x1b[B') { onKey('down');  return; }
    if (data === '\x1b[C') { onKey('right'); return; }
    if (data === '\x1b[D') { onKey('left');  return; }
    if (data === '\x1b[Z') { onKey('shift-tab'); return; }
    if (data === '\x1b[3~') { onKey('delete'); return; }
    if (data === '\x1b[3;5~') { onKey('ctrl-delete'); return; }

    // Control Characters (non-escape sequences)
    if (data === '\x00') { onKey('ctrl-space'); return; }
    if (data === '\x05') { onKey('ctrl-e'); return; }

    // Enter
    if (data === '\r' || data === '\n') { onKey('enter'); return; }

    // Escape (plain)
    if (data === '\x1b') { onKey('escape'); return; }

    // Backspace
    if (data === '\x7f' || data === '\b') { onKey('backspace'); return; }

    // Tab
    if (data === '\t') { onKey('tab'); return; }

    // Printable characters (single byte)
    if (data.length === 1 && data >= ' ' && data <= '~') {
      onKey('char', data);
      return;
    }

    // Multi-byte UTF-8 printable (emoji, accented chars, etc.)
    if (data.length >= 1 && !data.startsWith('\x1b')) {
      onKey('char', data);
      return;
    }
  };

  stdin.on('data', onData);

  return {
    stdin,
    cleanup: () => {
      stdin.removeListener('data', onData);
      stdin.setRawMode(false);
      stdin.pause();
    }
  };
}
