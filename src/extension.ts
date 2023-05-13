import * as path from 'path';
import * as vscode from 'vscode';
import { workspace, ExtensionContext } from 'vscode';
import * as fs from 'fs';
import * as uuid from 'node-uuid';
import { SimpleTiddlerNode, TiddlerNode, NodeSymbol, ChildNodeSymbol, SimpleNodeSymbol, SymbolLocation, TiddlerEdge, TiddlerPosition } from './types';

const nodeHorizontalSpacing = 160;
const nodeVerticalSpacing = 120;
const nodeChildrenVerticalSpace = 80;

// TODO: 
// fix listenable in Verse.digest.verse
// fix DamagedEvent in Fortnite.digest.verse
// fix ctrl+click in graph gets disabled after changing view/losing focus
// fix constructors (MakeScoreManager in score_manager.verse)
// fix `ZoneDevices := GetCreativeObjectsWithTag(ZoneTag)` in `pickup_delivery_zone.verse`

// normalize all children (including definitions) as children of a symbol?
// crop symbols (i.e methods don't need to have children)
// append 'operator' symbols to the children of a given symbol
// add usages, related and devices
// add comments to the tiddler's descriptions
// make interal searches for children properties??? This way more nodes can be created but also it will be possible to style enum,class,struct properties, etc.

export async function activate(context: vscode.ExtensionContext) 
{
	const viewReferenceExplorerCommand = vscode.commands.registerCommand("verseHelper.viewReferenceExplorerCommand", (location : any) =>
	{
        HandleVerseReferenceExplorerCommand(context);
	});
    context.subscriptions.push(viewReferenceExplorerCommand);
}

