Visualize your code to either help you understand it better or to find bugs.

WIP Visual Reference Explorer & Helper for the Verse Programming Language created for UEFN (Unreal Editor for Fortnite) by Epic Games.

**NOTE**: This extension is meant to work together with the official `Verse` LSP extension made by Epic Games. It won't work without it.

# How to install

Go to VSCode->Extensions->`... Menu`->Select `Install from VSIX`

# Features

### Generate a Visual Reference graph from a given symbol in the workspace.
![](https://raw.githubusercontent.com/cronofear-dev/VerseReferenceExplorer/main/doc/viewRefExplorer.gif)

### `Ctrl+Click` on a symbol in the graph to navigate back to its location in VSCode.
![](https://raw.githubusercontent.com/cronofear-dev/VerseReferenceExplorer/main/doc/goToLocationInVSCode.gif)

### Other features

- `MouseWheel` to zoom in/out in the graph.
- Hold `Left Mouse Button` to pan the graph.
- Press `Left Mouse Button` twice over a node to open its details.
- Hover over a node to view it details.
- It's possible to open multiple graphs at the same time and close them at any time.

# Planned Roadmap

### Verse Reference Explorer

- [x] Show the definition tree of the relevant symbols in the graph.  
- [x] Add the option to navigate back to VSCode from a given symbol in the graph.
- [ ] Apprend generic/templates members/methods to the relevant symbols in the graph. e.g. Add `Slice()` method as child of array properties.
- [ ] Show the list of references/related symbols of the relevant symbols in the graph. e.g. If a symbol is named `MyAgent` of type `agent`, add any repetition of properties named "MyAgent" in the workspace. Add methods that make or return `agent` as a parameter?
- [ ] Show the list of usages locations of the relevant symbols in the graph. e.g. Locations of where `MyAgent` is used in the workspace. This can be used to navigate back to those locations in VSCode.
- [ ] Show the list of UEFN devices related to the relevant symbols in the graph. Similar to references/related symbols, but  focused on Fortnite devices.
- [ ] Show a notification if the symbol under the caret doesn't have enough data to be shown in the graph.
- [ ] Parse and Add comments to the description of the symbols in the graph.
- [ ] Implement the `Go to Reference Explorer` command. This command will navigate/focus the relevant symbol under the caret in the graph.
- [ ] Expose settings for darkmode, custom tiddlymap file, etc.
- [ ] Disable/modify UI elements and features from tiddlymaps to improve the UX.

### Verse Programming Language
- [ ] Add generic/templates members/methods to the vscode editor suggestions.
- [ ] Add snippets.

# Known Issues (To be fixed)

- `Navigate to VSCode` using `Ctrl+Click` gets disabled in tiddlymaps if the graph loses focus (e.g. by changing the view in tiddlymaps).
- Constructors do not generate a definition tree in the graph.
- Symbols such as `listenable` that implement interfaces with params such as `awaitable(payload)` do not generate a definition tree in the graph.

## Thanks to

- [TiddlyWiki](https://github.com/Jermolene/TiddlyWiki5)
- [TiddlyMap](https://github.com/felixhayashi/TW5-TiddlyMap)

## Keywords

Unreal Engine, Fortnite, UEFN, Verse, Visual Reference, Graph, Explorer, Fortnite Creative, Unreal Editor for Fortnite