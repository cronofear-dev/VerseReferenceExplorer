# Tiddly Map settings

- Graph
    - layout
        - heriarchical : true
    - interaction
        - tooltipDelay: 50
    - manipulation
        - initiallyActive: false # disables node editing by default
- Editor
    - Show Neighbour menu: false
- Interaction & behavior
    - Default startup view: default
    - Popup Delay: 50
    - Allow single click mode: true
    - Edge click behavior: Nothing
    - Supress dialogs: all
- Live tab
    - Show live tab: true
    - Fall back view: Live?
- Verbosity
    - Debug: false
    - Notification: false?

# Packaging

Make sure `vsce` is installed
>npm install -g @vscode/vsce

Package:
>vsce package

Publish
>vsce publish

Install:

Go to Vscode->Extensions->`...` Menu->Install from VSIX

# Info

- Node styles can be inherited from tag. When a node has a tag, and a node type defines:
    - General->Scope: "[tag[MyTag]]"
- Edges can define direction without affecting hierarchy

This is a simple node.js app that is used to develop/modify `empty.html` (tiddlymap file) and `script.js` (tiddlymap custom script). The idea is to embed the `script.js` in the `empty.html` wiki file so it gets loaded when the tiddlymap is loaded.

The following packages are used:

- tw5-typed: This adds autocomplete for `$tw` (Tiddlywiki types) so it can be used in `scripts.js` for some QoL dev.
- tiddlywiki: Simply installed for reference.
- tiddlymap: Also installed for referencing purposes, and it's mostly useful to explore the api of the tiddlymap plugin (`$tm`)
    - This was installed using `npm install -D https://github.com/felixhayashi/TW5-TiddlyMap/tarball/master`

# API

The exposed namespaces seem to be defined in `Caretaker.js`. Also, print the `$tm` object in the console to see what's available.

- $tm.registry[0]: This is a reference to the active MapWidget.js
- $tm.mouse
- $tm.callbackManager
- $tm.dialogManager
- $tm.utils
- $tm.adapter
- $tw.wiki

# API detailed

tm.adapter:
- insertNode()
- insertEdge(): It's possible to add a type (style) to a node when created
- getTiddlerById(): Gets tiddler name by Id, use `$tw.wiki.getTiddler(name)` to get the actual tiddler
- addStyleToEdge()
- attachStylesToNodes()

tw.wiki:
- getTiddler(): Gets a tiddler reference by its name

# Changes in output.html

- The codeblock from `CUSTOM SCRIPT` to `CUSTOM SCRIPT END` at the end of the document