async function HandleVerseReferenceExplorerCommand(context: vscode.ExtensionContext)
{
    const editor = vscode.window.activeTextEditor; 
    if(editor == null) return;
    const position = editor.selection.active;

    /* 
     * 1 - Get the definition tree of the symbol at the caret position
     * At fist, this only gets the name and location of the symbol (uri, position)
     */

    // Start by obtaining the symbol at the caret position
    let maybeSymbol = await tryGetSymbolAtCaretPosition(editor.document, position);
    if(!maybeSymbol) { return; } // No point in continuing if there is no symbol at the caret position
    
    // If a symbol is found, add it to the array and start looking for the next symbols recursively
    const maybeSymbolList : vscode.SymbolInformation[] = [];
    maybeSymbolList.push(maybeSymbol);

    while (true) 
    {
        // Get the document and position of the current stored maybeSymbol
        const currentDocument : vscode.TextDocument = await workspace.openTextDocument(maybeSymbol.location.uri);
        const currentPosition : vscode.Position = maybeSymbol.location.range.start;

        // Attempt to get the next symbol
        maybeSymbol = await tryGetNextSymbolFromCaretPosition(currentDocument, currentPosition);
        if(maybeSymbol) 
        {
            maybeSymbolList.push(maybeSymbol)
        }
        else
        {
            break;
        }
    }

    // console.log("----------------------------------------");
    // console.log("Maybe Symbols:");
    // for(const maybeSymbol of maybeSymbolList)
    // {
    //     const location = maybeSymbol.location.uri.fsPath.split("\\").pop() + " (ln: " + (maybeSymbol.location.range.start.line + 1) + ", col: " + (maybeSymbol.location.range.start.character + 1) + ")";
    //     console.log(maybeSymbol.name + " - Location: " + location);
    // }
    // console.log("----------------------------------------");

    /* 
     * 2 - For each maybe symbol, attempt to make a NodeSymbol.
     * NodeSymbol contains: Parents, Children, Location(in editor), Kind (type), Detail(type name), Usages, Implementations, Devices
     * NOTE: Step "1" is the only non agnostic functionality explicitly used for UEFN Verse. Other languages should start from here, but use only 1 symbol (the symbol at the caret) instead of an array of symbols.
     */

    const nodeSymbolTree = await getNodeSymbolListFromMaybeSymbolList(maybeSymbolList);
    
    // console.log("Found Symbols:");
    // for(const symbol of nodeSymbolTree)
    // {
    //     const definitionsNum = symbol.definitions.length;
    //     const childrenNum = symbol.children.length;
    //     const parentsNum = symbol.parents.length;
    //     const usagesNum = symbol.usages.length;
    //     const implmsNum = symbol.related.length;
    //     const devicesNum = symbol.devices.length;
    //     const location = symbol.location.path.split("\\").pop() + " (ln: " + (symbol.location.line + 1) + ", col: " + (symbol.location.character + 1) + ")";
    //     console.log(symbol.title + " - Kind: " + symbol.kind + " - Signature: " + symbol.signature + " - Definitions: " + definitionsNum + " - Children: " + childrenNum + " - Parents: " + parentsNum + " - Usages: " + usagesNum + " - Implms: " + implmsNum + " - Devices: " + devicesNum + " - Location: " + location);
    // }
    // console.log("----------------------------------------");

    /* 
     * 3 - Create an open a webview using the tiddlymap html file
     */
    const tiddlyPath = path.join(context.extensionPath, "tiddlymap");
    const wikiFilePath = path.join(tiddlyPath, "output.html");
    const wikiFile = fs.readFileSync(wikiFilePath, { encoding: "utf8" });

    const panel = vscode.window.createWebviewPanel(
        "verseHelperExplorer",
        "Verse Reference Explorer",
        vscode.ViewColumn.Two, // One or Active to view in full editor
        {
            enableScripts: true,
            localResourceRoots: [vscode.Uri.file(tiddlyPath)],
            retainContextWhenHidden: true
        }
    );
    panel.webview.html = wikiFile;

    /* 
    * 4 - Create the nodes in tiddlymap using the nodeSymbolTree
    */
    for(let symbolIndex = 0; symbolIndex < nodeSymbolTree.length; symbolIndex++)
    {
        const symbol = updateSymbolTitleTagFromMetadata(nodeSymbolTree[symbolIndex]);
        const posX = symbolIndex * nodeHorizontalSpacing;

        // Add current symbol
        const tiddler = new TiddlerNode(symbol.id, symbol.title, symbol.title, symbol.lineText, symbol.kind, symbol.signature, symbol.location, symbol.tags);
        const position = new TiddlerPosition(posX, 0);
        panel.webview.postMessage({ command: "addNode", tiddler: tiddler, position: position });

        if(symbol.children.length > 0 || symbol.definitions.length > 0)
        {
            // Create a simple connection node for the children nodes
            const conId = uuid.v4();
            const conTiddler = new SimpleTiddlerNode(conId, conId, "Children", ["has_children"]);
            const conPosition = new TiddlerPosition(posX, nodeVerticalSpacing);
            panel.webview.postMessage({ command: "addNode", tiddler: conTiddler, position: conPosition });
    
            // Connect symbol to connection symbol (Children node)
            const edge = new TiddlerEdge(symbol.id, conId, "normal");
            panel.webview.postMessage({ command: "addEdge", edge: edge });
    
            // Recursively create children nodes
            // const newPosX = posX - (nodeHorizontalSpacing/2) * (symbol.children.length + symbol.definitions.length - 1);
            createTiddlersFromNodeSymbol(panel.webview, conId, symbol, posX, nodeVerticalSpacing*2);
        }

        // Attemp to connect previous symbol to current symbol
        const previousSymbol = nodeSymbolTree[symbolIndex - 1];
        if(previousSymbol)
        {
            const edge = new TiddlerEdge(previousSymbol.id, symbol.id, "bold");
            panel.webview.postMessage({ command: "addEdge", edge: edge });
        }
    }

    /**
     * HANDLE MESSAGES RECEIVED FROM TIDDLYMAP
     */
    panel.webview.onDidReceiveMessage(message => 
    {
        switch (message.command) 
        {
            case "navigateToSymbol":
                navigateToLocation(message.location as SymbolLocation);
            break;
        }
    }, undefined, context.subscriptions);
}

