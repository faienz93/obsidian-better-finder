import { App, PluginSettingTab, Setting } from 'obsidian';

import ObsidianBetterFinder from '../main'

class FinderSetting extends PluginSettingTab {
  plugin: ObsidianBetterFinder;

  constructor(app: App, plugin: ObsidianBetterFinder) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;

    containerEl.empty();

    new Setting(containerEl)
      .setName('Show ribbon icon')
      .setDesc('Show the Better Finder icon in the left sidebar')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.showRibbonIcon)
        .onChange(async (value) => {
          this.plugin.settings.showRibbonIcon = value;

          if (value) {
            this.plugin.addRibbonIconEl();
          } else {
            this.plugin.removeRibbonIconEl();
          }

          await this.plugin.saveSettings();
        }));
  }
}

export default FinderSetting;
