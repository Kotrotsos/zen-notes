"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { BookOpen, FileText, Share2, Database, Sparkles, Users, Settings, Table } from 'lucide-react'
import Link from 'next/link'

interface SplashScreenProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SplashScreen({ open, onOpenChange }: SplashScreenProps) {
  const handleGetStarted = () => {
    localStorage.setItem('zen-notes-seen-splash', 'true')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">Welcome to Zen Notes</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <p className="text-muted-foreground">
            A minimalist, powerful note-taking app designed for focus and productivity.
          </p>

          <div className="space-y-4">
            <h3 className="font-semibold text-lg">Key Features</h3>

            <div className="grid gap-4">
              <div className="flex gap-3">
                <FileText className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-medium text-sm">Markdown Editor</h4>
                  <p className="text-sm text-muted-foreground">Write in markdown with live preview and syntax highlighting</p>
                </div>
              </div>

              <div className="flex gap-3">
                <Table className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-medium text-sm">Table View</h4>
                  <p className="text-sm text-muted-foreground">Edit CSV data in a spreadsheet-like interface</p>
                </div>
              </div>

              <div className="flex gap-3">
                <Sparkles className="h-5 w-5 text-purple-500 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-medium text-sm">AI Workbench</h4>
                  <p className="text-sm text-muted-foreground">Process documents with AI using templates and workflows</p>
                </div>
              </div>

              <div className="flex gap-3">
                <Database className="h-5 w-5 text-orange-500 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-medium text-sm">Local-First</h4>
                  <p className="text-sm text-muted-foreground">Works offline with IndexedDB, syncs to cloud when logged in</p>
                </div>
              </div>

              <div className="flex gap-3">
                <Share2 className="h-5 w-5 text-pink-500 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-medium text-sm">Document Sharing</h4>
                  <p className="text-sm text-muted-foreground">
                    Share documents with cute URLs (requires login)
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <Users className="h-5 w-5 text-indigo-500 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-medium text-sm">User Accounts</h4>
                  <p className="text-sm text-muted-foreground">Sign in to sync your notes across devices</p>
                </div>
              </div>

              <div className="flex gap-3">
                <Settings className="h-5 w-5 text-gray-500 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-medium text-sm">Customizable</h4>
                  <p className="text-sm text-muted-foreground">Adjust fonts, themes, editor settings, and more</p>
                </div>
              </div>
            </div>
          </div>

          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 text-blue-900 dark:text-blue-100 rounded-lg text-sm">
            <p className="font-medium mb-1">Note about sharing</p>
            <p>You need to be logged in to share documents. Create a free account to enable document sharing and sync across devices.</p>
          </div>

          <div className="flex gap-3 pt-2">
            <Link href="/docs" className="flex-1">
              <Button variant="outline" className="w-full" onClick={() => onOpenChange(false)}>
                <BookOpen className="mr-2 h-4 w-4" />
                View Full Documentation
              </Button>
            </Link>
            <Button onClick={handleGetStarted} className="flex-1">
              Get Started
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
