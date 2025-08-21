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

    const log = (msg: string) => { 
        output.appendLine(msg); 
        console.log(msg); 
    };

    const output = vscode.window.createOutputChannel('Mokky Buddy API Runner');

    // ---------------- Paths ----------------
    const storageDir = context.globalStoragePath || path.join(context.extensionPath, 'storage');
    fs.mkdirSync(storageDir, { recursive: true });
    const TEMP_CONFIG = path.join(storageDir, 'api-temp.json');
    const UI_CONFIG_FILE = path.join(storageDir, 'api-ui.json');

    // ---------------- Default Server ----------------
    const config = vscode.workspace.getConfiguration('mokkyBuddy');
    const javaPath = config.get<string>('javaPath') ?? 'java';
    const port = config.get<number>('serverPort') ?? 8081;
    let apiList: ApiDef[] = [];

    try { 
        if (fs.existsSync(UI_CONFIG_FILE)) {
            const rawList = JSON.parse(fs.readFileSync(UI_CONFIG_FILE, 'utf-8')) ?? [];
            // Filtro solo le API valide (con path e method)
            apiList = rawList.filter((a: any) => a.path && a.method);
        }
    } catch (e) {
        log(`❌ Errore caricando UI config: ${e}`);
    }

    servers.push({
        name: 'Localhost',
        port,
        javaPath,
        apiList: apiList ?? [],
        running: false
    });

    const persistUiConfig = () => { 
        try { 
            // salva solo i server che non hanno file esterno
            const uiServers = servers.map(s => ({
                name: s.name,
                port: s.port,
                javaPath: s.javaPath,
                apiList: s.jsonPath ? [] : s.apiList  // se ha file esterno, non salvare apiList
            }));
            fs.writeFileSync(UI_CONFIG_FILE, JSON.stringify(uiServers, null, 2), 'utf-8');
            log(`💾 UI config salvata su: ${UI_CONFIG_FILE}`);
        } catch (e:any) { log(`❌ Errore salvando UI config: ${e?.message ?? e}`); } 
    };

    const writeActiveConfig = (server: ServerDef) => {
        const target = server.jsonPath ?? TEMP_CONFIG;
        try { 
            fs.writeFileSync(target, JSON.stringify(server.apiList ?? [], null, 2), 'utf-8'); 
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

    private preview(json: any) { 
        if (!json) {return '—';} 
        const s = JSON.stringify(json);
        return s.length > 60 ? s.slice(0, 60) + '…' : s;
    }

    getTreeItem(el: vscode.TreeItem) { return el; }

    getChildren(element?: vscode.TreeItem): Thenable<vscode.TreeItem[]> {
        if (!element) {
            // Root nodes: server list
            return Promise.resolve(servers.map((server, index) => {
                const apiCount = server.apiList?.filter(a => a.path && a.method).length ?? 0;
                const label = `${server.name}:${server.port} (${apiCount} API)`;
                const item = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.Collapsed);
                (item as any).serverIndex = index;
                item.contextValue = 'serverNode';
                return item;
            }));
        }

        if (element.contextValue === 'serverNode') {
            const server = servers[(element as any).serverIndex];
            if (!server) {return Promise.resolve([]);}

            const items: vscode.TreeItem[] = [];

            // Start/Stop
            const startStop = new vscode.TreeItem(server.running ? `⏹ Stop Server` : `▶ Start Server`, vscode.TreeItemCollapsibleState.None);
            startStop.command = { command: 'mokkyBuddyAPIRunner.toggleServer', title: 'Toggle Server', arguments: [server] };
            items.push(startStop);

            // Porta
            const portItem = new vscode.TreeItem(`Port: ${server.port}`, vscode.TreeItemCollapsibleState.None);
            portItem.command = { command: 'mokkyBuddyAPIRunner.changePort', title: 'Change Port', arguments: [server] };
            items.push(portItem);

            // Config info
            const apiCount = server.apiList?.filter(a => a.path && a.method).length ?? 0;
            const configLabel = `Config: ${server.jsonPath ? `file esterno (${path.basename(server.jsonPath)})` : `UI (${apiCount} API)`}`;
            items.push(new vscode.TreeItem(configLabel, vscode.TreeItemCollapsibleState.None));

            // API Nodes
            server.apiList?.filter(a => a.path && a.method).forEach(a => {
                const pathText = a.path || 'NO_PATH';
                const methodText = a.method || 'NO_METHOD';
                const aNode = new vscode.TreeItem(`[${methodText}] ${pathText}`, vscode.TreeItemCollapsibleState.Collapsed);
                aNode.contextValue = 'apiNode';
                aNode.tooltip = `API ${methodText} ${pathText}`;

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

                (aNode as any).children = children;
                aNode.collapsibleState = children.length > 0 ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None;
                items.push(aNode);
            });

            // Add/Save/Load
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
        if (!fs.existsSync(jarPath)) { 
            vscode.window.showErrorMessage(`Jar non trovato: ${jarPath}`); 
            log(`❌ Jar non trovato: ${jarPath}`);
            return; 
        }
    
        const configPath = server.jsonPath ?? TEMP_CONFIG;
        if (!fs.existsSync(configPath)) { writeActiveConfig(server); }
        if (!fs.existsSync(configPath)) { 
            vscode.window.showErrorMessage(`Config non trovata: ${configPath}`); 
            log(`❌ Config non trovata: ${configPath}`); 
            return; 
        }
    
        const javaExec = server.javaPath || 'java';
        if (!fs.existsSync(javaExec)) { 
            vscode.window.showErrorMessage(`Java non trovato: ${javaExec}`); 
            log(`❌ Java non trovato: ${javaExec}`);
            return; 
        }
    
        server.process = spawn(javaExec, [
            '-jar', jarPath, 
            `--it.stapedev.api.mokkybuddy.loader.mock.route.file=file:${configPath}`, 
            `--server.port=${server.port}`
        ]);
    
        // ---- Captura stdout ----
        server.process.stdout?.on('data', (chunk: Buffer) => {
            const lines = chunk.toString().split(/\r?\n/).filter((l: string) => l.length > 0);
            lines.forEach((line: string) => log(`[Spring stdout] ${line}`));
        });
    
        // ---- Captura stderr ----
        server.process.stderr?.on('data', (chunk: Buffer) => {
            const lines = chunk.toString().split(/\r?\n/).filter((l: string) => l.length > 0);
            lines.forEach((line: string) => log(`[Spring stderr] ${line}`));
        });
    
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
        if (!server.running || !server.process) {return;}
    
        // Salva solo se il server NON usa file esterno
        if (!server.jsonPath) {
            const configPath = TEMP_CONFIG;
            try {
                fs.writeFileSync(configPath, JSON.stringify(server.apiList ?? [], null, 2), 'utf-8');
                log(`💾 Config server scritta su: ${configPath}`);
            } catch (e: any) {
                log(`❌ Errore scrittura config: ${e?.message ?? e}`);
                vscode.window.showErrorMessage('Errore nel salvare la configurazione attiva.');
            }
        }
    
        server.process.kill('SIGTERM');
        server.running = false;
        await new Promise(r => setTimeout(r, 300));
    
        // Quando il server è esterno, usa TEMP_CONFIG in memoria per il riavvio
        if (server.jsonPath) {
            const tempApiConfig = path.join(context.globalStoragePath || path.join(context.extensionPath, 'storage'), 'api-temp.json');
            fs.writeFileSync(tempApiConfig, JSON.stringify(server.apiList ?? [], null, 2), 'utf-8');
            server.jsonPath = undefined; // forza l'uso del TEMP_CONFIG per il riavvio
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
            server.port = newPort;
            if (server.running && server.process) {
                server.process.kill();
                server.running = false;
                await new Promise(r => setTimeout(r, 300));
                await startServer(server);
            }
            serverProvider.refresh();
            vscode.window.showInformationMessage(`${server.name} ora usa la porta ${newPort}`);
        }),

        // ---------------- API Commands ----------------
        vscode.commands.registerCommand('mokkyBuddyAPIRunner.addAPI', async (server: ServerDef) => {
            
            // Metodo
            const methodInput = await vscode.window.showQuickPick(
                ['GET','POST','PUT','DELETE'], 
                { placeHolder: 'Seleziona il metodo HTTP' }
            );
            if (!methodInput) {return;}
            
            // Path
            const pathInput = await vscode.window.showInputBox({ 
                prompt: 'Inserisci il path della nuova API (es: /users)' 
            });
            if (!pathInput) {return;}
        
            // Risposta Mock
            const responseInput = await vscode.window.showInputBox({
                prompt: 'Inserisci la risposta mock (JSON) - lascia vuoto se non serve'
            });
            let response: any = undefined;
            if (responseInput) {
                try { response = JSON.parse(responseInput); }
                catch { vscode.window.showErrorMessage('Risposta non è JSON valido, verrà ignorata.'); }
            }
        
            // Expected Body
            const bodyInput = await vscode.window.showInputBox({
                prompt: 'Inserisci il body atteso (JSON) - lascia vuoto se non serve'
            });
            let expectedBody: any = undefined;
            if (bodyInput) {
                try { expectedBody = JSON.parse(bodyInput); }
                catch { vscode.window.showErrorMessage('Expected body non è JSON valido, verrà ignorato.'); }
            }
        
            // JSON Schema
            const schemaInput = await vscode.window.showInputBox({
                prompt: 'Inserisci lo schema JSON per la validazione - lascia vuoto se non serve'
            });
            let jsonSchema: any = undefined;
            if (schemaInput) {
                try { jsonSchema = JSON.parse(schemaInput); }
                catch { vscode.window.showErrorMessage('Schema non è JSON valido, verrà ignorato.'); }
            }
        
            // Salvataggio
            server.apiList.push({ 
                path: pathInput, 
                method: methodInput as HttpMethod,
                response,
                expectedBody,
                jsonSchema
            });
        
            serverProvider.refresh();
            vscode.window.showInformationMessage(`API [${methodInput}] ${pathInput} aggiunta`);
            await restartServer(server);
        }),

        vscode.commands.registerCommand('mokkyBuddyAPIRunner.deleteAPI', async (server: ServerDef, path:string, method:HttpMethod) => {
            server.apiList = server.apiList.filter(a => !(a.path===path && a.method===method));
            serverProvider.refresh();
            vscode.window.showInformationMessage(`API [${method}] ${path} rimossa`);
            await restartServer(server);
        }),

        vscode.commands.registerCommand('mokkyBuddyAPIRunner.saveAPIConfig', async (server: ServerDef) => {
            writeActiveConfig(server);
            persistUiConfig();
            vscode.window.showInformationMessage(`Config server salvata`);
        }),

        // 🔥 nuova implementazione: load da file picker
        vscode.commands.registerCommand('mokkyBuddyAPIRunner.loadAPIConfig', async (server: ServerDef) => {
            const files = await vscode.window.showOpenDialog({
                canSelectMany: false,
                openLabel: 'Carica config JSON',
                filters: { 'JSON Files': ['json'] }
            });
            if (!files || files.length === 0) {return;}
        
            const selectedFile = files[0].fsPath;
            try {
                const data = JSON.parse(fs.readFileSync(selectedFile, 'utf-8'));
                if (!Array.isArray(data)) {
                    vscode.window.showErrorMessage('Il file non contiene una lista valida di API');
                    return;
                }
        
                // Aggiorna solo in memoria senza sovrascrivere il file
                server.apiList = data;
                server.jsonPath = selectedFile;
                serverProvider.refresh();
                vscode.window.showInformationMessage(`Config caricata da ${path.basename(selectedFile)}`);
                log(`📂 Config caricata da ${selectedFile}`);
        
                // Riavvia solo se il server era attivo
                if (server.running && server.process) {
                    await restartServer(server);
                }
        
            } catch (e: any) {
                vscode.window.showErrorMessage(`Errore caricando il file: ${e?.message ?? e}`);
            }
        }), 

        vscode.commands.registerCommand('mokkyBuddyAPIRunner.previewJson', async (json:any) => {
            const doc = await vscode.workspace.openTextDocument({ content: JSON.stringify(json, null, 2), language: 'json' });
            vscode.window.showTextDocument(doc);
        })
    );
}

export function deactivate() { 
    servers.forEach(s => { if(s.process) {s.process.kill();} }); 
}
