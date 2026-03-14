# Obsidian Better Finder

Advanced search modal and command view for Obsidian with smart query parsing.

## Installation

### Prerequisites

```bash
node --version  # Should be v18 or higher (tested with v22.13.1)
npm --version
```

### Development Setup

1. **Clone the repository into your vault's plugins folder**

```bash
   cd <YOUR_VAULT>/.obsidian/plugins/
   git clone https://github.com/YOUR_USERNAME/obsidian-better-finder
   cd obsidian-better-finder
```

2. **Install dependencies**

```bash
   npm install
```

3. **Build the plugin**

```bash
   npm run dev
```

This starts the development build with auto-reload on changes.

4. **Enable the plugin in Obsidian**
   - Open Obsidian Settings
   - Go to Community Plugins
   - Disable Safe Mode (if needed)
   - Enable "Better Finder"

5. **Set up hotkeys (optional)**
   - Settings → Hotkeys
   - Search for "Better Finder"
   - Assign your preferred shortcuts:
     - `Better Finder: Open Smart Search` (suggested: Ctrl/Cmd+O to replace Quick Switcher)
     - `Better Finder: Open Command View`

## Development

### Available Scripts

```bash
npm run dev      # Development build with watch mode
npm run build    # Production build
npm run version  # Bump version (updates manifest.json and versions.json)
```

### Making Changes

1.  **Open the project** in VS Code:
    `cd <YOUR_VAULT>/.obsidian/plugins`
2.  **Enable Hot Reload**:
    - Install the [Hot Reload](https://github.com/pjeby/hot-reload) plugin in your Obsidian vault.
    - Ensure a `.git` folder or an empty `.hotreload` file exists in this plugin's directory to trigger the auto-reload.
    - Enable the plugin into Obsidian
3.  **Start the compiler**:
    - Run `npm install` (if you haven't already).
    - Run `npm run dev` to start the build in watch mode.
4.  **Develop**:
    - Make your changes in the source code.
    - The plugin will automatically recompile, and Obsidian will reload it instantly without requiring a manual restart.
5.  **Test**: Verify your changes directly in Obsidian.

## Usage

### Smart Search Modal

Press `Ctrl/Cmd+O/Cmd+A` (or your custom hotkey) to open.

**Examples:**

- `today #react` - Files modified today with #react tag
- `this week task-todo:` - Incomplete tasks from this week
- `immagine.png` - Find images
- `title:meeting` - Files with "meeting" in the title
- `>theme` - Search commands (Command Palette mode)

### Command View

Open from ribbon icon or via command palette.

- Browse all available commands
- Search/filter commands
- Click to execute

## Roadmap

- [ ] Fuzzy search scoring
- [ ] Recent files history
- [ ] Custom saved searches
- [ ] Bookmarks integration
- [ ] Graph view integration

## Contributing

Issues and PRs welcome!

## License

MIT
