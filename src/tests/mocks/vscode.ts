export class EventEmitter<T = any> {
  private listeners: ((e: T) => void)[] = [];
  event = (listener: (e: T) => void) => {
    this.listeners.push(listener);
    return { dispose: () => { this.listeners = this.listeners.filter(l => l !== listener); } };
  };
  fire(data: T) {
    this.listeners.forEach(l => l(data));
  }
}
asdadasdasdasda
export const window = {
  createOutputChannel: () => ({ appendLine: jest.fn(), show: jest.fn() }),
  showInputBox: jest.fn(),
  showQuickPick: jest.fn(),
  showInformationMessage: jest.fn(),
  showErrorMessage: jest.fn(),
  openTextDocument: jest.fn().mockResolvedValue({}),
  showTextDocument: jest.fn().mockResolvedValue({})
};

export const workspace = {
  getConfiguration: jest.fn().mockReturnValue({ get: jest.fn() })
};

export const commands = {
  registerCommand: jest.fn()
};

export class TreeItem {
  label: string;
  collapsibleState?: any;
  tooltip?: string;
  command?: any;
  contextValue?: string;
  children?: TreeItem[];

  constructor(label: string, collapsibleState?: any) {
    this.label = label;
    this.collapsibleState = collapsibleState;
  }
}