function createTiddlersFromNodeSymbol(webview: vscode.Webview, parentId: string, symbol : ChildNodeSymbol, posX: number, posY: number)
{
    // Add children symbols
    if(symbol.children.length > 0)
    {   
        let newPosY = posY;
        for(let childIndex = 0; childIndex < symbol.children.length; childIndex++)
        {
            const childSymbol = updateSymbolTitleTagFromMetadata(symbol.children[childIndex]);
            // Create the child tiddler node
            const childTiddler = new TiddlerNode(childSymbol.id, childSymbol.title, childSymbol.title, childSymbol.lineText, childSymbol.kind, childSymbol.signature, childSymbol.location, childSymbol.tags);
            const childPosition = new TiddlerPosition(posX, newPosY);
            webview.postMessage({ command: "addNode", tiddler: childTiddler, position: childPosition });
            // Connect parent symbol to child
            const edge = new TiddlerEdge(parentId, childSymbol.id, "light");
            webview.postMessage({ command: "addEdge", edge: edge });
            newPosY += nodeChildrenVerticalSpace;
        }
        posX += nodeHorizontalSpacing; // Add 1 horizontal spacing after children
    }
    // Add definition symbols
    if(symbol.definitions.length > 0)
    {
        let lastDefinitionSymbol : ChildNodeSymbol | undefined;
        for(let definitionIndex = 0; definitionIndex < symbol.definitions.length; definitionIndex++)
        {
            const definitionSymbol = updateSymbolTitleTagFromMetadata(symbol.definitions[definitionIndex]);
            
            // Add a custom spacing using the previous definitionSymbol required width and the current definitionSymbol required width
            if(lastDefinitionSymbol)
            {
                posX += nodeHorizontalSpacing * (lastDefinitionSymbol.definitions.length + 1);
            }
            // Create the definition tiddler node
            const definitionTiddler = new TiddlerNode(definitionSymbol.id, definitionSymbol.title, definitionSymbol.title, definitionSymbol.lineText, definitionSymbol.kind, definitionSymbol.signature, definitionSymbol.location, definitionSymbol.tags);
            // Create the definition tiddler node
            const definitionPosition = new TiddlerPosition(posX, posY);
            webview.postMessage({ command: "addNode", tiddler: definitionTiddler, position: definitionPosition });
            // Connect the parentId to the definitionSymbol.id
            const edge = new TiddlerEdge(parentId, definitionSymbol.id, "normal");
            webview.postMessage({ command: "addEdge", edge: edge });
            
            // Recursively create children nodes
            // const newPosX = posX - (nodeHorizontalSpacing/2) * (definitionSymbol.children.length + definitionSymbol.definitions.length - 1);
            createTiddlersFromNodeSymbol(webview, definitionSymbol.id, definitionSymbol as NodeSymbol, posX, posY + nodeVerticalSpacing);
            lastDefinitionSymbol = definitionSymbol;
        }
    }
}

/** 
* Get a NodeSymbol tree from a list of maybe symbols (SymbolInformation)
* Each NodeSymbol can contain a structure of children, definitions, etc. that can be used to create nodes in tiddlymap
*/
async function getNodeSymbolListFromMaybeSymbolList(maybeSymbolList : vscode.SymbolInformation[]) : Promise<NodeSymbol[]>
{
    const nodeSymbolList : NodeSymbol[] = [];

    for (const maybeSymbol of maybeSymbolList)
    {
        const currentDocument = await workspace.openTextDocument(maybeSymbol.location.uri);
        // Get all symbols in the document
        const symbolInDocumentList = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>("vscode.executeDocumentSymbolProvider", currentDocument.uri);
        // Find the relevant symbol in the document and make the symbol heriarchy for it
        const nodeSymbol = await tryGetNodeSymbolInDocument(currentDocument, symbolInDocumentList, maybeSymbol);
        if (nodeSymbol) 
        {
            nodeSymbolList.push(nodeSymbol);
        }
    }

    return nodeSymbolList;
}

/**
 * Get the DocumentSymbol from a given maybe SymbolInformation. A document symbol may contain other document symbols as children.
 * A DocumentSymbol also has SymbolKind (property, method, class, etc), detail (type).
 */
