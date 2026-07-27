const RESET = '\x1b[0m';
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const DIM = '\x1b[2m';
const BOLD = '\x1b[1m';

const useColor = process.stdout.isTTY && !process.env.NO_COLOR;

function paint(color: string, s: string): string {
  return useColor ? `${color}${s}${RESET}` : s;
}

export const log = {
  info: (msg: string) => console.log(msg),
  ok: (msg: string) => console.log(paint(GREEN, '✔ ') + msg),
  warn: (msg: string) => console.warn(paint(YELLOW, '! ') + msg),
  step: (msg: string) => console.log(paint(CYAN, '→ ') + msg),
  dim: (msg: string) => console.log(paint(DIM, msg)),
  header: (msg: string) => console.log('\n' + paint(BOLD, msg)),
};

export function logError(msg: string): void {
  console.error(paint(RED, '✖ ') + msg);
}
