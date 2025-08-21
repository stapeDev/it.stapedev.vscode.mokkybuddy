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
    const storageDir = context.globalStoragePath || path.join(context.extensionPath, 'storage');
    fs.mkdirSync(storageDir, { recursive: true });
    const TEMP_CONFIG = path.join(storageDir, 'api-temp.json');
    const UI_CONFIG_FILE = path.join(storageDir, 'api-ui.json');

    // ---------------- Default Server ----------------
    const config = vscode.workspace.getConfiguration('mokkyBuddy');
    const javaPath = config.get<string>('javaPath') ?? 'C:\\tools\\java\\jdk-17.0.15+6\\bin\\java.exe';
    const port = config.get<number>('serverPort') ?? 8081;
    let apiList: ApiDef[] = [];

    try { 
        if (fs.existsSync(UI_CONFIG_FILE)) {apiList = JSON.parse(fs.readFileSync(UI_CONFIG_FILE, 'utf-8'));}
    } catch {}

    servers.push({
        name: 'Localhost',
        port,
        javaPath,
        apiList,
        running: false
    });

    const log = (msg: string) => { 
        output.appendLine(msg); 
        console.log(msg); 
    };

    const persistUiConfig = () => { 
        try { 
            if (fs.existsSync(UI_CONFIG_FILE)) {servers = JSON.parse(fs.readFileSync(UI_CONFIG_FILE, 'utf-8'));}
            log(`💾 UI config salvata su: ${UI_CONFIG_FILE}`);
        } catch (e:any) { log(`❌ Errore salvando UI config: ${e?.message ?? e}`); } 
    };

    const writeActiveConfig = (server: ServerDef) => {
        const target = server.jsonPath ?? TEMP_CONFIG;
        try { 
            fs.writeFileSync(target, JSON.stringify(server.apiList, null, 2), 'utf-8'); 
            log(`💾 Config server scritta su: ${target}`); 
        } catch (e: any) { 
            log(`❌ Errore scrittura config: ${e?.message ?? e}`); 
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
            if (!json) {return '—';} 
            const s = JSON.stringify(json); 
            return s.length > 60 ? s.slice(0, 60) + '…' : s; 
        }

        getChildren(element?: vscode.TreeItem): Thenable<vscode.TreeItem[]> {
            if (!element) {
                return Promise.resolve(servers.map(server => {
                    const item = new vscode.TreeItem(`${server.name}:${server.port}`, vscode.TreeItemCollapsibleState.Collapsed);
                    (item as any).serverIndex = servers.indexOf(server);
                    item.contextValue = 'serverNode';
                    return item;
                }));
            }

            if (element.contextValue === 'serverNode') {
                const server = servers[(element as any).serverIndex];
                if (!server) {return Promise.resolve([]);}
                const items: vscode.TreeItem[] = [];

                const startStop = new vscode.TreeItem(server.running ? `⏹ Stop Server` : `▶ Start Server`, vscode.TreeItemCollapsibleState.None);
                startStop.command = { command: 'mokkyBuddyAPIRunner.toggleServer', title: 'Toggle Server', arguments: [server] };
                items.push(startStop);

                const portItem = new vscode.TreeItem(`Port: ${server.port}`, vscode.TreeItemCollapsibleState.None);
                portItem.command = { command: 'mokkyBuddyAPIRunner.changePort', title: 'Change Port', arguments: [server] };
                items.push(portItem);


                items.push(new vscode.TreeItem(
                    server.jsonPath ? `Config: file esterno (${path.basename(server.jsonPath)})` : `Config: UI (${server.apiList.length} API)`,
                    vscode.TreeItemCollapsibleState.None
                ));

                server.apiList.forEach(a => {
                    const aNode = new vscode.TreeItem(`[${a.method}] ${a.path}`, vscode.TreeItemCollapsibleState.Collapsed);
                    aNode.contextValue = 'apiNode';
                    aNode.tooltip = `Click to expand details`;

                    const children: vscode.TreeItem[] = [];
                    if (a.response !== undefined) {
                        const rNode = new vscode.TreeItem(`Response: ${this.preview(a.response)}`, vscode.TreeItemCollapsibleState.None);
                        rNode.command = { command: 'mokkyBuddyAPIRunner.previewJson', title: 'Preview', arguments: [a.response] };
                        children.push(rNode);
                    }
                    if (a.expectedBody !== undefined) {
                        const bNode = new vscode.TreeItem(`Expected Body: ${this.preview(a.expectedBody)}`, vscode.TreeItemCollapsibleState.None);
                        bNode.command = { command: 'mokkyBuddyAPIRunner.previewJson', title: 'Preview', arguments: [a.expectedBody] };
                        children.push(bNode);
                    }
                    if (a.jsonSchema !== undefined) {
                        const sNode = new vscode.TreeItem(`JSON Schema: ${this.preview(a.jsonSchema)}`, vscode.TreeItemCollapsibleState.None);
                        sNode.command = { command: 'mokkyBuddyAPIRunner.previewJson', title: 'Preview', arguments: [a.jsonSchema] };
                        children.push(sNode);
                    }

                    const delNode = new vscode.TreeItem(`🗑 Delete API`, vscode.TreeItemCollapsibleState.None);
                    delNode.command = { command: 'mokkyBuddyAPIRunner.deleteAPI', title: 'Delete API', arguments: [server, a.path, a.method] };
                    children.push(delNode);

                    aNode.collapsibleState = children.length > 0 ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None;
                    (aNode as any).children = children;
                    items.push(aNode);
                });

                const addItem = new vscode.TreeItem('➕ Add API', vscode.TreeItemCollapsibleState.None);
                addItem.command = { command: 'mokkyBuddyAPIRunner.addAPI', title: 'Add API', arguments: [server] };
                items.push(addItem);

                const saveItem = new vscode.TreeItem('💾 Save Config', vscode.TreeItemCollapsibleState.None);
                saveItem.command = { command: 'mokkyBuddyAPIRunner.saveAPIConfig', title: 'Save API Config', arguments: [server] };
                items.push(saveItem);

                const loadItem = new vscode.TreeItem('📂 Load Config', vscode.TreeItemCollapsibleState.None);
                loadItem.command = { command: 'mokkyBuddyAPIRunner.loadAPIConfig', title: 'Load API Config', arguments: [server] };
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
        if (!(await checkPort(server.port))) { 
            vscode.window.showErrorMessage(`Porta ${server.port} già in uso!`); 
            log(`❌ Porta ${server.port} già in uso`); 
            return; 
        }

        const jarPath = path.join(context.extensionPath || '', 'resources', 'mokkyBuddyAPI.jar');
        if (!fs.existsSync(jarPath)) { vscode.window.showErrorMessage(`Jar non trovato: ${jarPath}`); log(`❌ Jar non trovato: ${jarPath}`); return; }

        const configPath = server.jsonPath ?? TEMP_CONFIG;
        if (!fs.existsSync(configPath)) {writeActiveConfig(server);}
        if (!fs.existsSync(configPath)) { vscode.window.showErrorMessage(`Config non trovata: ${configPath}`); log(`❌ Config non trovata: ${configPath}`); return; }

        const javaExec = javaPath || 'C:\\tools\\java\\jdk-17.0.15+6\\bin\\java.exe';
        if (!fs.existsSync(javaExec)) { vscode.window.showErrorMessage(`Java non trovato: ${javaExec}`); log(`❌ Java non trovato: ${javaExec}`); return; }

        server.process = spawn(javaExec, ['-jar', jarPath, `--it.stapedev.api.mokkybuddy.loader.mock.route.file=file:${configPath}`, `--server.port=${server.port}`]);
        server.process.stdout?.on('data', d => log(`[stdout] ${d.toString()}`));
        server.process.stderr?.on('data', d => log(`[stderr] ${d.toString()}`));
        server.process.on('exit', code => { 
            log(`⏹ Server ${server.name} exited with code ${code}`); 
            server.process = undefined; 
            server.running = false; 
            serverProvider.refresh(); 
        });

        server.running = true;
        serverProvider.refresh();
        vscode.window.showInformationMessage(`Server ${server.name} Started`);
        log(`▶ Server ${server.name} avviato sulla porta ${server.port}`);
    };

    const restartServer = async (server: ServerDef) => {
        log(`🔄 Restarting server ${server.name}...`);
        if (server.running && server.process) {
            server.process.kill();
            server.running = false;
            serverProvider.refresh();
            await new Promise(r => setTimeout(r, 300));
        }
        await startServer(server);
    };

    // ---------------- Commands ----------------
    context.subscriptions.push(
        vscode.commands.registerCommand('mokkyBuddyAPIRunner.toggleServer', async (server: ServerDef) => {
            if (server.running && server.process) { 
                server.process.kill(); 
                server.running = false; 
                serverProvider.refresh(); 
                vscode.window.showInformationMessage(`${server.name} Stopped`); 
                log(`⏹ Server ${server.name} stopped`);
                return; 
            }
            await startServer(server);
        }),

        vscode.commands.registerCommand('mokkyBuddyAPIRunner.addAPI', async (server: ServerDef) => {
            try {
                const method = await vscode.window.showQuickPick(['GET','POST','PUT','DELETE'], { placeHolder: 'Select HTTP method' }) as HttpMethod | undefined;
                if (!method) {return;}

                const apiPath = await vscode.window.showInputBox({ prompt: 'API Path (es. /api/user/)', value: '/api/' });
                if (!apiPath || !apiPath.startsWith('/')) { vscode.window.showErrorMessage('Il path deve iniziare con "/"'); return; }

                const respInput = await vscode.window.showInputBox({ prompt: 'Response JSON (opzionale)', value: '[]' });
                let responseObj: any = undefined;
                if (respInput) { try { responseObj = JSON.parse(respInput); } catch { vscode.window.showWarningMessage('JSON di risposta non valido, verrà ignorato'); } }

                server.apiList.push({ method, path: apiPath, response: responseObj });
                persistUiConfig();
                writeActiveConfig(server);
                serverProvider.refresh();
                await restartServer(server);
                vscode.window.showInformationMessage(`API [${method}] ${apiPath} aggiunta!`);
                log(`➕ API aggiunta: [${method}] ${apiPath}`);
            } catch (e: any) { 
                vscode.window.showErrorMessage('Errore durante l’aggiunta della API: ' + (e?.message ?? e)); 
                log(`❌ Errore aggiungendo API: ${e?.message ?? e}`);
            }
        }),

        vscode.commands.registerCommand('mokkyBuddyAPIRunner.deleteAPI', async (server: ServerDef, path:string, method:HttpMethod) => {
            server.apiList = server.apiList.filter(a => !(a.path===path && a.method===method));
            persistUiConfig();
            writeActiveConfig(server);
            serverProvider.refresh();
            await restartServer(server);
            log(`🗑 API rimossa: [${method}] ${path}`);
        }),

        vscode.commands.registerCommand('mokkyBuddyAPIRunner.saveAPIConfig', async (server: ServerDef) => {
            const fileUri = await vscode.window.showSaveDialog({ defaultUri: vscode.Uri.file(`${server.name}-api-config.json`) });
            if (!fileUri) {return;}
            try { 
                fs.writeFileSync(fileUri.fsPath, JSON.stringify(server.apiList, null, 2), 'utf-8'); 
                vscode.window.showInformationMessage('Config saved'); 
                log(`💾 Config salvata manualmente su: ${fileUri.fsPath}`);
            } catch(e:any) { 
                vscode.window.showErrorMessage('Errore nel salvare la configurazione'); 
                log(`❌ Errore salvando config: ${e?.message ?? e}`);
            }
        }),

        vscode.commands.registerCommand('mokkyBuddyAPIRunner.loadAPIConfig', async (server: ServerDef) => {
            const fileUri = await vscode.window.showOpenDialog({ canSelectFiles:true, canSelectMany:false, filters:{'JSON Files':['json']} });
            if (!fileUri || fileUri.length===0) {return;}
            try { 
                const data = JSON.parse(fs.readFileSync(fileUri[0].fsPath,'utf-8')); 
                server.apiList = data; 
                persistUiConfig();
                writeActiveConfig(server);
                serverProvider.refresh();
                await restartServer(server);
                log(`📂 Config caricata da: ${fileUri[0].fsPath}`);
            } catch(e:any) { 
                vscode.window.showErrorMessage('Errore nel caricare la configurazione'); 
                log(`❌ Errore caricando config: ${e?.message ?? e}`);
            }
        }),

        vscode.commands.registerCommand('mokkyBuddyAPIRunner.previewJson', async (json:any) => {
            const doc = await vscode.workspace.openTextDocument({content: JSON.stringify(json, null, 2), language:'json'});
            vscode.window.showTextDocument(doc, {preview:true});
        }),

        vscode.commands.registerCommand('mokkyBuddyAPIRunner.changePort', async (server: ServerDef) => {
            const input = await vscode.window.showInputBox({
            prompt: `Inserisci nuova porta per ${server.name}`,
            value: server.port.toString(),
            validateInput: (v) => isNaN(Number(v)) ? 'Deve essere un numero' : null
            });
            if (!input) {return;}
            const newPort = Number(input);
            const portFree = await checkPort(newPort);
            if (!portFree) {
                vscode.window.showErrorMessage(`Porta ${newPort} già in uso`);
                return;
            }
            // Aggiorno solo la porta del server esistente
            server.port = newPort;
            // Riavvio server se era in esecuzione
            if (server.running && server.process) {
                server.process.kill();
                server.running = false;
                await new Promise(r => setTimeout(r, 300));
                await startServer(server);
            }
            +
            serverProvider.refresh();
            vscode.window.showInformationMessage(`${server.name} ora usa la porta ${newPort}`);
        })
    );
}

export function deactivate() { 
    servers.forEach(s => { if(s.process) {s.process.kill();} }); 
}