async function tryGetNodeSymbolInDocument(document : vscode.TextDocument, documentSymbolList: vscode.DocumentSymbol[], maybeSymbol: vscode.SymbolInformation, symbolParents: SimpleNodeSymbol[] = []): Promise<NodeSymbol | undefined>
{
    for (const documentSymbol of documentSymbolList) 
    {
        // To prevent an edge case where maybeSymbol is out of range but in the same line as documentSymbol, create a new range that always start at the beginning of the line
        const documentSymbolrange = new vscode.Range(new vscode.Position(documentSymbol.range.start.line, 0), documentSymbol.range.end);
        
        // Check if the symbol's range contains the position of symbolToFind
        if (documentSymbolrange.contains(maybeSymbol.location.range.start)) 
        {
            // Check if the symbol matches symbolTaddEdgeoFind
            if (documentSymbol.name === maybeSymbol.name) 
            {
                // Map DocumentSymbol to the NodeSymbol type. TODO: Maybe find a mapper library for this?
                const id = uuid.v4();
                const lineText = document.lineAt(documentSymbol.range.start).text.trimStart();
                const kind = vscode.SymbolKind[documentSymbol.kind];
                const signature = documentSymbol.detail;
                const location = new SymbolLocation(maybeSymbol.location.uri.fsPath, documentSymbol.range.start.line, documentSymbol.range.start.character);
                const children = await getChildrenSymbolsFromDocument(document, documentSymbol.children, maybeSymbol.location.uri);
                const definitions = await getAdditionalDefinitionSymbols(document, documentSymbol.range.start, kind);
                const nodeSymbol = new NodeSymbol(id, documentSymbol.name, lineText, kind, signature, location, [], children, definitions, symbolParents, [], [], []);
                // Found the symbol that matches symbolToFind. This is a main symbol
                return nodeSymbol;
            } 
            else
            {
                // Every time we go down a level, add the parent to the list of parents
                const id = uuid.v4();
                const lineText = document.lineAt(documentSymbol.range.start).text.trimStart();
                const kind = vscode.SymbolKind[documentSymbol.kind];
                const signature = documentSymbol.detail;
                const location = new SymbolLocation(maybeSymbol.location.uri.fsPath, documentSymbol.range.start.line, documentSymbol.range.start.character);
                symbolParents.push(new SimpleNodeSymbol(id, documentSymbol.name, lineText, kind, signature, location, []));

                // Recursively search for the symbol in the children of this symbol
                const childSymbol = tryGetNodeSymbolInDocument(document, documentSymbol.children, maybeSymbol, symbolParents);
                if (childSymbol) 
                {
                    // childSymbol should return the symbol once return documentSymbol; returns something
                    return childSymbol;
                }
            }
        }
    }
    return undefined;
}

/**
 * Recursively map list of DocumentSymbol to list ChildNodeSymbol type.
*/
async function getChildrenSymbolsFromDocument(document : vscode.TextDocument, documentSymbolList: vscode.DocumentSymbol[], uri : vscode.Uri) : Promise<ChildNodeSymbol[]>
{
    const childNodeSymbolList : ChildNodeSymbol[] = [];
    for (const documentSymbol of documentSymbolList) 
    {
        const id = uuid.v4();
        const lineText = document.lineAt(documentSymbol.range.start).text.trimStart();
        const kind = vscode.SymbolKind[documentSymbol.kind];
        const signature = documentSymbol.detail;
        const location = new SymbolLocation(uri.fsPath, documentSymbol.range.start.line, documentSymbol.range.start.character);
        const children = await getChildrenSymbolsFromDocument(document, documentSymbol.children, uri);
        const definitions = await getAdditionalDefinitionSymbols(document, documentSymbol.range.start, kind);
        const childNodeSymbol = new ChildNodeSymbol(id, documentSymbol.name, lineText, kind, signature, location, [], children, definitions);
        childNodeSymbolList.push(childNodeSymbol);
    }
    return childNodeSymbolList;
}

/*
* Handles the obtaining of definition symbols from Class and Interface definitions (edge cases).
* TODO: Check if it works with enums, structs, etc.
*/
async function getAdditionalDefinitionSymbols(document : vscode.TextDocument, position : vscode.Position, kind : string) : Promise<ChildNodeSymbol[]>
{
    // Only search for a definition tree if the symbol is a class
    if(kind === "Class" || kind === "Interface")
    {
        const lineText = document.lineAt(position).text;

        // Get array of words inside the next parenthesis separated by commas.
        const maybeDefinitions = lineText.substring(lineText.indexOf("(") + 1, lineText.indexOf(")")).split(",");

        // Get Positions of each definitions using lineText and the position of the parenthesis
        const definitionPositions = maybeDefinitions.map((definition) => 
        {
            const definitionPosition = lineText.indexOf(definition.trim());
            return new vscode.Position(position.line, definitionPosition);
        });

        // Get the definition maybe symbols from the definition positions
        let maybeSymbolList : vscode.SymbolInformation[] = [];
        for(const definitionPosition of definitionPositions)
        {
            const maybeSymbol = await tryGetSymbolAtCaretPosition(document, definitionPosition);
            if(maybeSymbol)
            {
                maybeSymbolList.push(maybeSymbol);
            }
        }
        // Get the node symbols from the maybe symbol list
        const definitionSymbols = await getNodeSymbolListFromMaybeSymbolList(maybeSymbolList);
        return definitionSymbols;
    }

    // return empty by default
    return [];
}

/**
 * Get the symbol at the given position in the given document. It will attempt to return the symbol information from its definition.
 */
