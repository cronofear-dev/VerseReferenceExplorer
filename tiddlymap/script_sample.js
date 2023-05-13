const vscode = acquireVsCodeApi();
const widget = $tm.registry[0];
const visNetwork = widget.network;
const adapter = $tm.adapter;
const wiki = $tw.wiki;

/**
 * EXAMPLE OF HOW TO ADD NODES AND EDGES TO THE MAP
 * NOTE: Styles are added to nodes using the `tags` parameter, while to edges using `type` parameter.
 * These styles should already exist in tiddlymap. Also note that node styles need to add a tag scope in tiddlymap. i.e a scope for the `test` tag: `[tag[test]]`
 * See: `tiddlymap.org->family tree` for more info on how to style nodes.
 */ 
const defaultView = new $tm.ViewAbstraction("Default", { isCreate: true });
const newTiddler1 = new  $tw.Tiddler({title: 'My Tiddler 1', text:'My Description 1', tags:['test'], customField: 'testField1'});
const newTiddler2 = new  $tw.Tiddler({title: 'My Tiddler 2', text:'My Description 2', customField: 'testField2'});
const newTiddler3 = new  $tw.Tiddler({title: 'My Tiddler 3', text:'My Description 3', customField: 'testField2'});
const node1 = adapter.insertNode({ label : newTiddler1.fields.title }, defaultView, newTiddler1);
const node2 = adapter.insertNode({ label : newTiddler2.fields.title }, defaultView, newTiddler2);
const node3 = adapter.insertNode({ label : newTiddler3.fields.title }, defaultView, newTiddler3);
const insertedEdge1 = adapter.insertEdge({from: node1.id, to: node2.id, type:'test'});
const insertedEdge2 = adapter.insertEdge({from: node2.id, to: node3.id, type:'test'});
defaultView.saveNodePosition({ id: node1.id, x: 0, y: 0});
defaultView.saveNodePosition({ id: node2.id, x: 200, y: 0});
defaultView.saveNodePosition({ id: node3.id, x: 400, y: 0});

/**
 * HANDLE MESSAGES RECEIVED FROM VSCODE
 */ 
window.addEventListener('message', function(event) 
{
    console.log("Event triggered");
    // The json data that the extension sent
    const message = event.data;
    switch (message.command)
    {
        // Add a new node
        case 'addNode':
            var myView = new $tm.ViewAbstraction("Default", { isCreate: true });
            var options = { view: myView };
            var node1 = $tm.adapter.insertNode({ label: message.text, description: "aaaaa" }, myView);
        break;
    }
});

/**
 * HANDLE EVENTS FROM TIDDLYMAP
 */
// Handle node selection
visNetwork.on('click', function(params) 
{
    if(params.event.srcEvent.ctrlKey) //Ctrl key is held down
    {
        visNetwork.unselectAll(); // Disable multiple selection so it only works with 1 node
        handleSelectedNode(params.nodes[0]);
    }
});

//
function handleSelectedNode(nodeId)
{
    const tiddlerName = adapter.getTiddlerById(nodeId);
    let tiddler = wiki.getTiddler(tiddlerName);
    if(tiddler)
    {
        widget.openTiddlerWithId(nodeId);
        console.log(tiddler);
        console.log(tiddler.fields['title']);
        console.log(tiddler.fields['text']);
        console.log(tiddler.fields['tmap.id']);
        console.log(tiddler.fields['customField']);
    }
}
