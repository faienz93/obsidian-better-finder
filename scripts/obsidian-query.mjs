// Types each Query into the Modal and the Moodboard of the running Obsidian and prints, per view, the
// hint chips it lights, how many results it shows and the first few. Both views are closed afterwards.
//
//   node scripts/obsidian-query.mjs "path: Work pdf" "created:this-week"

import { evaluate } from './obsidian-cdp.mjs';

const queries = process.argv.slice(2);

if (queries.length === 0) {
  console.error('Usage: node scripts/obsidian-query.mjs "<query>" ["<query>" ...]');
  process.exit(2);
}

// Runs inside Obsidian; the search debounce is 150 ms, so each query waits well past it.
const inObsidian = async (queries) => {
  const settle = () => new Promise(resolve => setTimeout(resolve, 700));
  const chips = (root) => [...root.querySelectorAll('.hint-bar:not(.sub-hint-bar) .hint-chip-active')].map(c => c.textContent);

  const type = async (input, query) => {
    input.value = query;
    input.dispatchEvent(new Event('input'));
    await settle();
  };

  const report = {};

  app.commands.executeCommandById('obsidian-better-finder:obsidian-better-finder-open-modal');
  await settle();

  const modal = document.querySelector('.better-finder-modal');

  for (const query of queries) {
    await type(modal.querySelector('input'), query);
    const items = [...modal.querySelectorAll('.suggestion-item')];

    report[query] = { modal: { chips: chips(modal), results: items.length, first: items.slice(0, 3).map(i => i.textContent.slice(0, 60)) } };
  }

  modal.closest('.modal-container')?.querySelector('.modal-close-button')?.click();
  app.commands.executeCommandById('obsidian-better-finder:open-finder-view');
  await settle();

  const leaf = app.workspace.getLeavesOfType('better-finder-view')[0];

  for (const query of queries) {
    await type(leaf.view.containerEl.querySelector('input'), query);
    const results = leaf.view.allResults ?? [];

    report[query].moodboard = { chips: chips(leaf.view.containerEl), results: results.length, first: results.slice(0, 3).map(r => r.path ?? r.name) };
  }

  leaf.detach();

  return report;
};

try {
  console.log(JSON.stringify(await evaluate(`(${inObsidian})(${JSON.stringify(queries)})`), null, 2));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
