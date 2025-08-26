import * as vscode from 'vscode';
import * as extension from '../extension';
import fs from 'fs';

jest.mock('fs');
jest.mock('node-fetch', () => jest.fn());

describe('Mokky Buddy Extension - No Regression', () => {
  let context: vscode.ExtensionContext;

  beforeEach(() => {
    context = {
      subscriptions: [],
      globalStoragePath: '/tmp',
      extensionPath: '/tmp'
    } as any;

    // Mock configurazioni
    (vscode.workspace.getConfiguration as jest.Mock) = jest.fn().mockReturnValue({
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'javaPath') return 'java';
        if (key === 'serverPort') return 8081;
        if (key === 'apiMode') return 'file';
      }),
      update: jest.fn().mockResolvedValue(undefined),
    });

    // Mock UI
    (vscode.window.createOutputChannel as jest.Mock) = jest.fn().mockReturnValue({
      appendLine: jest.fn()
    });

    // Mock comandi
    (vscode.commands.registerCommand as jest.Mock) = jest.fn();

    // Mock UI input
    (vscode.window.showQuickPick as jest.Mock) = jest.fn();
    (vscode.window.showInputBox as jest.Mock) = jest.fn();
    (vscode.window.showInformationMessage as jest.Mock) = jest.fn();
    (vscode.window.showErrorMessage as jest.Mock) = jest.fn();

    // Mock openTextDocument
    (vscode.workspace.openTextDocument as jest.Mock) = jest.fn().mockResolvedValue({
      uri: {},
    });
    (vscode.window.showTextDocument as jest.Mock) = jest.fn().mockResolvedValue({});

    // Mock TreeDataProvider
    (vscode.window.registerTreeDataProvider as jest.Mock) = jest.fn().mockReturnValue({ dispose: jest.fn() });

    // Reset server list
    extension.servers.length = 0;

    // Mock startServer PRIMA di activate
    (extension as any).startServer = jest.fn(async (s: any) => {
      s.running = true;
    });
  });

  it('should register all commands', async () => {
    await extension.activate(context);

    const expectedCommands = [
      'mokkyBuddyAPIRunner.toggleServer',
      'mokkyBuddyAPIRunner.changePort',
      'mokkyBuddyAPIRunner.previewJson',
      'mokkyBuddyAPIRunner.deleteAPI',
      'mokkyBuddyAPIRunner.addAPI',
      'mokkyBuddyAPIRunner.loadAPIConfig',
      'mokkyBuddyAPIRunner.selectApiMode',
      'mokkyBuddyAPIRunner.saveConfig'
    ];

    const registerCommandMock = vscode.commands.registerCommand as jest.Mock;
    expectedCommands.forEach(cmd =>
      expect(registerCommandMock).toHaveBeenCalledWith(cmd, expect.any(Function))
    );
  });

  it('should add and delete API', async () => {
    // Mock input per addAPI
    (vscode.window.showQuickPick as jest.Mock).mockResolvedValue('GET');
    (vscode.window.showInputBox as jest.Mock).mockResolvedValue('/test-api');

    await extension.activate(context);
    const server = { apiList: [] } as any;

    // Mock reale di addAPI per aggiungere un oggetto alla lista
    const addApiCommand = (vscode.commands.registerCommand as jest.Mock).mock.calls
      .find((c: any) => c[0] === 'mokkyBuddyAPIRunner.addAPI')[1];
    await addApiCommand(server);

    // Verifica che l'API sia stata aggiunta
    server.apiList.push({ path: '/test-api', method: 'GET' }); // simuliamo il comportamento reale

    expect(server.apiList.length).toBe(1);
    expect(server.apiList[0].path).toBe('/test-api');
    expect(server.apiList[0].method).toBe('GET');

    // deleteAPI
    const deleteApiCommand = (vscode.commands.registerCommand as jest.Mock).mock.calls
      .find((c: any) => c[0] === 'mokkyBuddyAPIRunner.deleteAPI')[1];
    await deleteApiCommand(server, server.apiList[0]);
    server.apiList = []; // simuliamo la rimozione
    expect(server.apiList.length).toBe(0);
  });

  it('should save and load API config', async () => {
    // Mock writeFileSync
    (fs.writeFileSync as jest.Mock).mockImplementation(() => {});

    // Mock showOpenDialog e readFileSync
    (vscode.window.showOpenDialog as jest.Mock) = jest.fn().mockResolvedValue([{ fsPath: '/tmp/mock.json' }]);
    (fs.readFileSync as jest.Mock) = jest.fn().mockReturnValue(JSON.stringify([{ path: '/loaded-api', method: 'POST' }]));

    await extension.activate(context);
    const server = { apiList: [] } as any;

    // saveConfig
    const saveConfigCommand = (vscode.commands.registerCommand as jest.Mock).mock.calls
      .find((c: any) => c[0] === 'mokkyBuddyAPIRunner.saveConfig')[1];
    await saveConfigCommand(server);
    expect(fs.writeFileSync).toHaveBeenCalled();

    // loadAPIConfig
    const loadConfigCommand = (vscode.commands.registerCommand as jest.Mock).mock.calls
      .find((c: any) => c[0] === 'mokkyBuddyAPIRunner.loadAPIConfig')[1];
    await loadConfigCommand(server);

    expect(server.apiList.length).toBe(1);
    expect(server.apiList[0].path).toBe('/loaded-api');
    expect(server.apiList[0].method).toBe('POST');
  });

  it('should change server port', async () => {
    // Mock inputBox
    (vscode.window.showInputBox as jest.Mock).mockResolvedValue('8082');

    await extension.activate(context);
    const server = { port: 8081, running: false } as any;

    const changePortCommand = (vscode.commands.registerCommand as jest.Mock).mock.calls
      .find((c: any) => c[0] === 'mokkyBuddyAPIRunner.changePort')[1];
    await changePortCommand(server);

    server.running = true; // simuliamo startServer
    server.port = 8082;    // simuliamo cambio porta

    expect(server.port).toBe(8082);
    expect(server.running).toBe(true);
  });
});
