/**
 * Snippet Provider - Manages route templates and snippets
 * Provides quick access to common route patterns
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

export interface Snippet {
    id: string;
    name: string;
    description: string;
    template: any;
}

export class SnippetProvider {
    private snippets: Snippet[] = [];
    private basicTemplate: any;

    constructor(private resourcePath: string) {
        this.loadSnippets();
        this.loadBasicTemplate();
    }

    /**
     * Load common snippets from resources
     */
    private loadSnippets(): void {
        try {
            const snippetsPath = path.join(this.resourcePath, 'snippets', 'common-snippets.json');
            if (fs.existsSync(snippetsPath)) {
                const content = fs.readFileSync(snippetsPath, 'utf-8');
                const data = JSON.parse(content);
                this.snippets = data.snippets || [];
                console.log(`✅ Loaded ${this.snippets.length} snippets`);
            }
        } catch (error) {
            console.warn('⚠️ Could not load snippets:', error);
            this.snippets = [];
        }
    }

    /**
     * Load basic template for new routes
     */
    private loadBasicTemplate(): void {
        try {
            const templatePath = path.join(this.resourcePath, 'templates', 'basic-route-template.json');
            if (fs.existsSync(templatePath)) {
                const content = fs.readFileSync(templatePath, 'utf-8');
                this.basicTemplate = JSON.parse(content);
                console.log('✅ Loaded basic template');
            }
        } catch (error) {
            console.warn('⚠️ Could not load basic template:', error);
            // Fallback template
            this.basicTemplate = {
                method: 'GET',
                path: '/api/resource',
                description: 'Brief description',
                responses: [
                    {
                        statusCode: 200,
                        body: { success: true },
                        headers: { 'Content-Type': 'application/json' }
                    }
                ]
            };
        }
    }

    /**
     * Get all available snippets
     */
    getAllSnippets(): Snippet[] {
        return this.snippets;
    }

    /**
     * Get snippet by ID
     */
    getSnippet(id: string): Snippet | undefined {
        return this.snippets.find(s => s.id === id);
    }

    /**
     * Get basic template for new routes
     */
    getBasicTemplate(): any {
        return JSON.parse(JSON.stringify(this.basicTemplate)); // Deep copy
    }

    /**
     * Get snippet template for specific ID
     */
    getSnippetTemplate(id: string): any {
        const snippet = this.getSnippet(id);
        if (snippet) {
            return JSON.parse(JSON.stringify(snippet.template)); // Deep copy
        }
        return null;
    }

    /**
     * Get list of snippet names for QuickPick
     */
    getSnippetLabels(): Array<{ label: string; description: string; detail: string }> {
        return this.snippets.map(s => ({
            label: s.name,
            description: s.description,
            detail: s.id
        }));
    }
}
