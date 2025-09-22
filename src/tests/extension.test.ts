import * as extension from '../extension';
import * as vscode from 'vscode';

// Mock del modulo vscode
jest.mock('vscode', () => {
  const commandsRegistered: string[] = [];

  return {
    window: {
      registerTreeDataProvider: jest.fn(),
      showInformationMessage: jest.fn(),
      showErrorMessage: jest.fn(),
      showInputBox: jest.fn().mockResolvedValue(''),
      showQuickPick: jest.fn().mockResolvedValue('file'),
      createOutputChannel: jest.fn().mockReturnValue({
        appendLine: jest.fn(),
      }),
      showTextDocument: jest.fn().mockResolvedValue(undefined),
    },
    commands: {
      registerCommand: jest.fn((cmd, cb) => {
        commandsRegistered.push(cmd);
        return { dispose: jest.fn() };
      }),
      getCommands: jest.fn().mockResolvedValue([
        'mokkyBuddyAPIRunner.toggleServer',
        'mokkyBuddyAPIRunner.addAPI',
        'mokkyBuddyAPIRunner.deleteAPI',
        'mokkyBuddyAPIRunner.previewJson',
        'mokkyBuddyAPIRunner.saveAPIConfig',
        'mokkyBuddyAPIRunner.loadAPIConfig',
        'mokkyBuddyAPIRunner.changePort',
        'mokkyBuddyAPIRunner.selectApiMode',
      ]),
    },
    workspace: {
      getConfiguration: jest.fn().mockReturnValue({
        get: jest.fn((key: string) => {
          switch(key) {
            case 'javaPath': return 'java';
            case 'serverPort': return 8081;
            case 'apiMode': return 'file';
            default: return undefined;
          }
        }),
        update: jest.fn().mockResolvedValue(true),
      }),
    },
    TreeItemCollapsibleState: {
      None: 0,
      Collapsed: 1,
    },
    TreeItem: class {
      constructor(public label: string, public collapsibleState?: number) {}
    },
    EventEmitter: class {
      fire = jest.fn();
      get event() { return jest.fn(); }
    },
  };
});

describe('Mokky Buddy Extension', () => {
  let context: any;

  beforeEach(() => {
    // Pulizia lista servers prima di ogni test
    (extension as any).servers.length = 0;

    context = {
      subscriptions: [],
      globalStoragePath: __dirname,
      extensionPath: __dirname,
    };
  });

  test('attivazione senza errori', () => {
    expect(() => extension.activate(context)).not.toThrow();
    expect((extension as any).servers.length).toBeGreaterThanOrEqual(1);
  });

  test('i comandi sono registrati', async () => {
    await extension.activate(context);
    const commands = await vscode.commands.getCommands(true);

    const expected = [
      'mokkyBuddyAPIRunner.toggleServer',
      'mokkyBuddyAPIRunner.addAPI',
      'mokkyBuddyAPIRunner.deleteAPI',
      'mokkyBuddyAPIRunner.previewJson',
      'mokkyBuddyAPIRunner.saveAPIConfig',
      'mokkyBuddyAPIRunner.loadAPIConfig',
      'mokkyBuddyAPIRunner.changePort',
      'mokkyBuddyAPIRunner.selectApiMode',
    ];

    for (const cmd of expected) {
      expect(commands).toContain(cmd);
    }
  });

  test('lista servers ha almeno 1 server di default', async () => {
    await extension.activate(context);
    const servers = (extension as any).servers;
    expect(servers).toBeDefined();
    expect(servers.length).toBeGreaterThanOrEqual(1);
    expect(servers[0].name).toBe('Localhost');
    expect(servers[0].port).toBe(8081);
  });
});
