// Evaluates a JavaScript expression in the running Obsidian window and prints the result as JSON.
// Obsidian must be started with --remote-debugging-port (default 9222, override with OBSIDIAN_DEBUG_PORT).
//
//   node scripts/obsidian-eval.mjs "document.querySelectorAll('.snippet-highlight').length"
//   node scripts/obsidian-eval.mjs "getComputedStyle(document.querySelector('.snippet-highlight')).backgroundColor"

const port = process.env.OBSIDIAN_DEBUG_PORT ?? '9222';
const expression = process.argv[2];

if (!expression) {
  console.error('Usage: node scripts/obsidian-eval.mjs "<expression>"');
  process.exit(2);
}

let targets;

try {
  targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
} catch {
  console.error(`No Obsidian on port ${port}: start it with --remote-debugging-port=${port}.`);
  process.exit(1);
}

const page = targets.find(target => target.type === 'page' && target.webSocketDebuggerUrl);

if (!page) {
  console.error('Obsidian is listening but has no window to evaluate in.');
  process.exit(1);
}

const socket = new WebSocket(page.webSocketDebuggerUrl);

socket.addEventListener('open', () => {
  socket.send(JSON.stringify({
    id: 1,
    method: 'Runtime.evaluate',
    params: { expression, returnByValue: true, awaitPromise: true },
  }));
});

socket.addEventListener('message', (event) => {
  const { id, result } = JSON.parse(event.data);

  if (id !== 1) return;

  if (result.exceptionDetails) {
    console.error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
    process.exitCode = 1;
  } else {
    console.log(JSON.stringify(result.result.value, null, 2));
  }

  socket.close();
});
