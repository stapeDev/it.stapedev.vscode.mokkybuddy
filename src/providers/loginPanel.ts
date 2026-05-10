/**
 * MokkyBuddy Extension - Login Webview Panel
 * Provides a rich login UI for SAAS authentication
 */

import * as vscode from 'vscode';
import { AuthService } from '../auth/authService';
import { log, logError } from '../utils/logger';

export class LoginPanel {
    public static currentPanel: LoginPanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private _disposables: vscode.Disposable[] = [];

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
        this._panel = panel;
        this._panel.webview.html = this._getHtmlForWebview();

        // Handle messages from the webview
        this._panel.webview.onDidReceiveMessage(
            async (message) => {
                switch (message.command) {
                    case 'login':
                        await this._handleLogin(message.username, message.password);
                        break;
                    case 'cancel':
                        this._panel.dispose();
                        break;
                    case 'goToRegister':
                        this._panel.dispose();
                        vscode.commands.executeCommand('mokkyBuddyAPIRunner.register');
                        break;
                }
            },
            null,
            this._disposables
        );

        // Handle panel disposal
        this._panel.onDidDispose(
            () => this.dispose(),
            null,
            this._disposables
        );
    }

    /**
     * Create or show the login panel
     */
    public static createOrShow(extensionUri: vscode.Uri): void {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        // If we already have a panel, show it
        if (LoginPanel.currentPanel) {
            LoginPanel.currentPanel._panel.reveal(column);
            return;
        }

        // Create a new panel
        const panel = vscode.window.createWebviewPanel(
            'mokkyBuddyLogin',
            'MokkyBuddy Login',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        LoginPanel.currentPanel = new LoginPanel(panel, extensionUri);
    }

    /**
     * Handle login request from webview
     */
    private async _handleLogin(username: string, password: string): Promise<void> {
        if (!username || !password) {
            this._sendMessage({ type: 'error', message: 'Username and password are required' });
            return;
        }

        this._sendMessage({ type: 'loading', loading: true });

        try {
            const authService = AuthService.getInstance();
            const user = await authService.login(username, password);
            
            this._sendMessage({ type: 'success', user });
            
            vscode.window.showInformationMessage(`Welcome, ${user.username}!`);
            
            // Close the panel after successful login
            setTimeout(() => {
                this._panel.dispose();
            }, 1000);

        } catch (error: any) {
            logError('Login failed:', error);
            this._sendMessage({ 
                type: 'error', 
                message: error.message || 'Login failed. Please check your credentials.' 
            });
        }
    }

    /**
     * Send message to webview
     */
    private _sendMessage(message: any): void {
        this._panel.webview.postMessage(message);
    }

    /**
     * Get the HTML content for the webview
     */
    private _getHtmlForWebview(): string {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MokkyBuddy Login</title>
    <style>
        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }
        
        body {
            font-family: var(--vscode-font-family);
            background-color: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            padding: 20px;
        }
        
        .login-container {
            background-color: var(--vscode-sideBar-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 8px;
            padding: 40px;
            width: 100%;
            max-width: 400px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        
        .logo {
            text-align: center;
            margin-bottom: 30px;
        }
        
        .logo h1 {
            font-size: 24px;
            color: var(--vscode-textLink-foreground);
            margin-bottom: 8px;
        }
        
        .logo p {
            font-size: 14px;
            color: var(--vscode-descriptionForeground);
        }
        
        .form-group {
            margin-bottom: 20px;
        }
        
        label {
            display: block;
            margin-bottom: 8px;
            font-size: 13px;
            color: var(--vscode-input-foreground);
        }
        
        input {
            width: 100%;
            padding: 10px 12px;
            font-size: 14px;
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            border-radius: 4px;
            outline: none;
            transition: border-color 0.2s;
        }
        
        input:focus {
            border-color: var(--vscode-focusBorder);
        }
        
        input::placeholder {
            color: var(--vscode-input-placeholderForeground);
        }
        
        .btn {
            width: 100%;
            padding: 12px;
            font-size: 14px;
            font-weight: 500;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            transition: background-color 0.2s;
        }
        
        .btn-primary {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
        }
        
        .btn-primary:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        
        .btn-primary:disabled {
            opacity: 0.6;
            cursor: not-allowed;
        }
        
        .btn-secondary {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            margin-top: 10px;
        }
        
        .btn-secondary:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }
        
        .message {
            padding: 12px;
            border-radius: 4px;
            margin-bottom: 20px;
            font-size: 13px;
            display: none;
        }
        
        .message.error {
            display: block;
            background-color: var(--vscode-inputValidation-errorBackground);
            border: 1px solid var(--vscode-inputValidation-errorBorder);
            color: var(--vscode-errorForeground);
        }
        
        .message.success {
            display: block;
            background-color: var(--vscode-inputValidation-infoBackground);
            border: 1px solid var(--vscode-inputValidation-infoBorder);
            color: var(--vscode-textLink-foreground);
        }
        
        .loading {
            display: none;
            text-align: center;
            padding: 20px;
        }
        
        .loading.show {
            display: block;
        }
        
        .spinner {
            width: 24px;
            height: 24px;
            border: 3px solid var(--vscode-progressBar-background);
            border-top-color: var(--vscode-textLink-foreground);
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 0 auto 10px;
        }
        
        @keyframes spin {
            to { transform: rotate(360deg); }
        }
        
        .divider {
            display: flex;
            align-items: center;
            margin: 25px 0;
        }
        
        .divider::before,
        .divider::after {
            content: '';
            flex: 1;
            border-bottom: 1px solid var(--vscode-panel-border);
        }
        
        .divider span {
            padding: 0 15px;
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
        }
        
        .footer {
            text-align: center;
            margin-top: 20px;
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
        }
        
        .footer a {
            color: var(--vscode-textLink-foreground);
            text-decoration: none;
        }
        
        .footer a:hover {
            text-decoration: underline;
        }
    </style>
</head>
<body>
    <div class="login-container">
        <div class="logo">
            <h1>🧪 MokkyBuddy</h1>
            <p>Sign in to access your mock servers</p>
        </div>
        
        <div id="message" class="message"></div>
        
        <div id="loading" class="loading">
            <div class="spinner"></div>
            <p>Signing in...</p>
        </div>
        
        <form id="loginForm">
            <div class="form-group">
                <label for="username">Username or Email</label>
                <input 
                    type="text" 
                    id="username" 
                    name="username" 
                    placeholder="Enter your username or email"
                    autocomplete="username"
                    required
                >
            </div>
            
            <div class="form-group">
                <label for="password">Password</label>
                <input 
                    type="password" 
                    id="password" 
                    name="password" 
                    placeholder="Enter your password"
                    autocomplete="current-password"
                    required
                >
            </div>
            
            <button type="submit" id="loginBtn" class="btn btn-primary">
                Sign In
            </button>
            
            <button type="button" id="cancelBtn" class="btn btn-secondary">
                Cancel
            </button>
        </form>
        
        <div class="divider">
            <span>SAAS Mode</span>
        </div>
        
        <div class="footer">
            <p>Don't have an account? <a id="registerLink">Sign up</a></p>
        </div>
    </div>
    
    <script>
        const vscode = acquireVsCodeApi();
        
        const form = document.getElementById('loginForm');
        const usernameInput = document.getElementById('username');
        const passwordInput = document.getElementById('password');
        const loginBtn = document.getElementById('loginBtn');
        const cancelBtn = document.getElementById('cancelBtn');
        const registerLink = document.getElementById('registerLink');
        const messageDiv = document.getElementById('message');
        const loadingDiv = document.getElementById('loading');
        
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            
            const username = usernameInput.value.trim();
            const password = passwordInput.value;
            
            if (!username || !password) {
                showMessage('Please fill in all fields', 'error');
                return;
            }
            
            vscode.postMessage({
                command: 'login',
                username: username,
                password: password
            });
        });
        
        cancelBtn.addEventListener('click', () => {
            vscode.postMessage({ command: 'cancel' });
        });
        
        registerLink.addEventListener('click', () => {
            vscode.postMessage({ command: 'goToRegister' });
        });
        
        window.addEventListener('message', (event) => {
            const message = event.data;
            
            switch (message.type) {
                case 'loading':
                    setLoading(message.loading);
                    break;
                case 'error':
                    setLoading(false);
                    showMessage(message.message, 'error');
                    break;
                case 'success':
                    setLoading(false);
                    showMessage('Login successful! Welcome ' + message.user.username, 'success');
                    break;
            }
        });
        
        function showMessage(text, type) {
            messageDiv.textContent = text;
            messageDiv.className = 'message ' + type;
        }
        
        function setLoading(loading) {
            loadingDiv.className = loading ? 'loading show' : 'loading';
            loginBtn.disabled = loading;
            usernameInput.disabled = loading;
            passwordInput.disabled = loading;
        }
        
        // Focus username input on load
        usernameInput.focus();
    </script>
</body>
</html>`;
    }

    /**
     * Dispose the panel and resources
     */
    public dispose(): void {
        LoginPanel.currentPanel = undefined;

        this._panel.dispose();

        while (this._disposables.length) {
            const disposable = this._disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }
}

/**
 * Simple login via input boxes (alternative to webview)
 */
export async function showSimpleLogin(): Promise<boolean> {
    const username = await vscode.window.showInputBox({
        prompt: 'Enter your username or email',
        placeHolder: 'username@example.com',
        ignoreFocusOut: true
    });

    if (!username) {
        return false;
    }

    const password = await vscode.window.showInputBox({
        prompt: 'Enter your password',
        placeHolder: 'Password',
        password: true,
        ignoreFocusOut: true
    });

    if (!password) {
        return false;
    }

    try {
        const authService = AuthService.getInstance();
        const user = await authService.login(username, password);
        vscode.window.showInformationMessage(`Welcome, ${user.username}!`);
        return true;
    } catch (error: any) {
        vscode.window.showErrorMessage(`Login failed: ${error.message}`);
        return false;
    }
}