async function tryGetSymbolAtCaretPosition(document : vscode.TextDocument, position : vscode.Position) : Promise<vscode.SymbolInformation | undefined>
{
    /**
     * Get the first instance of symbol information at the given line that matches the given symbol name. 
     */
    function tryGetNamedSymbolAtLine(inDocument : vscode.TextDocument, inSymbolName:string, inLineNumber : number): vscode.SymbolInformation | undefined 
    {
        // Make a new position starting from the position of the first instance of the given symbol name in the line.
        const inCharNumber = inDocument.lineAt(inLineNumber).text.indexOf(inSymbolName); //column number where inSymbolName is found
        const inPosition = new vscode.Position(inLineNumber, inCharNumber);
        // Attempt to get the symbol at the given position
        return tryGetSymbolAtPosition(inDocument, inPosition);
    }

    /**
     * Get the symbol information at the given position in the given document.
     */
    function tryGetSymbolAtPosition(inDocument : vscode.TextDocument, inPosition : vscode.Position) : vscode.SymbolInformation | undefined
    {
        // Attempt to return the symbol information at the range from the given position.
        const range = inDocument.getWordRangeAtPosition(inPosition);
        if(range?.isSingleLine)
        {   
            return new vscode.SymbolInformation(inDocument.getText(range), vscode.SymbolKind.Null, "", new vscode.Location(inDocument.uri, range));
        }
        return undefined;
    }

    // First, get the symbol at the current position.
    const maybeSymbol = tryGetSymbolAtPosition(document, position);
    if(!maybeSymbol) { return undefined; } // If no symbol is found, return undefined.

    // Then, attempt to get the definition of the symbol at the caret.
    const definitionLocation = (await vscode.commands.executeCommand<vscode.Location[]>("vscode.executeDefinitionProvider", document.uri, position)).at(0);
    if(definitionLocation)
    {
        // If the definition is found, open the document and get the symbol at the definition location.
        const newPosition = definitionLocation.range.start;
        const newDocument = await vscode.workspace.openTextDocument(definitionLocation.uri);
        let newMaybeSymbol = tryGetSymbolAtPosition(newDocument, newPosition);

        if(maybeSymbol.name != newMaybeSymbol?.name)
        {
            // This is an edge case where maybeSymbol is not the same as the symbol at its definition (newMaybeSymbol). 
            // i.e when the definition of a type points to "class" or "interface"
            // In this case, attempt to get the first instance of the symbol by its name at the line of the definition.
            newMaybeSymbol = tryGetNamedSymbolAtLine(newDocument, maybeSymbol.name, newPosition.line);
        }
        return newMaybeSymbol;
    }
    return maybeSymbol;
}

/**
 * Get the word symbol that is next to the ":" character in the given position.
 */
