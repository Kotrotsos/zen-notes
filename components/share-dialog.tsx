"use client"

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Copy, Check, RefreshCw } from 'lucide-react'
import { generateShareableSlugs } from '@/lib/url-generator'

interface ShareDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  documentId: string
  documentName: string
}

export function ShareDialog({ open, onOpenChange, documentId, documentName }: ShareDialogProps) {
  const [loading, setLoading] = useState(false)
  const [shareUrl, setShareUrl] = useState('')
  const [copied, setCopied] = useState(false)
  const [slugOptions, setSlugOptions] = useState<string[]>([])
  const [selectedSlug, setSelectedSlug] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      // Generate slug options when dialog opens
      const slugs = generateShareableSlugs(5)
      setSlugOptions(slugs)
      setSelectedSlug(slugs[0])
    }
  }, [open])

  const generateNewOptions = () => {
    const slugs = generateShareableSlugs(5)
    setSlugOptions(slugs)
    setSelectedSlug(slugs[0])
  }

  const handleShare = async () => {
    setError('')
    setLoading(true)

    try {
      const response = await fetch('/api/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId,
          customSlug: selectedSlug,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Failed to create share link')
      } else {
        setShareUrl(data.url)
      }
    } catch (err) {
      setError('Failed to create share link')
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const handleClose = () => {
    setShareUrl('')
    setCopied(false)
    setError('')
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share Document</DialogTitle>
          <DialogDescription>
            Create a public link for: {documentName}
          </DialogDescription>
        </DialogHeader>

        {!shareUrl ? (
          <div className="space-y-4">
            {error && (
              <div className="p-3 text-sm bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded">
                {error}
              </div>
            )}

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Choose a URL phrase</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={generateNewOptions}
                  className="h-8"
                >
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Regenerate
                </Button>
              </div>

              <div className="space-y-2">
                {slugOptions.map((slug) => (
                  <div
                    key={slug}
                    onClick={() => setSelectedSlug(slug)}
                    className={`p-3 border rounded cursor-pointer transition-colors ${
                      selectedSlug === slug
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-border hover:border-blue-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <code className="text-sm font-mono">{slug}</code>
                      {selectedSlug === slug && (
                        <Check className="h-4 w-4 text-blue-600" />
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <p className="text-xs text-muted-foreground">
                Your document will be available at: zennotes.com/{selectedSlug}
              </p>
            </div>

            <Button
              onClick={handleShare}
              className="w-full"
              disabled={loading || !selectedSlug}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Share Link
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-3 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded text-sm">
              Share link created successfully!
            </div>

            <div className="space-y-2">
              <Label>Share URL</Label>
              <div className="flex gap-2">
                <Input
                  value={shareUrl}
                  readOnly
                  className="font-mono text-sm"
                />
                <Button
                  onClick={handleCopy}
                  variant="outline"
                  size="icon"
                  className="shrink-0"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Anyone with this link can view this document
              </p>
            </div>

            <Button onClick={handleClose} className="w-full">
              Done
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
