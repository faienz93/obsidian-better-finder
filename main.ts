import { MarkdownView, Plugin } from 'obsidian';
import FinderModal from './src/FinderModal'
import { BetterFinderView, VIEW_TYPE_BETTERFINDER } from "./src/BetterFinderView";
import FinderSetting from './src/FinderSetting'

interface ObsidianBetterFinderSettings {
  mySetting: string;
}

const DEFAULT_SETTINGS: ObsidianBetterFinderSettings = {
  mySetting: 'default'
}

export default class ObsidianBetterFinder extends Plugin {
  settings: ObsidianBetterFinderSettings;

  async onload() {
    console.log("AdvancedSearch loaded 🚀");
    this.registerView(
      VIEW_TYPE_BETTERFINDER,
      (leaf) => new BetterFinderView(leaf)
    );
    await this.loadSettings();

    this.addCommand({
      id: 'open-sample-modal-simple',
      name: 'Open sample modal (simple)',
      callback: () => {
        new FinderModal(this.app).open();
      }
    });

    this.addCommand({
      id: 'open-better-finder',
      name: 'Apri Better Finder',
      callback: () => {
        this.activateView();
      }
    });

    // This adds a settings tab so the user can configure various aspects of the plugin
    this.addSettingTab(new FinderSetting(this.app, this));

    // If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
    // Using this function will automatically remove the event listener when this plugin is disabled.
    this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
      console.log('click', evt);
    });



    // When registering intervals, this function will automatically clear the interval when the plugin is disabled.
    this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));
  }

  onunload() {

  }

  async activateView() {
    const { workspace } = this.app;
    let leaf = workspace.getLeavesOfType(VIEW_TYPE_BETTERFINDER).first();
    if (!leaf) {
      // 👇 crea la view nello spazio editor principale
      leaf = workspace.getLeaf(true);
      await leaf.setViewState({ type: VIEW_TYPE_BETTERFINDER, active: true });
    }
    workspace.revealLeaf(leaf);
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }


}




