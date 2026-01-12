'use client';

import { memo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Bot, CheckSquare, Info, Sparkles } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export type InsightType = 'response' | 'action' | 'info' | 'suggestion';

export interface InsightCardData {
  id: string;
  type: InsightType;
  title?: string;
  content: string;
  source?: string;
  timestamp: Date;
}

interface InsightCardProps extends InsightCardData {
  /** Optional className for customization */
  className?: string;
  /** Animation index for staggered entrance */
  index?: number;
  /** Optional click handler for keyboard navigation */
  onClick?: () => void;
}

// ARIA role mapping for insight types
const typeAriaRoles: Record<InsightType, string> = {
  response: 'article',
  action: 'listitem',
  info: 'note',
  suggestion: 'note',
};

const typeConfig = {
  response: {
    borderColor: 'border-l-blue-500',
    bgColor: 'bg-blue-500/5',
    icon: Bot,
    iconColor: 'text-blue-500',
    defaultTitle: 'AI Response',
  },
  action: {
    borderColor: 'border-l-orange-500',
    bgColor: 'bg-orange-500/5',
    icon: CheckSquare,
    iconColor: 'text-orange-500',
    defaultTitle: 'Action Item',
  },
  info: {
    borderColor: 'border-l-slate-400',
    bgColor: 'bg-slate-500/5',
    icon: Info,
    iconColor: 'text-slate-400',
    defaultTitle: 'Information',
  },
  suggestion: {
    borderColor: 'border-l-purple-500',
    bgColor: 'bg-purple-500/5',
    icon: Sparkles,
    iconColor: 'text-purple-500',
    defaultTitle: 'Suggestion',
  },
};

/**
 * An insight card that displays AI responses, action items, or information
 * during meetings. Cards have type-specific styling and entrance animations.
 */
function InsightCardComponent({
  type,
  title,
  content,
  source,
  timestamp,
  className,
  index = 0,
  onClick,
}: InsightCardProps) {
  const config = typeConfig[type];
  const Icon = config.icon;
  const displayTitle = title || config.defaultTitle;

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (onClick && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        onClick();
      }
    },
    [onClick]
  );

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{
        duration: 0.3,
        delay: index * 0.1,
        ease: 'easeOut',
      }}
      role={typeAriaRoles[type]}
      aria-label={`${displayTitle}: ${content.slice(0, 100)}${content.length > 100 ? '...' : ''}`}
    >
      <Card
        className={cn(
          'border-l-4 transition-all duration-200 hover:shadow-md',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          config.borderColor,
          config.bgColor,
          onClick && 'cursor-pointer',
          className
        )}
        tabIndex={onClick ? 0 : undefined}
        onClick={onClick}
        onKeyDown={onClick ? handleKeyDown : undefined}
      >
        <CardHeader className="pb-2 pt-3 px-4">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Icon
              className={cn('h-4 w-4', config.iconColor)}
              aria-hidden="true"
            />
            <span>{displayTitle}</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="pb-3 px-4">
          <p className="text-sm leading-relaxed">{content}</p>

          <div className="flex items-center justify-between mt-3 pt-2 border-t border-border/50">
            {source && (
              <span className="text-xs text-muted-foreground">
                Source: {source}
              </span>
            )}
            <time
              dateTime={timestamp.toISOString()}
              className={cn(
                'text-xs text-muted-foreground',
                !source && 'ml-auto'
              )}
            >
              {formatTime(timestamp)}
            </time>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// Memoize to prevent unnecessary re-renders
export const InsightCard = memo(InsightCardComponent);

/**
 * Format timestamp for display
 */
function formatTime(date: Date): string {
  return date.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * A container for insight cards with proper spacing and scrolling
 */
interface InsightFeedProps {
  cards: InsightCardData[];
  className?: string;
  emptyMessage?: string;
  /** Accessible label for the feed region */
  ariaLabel?: string;
}

function InsightFeedComponent({
  cards,
  className,
  emptyMessage = 'Insights will appear here during the meeting...',
  ariaLabel = 'Meeting insights and responses',
}: InsightFeedProps) {
  return (
    <div
      className={cn('space-y-3 overflow-y-auto', className)}
      role="feed"
      aria-label={ariaLabel}
      aria-busy={false}
    >
      {cards.length === 0 ? (
        <div
          className="text-center py-8 text-muted-foreground text-sm"
          role="status"
        >
          {emptyMessage}
        </div>
      ) : (
        <>
          {/* Screen reader announcement for new items */}
          <div className="sr-only" aria-live="polite" aria-atomic="false">
            {cards.length} insight{cards.length !== 1 ? 's' : ''} available
          </div>
          {cards.map((card, index) => (
            <InsightCard key={card.id} {...card} index={index} />
          ))}
        </>
      )}
    </div>
  );
}

// Memoize to prevent unnecessary re-renders
export const InsightFeed = memo(InsightFeedComponent);

/**
 * Create a new insight card with auto-generated ID
 */
export function createInsight(
  type: InsightType,
  content: string,
  options?: {
    title?: string;
    source?: string;
  }
): InsightCardData {
  const result: InsightCardData = {
    id: `insight-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type,
    content,
    timestamp: new Date(),
  };
  if (options?.title) {
    result.title = options.title;
  }
  if (options?.source) {
    result.source = options.source;
  }
  return result;
}
