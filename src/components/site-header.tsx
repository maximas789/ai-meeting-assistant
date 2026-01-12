import Link from "next/link";
import { Mic, Radio, MessageSquare, AudioWaveform, Settings } from "lucide-react";
import { Button } from "./ui/button";
import { ModeToggle } from "./ui/mode-toggle";

const navLinks = [
  {
    href: "/meeting",
    label: "Meeting",
    icon: Radio,
    description: "Start a meeting session",
  },
  {
    href: "/test-transcription",
    label: "Test Audio",
    icon: AudioWaveform,
    description: "Test transcription",
  },
  {
    href: "/chat",
    label: "Chat",
    icon: MessageSquare,
    description: "AI chat interface",
  },
  {
    href: "/admin",
    label: "Admin",
    icon: Settings,
    description: "Admin settings",
  },
];

export function SiteHeader() {
  return (
    <>
      {/* Skip to main content link for accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-background focus:text-foreground focus:border focus:rounded-md"
      >
        Skip to main content
      </a>
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60" role="banner">
        <nav
          className="container mx-auto px-4 py-3 flex justify-between items-center"
          aria-label="Main navigation"
        >
          {/* Logo */}
          <Link
            href="/"
            className="flex items-center gap-2 text-primary hover:text-primary/80 transition-colors"
            aria-label="AI Meeting Assistant - Go to homepage"
          >
            <div
              className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20"
              aria-hidden="true"
            >
              <Mic className="h-5 w-5" />
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent hidden sm:inline">
              Meeting Assistant
            </span>
          </Link>

          {/* Navigation Links */}
          <div className="flex items-center gap-1" role="group" aria-label="Main navigation links">
            {navLinks.map((link) => {
              const Icon = link.icon;
              return (
                <Button
                  key={link.href}
                  variant="ghost"
                  size="sm"
                  asChild
                  className="text-muted-foreground hover:text-foreground"
                >
                  <Link href={link.href} title={link.description}>
                    <Icon className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline">{link.label}</span>
                  </Link>
                </Button>
              );
            })}
          </div>

          {/* User actions */}
          <div
            className="flex items-center gap-2"
            role="group"
            aria-label="User actions"
          >
            <ModeToggle />
          </div>
        </nav>
      </header>
    </>
  );
}