async function tryGetNextSymbolFromCaretPosition(document : vscode.TextDocument, position : vscode.Position) : Promise<vscode.SymbolInformation | undefined>
{
    const lineText = document.lineAt(position.line).text;
    const caretPosition = position.character;
    
    // i.e. A if caret is in index 0 in "AddRemainingTime<public>(Time : float) : void= # hello"
    // i.e. B if caret in in index 0 in "class<final>(text_base): <# test #>"
    // i.e. C if caret in in index 0 in "GetTeams<public>()<transacts>:[]team"
    // i.e. D if caret is in index 0 in "TestConstant : (text_block)"
    // i.e. E if caret is in "MyClass" in "MyMethod(MyClass : my_class):void="
    const openDelimiters = ['<', '[', '(', '{', '<', '#'];
    const closeDelimiters = ['>', ']', ')', '}', '>', '#'];
    // We consider different symbols if these characters are found after ":" has been found
    const breakingSymbols = [',', ';', '#'];

    let currentOpenDelimiter = "";
    let positionOfRelevantDelimiter : number = -1;

    for (let i = caretPosition; i < lineText.length; i++) 
    {
        const c = lineText.charAt(i);

        // Only search for symbols if we are not inside a delimiter block
        if(currentOpenDelimiter.length == 0)
        {
            // Leave if we find a breaking symbol outside a delimiter block
            if(breakingSymbols.includes(c))
            {
                break;
            }

            // Try to find the delimiter ":" that is not inside a delimiter block 
            if(c == ':') 
            {
                // Return the position after the ":" symbol
                // i.e. A this should return position at " void= # hello"   - we can get "void" symbol from this
                // i.e. B this should return position at " <# test #>"      - there's no symbol after # as it acts as a close delimiter
                // i.e. C this should return position at "[]team"           - we can get "team" symbol from this
                // i.e. D this should return position at " (text_block)"    - we can get "text_block" symbol from this
                // i.e. E this should return position at " my_class):void=" - we can get "my_class" symbol from this
                positionOfRelevantDelimiter = i + 1; // Skip the ":" symbol

                //console.log("Relevant Substring: " + "`" + lineText.substring(positionOfRelevantDelimiter) + "`"); // print the substring before leaving the loop
                break;
            }
            else if(openDelimiters.includes(c))
            {
                currentOpenDelimiter = c;
            }
            else if(closeDelimiters.includes(c))
            {
                break;
            }
        }
        // if we are inside a delimiter block, search for the closing delimiter
        else if (closeDelimiters.includes(c))
        {
            // if pair matches the currentOpenDelimiter, clear currentOpenDelimiter
            if(openDelimiters.indexOf(currentOpenDelimiter) == closeDelimiters.indexOf(c))
            {
                currentOpenDelimiter = "";
            }
        }
    }

    // Invalid characters for a symbol
    const invalidCharacters = [' ', '(', ')', '[', ']', '{', '}', '<', '>', ',', ';', ':', '#', '=', '+', '-', '*', '/', '%', '&', '|', '^', '~', '!', '.', '@', '$', '\'', '"', '`', '\\' ];

    // Attempt to find next symbols in the relevant substring
    for (let i = positionOfRelevantDelimiter; i < lineText.length; i++) 
    {
        // If we find a breaking symbol, stop searching
        const c = lineText.charAt(i);
        if(i < 0 || breakingSymbols.includes(c))
        {
            break;
        }
        // If current character is invalid for a symbol, skip it
        if(invalidCharacters.includes(c))
        {
            continue;
        }

        // Try to get the symbol at the current position
        const symbol = await tryGetSymbolAtCaretPosition(document, new vscode.Position(position.line, i));
        if(symbol)
        {
            return symbol;
        }
    }
    return undefined;
}

/**
* Handles the "Go to Definition" command sent from the webview 
*/
async function navigateToLocation(location : SymbolLocation)
{
    const uri = vscode.Uri.file(location.path);
    const position = new vscode.Position(location.line, location.character);
    const document = await vscode.workspace.openTextDocument(uri);
    const editor = await vscode.window.showTextDocument(document, vscode.ViewColumn.One);
    editor.revealRange(new vscode.Range(position, position));
    editor.selection = new vscode.Selection(position, position);
}

/**
* Update the title and tags from a symbol using its metadata (kind, signature, etc.)
*/
function updateSymbolTitleTagFromMetadata(symbol : ChildNodeSymbol) : ChildNodeSymbol //TODO Modify by reference?
{
    // console.log("---------------------------------------------------------");
    // console.log("Title: " + symbol.title);
    // console.log("Data: ");
    // console.log(symbol);
    const title = symbol.title;
    const kind = symbol.kind;
    const signature = symbol.signature;
    let tag = kind.toLowerCase();
    let newTitle = title;
    switch (kind) 
    {
        case "Method":
            newTitle = title + "()";
        break;
        case "Property":
            tag = "property_object";
            newTitle = newTitle + " ";
            if(signature.includes("[]") && !signature.includes("[]char"))
            {
                newTitle = newTitle + "[]";
            }
            if(signature.includes("->"))
            {
                newTitle = newTitle + "[->]";
            }
            if(signature.includes("tuple"))
            {
                newTitle = newTitle + "(,)";
            }
            if(signature.includes("?"))
            {
                newTitle = newTitle + "?";
            }

            if(signature.includes("int"))
            {
                tag = "property_int";
            }
            else if(signature.includes("float"))
            {
                tag = "property_float";
            }
            else if(signature.includes("logic"))
            {
                tag = "property_logic";
            }
            else if(signature.includes("[]char"))
            {
                tag = "property_string";
            }
            else if(signature.includes("vector3"))
            {
                tag = "property_vector";
            }
            else if(signature.includes("rotation"))
            {
                tag = "property_rotator";
            }
            else if(signature.includes("transform"))
            {
                tag = "property_transform";
            }
            //TODO if definitions are populated, use it to determine if a property is a class, struct, interface, enum, etc.
        break;
    }

    symbol.title = newTitle;
    symbol.tags = [tag];
    return symbol;
}

// This method is called when your extension is deactivated
export function deactivate() {}