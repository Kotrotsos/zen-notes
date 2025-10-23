"use client"

import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { ArrowLeft, FileText, Table, Sparkles, Database, Share2, Users, Settings, Folder, Star, Search, Download, Upload, Eye, Keyboard } from 'lucide-react'

export default function DocsPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Link href="/">
          <Button variant="ghost" className="mb-6">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to App
          </Button>
        </Link>

        <div className="space-y-8">
          <div>
            <h1 className="text-4xl font-bold mb-2">Zen Notes Documentation</h1>
            <p className="text-muted-foreground text-lg">
              A complete guide to all features and capabilities
            </p>
          </div>

          {/* Overview */}
          <section className="space-y-4">
            <h2 className="text-2xl font-semibold border-b pb-2">Overview</h2>
            <p>
              Zen Notes is a minimalist, powerful note-taking application designed for focus and productivity.
              It works offline-first with local storage and optionally syncs to the cloud when you sign in.
            </p>
          </section>

          {/* Core Features */}
          <section className="space-y-4">
            <h2 className="text-2xl font-semibold border-b pb-2">Core Features</h2>

            <div className="space-y-6">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="h-5 w-5 text-blue-500" />
                  <h3 className="text-xl font-semibold">Markdown Editor</h3>
                </div>
                <p className="mb-2">Write notes in markdown with full syntax support:</p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4">
                  <li>Headers, bold, italic, code blocks</li>
                  <li>Lists (ordered and unordered)</li>
                  <li>Links and images</li>
                  <li>Tables and task lists</li>
                  <li>Live preview with split view</li>
                  <li>Syntax highlighting for code blocks</li>
                </ul>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Table className="h-5 w-5 text-green-500" />
                  <h3 className="text-xl font-semibold">Table View</h3>
                </div>
                <p className="mb-2">Edit CSV data in a spreadsheet-like interface:</p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4">
                  <li>Toggle between text and table view</li>
                  <li>Edit cells inline</li>
                  <li>Add/remove rows and columns</li>
                  <li>Import and export CSV files</li>
                  <li>Column headers with sorting</li>
                </ul>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="h-5 w-5 text-purple-500" />
                  <h3 className="text-xl font-semibold">AI Workbench</h3>
                </div>
                <p className="mb-2">Process your documents with AI assistance:</p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4">
                  <li><strong>Basic Mode:</strong> Apply prompts and templates to chunks of text</li>
                  <li><strong>Advanced Mode:</strong> Create YAML workflows with nodes (func, prompt, print)</li>
                  <li>Process CSV data row-by-row</li>
                  <li>Configurable chunking with custom separators</li>
                  <li>Save and reuse prompts and workflows</li>
                  <li>Model selection (GPT-4, Claude, etc.)</li>
                  <li>Stream responses in real-time</li>
                  <li>Bulk apply results back to document</li>
                </ul>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Folder className="h-5 w-5 text-yellow-500" />
                  <h3 className="text-xl font-semibold">File Organization</h3>
                </div>
                <p className="mb-2">Organize your notes with folders:</p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4">
                  <li>Create nested folder structures</li>
                  <li>Drag and drop files between folders</li>
                  <li>Expand/collapse folder trees</li>
                  <li>Context menu for file operations</li>
                  <li>Rename files and folders</li>
                  <li>Delete with confirmation</li>
                </ul>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Star className="h-5 w-5 text-amber-500" />
                  <h3 className="text-xl font-semibold">Favorites & References</h3>
                </div>
                <p className="mb-2">Quick access to important documents:</p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4">
                  <li>Star files to add them to favorites</li>
                  <li>Favorites section at top of explorer</li>
                  <li>@ reference system to link documents</li>
                  <li>Click references to jump to documents</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Cloud Features */}
          <section className="space-y-4">
            <h2 className="text-2xl font-semibold border-b pb-2">Cloud Features (Requires Login)</h2>

            <div className="space-y-6">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Users className="h-5 w-5 text-indigo-500" />
                  <h3 className="text-xl font-semibold">User Accounts</h3>
                </div>
                <p className="mb-2">Sign up for a free account to enable cloud features:</p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4">
                  <li>Secure authentication with JWT</li>
                  <li>Password reset via email</li>
                  <li>User profile with avatar</li>
                </ul>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Database className="h-5 w-5 text-orange-500" />
                  <h3 className="text-xl font-semibold">Cloud Sync</h3>
                </div>
                <p className="mb-2">Your notes sync automatically when logged in:</p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4">
                  <li>Works offline with IndexedDB</li>
                  <li>Syncs to PostgreSQL database when online</li>
                  <li>Automatic sync on login</li>
                  <li>Manual sync available in share dialog</li>
                  <li>Preserves folder structure</li>
                  <li>All settings and preferences saved</li>
                </ul>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Share2 className="h-5 w-5 text-pink-500" />
                  <h3 className="text-xl font-semibold">Document Sharing</h3>
                </div>
                <p className="mb-2">Share documents with beautiful, memorable URLs:</p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4">
                  <li>Generate cute phrase URLs (e.g., "glowy-worm-like-santa-9a4b")</li>
                  <li>Choose from 5 URL options</li>
                  <li>Public view with document owner info</li>
                  <li>Regenerate URLs for existing shares</li>
                  <li>Remove shares at any time</li>
                  <li>Access count tracking</li>
                  <li>2.5 trillion possible combinations</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Editor Features */}
          <section className="space-y-4">
            <h2 className="text-2xl font-semibold border-b pb-2">Editor Features</h2>

            <div className="space-y-6">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Eye className="h-5 w-5 text-blue-500" />
                  <h3 className="text-xl font-semibold">Live Preview</h3>
                </div>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4">
                  <li>Toggle markdown preview on/off</li>
                  <li>Split view with adjustable ratio</li>
                  <li>Synchronized scrolling</li>
                  <li>Custom CSS styling support</li>
                  <li>Preview templates</li>
                </ul>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Settings className="h-5 w-5 text-gray-500" />
                  <h3 className="text-xl font-semibold">Customization</h3>
                </div>
                <p className="mb-2">Customize the editor to your preferences:</p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4">
                  <li><strong>Appearance:</strong> Light/dark theme</li>
                  <li><strong>Editor:</strong> Font size, line height, font family</li>
                  <li><strong>Layout:</strong> Show/hide line numbers and gutter</li>
                  <li><strong>Models:</strong> Configure API keys for different AI models</li>
                  <li><strong>Shortcuts:</strong> Keyboard shortcuts reference</li>
                </ul>
              </div>
            </div>
          </section>

          {/* File Operations */}
          <section className="space-y-4">
            <h2 className="text-2xl font-semibold border-b pb-2">File Operations</h2>

            <div className="space-y-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Download className="h-5 w-5 text-blue-500" />
                  <h3 className="text-xl font-semibold">Export</h3>
                </div>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4">
                  <li><strong>Save File:</strong> Download current document as .md or .csv</li>
                  <li><strong>Save All:</strong> Export all tabs as a ZIP file</li>
                  <li>Preserves folder structure in exports</li>
                </ul>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Upload className="h-5 w-5 text-green-500" />
                  <h3 className="text-xl font-semibold">Import</h3>
                </div>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4">
                  <li><strong>Load File:</strong> Import single .md or .csv file</li>
                  <li><strong>Load Tabs:</strong> Import entire workspace from ZIP</li>
                  <li>Automatically detects file type</li>
                  <li>Creates new tabs for each file</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Keyboard Shortcuts */}
          <section className="space-y-4">
            <h2 className="text-2xl font-semibold border-b pb-2">Keyboard Shortcuts</h2>

            <div className="space-y-2">
              <div className="flex items-center gap-2 mb-2">
                <Keyboard className="h-5 w-5 text-purple-500" />
                <h3 className="text-xl font-semibold">Common Shortcuts</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div className="flex justify-between p-2 bg-muted/50 rounded">
                  <span className="text-sm">New Tab</span>
                  <kbd className="text-xs">Cmd/Ctrl + N</kbd>
                </div>
                <div className="flex justify-between p-2 bg-muted/50 rounded">
                  <span className="text-sm">Close Tab</span>
                  <kbd className="text-xs">Cmd/Ctrl + W</kbd>
                </div>
                <div className="flex justify-between p-2 bg-muted/50 rounded">
                  <span className="text-sm">Save</span>
                  <kbd className="text-xs">Cmd/Ctrl + S</kbd>
                </div>
                <div className="flex justify-between p-2 bg-muted/50 rounded">
                  <span className="text-sm">Toggle Preview</span>
                  <kbd className="text-xs">Cmd/Ctrl + P</kbd>
                </div>
                <div className="flex justify-between p-2 bg-muted/50 rounded">
                  <span className="text-sm">Find</span>
                  <kbd className="text-xs">Cmd/Ctrl + F</kbd>
                </div>
                <div className="flex justify-between p-2 bg-muted/50 rounded">
                  <span className="text-sm">Toggle Explorer</span>
                  <kbd className="text-xs">Cmd/Ctrl + B</kbd>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                View all shortcuts in the app: Settings → Shortcuts tab
              </p>
            </div>
          </section>

          {/* Getting Started */}
          <section className="space-y-4">
            <h2 className="text-2xl font-semibold border-b pb-2">Getting Started</h2>

            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-2">1. Create Your First Note</h3>
                <p className="text-muted-foreground">
                  Click the "+" button in the tab bar to create a new document. Start writing in markdown!
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-2">2. Organize with Folders</h3>
                <p className="text-muted-foreground">
                  Open the file explorer (left sidebar) and create folders to organize your notes.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-2">3. Try the Preview</h3>
                <p className="text-muted-foreground">
                  Toggle the markdown preview to see your formatted content alongside your text.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-2">4. Sign Up (Optional)</h3>
                <p className="text-muted-foreground">
                  Create a free account to sync your notes across devices and enable document sharing.
                </p>
              </div>
            </div>
          </section>

          {/* Tips & Tricks */}
          <section className="space-y-4">
            <h2 className="text-2xl font-semibold border-b pb-2">Tips & Tricks</h2>

            <ul className="space-y-2 text-muted-foreground">
              <li className="flex gap-2">
                <span className="text-primary">•</span>
                <span>Use @ references to link between documents (e.g., @document-name)</span>
              </li>
              <li className="flex gap-2">
                <span className="text-primary">•</span>
                <span>Star your most used documents for quick access in the favorites section</span>
              </li>
              <li className="flex gap-2">
                <span className="text-primary">•</span>
                <span>Pin the file explorer to keep it always visible</span>
              </li>
              <li className="flex gap-2">
                <span className="text-primary">•</span>
                <span>Use table view for CSV files to edit data more easily</span>
              </li>
              <li className="flex gap-2">
                <span className="text-primary">•</span>
                <span>The AI Workbench can process multiple documents at once using workflows</span>
              </li>
              <li className="flex gap-2">
                <span className="text-primary">•</span>
                <span>Customize the preview style with custom CSS in the Preview settings</span>
              </li>
              <li className="flex gap-2">
                <span className="text-primary">•</span>
                <span>Export your entire workspace regularly as a backup (Save All)</span>
              </li>
            </ul>
          </section>

          {/* Footer */}
          <div className="pt-8 border-t">
            <p className="text-center text-muted-foreground">
              Zen Notes v1.0 - Built with Next.js, React, and TypeScript
            </p>
            <div className="flex justify-center gap-4 mt-4">
              <Link href="/">
                <Button>Go to App</Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
