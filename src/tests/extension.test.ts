import * as fs from 'fs';
import { servers as extensionServers } from '../extension';
import { outputChannel } from '../extension';

jest.mock('fs');
const mockFs = fs as jest.Mocked<typeof fs>;
mockFs.existsSync.mockReturnValue(true);
mockFs.readFileSync.mockReturnValue('[]');
mockFs.mkdirSync.mockReturnValue(undefined);
mockFs.writeFileSync.mockReturnValue(undefined);
jest.spyOn(outputChannel, 'appendLine').mockImplementation(() => {});
jest.spyOn(outputChannel, 'show').mockImplementation(() => {});


jest.mock('vscode', () => ({
  window: {
    showInputBox: jest.fn(),
    showQuickPick: jest.fn().mockResolvedValue('GET'),
    showInformationMessage: jest.fn(),
    showErrorMessage: jest.fn(),
    createOutputChannel: jest.fn(() => ({ appendLine: jest.fn(), show: jest.fn() })),
    registerTreeDataProvider: jest.fn(),
    showOpenDialog: jest.fn(),
    showTextDocument: jest.fn()
  },
  workspace: {
    getConfiguration: jest.fn(() => ({ get: jest.fn((key: string) => key === 'serverPort' ? 8081 : 'java') })),
    openTextDocument: jest.fn().mockResolvedValue({})
  },
  commands: { registerCommand: jest.fn() },
  EventEmitter: class { event = jest.fn(); fire = jest.fn(); },
  TreeItemCollapsibleState: { None: 0, Collapsed: 1, Expanded: 2 }
}));

jest.mock('child_process', () => ({
  spawn: jest.fn(() => ({
    stdout: { on: jest.fn() },
    stderr: { on: jest.fn() },
    on: jest.fn((event, callback) => event === 'exit' && setTimeout(() => callback(0), 10)),
    kill: jest.fn()
  }))
}));

console.log = jest.fn();

const extension = require('../extension');
const vscode = require('vscode');

describe('Mokky Buddy Extension - No Regression', () => {
  let context: any;
  let outputChannel: any;

  beforeEach(async () => {
    context = { subscriptions: [], globalStoragePath: '/tmp/fake-storage', extensionPath: '/tmp/fake-extension' };
    jest.clearAllMocks();
    extensionServers.forEach(s => s.apiList = []);
    await extension.activate(context);
    outputChannel = (vscode.window.createOutputChannel as jest.Mock).mock.results[0]?.value;
  });

  it('should activate without errors', () => {
    expect(context.subscriptions.length).toBeGreaterThan(0);
  });

  it('should create default server', () => {
    const server = extensionServers[0];
    expect(server.name).toBe('Localhost');
    expect(server.port).toBe(8081);
    expect(server.apiList).toEqual([]);
  });

  it('should register all commands', () => {
    const commands = [
      'mokkyBuddyAPIRunner.toggleServer',
      'mokkyBuddyAPIRunner.addAPI',
      'mokkyBuddyAPIRunner.deleteAPI',
      'mokkyBuddyAPIRunner.previewJson',
      'mokkyBuddyAPIRunner.saveAPIConfig',
      'mokkyBuddyAPIRunner.loadAPIConfig',
      'mokkyBuddyAPIRunner.changePort'
    ];
    commands.forEach(cmd => expect(vscode.commands.registerCommand).toHaveBeenCalledWith(cmd, expect.any(Function)));
  });

  it('should add and delete API', async () => {
    const server = extensionServers[0];
    (vscode.window.showInputBox as jest.Mock)
      .mockResolvedValueOnce('/test-api')
      .mockResolvedValueOnce(JSON.stringify({ ok: true }))
      .mockResolvedValueOnce(JSON.stringify({}))
      .mockResolvedValueOnce(JSON.stringify({}));

    const addApiCommand = vscode.commands.registerCommand.mock.calls.find((c:any) => c[0] === 'mokkyBuddyAPIRunner.addAPI')[1];
    await addApiCommand(server);
    expect(server.apiList.length).toBe(1);

    const deleteApiCommand = vscode.commands.registerCommand.mock.calls.find((c:any) => c[0] === 'mokkyBuddyAPIRunner.deleteAPI')[1];
    await deleteApiCommand(server, '/test-api', 'GET');
    expect(server.apiList.length).toBe(0);
  });

  it('should save and load API config', async () => {
    const server = extensionServers[0];
    server.apiList.push({ path: '/save-api', method: 'POST' });

    const saveApiCommand = vscode.commands.registerCommand.mock.calls.find((c:any) => c[0] === 'mokkyBuddyAPIRunner.saveAPIConfig')[1];
    await saveApiCommand(server);
    expect(mockFs.writeFileSync).toHaveBeenCalled();

    const fakeFile = '/tmp/fake-api-config.json';
    mockFs.readFileSync.mockReturnValue(JSON.stringify([{ path: '/loaded-api', method: 'GET' }]));
    (vscode.window.showOpenDialog as jest.Mock).mockResolvedValueOnce([{ fsPath: fakeFile }]);
    const loadApiCommand = vscode.commands.registerCommand.mock.calls.find((c:any) => c[0] === 'mokkyBuddyAPIRunner.loadAPIConfig')[1];
    await loadApiCommand(server);
    expect(server.apiList[0].path).toBe('/loaded-api');
  });

  it('should toggle server running state', async () => {
    const server = extensionServers[0];
    const toggleCommand = vscode.commands.registerCommand.mock.calls.find((c:any) => c[0] === 'mokkyBuddyAPIRunner.toggleServer')[1];

    server.running = false; await toggleCommand(server); expect(server.running).toBe(true);
    server.running = true; await toggleCommand(server); expect(server.running).toBe(false);
  });

  it('should change server port', async () => {
    const server = extensionServers[0];
    (vscode.window.showInputBox as jest.Mock).mockResolvedValueOnce('8082');
    const changePortCommand = vscode.commands.registerCommand.mock.calls.find((c:any) => c[0] === 'mokkyBuddyAPIRunner.changePort')[1];
    await changePortCommand(server);
    expect(server.port).toBe(8082);
  });

});
