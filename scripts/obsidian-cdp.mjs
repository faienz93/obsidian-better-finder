// Evaluates JavaScript in the running Obsidian window over the Chrome DevTools Protocol.
// Obsidian must be started with --remote-debugging-port (default 9222, override with OBSIDIAN_DEBUG_PORT).

const port = process.env.OBSIDIAN_DEBUG_PORT ?? '9222';

/** Resolves with the expression's value, awaiting it when it is a promise. Exits the process when Obsidian is unreachable. */
export async function evaluate(expression) {
  let targets;

  try {
    targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
  } catch {
    console.error(`No Obsidian on port ${port}: start it with /snap/bin/obsidian --remote-debugging-port=${port}.`);
    process.exit(1);
  }

  const page = targets.find(target => target.type === 'page' && target.webSocketDebuggerUrl);

  if (!page) {
    console.error('Obsidian is listening but has no window to evaluate in.');
    process.exit(1);
  }

  const socket = new WebSocket(page.webSocketDebuggerUrl);

  return new Promise((resolve, reject) => {
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

      socket.close();

      if (result.exceptionDetails) {
        reject(new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text));
      } else {
        resolve(result.result.value);
      }
    });
  });
}
