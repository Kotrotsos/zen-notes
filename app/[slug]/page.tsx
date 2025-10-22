"use client"

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Loader2, User, Calendar } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface SharedDocument {
  name: string
  content: string
  view: 'text' | 'table'
  owner: string
  sharedAt: string
}

export default function SharedDocumentPage() {
  const params = useParams()
  const slug = params.slug as string
  const [document, setDocument] = useState<SharedDocument | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchDocument = async () => {
      try {
        const response = await fetch(`/api/share/${slug}`)
        const data = await response.json()

        if (!response.ok) {
          setError(data.error || 'Failed to load document')
        } else {
          setDocument(data.document)
        }
      } catch (err) {
        setError('Failed to load document')
      } finally {
        setLoading(false)
      }
    }

    fetchDocument()
  }, [slug])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading shared document...</p>
        </div>
      </div>
    )
  }

  if (error || !document) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-bold mb-2">Document Not Found</h1>
          <p className="text-muted-foreground mb-6">
            {error || 'This shared link is invalid or has been deactivated.'}
          </p>
          <a
            href="/"
            className="inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Go to Zen Notes
          </a>
        </div>
      </div>
    )
  }

  const formattedDate = new Date(document.sharedAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold">{document.name}</h1>
              <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <User className="h-4 w-4" />
                  <span>{document.owner}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  <span>Shared on {formattedDate}</span>
                </div>
              </div>
            </div>
            <a
              href="/"
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Create Your Own
            </a>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {document.view === 'table' ? (
          <div className="border rounded-lg overflow-x-auto">
            <pre className="p-4 text-sm font-mono whitespace-pre-wrap">
              {document.content}
            </pre>
          </div>
        ) : (
          <div className="prose dark:prose-invert max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {document.content}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  )
}
