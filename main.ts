import { App, Editor, MarkdownView, Modal, Notice, Plugin } from 'obsidian';
import AdvancedSearchModal from './src/BetterFinderModal'
import { BetterFinderView, VIEW_TYPE_BETTERFINDER } from "./src/BetterFinderView";
import FinderSetting from './src/Setting'

// Remember to rename these classes and interfaces!

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

    // This creates an icon in the left ribbon.
    const ribbonIconEl = this.addRibbonIcon('dice', 'Sample Plugin', (evt: MouseEvent) => {
      // Called when the user clicks the icon.
      new Notice('This is a notice!');
    });
    // Perform additional things with the ribbon
    ribbonIconEl.addClass('my-plugin-ribbon-class');

    // This adds a status bar item to the bottom of the app. Does not work on mobile apps.
    const statusBarItemEl = this.addStatusBarItem();
    statusBarItemEl.setText('Status Bar Text');

    // This adds a simple command that can be triggered anywhere
    this.addCommand({
      id: 'open-sample-modal-simple',
      name: 'Open sample modal (simple)',
      callback: () => {
        new SampleModal(this.app).open();
      }
    });
    // This adds an editor command that can perform some operation on the current editor instance
    this.addCommand({
      id: 'sample-editor-command',
      name: 'Sample editor command',
      editorCallback: (editor: Editor, view: MarkdownView) => {
        console.log(editor.getSelection());
        editor.replaceSelection('Sample Editor Command');
      }
    });
    // This adds a complex command that can check whether the current state of the app allows execution of the command
    this.addCommand({
      id: 'open-sample-modal-complex',
      name: 'Open sample modal (complex)',
      checkCallback: (checking: boolean) => {
        // Conditions to check
        const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (markdownView) {
          // If checking is true, we're simply "checking" if the command can be run.
          // If checking is false, then we want to actually perform the operation.
          if (!checking) {
            new SampleModal(this.app).open();
          }

          // This command will only show up in Command Palette when the check function returns true
          return true;
        }
      }
    });




    this.addCommand({
      id: "open-advanced-search",
      name: "Apri Ricerca Avanzata",
      callback: () => {
        new AdvancedSearchModal(this.app).open();
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

    this.addRibbonIcon('dice', 'Greet', () => {
      new Notice('Hello, world!');
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

class SampleModal extends Modal {
  constructor(app: App) {
    super(app);
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.setText('Woah!');
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}


