import { i18n } from "src/const";
import { HintsType } from "src/component/ui/HintBar";

/** Not a Filter: `>` at the start switches the whole Query to commands before it is tokenized. */
export class CommandFilter implements HintsType {
  readonly label = '>';
  readonly desc = i18n.commands;

  extract(query: string): { isCommandMode: boolean; commandText?: string } {
    const trimmed = query.trim();

    if (trimmed.startsWith('>')) {
      return { isCommandMode: true, commandText: trimmed.slice(1).trim() };
    }

    return { isCommandMode: false };
  }
}
