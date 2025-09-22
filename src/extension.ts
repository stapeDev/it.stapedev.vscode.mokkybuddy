import * as vscode from 'vscode';
import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as net from 'net';
import FormData from 'form-data';
import fetch from 'node-fetch';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

interface UiServer {
    name: string;
    port: number;
    javaPath: string;
    apiList: ApiDef[];
}

interface ApiDef {
    id?: string;
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
    apiList: ApiDef[];
    process?: ChildProcessWithoutNullStreams;
    running?: boolean;
}

let servers: ServerDef[] = [];
export { servers };

export const outputChannel = vscode.window.createOutputChannel('Mokky Buddy API Runner');

export function activate(context: vscode.ExtensionContext) {
    const log = (msg: string) => { outputChannel.appendLine(msg); console.log(msg); };

    const config = vscode.workspace.getConfiguration('mokkyBuddy');
    const javaPath = config.get<string>('javaPath') ?? 'java';
    const port = config.get<number>('serverPort') ?? 8081;

    const storageDir = context.globalStoragePath || path.join(context.extensionPath, 'storage');
    fs.mkdirSync(storageDir, { recursive: true });
    const TEMP_CONFIG = path.join(storageDir, 'api-temp.json');
    const UI_CONFIG_FILE = path.join(storageDir, 'api-ui.json');

    const getCurrentApiMode = (): 'file' | 'database' => {
        return vscode.workspace.getConfiguration('mokkyBuddy').get<'file'|'database'>('apiMode') ?? 'file';
    };
    
    const server: ServerDef = { name: 'Localhost', port, javaPath, apiList: [], running: false };
    servers.push(server);

    const loadApisForServer = async (server: ServerDef): Promise<void> => {
        const mode = getCurrentApiMode();
    
        // Modalità FILE: preferisci TEMP_CONFIG (stato attivo) poi fallback a UI_CONFIG_FILE
        if (mode === 'file') {
            try {
                // Se esiste TEMP_CONFIG -> è lo stato attivo del server (usato da writeActiveConfig)
                if (fs.existsSync(TEMP_CONFIG)) {
                    const raw = JSON.parse(fs.readFileSync(TEMP_CONFIG, 'utf-8')) ?? [];
                    // TEMP_CONFIG è un array di ApiDef per questo server
                    server.apiList = Array.isArray(raw) ? raw.filter((a: any) => a.path && a.method) : [];
                    return;
                }
    
                // Altrimenti fallback a UI_CONFIG_FILE (che contiene la lista di tutti i server)
                if (fs.existsSync(UI_CONFIG_FILE)) {
                    const rawList: UiServer[] = JSON.parse(fs.readFileSync(UI_CONFIG_FILE, 'utf-8')) ?? [];
                    server.apiList = rawList.find((s: UiServer) => s.name === server.name)?.apiList ?? [];
                    return;
                }
    
                // Nessun file -> lista vuota
                server.apiList = [];
            } catch (e: any) {
                log(`❌ Errore caricando config file (file mode): ${e?.message ?? e}`);
                server.apiList = [];
            }
            return;
        }
    
        // Modalità DATABASE: richiama il server remoto (se in esecuzione)
        if (mode === 'database') {
            if (!server.running) {
                server.apiList = [];
                return;
            }
            try {
                const res = await fetch(`http://localhost:${server.port}/api/mokky/route/`);
                const data: any[] = await res.json();
                server.apiList = data.map(d => ({
                    id: String(d.id),
                    method: d.method as HttpMethod,
                    path: d.path,
                    expectedBody: d.expectedBody,
                    response: d.response,
                    jsonSchema: d.jsonSchema
                }));
            } catch (e: any) {
                log(`❌ Errore fetching API list: ${e?.message ?? e}`);
                server.apiList = [];
            }
        }
    };

    loadApisForServer(server).then(() => {
        serverProvider.refresh();
    });

    const serverProviderRefresh = new vscode.EventEmitter<vscode.TreeItem | null>();

    const persistUiConfig = () => {
        try {
            const uiServers = servers.map(s => ({
                name: s.name,
                port: s.port,
                javaPath: s.javaPath,
                apiList: s.apiList
            }));
            fs.writeFileSync(UI_CONFIG_FILE, JSON.stringify(uiServers, null, 2), 'utf-8');
            log(`💾 UI config salvata su: ${UI_CONFIG_FILE}`);
        } catch (e: any) { log(`❌ Errore salvando UI config: ${e?.message ?? e}`); }
    };

    const writeActiveConfig = (server: ServerDef) => {
        if (getCurrentApiMode() === 'file') {
            try {
                fs.writeFileSync(TEMP_CONFIG, JSON.stringify(server.apiList ?? [], null, 2), 'utf-8');
                log(`💾 Config server scritta su: ${TEMP_CONFIG}`);
            } catch (e: any) {
                log(`❌ Errore scrittura config: ${e?.message ?? e}`);
                vscode.window.showErrorMessage('Errore nel salvare la configurazione attiva.');
            }
        }
    };

    class ServerTreeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
        private _onDidChangeTreeData = serverProviderRefresh;
        readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

        refresh() { this._onDidChangeTreeData.fire(null); }

        private preview(json: any) { 
            if (!json) { return '—'; }
            const s = JSON.stringify(json);
            return s.length > 60 ? s.slice(0, 60) + '…' : s;
        }

        getTreeItem(el: vscode.TreeItem) { return el; }

        async getChildren(element?: vscode.TreeItem): Promise<vscode.TreeItem[]> {
            if (!element) {
                return servers.map((server, index) => {
                    const apiCount = server.apiList?.filter(a => a.path && a.method).length ?? 0;
                    const label = `${server.name}:${server.port} (${apiCount} API)`;
                    const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.Collapsed);
                    (item as any).serverIndex = index;
                    item.contextValue = 'serverNode';
                    return item;
                });
            }
        
            if (element.contextValue === 'serverNode') {
                const server = servers[(element as any).serverIndex];
                if (!server) { return []; }
        
                await loadApisForServer(server);
        
                const items: vscode.TreeItem[] = [];
        
                const startStop = new vscode.TreeItem(server.running ? `⏹ Stop Server` : `▶ Start Server`, vscode.TreeItemCollapsibleState.None);
                startStop.command = { command: 'mokkyBuddyAPIRunner.toggleServer', title: 'Toggle Server', arguments: [server] };
                items.push(startStop);
        
                const portItem = new vscode.TreeItem(`Port: ${server.port}`, vscode.TreeItemCollapsibleState.None);
                portItem.command = { command: 'mokkyBuddyAPIRunner.changePort', title: 'Change Port', arguments: [server] };
                items.push(portItem);
        
                const modeItem = new vscode.TreeItem(`API Mode: ${getCurrentApiMode()}`, vscode.TreeItemCollapsibleState.None);
                modeItem.command = { command: 'mokkyBuddyAPIRunner.selectApiMode', title: 'Seleziona modalità API' };
                items.push(modeItem);
        
                // 🔧 SOLUZIONE 1: sempre basato sullo stato attuale in memoria
                const configApiCount = getCurrentApiMode() === 'file'
                    ? server.apiList?.filter(a => a.path && a.method).length ?? 0
                    : 0;
        
                const configLabel = getCurrentApiMode() === 'file'
                    ? `Config: UI (${configApiCount} API)`
                    : `Config: Database`;
                items.push(new vscode.TreeItem(configLabel, vscode.TreeItemCollapsibleState.None));
                      
                server.apiList?.filter(a => a.path && a.method).forEach(a => {
                    const aNode = new vscode.TreeItem(`[${a.method}] ${a.path}`, vscode.TreeItemCollapsibleState.Collapsed);
                    aNode.contextValue = 'apiNode';
                    aNode.tooltip = `API ${a.method} ${a.path}`;
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
                    delNode.command = { command: 'mokkyBuddyAPIRunner.deleteAPI', title: 'Delete API', arguments: [server, a] };
                    children.push(delNode);
        
                    (aNode as any).children = children;
                    aNode.collapsibleState = children.length > 0 ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None;
                    items.push(aNode);
                });
        
                const addItem = new vscode.TreeItem('➕ Add API', vscode.TreeItemCollapsibleState.None);
                addItem.command = { command: 'mokkyBuddyAPIRunner.addAPI', title: 'Add API', arguments: [server] };
                items.push(addItem);
                
                if (getCurrentApiMode() === 'file') {
                    const saveItem = new vscode.TreeItem('💾 Save Config', vscode.TreeItemCollapsibleState.None);
                    saveItem.command = { command: 'mokkyBuddyAPIRunner.saveConfig', title: 'Save Config', arguments: [server] };
                    items.push(saveItem);
                }
                const loadItem = new vscode.TreeItem('📂 Load Config', vscode.TreeItemCollapsibleState.None);
                loadItem.command = { command: 'mokkyBuddyAPIRunner.loadAPIConfig', title: 'Load API Config', arguments: [server] };
                items.push(loadItem);
        
                return items;
            }
        
            if (element.contextValue === 'apiNode') {
                return Promise.resolve((element as any).children ?? []);
            }
        
            return [];
        }        
    }

    const serverProvider = new ServerTreeProvider();
    context.subscriptions.push(vscode.window.registerTreeDataProvider('mokkyBuddyServerView', serverProvider));

    
    const checkPort = async (port: number): Promise<boolean> => {
        if (process.env.NODE_ENV === 'test') {return true;}
        return new Promise(resolve => {
            const server = net.createServer();
            server.once('error', () => resolve(false));
            server.once('listening', () => server.close(() => resolve(true)));
            server.listen(port);
        });
    };

    // Funzione helper per riavviare il server con gestione porta
    const restartServer = async (server: ServerDef) => {
        if (server.running) {stopServer(server);}

        // Aspetta che la porta si liberi
        const maxRetries = 5;
        for (let i = 0; i < maxRetries; i++) {
            if (await checkPort(server.port)) {break;}
            await new Promise(r => setTimeout(r, 500));
        }

        await startServer(server);
    };

    const startServer = async (server: ServerDef) => {
        if (!(await checkPort(server.port))) { 
            vscode.window.showErrorMessage(`Porta ${server.port} già in uso!`); 
            log(`❌ Porta ${server.port} già in uso`); 
            return; 
        }
    
        const jarPath = path.join(context.extensionPath || '', 'resources', 'mokkyBuddyAPI.jar');
        if (!fs.existsSync(jarPath)) { 
            vscode.window.showErrorMessage(`Jar non trovato: ${jarPath}`); 
            log(`❌ Jar non trovato: ${jarPath}`);
            return; 
        }
    
        const args: string[] = ['-jar', jarPath, `--server.port=${server.port}`];
    
        if (getCurrentApiMode() === 'database') {
            args.push(`--spring.profiles.active=databaselocal`);
        } else {
            args.push(`--it.stapedev.api.mokkybuddy.loader.mock.route.file=file:${TEMP_CONFIG}`);
            // Carica API dal TEMP_CONFIG all'avvio
            if (fs.existsSync(TEMP_CONFIG)) {
                try {
                    const rawList = JSON.parse(fs.readFileSync(TEMP_CONFIG, 'utf-8')) ?? [];
                    server.apiList = rawList.filter((a: any) => a.path && a.method);
                } catch (e: any) { log(`❌ Errore caricando TEMP_CONFIG: ${e?.message ?? e}`); }
            }
        }
    
        server.process = spawn(server.javaPath, args);
        server.process.stdout?.on('data', (chunk: Buffer) => chunk.toString().split(/\r?\n/).filter(l => l).forEach(line => log(`[Spring stdout] ${line}`)));
        server.process.stderr?.on('data', (chunk: Buffer) => chunk.toString().split(/\r?\n/).filter(l => l).forEach(line => log(`[Spring stderr] ${line}`)));
        server.process.on('exit', code => { 
            server.process = undefined; 
            server.running = false; 
            serverProvider.refresh(); 
            log(`⏹ Server ${server.name} exited with code ${code}`); 
        });
    
        server.running = true;
        serverProvider.refresh();
        vscode.window.showInformationMessage(`Server avviato su http://localhost:${server.port}`);
    };

    const stopServer = (server: ServerDef) => {
        server.process?.kill();
        server.running = false;
        serverProvider.refresh();
        vscode.window.showInformationMessage(`Server fermato.`);
    };

    context.subscriptions.push(
        vscode.commands.registerCommand('mokkyBuddyAPIRunner.toggleServer', async (server: ServerDef) => {
            if (server.running) { stopServer(server); } else { startServer(server); }
        }),
        vscode.commands.registerCommand('mokkyBuddyAPIRunner.changePort', async (server: ServerDef) => {
            const portStr = await vscode.window.showInputBox({ placeHolder: 'New Port', value: String(server.port) });
            if (!portStr) {return;}
            const newPort = Number(portStr);
            if (isNaN(newPort)) { vscode.window.showErrorMessage('Porta non valida'); return; }
            server.port = newPort;
            await restartServer(server);
        }),
        vscode.commands.registerCommand('mokkyBuddyAPIRunner.previewJson', async (json: any) => {
            const doc = await vscode.workspace.openTextDocument({ content: JSON.stringify(json, null, 2), language: 'json' });
            vscode.window.showTextDocument(doc, { preview: false });
        }),
        vscode.commands.registerCommand('mokkyBuddyAPIRunner.deleteAPI', async (server: ServerDef, api: ApiDef) => {
            if (getCurrentApiMode() === 'database' && api.id) {
                try {
                    const res = await fetch(`http://localhost:${server.port}/api/mokky/route/${api.id}/`, { method: 'DELETE' });
                    if (!res.ok) { const text = await res.text(); log(`❌ Errore delete API: status ${res.status}, body: ${text}`); return; }
                } catch (e: any) { log(`❌ Errore delete API: ${e?.message ?? e}`); return; }
            }
            server.apiList = server.apiList.filter(a => a !== api);
            // Scrivi il config attivo (TEMP_CONFIG) -- in modo che loadApisForServer lo trovi subito
            writeActiveConfig(server);
        
            // Aggiorna il tree (mostra il conteggio aggiornato)
            serverProvider.refresh();
        
            // Se il server è in esecuzione, riavvialo per caricare il nuovo TEMP_CONFIG
            if (getCurrentApiMode() === 'file' && server.running) {
                await restartServer(server);
            }
        }),
        vscode.commands.registerCommand('mokkyBuddyAPIRunner.addAPI', async (server: ServerDef) => {
            const methodPick = await vscode.window.showQuickPick(['GET','POST','PUT','DELETE'], { placeHolder: 'HTTP Method' });
            if (!methodPick) {return;}
        
            const pathInput = await vscode.window.showInputBox({ placeHolder: '/path' });
            if (!pathInput) {return;}
        
            // nuovo: chiedi la response JSON
            const responseInput = await vscode.window.showInputBox({ 
                placeHolder: 'Response JSON (es: {"msg":"ok"})', 
                prompt: 'Lascia vuoto se non vuoi impostare una risposta'
            });
        
            const expectedBodyInput = await vscode.window.showInputBox({ 
                placeHolder: 'Expected Body JSON (opzionale)', 
                prompt: 'Lascia vuoto se non serve'
            });
        
            const schemaInput = await vscode.window.showInputBox({ 
                placeHolder: 'JSON Schema (opzionale)', 
                prompt: 'Lascia vuoto se non serve'
            });
        
            const api: ApiDef = { 
                method: methodPick as HttpMethod, 
                path: pathInput,
                response: responseInput ? JSON.parse(responseInput) : undefined,
                expectedBody: expectedBodyInput ? JSON.parse(expectedBodyInput) : undefined,
                jsonSchema: schemaInput ? JSON.parse(schemaInput) : undefined
            };
        
            // --- resto del codice invariato ---
            if (getCurrentApiMode() === 'database') {
                try {
                    const res = await fetch(`http://localhost:${server.port}/api/mokky/route/`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(api)
                    });
                    if (!res.ok) { const text = await res.text(); log(`❌ Errore add API: status ${res.status}, body: ${text}`); return; }
                    const result: any = await res.json();
                    api.id = typeof result === 'string' ? result : result?.id;
                } catch (e: any) { log(`❌ Errore add API: ${e?.message ?? e}`); return; }
            }
        
            server.apiList.push(api);
            writeActiveConfig(server);
            await loadApisForServer(server);
            serverProvider.refresh();
        
            if (getCurrentApiMode() === 'file' && server.running) {
                await restartServer(server);
            }
        }),         
        vscode.commands.registerCommand('mokkyBuddyAPIRunner.loadAPIConfig', async (server: ServerDef) => {
            const files = await vscode.window.showOpenDialog({ canSelectFiles: true, canSelectMany: false, filters: { 'JSON': ['json'] } });
            if (!files || files.length === 0) {return;}
            const fileUri = files[0];
        
            if (getCurrentApiMode() === 'database') {
                try {
                    await fetch(`http://localhost:${server.port}/api/mokky/route/clear`, { method: 'POST' });
                    const form = new FormData();
                    form.append('file', fs.createReadStream(fileUri.fsPath));
                    await fetch(`http://localhost:${server.port}/api/mokky/route/load`, { method: 'POST', body: form });
                    vscode.window.showInformationMessage('Config caricato sul server database!');
                } catch (e: any) { log(`❌ Errore load API: ${e?.message ?? e}`); return; }
            } else {
                // Copia il file selezionato in TEMP_CONFIG (stato attivo)
                fs.copyFileSync(fileUri.fsPath, TEMP_CONFIG);
        
                // Carica direttamente TEMP_CONFIG in memoria (non aspettare UI_CONFIG_FILE)
                try {
                    const raw = JSON.parse(fs.readFileSync(TEMP_CONFIG, 'utf-8')) ?? [];
                    server.apiList = Array.isArray(raw) ? raw.filter((a: any) => a.path && a.method) : [];
                } catch (e: any) {
                    log(`❌ Errore caricando TEMP_CONFIG dopo load: ${e?.message ?? e}`);
                    server.apiList = [];
                }
        
                // Se vuoi che venga anche reso persistente su UI_CONFIG_FILE, puoi chiamare persistUiConfig()
                // persistUiConfig();
        
                if (server.running) {
                    await restartServer(server);
                }
                vscode.window.showInformationMessage('Config caricato in modalità file!');
            }
        
            // Aggiorna UI e salva file di UI globale
            persistUiConfig();
            serverProvider.refresh();
        }),
        vscode.commands.registerCommand('mokkyBuddyAPIRunner.selectApiMode', async () => {
            const mode = await vscode.window.showQuickPick(['file', 'database'], {
                placeHolder: 'Seleziona modalità API'
            });
            if (!mode) {return;}

            // Ferma tutti i server esistenti
            for (const server of servers) {
                if (server.running) {stopServer(server);}
            }

            await vscode.workspace.getConfiguration('mokkyBuddy').update('apiMode', mode, vscode.ConfigurationTarget.Global);
            vscode.window.showInformationMessage(`Modalità API cambiata in: ${mode}`);

            for (const server of servers) {
                server.apiList = [];
                await loadApisForServer(server);
            }

            serverProvider.refresh();
        }),
        vscode.commands.registerCommand('mokkyBuddyAPIRunner.saveConfig', async (server: ServerDef) => {
            persistUiConfig();
            vscode.window.showInformationMessage('Configurazione salvata!');
        })
    );
}
export function deactivate() { 
    servers.forEach(s => { if(s.process) {s.process.kill();} }); 
}

