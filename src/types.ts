import * as vscode from 'vscode';

/**
 * Represents a symbol location in a document.
 * From this it's possible to generate a vscode.Uri and a vscode.Position.
 * vscode.Uri.file(path) - for Uri
 * new vscode.Position(line, character) - for Position
 */
export class SymbolLocation
{
    path: string;
    line: number;
    character: number;

    constructor(path: string, line: number, character: number)
    {
        this.path = path;
        this.line = line;
        this.character = character;
    }
}

export class TiddlerPosition
{
    x: number;
    y: number;

    constructor(x: number, y: number)
    {
        this.x = x;
        this.y = y;
    }
}

export class TiddlerEdge
{
    from: string; //fromId
    
    to: string; //toId
    
    type: string;

    constructor(fromId: string, toId: string, type: string)
    {
        this.from = fromId;
        this.to = toId;
        this.type = type;
    }
}

/**
* Represents a simple tiddler/node in Tiddlywiki. It has the minimum information required to be passed to tiddlywiki.
*/
export class SimpleTiddlerNode
{
    /**
     * The id of the tiddler that is generated ahead of time so it's easy to generate edges connecting nodes.
     */
    'tmap.id' : string;

    /**
     * The title of the tiddler
     */
    title: string;

    /**
     * The label of the node in the graph (this should support repeated labels, while title is unique due to how tiddlywiki works)
     */
    caption: string;

    /**
     * The tags of the tiddler, used to style the node in tiddlywiki.
     */
    tags: string[];

    /**
     * Creates a new Tiddler from symbol metadata.
    */
    constructor(id: string, title: string, caption: string, tags: string[])
    {
        this['tmap.id'] = id;
        this.title = title;
        this.caption = caption;
        this.tags = tags;
    }
}

/**
* Represents a simple tiddler/node in Tiddlywiki. It has the minimum information required to be passed to tiddlywiki.
*/
export class TiddlerNode extends SimpleTiddlerNode
{
    /**
    * The description of the tiddler
    */
    text: string;

    /**
     * The location of the symbol defined in this tiddler
     * Metadata passed to each tiddler/node so it can link back to vscode.
    */
    location: SymbolLocation;

    /**
     * Creates a new Tiddler from symbol metadata.
    */
    constructor(id: string, title: string, caption: string, lineText: string, kind: string, signature: string, location: SymbolLocation, tags: string[])
    {
        super(id, title, caption, tags);
        this.location = location;
        // Build a text description from the symbol metadata
        this.text = "```ts\n" + 
            lineText + 
            "\n```" +
            "\n^^''Kind'': //" + kind + "//^^\n" +
            "\n^^''Signature'': //" + signature + "//^^\n" +
            "\n^^''Location'': //" + location.path.split("\\").pop() + " (ln: " + (location.line + 1) + ")" + "//^^";
    }
}

/**
* Represents a simple symbol to be used in the graph.
*/
export class SimpleNodeSymbol
{
    /**
     * The id of the tiddler that is generated ahead of time so it's easy to generate edges connecting nodes.
     */
    id: string;

    /**
     * The name of this symbol to be displayed on tiddlywiki.
     */
    title: string;

    /**
    * The text of line where this symbol is defined, used to buidl a text description in tiddlywiki.
    */
    lineText: string;

    /**
    * The symbol kind, used to buidl a text description in tiddlywiki.
    * See: vscode.SymbolKind
    */
    kind: string;

    /**
    * The signature/type of this symbol, used to buidl a text description in tiddlywiki.
    * See: vscode.DocumentSymbol.detail
    */
    signature: string;

    /**
     * The location of this symbol in the vscode workspace. 
     * Metadata passed to each tiddler/node so it can link back to vscode.
    */
    location: SymbolLocation;

    /**
     * The tags of this symbol, used to style the node in tiddlywiki.
     */
    tags: string[];
   
    /**
     * Creates a new NodeSymbol.
    */
    constructor(id: string, title: string, lineText: string, kind: string, signature: string, location: SymbolLocation, tags: string[])
    {
        this.id = id;
        this.title = title;
        this.lineText = lineText;
        this.kind = kind;
        this.signature = signature;
        this.location = location;
        this.tags = tags;
    }
}

/**
* Represents a node symbol to be used in the graph that has children node symbols.
*/
export class ChildNodeSymbol extends SimpleNodeSymbol 
{
    /**
     * Children of this symbol, e.g. members/methods of a class.
     * Should also contain:
     * - children from native vscode implementations (DocumentSymbolProvider)
     * - children from inherited classes/interfaces
     * - children from extension methods/members (i.e "operator" methods in WorkspaceSymbolProvider)
     * TODO: Maybe separate these and group them by uri? Do it only if it's needed.
     */
    children: ChildNodeSymbol[]; // Childs can have child nodes (i.e. methods in a class)

    /**
    * Array of definitions of a symbol.
    * Usually a symbol will have only 1 definition, with the exception of classes that can multiple inheritance or multiple interface implementations.
    * In UEFN verse, see `fort_character` which has many interfaces definitions (positional, healable, etc.)
    */
    definitions: ChildNodeSymbol[];

    /**
     * Creates a new NodeSymbol.
     */
    constructor(id: string, title: string, lineText: string, kind: string, signature: string, location: SymbolLocation, tags: string[],  
        children: ChildNodeSymbol[], definitions: ChildNodeSymbol[])
    {
        super(id, title, lineText, kind, signature, location, tags); 
        this.children = children;
        this.definitions = definitions;
    }
}

/**
 * Represents a main symbol (main symbols are obtained from the caret position and its definitions).
 */
export class NodeSymbol extends ChildNodeSymbol
{
    /**
     * The heriarchy of parents where this symbol belongs to (i.e. method -> class -> module -> file)
     * The order determines the hierarchy, where the first element is the parent of the second element, and so on.
     */
    parents: SimpleNodeSymbol[]; // Parents are simple nodes with no childs or similar

    /**
     * The usages/references of this symbol
     * Only Location (uri, range) is needed as its only used to show where this symbol is being used.
     */
    usages : vscode.Location[]; // Usages are simple locations

    /**
     * The implementations/related symbols for this symbol 
     * Implementations are different places where the symbol is defined or implemented. i.e. polimorphism of method in a class, an interface being implemented in multiple places.
     * Generally, if it's a related symbol that may or has a different signature, then it's placed here.
    */
    related: ChildNodeSymbol[]; // Implementations are childs that can have child nodes (i.e. methods in a class)

    /**
     * A list of devices that this symbol is used in.
     * If a device is in any way related to this symbol, it should be added here.
     * 
     * NOTE: This is UEFN Verse specific.
    */
    devices: ChildNodeSymbol[]; // Devices are childs that can have child nodes (i.e. methods in a device class)

    /**
     * Creates a new NodeSymbol that requires every parameter.
     */
    constructor(id: string, title: string, lineText: string, kind: string, signature: string, location: SymbolLocation, tags: string[],  
        children: ChildNodeSymbol[], definitions: ChildNodeSymbol[] , parents: SimpleNodeSymbol[], usages: vscode.Location[], related: ChildNodeSymbol[], devices: ChildNodeSymbol[])
    {
        super(id, title, lineText, kind, signature, location, tags, children, definitions);
        this.parents = parents;
        this.usages = usages;
        this.related = related;
        this.devices = devices;
    }
}