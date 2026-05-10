/**
 * MokkyBuddy Extension - Logger Utility
 * Centralized logging to output channel
 */

import * as vscode from 'vscode';

export const outputChannel = vscode.window.createOutputChannel('Mokky Buddy API Runner');

export function log(message: string): void {
    const timestamp = new Date().toISOString().slice(11, 19);
    outputChannel.appendLine(`[${timestamp}] ${message}`);
    console.log(`[MokkyBuddy] ${message}`);
}

export function logError(message: string, error?: any): void {
    const timestamp = new Date().toISOString().slice(11, 19);
    const errorMsg = error?.message || error || '';
    outputChannel.appendLine(`[${timestamp}] ❌ ${message} ${errorMsg}`);
    console.error(`[MokkyBuddy] ${message}`, error);
}

export function logSuccess(message: string): void {
    log(`✅ ${message}`);
}

export function logInfo(message: string): void {
    log(`ℹ️ ${message}`);
}

export function logWarning(message: string): void {
    log(`⚠️ ${message}`);
}

export function showOutputChannel(): void {
    outputChannel.show();
}
