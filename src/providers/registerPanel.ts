/**
 * MokkyBuddy Extension - Registration Webview Panel
 * Provides a rich registration UI for SAAS authentication
 */

import * as vscode from 'vscode';
import { AuthService } from '../auth/authService';
import { log, logError } from '../utils/logger';

export class RegisterPanel {
    public static currentPanel: RegisterPanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private _disposables: vscode.Disposable[] = [];

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
        this._panel = panel;
        this._panel.webview.html = this._getHtmlForWebview();

        // Handle messages from the webview
        this._panel.webview.onDidReceiveMessage(
            async (message) => {
                switch (message.command) {
                    case 'register':
                        await this._handleRegister(
                            message.username,
                            message.email,
                            message.password,
                            message.firstname,
                            message.lastname
                        );
                        break;
                    case 'cancel':
                        this._panel.dispose();
                        break;
                    case 'goToLogin':
                        this._panel.dispose();
                        vscode.commands.executeCommand('mokkyBuddyAPIRunner.login');
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
     * Create or show the registration panel
     */
    public static createOrShow(extensionUri: vscode.Uri): void {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        // If we already have a panel, show it
        if (RegisterPanel.currentPanel) {
            RegisterPanel.currentPanel._panel.reveal(column);
            return;
        }

        // Create a new panel
        const panel = vscode.window.createWebviewPanel(
            'mokkyBuddyRegister',
            'MokkyBuddy Registration',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        RegisterPanel.currentPanel = new RegisterPanel(panel, extensionUri);
    }

    /**
     * Handle registration request from webview
     */
    private async _handleRegister(
        username: string,
        email: string,
        password: string,
        firstname?: string,
        lastname?: string
    ): Promise<void> {
        if (!username || !email || !password) {
            this._sendMessage({ type: 'error', message: 'Username, email, and password are required' });
            return;
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            this._sendMessage({ type: 'error', message: 'Please enter a valid email address' });
            return;
        }

        // Validate password strength
        if (password.length < 8) {
            this._sendMessage({ type: 'error', message: 'Password must be at least 8 characters long' });
            return;
        }

        this._sendMessage({ type: 'loading', loading: true });

        try {
            const authService = AuthService.getInstance();
            const user = await authService.register(username, email, password, firstname, lastname);
            
            this._sendMessage({ type: 'success', user });
            
            vscode.window.showInformationMessage(
                `Registration successful! Welcome, ${user.username}! Please login to continue.`
            );
            
            // Close panel and open login after successful registration
            setTimeout(() => {
                this._panel.dispose();
                vscode.commands.executeCommand('mokkyBuddyAPIRunner.login');
            }, 1500);

        } catch (error: any) {
            logError('Registration failed:', error);
            this._sendMessage({ 
                type: 'error', 
                message: error.message || 'Registration failed. Please try again.' 
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
    <title>MokkyBuddy Registration</title>
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
        
        .register-container {
            background-color: var(--vscode-sideBar-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 8px;
            padding: 40px;
            width: 100%;
            max-width: 450px;
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
            margin-bottom: 16px;
        }
        
        .form-row {
            display: flex;
            gap: 12px;
        }
        
        .form-row .form-group {
            flex: 1;
        }
        
        label {
            display: block;
            margin-bottom: 6px;
            font-size: 13px;
            color: var(--vscode-input-foreground);
        }
        
        label .required {
            color: var(--vscode-errorForeground);
        }
        
        label .optional {
            color: var(--vscode-descriptionForeground);
            font-size: 11px;
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
        
        .password-requirements {
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
            margin-top: 4px;
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
            cursor: pointer;
        }
        
        .footer a:hover {
            text-decoration: underline;
        }
    </style>
</head>
<body>
    <div class="register-container">
        <div class="logo">
            <h1>🧪 MokkyBuddy</h1>
            <p>Create your account to start mocking APIs</p>
        </div>
        
        <div id="message" class="message"></div>
        
        <div id="loading" class="loading">
            <div class="spinner"></div>
            <p>Creating your account...</p>
        </div>
        
        <form id="registerForm">
            <div class="form-group">
                <label for="username">Username <span class="required">*</span></label>
                <input 
                    type="text" 
                    id="username" 
                    name="username" 
                    placeholder="Choose a username"
                    autocomplete="username"
                    required
                >
            </div>
            
            <div class="form-group">
                <label for="email">Email <span class="required">*</span></label>
                <input 
                    type="email" 
                    id="email" 
                    name="email" 
                    placeholder="Enter your email address"
                    autocomplete="email"
                    required
                >
            </div>
            
            <div class="form-row">
                <div class="form-group">
                    <label for="firstname">First Name <span class="optional">(optional)</span></label>
                    <input 
                        type="text" 
                        id="firstname" 
                        name="firstname" 
                        placeholder="John"
                        autocomplete="given-name"
                    >
                </div>
                
                <div class="form-group">
                    <label for="lastname">Last Name <span class="optional">(optional)</span></label>
                    <input 
                        type="text" 
                        id="lastname" 
                        name="lastname" 
                        placeholder="Doe"
                        autocomplete="family-name"
                    >
                </div>
            </div>
            
            <div class="form-group">
                <label for="password">Password <span class="required">*</span></label>
                <input 
                    type="password" 
                    id="password" 
                    name="password" 
                    placeholder="Create a password"
                    autocomplete="new-password"
                    required
                >
                <p class="password-requirements">Minimum 8 characters</p>
            </div>
            
            <div class="form-group">
                <label for="confirmPassword">Confirm Password <span class="required">*</span></label>
                <input 
                    type="password" 
                    id="confirmPassword" 
                    name="confirmPassword" 
                    placeholder="Confirm your password"
                    autocomplete="new-password"
                    required
                >
            </div>
            
            <button type="submit" id="registerBtn" class="btn btn-primary">
                Create Account
            </button>
            
            <button type="button" id="cancelBtn" class="btn btn-secondary">
                Cancel
            </button>
        </form>
        
        <div class="divider">
            <span>SAAS Mode</span>
        </div>
        
        <div class="footer">
            <p>Already have an account? <a id="loginLink">Sign in</a></p>
        </div>
    </div>
    
    <script>
        const vscode = acquireVsCodeApi();
        
        const form = document.getElementById('registerForm');
        const usernameInput = document.getElementById('username');
        const emailInput = document.getElementById('email');
        const firstnameInput = document.getElementById('firstname');
        const lastnameInput = document.getElementById('lastname');
        const passwordInput = document.getElementById('password');
        const confirmPasswordInput = document.getElementById('confirmPassword');
        const registerBtn = document.getElementById('registerBtn');
        const cancelBtn = document.getElementById('cancelBtn');
        const loginLink = document.getElementById('loginLink');
        const messageDiv = document.getElementById('message');
        const loadingDiv = document.getElementById('loading');
        
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            
            const username = usernameInput.value.trim();
            const email = emailInput.value.trim();
            const firstname = firstnameInput.value.trim();
            const lastname = lastnameInput.value.trim();
            const password = passwordInput.value;
            const confirmPassword = confirmPasswordInput.value;
            
            // Validation
            if (!username || !email || !password) {
                showMessage('Please fill in all required fields', 'error');
                return;
            }
            
            if (password !== confirmPassword) {
                showMessage('Passwords do not match', 'error');
                return;
            }
            
            if (password.length < 8) {
                showMessage('Password must be at least 8 characters long', 'error');
                return;
            }
            
            // Email validation
            const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
            if (!emailRegex.test(email)) {
                showMessage('Please enter a valid email address', 'error');
                return;
            }
            
            vscode.postMessage({
                command: 'register',
                username: username,
                email: email,
                password: password,
                firstname: firstname || undefined,
                lastname: lastname || undefined
            });
        });
        
        cancelBtn.addEventListener('click', () => {
            vscode.postMessage({ command: 'cancel' });
        });
        
        loginLink.addEventListener('click', () => {
            vscode.postMessage({ command: 'goToLogin' });
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
                    showMessage('Account created successfully! Redirecting to login...', 'success');
                    break;
            }
        });
        
        function showMessage(text, type) {
            messageDiv.textContent = text;
            messageDiv.className = 'message ' + type;
        }
        
        function setLoading(loading) {
            loadingDiv.className = loading ? 'loading show' : 'loading';
            registerBtn.disabled = loading;
            usernameInput.disabled = loading;
            emailInput.disabled = loading;
            firstnameInput.disabled = loading;
            lastnameInput.disabled = loading;
            passwordInput.disabled = loading;
            confirmPasswordInput.disabled = loading;
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
        RegisterPanel.currentPanel = undefined;

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
 * Simple registration via input boxes (alternative to webview)
 */
export async function showSimpleRegister(): Promise<boolean> {
    const username = await vscode.window.showInputBox({
        prompt: 'Choose a username',
        placeHolder: 'username',
        ignoreFocusOut: true,
        validateInput: (value) => {
            if (!value || value.trim().length < 3) {
                return 'Username must be at least 3 characters';
            }
            return null;
        }
    });

    if (!username) {
        return false;
    }

    const email = await vscode.window.showInputBox({
        prompt: 'Enter your email address',
        placeHolder: 'email@example.com',
        ignoreFocusOut: true,
        validateInput: (value) => {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!value || !emailRegex.test(value)) {
                return 'Please enter a valid email address';
            }
            return null;
        }
    });

    if (!email) {
        return false;
    }

    const password = await vscode.window.showInputBox({
        prompt: 'Create a password (minimum 8 characters)',
        placeHolder: 'Password',
        password: true,
        ignoreFocusOut: true,
        validateInput: (value) => {
            if (!value || value.length < 8) {
                return 'Password must be at least 8 characters';
            }
            return null;
        }
    });

    if (!password) {
        return false;
    }

    const confirmPassword = await vscode.window.showInputBox({
        prompt: 'Confirm your password',
        placeHolder: 'Confirm password',
        password: true,
        ignoreFocusOut: true,
        validateInput: (value) => {
            if (value !== password) {
                return 'Passwords do not match';
            }
            return null;
        }
    });

    if (!confirmPassword) {
        return false;
    }

    try {
        const authService = AuthService.getInstance();
        const user = await authService.register(username, email, password);
        vscode.window.showInformationMessage(
            `Registration successful! Welcome, ${user.username}! Please login to continue.`
        );
        
        // Prompt to login
        const loginNow = await vscode.window.showInformationMessage(
            'Would you like to login now?',
            'Yes',
            'No'
        );
        
        if (loginNow === 'Yes') {
            vscode.commands.executeCommand('mokkyBuddyAPIRunner.login');
        }
        
        return true;
    } catch (error: any) {
        vscode.window.showErrorMessage(`Registration failed: ${error.message}`);
        return false;
    }
}
