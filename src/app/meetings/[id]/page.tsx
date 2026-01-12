'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Calendar,
  Clock,
  FileText,
  Sparkles,
  Trash2,
  Edit2,
  Check,
  X,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import type { Meeting } from '@/lib/schema';

type PageProps = {
  params: Promise<{ id: string }>;
};

export default function MeetingDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch meeting details
  useEffect(() => {
    async function fetchMeeting() {
      try {
        setIsLoading(true);
        const response = await fetch(`/api/meetings/${id}`);
        if (!response.ok) {
          if (response.status === 404) {
            setError('Meeting not found');
          } else {
            throw new Error('Failed to fetch meeting');
          }
          return;
        }
        const data = await response.json();
        setMeeting(data);
        setEditTitle(data.title || '');
      } catch (err) {
        console.error('Error fetching meeting:', err);
        setError('Failed to load meeting');
      } finally {
        setIsLoading(false);
      }
    }
    fetchMeeting();
  }, [id]);

  // Update meeting title
  const handleSaveTitle = async () => {
    if (!meeting) return;

    try {
      const response = await fetch(`/api/meetings/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: editTitle }),
      });
      if (!response.ok) throw new Error('Failed to update meeting');
      const updated = await response.json();
      setMeeting(updated);
      setIsEditing(false);
    } catch (err) {
      console.error('Error updating meeting:', err);
    }
  };

  // Delete meeting
  const handleDelete = async () => {
    try {
      setIsDeleting(true);
      const response = await fetch(`/api/meetings/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete meeting');
      router.push('/meetings');
    } catch (err) {
      console.error('Error deleting meeting:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  // Format date for display
  const formatDate = (date: Date | string | null) => {
    if (!date) return 'Unknown';
    const d = new Date(date);
    return d.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Format time for display
  const formatTime = (date: Date | string | null) => {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  // Calculate meeting duration
  const getDuration = (
    start: Date | string | null,
    end: Date | string | null
  ) => {
    if (!start || !end) return null;
    const startDate = new Date(start);
    const endDate = new Date(end);
    const diffMs = endDate.getTime() - startDate.getTime();
    const diffMins = Math.round(diffMs / 60000);
    if (diffMins < 60) return `${diffMins} minutes`;
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours} hours`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <Skeleton className="h-8 w-48 mb-4" />
          <Skeleton className="h-6 w-32 mb-8" />
          <Skeleton className="h-40 w-full mb-4" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (error || !meeting) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <Link href="/meetings">
            <Button variant="ghost" className="gap-2 mb-8">
              <ArrowLeft className="h-4 w-4" />
              Back to Meetings
            </Button>
          </Link>
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <p className="text-slate-400">{error || 'Meeting not found'}</p>
              <Link href="/meetings">
                <Button className="mt-4" variant="outline">
                  View All Meetings
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Link href="/meetings">
            <Button variant="ghost" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </Link>
          <Button
            variant="ghost"
            className="text-slate-400 hover:text-red-400"
            onClick={() => setDeleteDialogOpen(true)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>

        {/* Title */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3 mb-2">
            {isEditing ? (
              <div className="flex items-center gap-2 flex-1">
                <Input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="text-2xl font-bold bg-slate-800 border-slate-700"
                  placeholder="Meeting title..."
                  autoFocus
                />
                <Button size="icon" onClick={handleSaveTitle}>
                  <Check className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => {
                    setIsEditing(false);
                    setEditTitle(meeting.title || '');
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <>
                <h1 className="text-2xl font-bold text-slate-100">
                  {meeting.title || 'Untitled Meeting'}
                </h1>
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-slate-400"
                  onClick={() => setIsEditing(true)}
                >
                  <Edit2 className="h-4 w-4" />
                </Button>
                {!meeting.endedAt && (
                  <Badge
                    variant="outline"
                    className="border-green-500 text-green-400"
                  >
                    In Progress
                  </Badge>
                )}
              </>
            )}
          </div>
          <div className="flex items-center gap-4 text-sm text-slate-400">
            <span className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              {formatDate(meeting.startedAt)}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              {formatTime(meeting.startedAt)}
              {meeting.endedAt && ` - ${formatTime(meeting.endedAt)}`}
            </span>
            {meeting.endedAt && (
              <span className="text-slate-500">
                ({getDuration(meeting.startedAt, meeting.endedAt)})
              </span>
            )}
          </div>
        </motion.div>

        {/* Summary */}
        {meeting.summary && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="bg-slate-800/50 border-slate-700 mb-6">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Sparkles className="h-4 w-4 text-purple-400" />
                  AI Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-300 whitespace-pre-wrap">
                  {meeting.summary}
                </p>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Transcript */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4 text-blue-400" />
                Transcript
              </CardTitle>
              <CardDescription>
                Full meeting transcript
              </CardDescription>
            </CardHeader>
            <CardContent>
              {meeting.transcript ? (
                <div className="prose prose-invert prose-sm max-w-none">
                  <p className="text-slate-300 whitespace-pre-wrap leading-relaxed">
                    {meeting.transcript}
                  </p>
                </div>
              ) : (
                <p className="text-slate-500 italic">
                  No transcript available for this meeting.
                </p>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="bg-slate-800 border-slate-700">
          <DialogHeader>
            <DialogTitle>Delete Meeting</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this meeting? This action cannot
              be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
