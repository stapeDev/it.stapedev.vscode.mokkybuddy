import * as vscode from 'vscode';
import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as net from 'net';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

interface ApiDef {
    method: HttpMethod;
    path: string;
    response?: any;
    expectedBody?: any;
    jsonSchema?: any;
}

interface ServerDef {
    name: string;
    port: number;
    javaPath: string;
    jsonPath?: string;
    apiList: ApiDef[];
    process?: ChildProcessWithoutNullStreams;
    running?: boolean;
}

let servers: ServerDef[] = [];

export function activate(context: vscode.ExtensionContext) {
    const output = vscode.window.createOutputChannel('Mokky Buddy API Runner');

    // ---------------- Paths ----------------
    const storageDir = context.globalStoragePath;
    fs.mkdirSync(storageDir, { recursive: true });
    const TEMP_CONFIG = path.join(storageDir, 'api-temp.json');
    const UI_CONFIG_FILE = path.join(storageDir, 'api-ui.json');

    // ---------------- Default Server ----------------
    const config = vscode.workspace.getConfiguration('mokkyBuddy');
    const javaPath = config.get<string>('javaPath') ?? 'C:\\tools\\java\\jdk-17.0.15+6\\bin\\java.exe';
    const port = config.get<number>('serverPort') ?? 8081;
    let apiList: ApiDef[] = [];

    try { 
        if (fs.existsSync(UI_CONFIG_FILE)) { apiList = JSON.parse(fs.readFileSync(UI_CONFIG_FILE, 'utf-8')); } 
    } catch {}

    servers.push({
        name: 'Localhost',
        port,
        javaPath,
        apiList,
        running: false
    });

    const persistUiConfig = () => { 
        try { fs.writeFileSync(UI_CONFIG_FILE, JSON.stringify(servers[0].apiList, null, 2), 'utf-8'); } catch {} 
    };

    const writeActiveConfig = (server: ServerDef) => {
        const target = server.jsonPath ?? TEMP_CONFIG;
        try { 
            fs.writeFileSync(target, JSON.stringify(server.apiList, null, 2), 'utf-8'); 
            output.appendLine(`💾 Config scritta su: ${target}`); 
        } catch (e: any) { 
            output.appendLine(`❌ Errore scrittura config: ${e?.message ?? e}`); 
            vscode.window.showErrorMessage('Errore nel salvare la configurazione attiva.'); 
        }
    };

    // ---------------- Tree Provider ----------------
    class ServerTreeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
        private _onDidChangeTreeData = new vscode.EventEmitter<vscode.TreeItem | null>();
        readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
        refresh() { this._onDidChangeTreeData.fire(null); }
        getTreeItem(el: vscode.TreeItem) { return el; }

        private preview(json: any) { 
            if (!json) { return '—'; } 
            const s = JSON.stringify(json); 
            return s.length > 60 ? s.slice(0, 60) + '…' : s; 
        }

        getChildren(element?: vscode.TreeItem): Thenable<vscode.TreeItem[]> {
            if (!element) {
                return Promise.resolve(servers.map(server => {
                    const item = new vscode.TreeItem(server.name, vscode.TreeItemCollapsibleState.Collapsed);
                    item.contextValue = 'serverNode';
                    return item;
                }));
            }

            if (element.contextValue === 'serverNode') {
                const server = servers.find(s => s.name === element.label);
                if (!server) { return Promise.resolve([]); }
                const items: vscode.TreeItem[] = [];

                const startStop = new vscode.TreeItem(server.running ? `⏹ Stop Server` : `▶ Start Server`, vscode.TreeItemCollapsibleState.None);
                startStop.command = { command: 'mokkyBuddyAPIRunner.toggleServer', title: 'Toggle Server', arguments: [server] };
                startStop.iconPath = { id: server.running ? 'debug-stop' : 'debug-start' };
                items.push(startStop);

                const portItem = new vscode.TreeItem(`Port: ${server.port}`);
                portItem.iconPath = { id: 'circle-outline' };
                items.push(portItem);

                const configItem = new vscode.TreeItem(
                    server.jsonPath ? `Config: file esterno (${path.basename(server.jsonPath)})` : `Config: UI (${server.apiList.length} API)`,
                    vscode.TreeItemCollapsibleState.None
                );
                configItem.iconPath = { id: 'file' };
                items.push(configItem);

                // API nodes
                server.apiList.forEach(a => {
                    const aNode = new vscode.TreeItem(`[${a.method}] ${a.path}`, vscode.TreeItemCollapsibleState.Collapsed);
                    aNode.contextValue = 'apiNode';
                    aNode.iconPath = { id: { GET: 'symbol-field', POST: 'add', PUT: 'edit', DELETE: 'trash' }[a.method] ?? 'gear' };
                    aNode.tooltip = `Click to expand details`;

                    const children: vscode.TreeItem[] = [];
                    if (a.response !== undefined) {
                        const rNode = new vscode.TreeItem(`Response: ${this.preview(a.response)}`, vscode.TreeItemCollapsibleState.None);
                        rNode.command = { command: 'mokkyBuddyAPIRunner.previewJson', title: 'Preview', arguments: [a.response] };
                        rNode.iconPath = { id: 'code' };
                        children.push(rNode);
                    }
                    if (a.expectedBody !== undefined) {
                        const bNode = new vscode.TreeItem(`Expected Body: ${this.preview(a.expectedBody)}`, vscode.TreeItemCollapsibleState.None);
                        bNode.command = { command: 'mokkyBuddyAPIRunner.previewJson', title: 'Preview', arguments: [a.expectedBody] };
                        bNode.iconPath = { id: 'symbol-paramete' };
                        children.push(bNode);
                    }
                    if (a.jsonSchema !== undefined) {
                        const sNode = new vscode.TreeItem(`JSON Schema: ${this.preview(a.jsonSchema)}`, vscode.TreeItemCollapsibleState.None);
                        sNode.command = { command: 'mokkyBuddyAPIRunner.previewJson', title: 'Preview', arguments: [a.jsonSchema] };
                        sNode.iconPath = { id: 'json' };
                        children.push(sNode);
                    }

                    const delNode = new vscode.TreeItem(`🗑 Delete API`, vscode.TreeItemCollapsibleState.None);
                    delNode.command = { command: 'mokkyBuddyAPIRunner.deleteAPI', title: 'Delete API', arguments: [server, a.path, a.method] };
                    delNode.iconPath = { id: 'trash' };
                    children.push(delNode);

                    aNode.collapsibleState = children.length > 0 ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None;
                    (aNode as any).children = children;
                    items.push(aNode);
                });

                // Add API
                const addItem = new vscode.TreeItem('➕ Add API', vscode.TreeItemCollapsibleState.None);
                addItem.command = { command: 'mokkyBuddyAPIRunner.addAPI', title: 'Add API', arguments: [server] };
                addItem.iconPath = { id: 'add' };
                items.push(addItem);

                // Save/Load Config
                const saveItem = new vscode.TreeItem('💾 Save Config', vscode.TreeItemCollapsibleState.None);
                saveItem.command = { command: 'mokkyBuddyAPIRunner.saveAPIConfig', title: 'Save API Config', arguments: [server] };
                saveItem.iconPath = { id: 'save' };
                items.push(saveItem);

                const loadItem = new vscode.TreeItem('📂 Load Config', vscode.TreeItemCollapsibleState.None);
                loadItem.command = { command: 'mokkyBuddyAPIRunner.loadAPIConfig', title: 'Load API Config', arguments: [server] };
                loadItem.iconPath = { id: 'folder-opened' };
                items.push(loadItem);

                return Promise.resolve(items);
            }

            if (element.contextValue === 'apiNode') {
                return Promise.resolve((element as any).children ?? []);
            }

            return Promise.resolve([]);
        }
    }

    const serverProvider = new ServerTreeProvider();
    context.subscriptions.push(vscode.window.registerTreeDataProvider('mokkyBuddyServerView', serverProvider));

    // ---------------- Server Utilities ----------------
    const checkPort = (port: number): Promise<boolean> => {
        return new Promise(resolve => {
            const server = net.createServer();
            server.once('error', () => resolve(false));
            server.once('listening', () => server.close(() => resolve(true)));
            server.listen(port);
        });
    };

    const startServer = async (server: ServerDef) => {
        if (!(await checkPort(server.port))) { vscode.window.showErrorMessage(`Porta ${server.port} già in uso!`); return; }
        const jarPath = path.join(context.extensionPath, 'resources/mokkyBuddyAPI.jar');
        const configPath = server.jsonPath ?? TEMP_CONFIG;
        if (!server.jsonPath) {writeActiveConfig(server);}
        output.appendLine(`▶ Avvio server ${server.name} (config: ${server.jsonPath ? 'file esterno' : 'UI'})`);

        server.process = spawn(server.javaPath, ['-jar', jarPath, `--it.stapedev.api.mokkybuddy.loader.mock.route.file=file:${configPath}`, `--server.port=${server.port}`]);
        server.process.stdout?.on('data', d => output.append(d.toString()));
        server.process.stderr?.on('data', d => output.append(`[stderr] ${d.toString()}`));
        server.process.on('exit', code => { 
            output.appendLine(`⏹ Server exited with code ${code}`); 
            server.process = undefined; 
            server.running = false; 
            serverProvider.refresh(); 
        });
        server.running = true;
        serverProvider.refresh();
        vscode.window.showInformationMessage(`Server ${server.name} Started`);
    };

    const restartServer = async (server: ServerDef) => {
        if (server.running && server.process) {
            server.process.kill();
            server.running = false;
            serverProvider.refresh();
            await new Promise(r => setTimeout(r, 300));
        }
        startServer(server);
    };

    // ---------------- Commands ----------------
    context.subscriptions.push(
        vscode.commands.registerCommand('mokkyBuddyAPIRunner.toggleServer', async (server: ServerDef) => {
            if (server.running && server.process) { 
                server.process.kill(); 
                server.running=false; 
                serverProvider.refresh(); 
                vscode.window.showInformationMessage(`${server.name} Stopped`); 
                return; 
            }
            startServer(server);
        }),

        vscode.commands.registerCommand('mokkyBuddyAPIRunner.addAPI', async (server: ServerDef) => {
            const method = await vscode.window.showQuickPick(['GET','POST','PUT','DELETE'], {placeHolder:'Select HTTP method'}) as HttpMethod|undefined;
            if(!method) {return;}
            const apiPath = await vscode.window.showInputBox({prompt:'API Path (es. /api/user/)',value:'/api/'}); 
            if(!apiPath || !apiPath.startsWith('/')) { vscode.window.showErrorMessage('Il path deve iniziare con "/"'); return; }
            const respInput = await vscode.window.showInputBox({prompt:'Response JSON (opzionale)',value:'[]'}); 
            let responseObj:any=undefined; 
            try{responseObj=respInput?JSON.parse(respInput):undefined;}catch{}
            server.apiList.push({method,path:apiPath,response:responseObj});
            persistUiConfig();
            serverProvider.refresh();
            restartServer(server);
        }),

        vscode.commands.registerCommand('mokkyBuddyAPIRunner.deleteAPI', async (server: ServerDef, path:string, method:HttpMethod) => {
            server.apiList = server.apiList.filter(a => !(a.path===path && a.method===method));
            persistUiConfig();
            serverProvider.refresh();
            restartServer(server);
        }),

        vscode.commands.registerCommand('mokkyBuddyAPIRunner.saveAPIConfig', async (server: ServerDef) => {
            const fileUri = await vscode.window.showSaveDialog({ defaultUri: vscode.Uri.file(`${server.name}-api-config.json`) });
            if(!fileUri) {return;}
            try { fs.writeFileSync(fileUri.fsPath, JSON.stringify(server.apiList, null, 2), 'utf-8'); vscode.window.showInformationMessage('Config saved'); }
            catch(e:any) { vscode.window.showErrorMessage('Errore nel salvare la configurazione'); }
        }),

        vscode.commands.registerCommand('mokkyBuddyAPIRunner.loadAPIConfig', async (server: ServerDef) => {
            const fileUri = await vscode.window.showOpenDialog({ canSelectFiles:true, canSelectMany:false, filters:{'JSON Files':['json']} });
            if(!fileUri || fileUri.length===0) {return;}
            try { 
                const data = JSON.parse(fs.readFileSync(fileUri[0].fsPath,'utf-8')); 
                server.apiList = data; 
                persistUiConfig();
                serverProvider.refresh();
                restartServer(server);
            }
            catch(e:any) { vscode.window.showErrorMessage('Errore nel caricare la configurazione'); }
        }),

        vscode.commands.registerCommand('mokkyBuddyAPIRunner.previewJson', async (json:any) => {
            const doc = await vscode.workspace.openTextDocument({content: JSON.stringify(json, null, 2), language:'json'});
            vscode.window.showTextDocument(doc, {preview:true});
        })
    );
}

export function deactivate() { 
    servers.forEach(s => { if(s.process) {s.process.kill();} }); 
}
