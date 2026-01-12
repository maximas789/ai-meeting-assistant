'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Search,
  Calendar,
  Clock,
  ChevronRight,
  Trash2,
  Plus,
  ArrowLeft,
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

export default function MeetingsPage() {
  const router = useRouter();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    meeting: Meeting | null;
  }>({ open: false, meeting: null });
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch meetings
  const fetchMeetings = useCallback(async (search?: string) => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (search) {
        params.set('search', search);
      }
      const response = await fetch(`/api/meetings?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch meetings');
      const data = await response.json();
      setMeetings(data);
    } catch (error) {
      console.error('Error fetching meetings:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchMeetings();
  }, [fetchMeetings]);

  // Search with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchMeetings(searchQuery || undefined);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, fetchMeetings]);

  // Start a new meeting
  const handleStartMeeting = async () => {
    try {
      const response = await fetch('/api/meetings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: '' }),
      });
      if (!response.ok) throw new Error('Failed to start meeting');
      const meeting = await response.json();
      router.push(`/meeting?id=${meeting.id}`);
    } catch (error) {
      console.error('Error starting meeting:', error);
    }
  };

  // Delete a meeting
  const handleDeleteMeeting = async () => {
    if (!deleteDialog.meeting) return;

    try {
      setIsDeleting(true);
      const response = await fetch(`/api/meetings/${deleteDialog.meeting.id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete meeting');

      // Remove from local state
      setMeetings((prev) =>
        prev.filter((m) => m.id !== deleteDialog.meeting?.id)
      );
      setDeleteDialog({ open: false, meeting: null });
    } catch (error) {
      console.error('Error deleting meeting:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  // Format date for display
  const formatDate = (date: Date | string | null) => {
    if (!date) return 'Unknown';
    const d = new Date(date);
    return d.toLocaleDateString('en-US', {
      month: 'short',
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
    if (diffMins < 60) return `${diffMins}m`;
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-slate-100">
                Meeting History
              </h1>
              <p className="text-sm text-slate-400">
                View and search past meetings
              </p>
            </div>
          </div>
          <Button onClick={handleStartMeeting} className="gap-2">
            <Plus className="h-4 w-4" />
            New Meeting
          </Button>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search meetings by topic, transcript, or summary..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-slate-800 border-slate-700"
          />
        </div>

        {/* Meetings List */}
        <div className="space-y-4">
          {isLoading ? (
            // Loading skeletons
            Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} className="bg-slate-800/50 border-slate-700">
                <CardHeader>
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-4 w-32" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-16 w-full" />
                </CardContent>
              </Card>
            ))
          ) : meetings.length === 0 ? (
            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Calendar className="h-12 w-12 text-slate-500 mb-4" />
                <p className="text-slate-400 text-center">
                  {searchQuery
                    ? 'No meetings found matching your search'
                    : 'No meetings yet. Start your first meeting!'}
                </p>
                {!searchQuery && (
                  <Button
                    onClick={handleStartMeeting}
                    className="mt-4 gap-2"
                    variant="outline"
                  >
                    <Plus className="h-4 w-4" />
                    Start Meeting
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            meetings.map((meeting, index) => (
              <motion.div
                key={meeting.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card className="bg-slate-800/50 border-slate-700 hover:bg-slate-800/70 transition-colors group">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <CardTitle className="text-lg text-slate-100">
                            {meeting.title || 'Untitled Meeting'}
                          </CardTitle>
                          {!meeting.endedAt && (
                            <Badge
                              variant="outline"
                              className="border-green-500 text-green-400"
                            >
                              In Progress
                            </Badge>
                          )}
                        </div>
                        <CardDescription className="flex items-center gap-4 text-slate-400">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5" />
                            {formatDate(meeting.startedAt)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            {formatTime(meeting.startedAt)}
                          </span>
                          {meeting.endedAt && (
                            <span className="text-slate-500">
                              Duration:{' '}
                              {getDuration(meeting.startedAt, meeting.endedAt)}
                            </span>
                          )}
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-red-400"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteDialog({ open: true, meeting });
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                        <Link href={`/meetings/${meeting.id}`}>
                          <Button variant="ghost" size="icon">
                            <ChevronRight className="h-5 w-5 text-slate-400" />
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </CardHeader>
                  {meeting.summary && (
                    <CardContent>
                      <p className="text-sm text-slate-300 line-clamp-3">
                        {meeting.summary}
                      </p>
                    </CardContent>
                  )}
                </Card>
              </motion.div>
            ))
          )}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialog.open}
        onOpenChange={(open) =>
          !isDeleting && setDeleteDialog({ open, meeting: null })
        }
      >
        <DialogContent className="bg-slate-800 border-slate-700">
          <DialogHeader>
            <DialogTitle>Delete Meeting</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;
              {deleteDialog.meeting?.title || 'Untitled Meeting'}&quot;? This
              action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialog({ open: false, meeting: null })}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteMeeting}
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
