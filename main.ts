import { Plugin } from 'obsidian';
import FinderModal from './src/FinderModal'
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

    await this.loadSettings();

    this.addCommand({
      id: 'obsidian-better-finder-open-modal',
      name: 'Open Better Finder Modal',
      // Hot key
      // hotkeys: [{ modifiers: ['Mod', 'Shift'], key: 'a' }],
      callback: () => {
        new FinderModal(this.app).open();
      }
    });


    // This adds a settings tab so the user can configure various aspects of the plugin
    this.addSettingTab(new FinderSetting(this.app, this));

  }

  onunload() {

  }



  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }


}




