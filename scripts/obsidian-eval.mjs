// Evaluates a JavaScript expression in the running Obsidian window and prints the result as JSON.
// Obsidian must be started with --remote-debugging-port (default 9222, override with OBSIDIAN_DEBUG_PORT).
//
//   node scripts/obsidian-eval.mjs "document.querySelectorAll('.snippet-highlight').length"
//   node scripts/obsidian-eval.mjs "getComputedStyle(document.querySelector('.snippet-highlight')).backgroundColor"

import { evaluate } from './obsidian-cdp.mjs';

const expression = process.argv[2];

if (!expression) {
  console.error('Usage: node scripts/obsidian-eval.mjs "<expression>"');
  process.exit(2);
}

try {
  console.log(JSON.stringify(await evaluate(expression), null, 2));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
