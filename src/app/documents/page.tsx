'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload,
  FileText,
  Trash2,
  Loader2,
  AlertCircle,
  CheckCircle2,
  FileUp,
  Search,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';

// Document type from schema
interface Document {
  id: number;
  filename: string;
  originalName: string | null;
  mimeType: string | null;
  fileSize: number | null;
  uploadedAt: string;
  processedAt: string | null;
  chunkCount: number | null;
}

// Query result type
interface QueryResult {
  text: string;
  source: string;
  documentId: string;
  relevance: number;
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return 'Unknown size';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<QueryResult[] | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch documents on mount
  const fetchDocuments = useCallback(async () => {
    try {
      const response = await fetch('/api/documents');
      if (!response.ok) throw new Error('Failed to fetch documents');
      const data = await response.json();
      setDocuments(data);
    } catch (error) {
      console.error('Failed to fetch documents:', error);
      toast.error('Failed to load documents');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  // Handle file upload
  const handleUpload = useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files);
      if (fileArray.length === 0) return;

      setIsUploading(true);
      let successCount = 0;
      let errorCount = 0;

      for (const file of fileArray) {
        const formData = new FormData();
        formData.append('file', file);

        try {
          const response = await fetch('/api/documents', {
            method: 'POST',
            body: formData,
          });

          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Upload failed');
          }

          successCount++;
        } catch (error) {
          console.error(`Failed to upload ${file.name}:`, error);
          toast.error(
            `Failed to upload ${file.name}: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
          errorCount++;
        }
      }

      if (successCount > 0) {
        toast.success(
          `Successfully uploaded ${successCount} document${successCount > 1 ? 's' : ''}`
        );
        await fetchDocuments();
      }

      setIsUploading(false);
    },
    [fetchDocuments]
  );

  // Handle file input change
  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
        handleUpload(e.target.files);
        e.target.value = ''; // Reset input
      }
    },
    [handleUpload]
  );

  // Handle drag and drop
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleUpload(e.dataTransfer.files);
      }
    },
    [handleUpload]
  );

  // Handle document deletion
  const handleDelete = useCallback(
    async (id: number) => {
      setDeletingId(id);
      try {
        const response = await fetch(`/api/documents/${id}`, {
          method: 'DELETE',
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Delete failed');
        }

        toast.success('Document deleted');
        await fetchDocuments();
      } catch (error) {
        console.error('Failed to delete document:', error);
        toast.error(
          `Failed to delete: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      } finally {
        setDeletingId(null);
      }
    },
    [fetchDocuments]
  );

  // Handle search
  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) {
      setSearchResults(null);
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch('/api/documents/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: searchQuery,
          nResults: 5,
          includeContext: true,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Search failed');
      }

      const data = await response.json();
      setSearchResults(data.results);
    } catch (error) {
      console.error('Search failed:', error);
      toast.error(
        `Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery]);

  const clearSearch = useCallback(() => {
    setSearchQuery('');
    setSearchResults(null);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white">Documents</h1>
              <p className="text-slate-400 mt-1">
                Upload documents for the AI to reference during meetings
              </p>
            </div>
            <Link href="/meeting">
              <Button variant="outline">Back to Meeting</Button>
            </Link>
          </div>
        </div>

        {/* Search */}
        <Card className="mb-6 bg-slate-900/50 border-slate-800">
          <CardContent className="pt-6">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search documents..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="pl-10 bg-slate-800 border-slate-700"
                />
                {searchQuery && (
                  <button
                    onClick={clearSearch}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <Button onClick={handleSearch} disabled={isSearching}>
                {isSearching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Search'
                )}
              </Button>
            </div>

            {/* Search results */}
            <AnimatePresence>
              {searchResults && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-4 space-y-3"
                >
                  {searchResults.length === 0 ? (
                    <p className="text-slate-400 text-sm">
                      No relevant results found
                    </p>
                  ) : (
                    searchResults.map((result, i) => (
                      <div
                        key={i}
                        className="p-3 rounded-lg bg-slate-800/50 border border-slate-700"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-slate-300">
                            {result.source}
                          </span>
                          <span className="text-xs text-slate-500">
                            {Math.round(result.relevance * 100)}% match
                          </span>
                        </div>
                        <p className="text-sm text-slate-400 line-clamp-3">
                          {result.text}
                        </p>
                      </div>
                    ))
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>

        {/* Upload area */}
        <Card
          className={`mb-6 bg-slate-900/50 border-2 border-dashed transition-colors ${
            dragActive
              ? 'border-blue-500 bg-blue-500/10'
              : 'border-slate-700 hover:border-slate-600'
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center py-8">
              {isUploading ? (
                <>
                  <Loader2 className="h-12 w-12 text-blue-500 animate-spin mb-4" />
                  <p className="text-slate-300">Processing documents...</p>
                </>
              ) : (
                <>
                  <FileUp className="h-12 w-12 text-slate-500 mb-4" />
                  <p className="text-slate-300 mb-2">
                    Drag and drop files here, or click to browse
                  </p>
                  <p className="text-sm text-slate-500 mb-4">
                    Supports PDF, DOCX, TXT, and Markdown files (max 10MB)
                  </p>
                  <Button
                    onClick={() => fileInputRef.current?.click()}
                    variant="outline"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Select Files
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown"
                    className="hidden"
                    onChange={handleFileInputChange}
                  />
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Document list */}
        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white">Uploaded Documents</CardTitle>
            <CardDescription>
              {documents.length} document{documents.length !== 1 ? 's' : ''}{' '}
              available for reference
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 text-slate-500 animate-spin" />
              </div>
            ) : documents.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="h-12 w-12 text-slate-600 mx-auto mb-4" />
                <p className="text-slate-400">No documents uploaded yet</p>
                <p className="text-sm text-slate-500 mt-1">
                  Upload documents to let the AI reference them during meetings
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {documents.map((doc) => (
                  <motion.div
                    key={doc.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center justify-between p-4 rounded-lg bg-slate-800/50 border border-slate-700"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-slate-700 flex items-center justify-center">
                        <FileText className="h-5 w-5 text-slate-400" />
                      </div>
                      <div>
                        <p className="font-medium text-slate-200">
                          {doc.originalName || doc.filename}
                        </p>
                        <div className="flex items-center gap-2 text-sm text-slate-500">
                          <span>{formatFileSize(doc.fileSize)}</span>
                          <span>•</span>
                          <span>{formatDate(doc.uploadedAt)}</span>
                          {doc.chunkCount && (
                            <>
                              <span>•</span>
                              <span>{doc.chunkCount} chunks</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {doc.processedAt ? (
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                      ) : (
                        <AlertCircle className="h-5 w-5 text-yellow-500" />
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(doc.id)}
                        disabled={deletingId === doc.id}
                        className="text-slate-400 hover:text-red-400"
                      >
                        {deletingId === doc.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
