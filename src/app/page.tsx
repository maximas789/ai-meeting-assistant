"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Mic, Database, Bot, Shield, MessageSquare, ArrowRight, Radio } from "lucide-react";
import { SetupChecklist } from "@/components/setup-checklist";
import { Button } from "@/components/ui/button";
import { useDiagnostics } from "@/hooks/use-diagnostics";

const features = [
  {
    icon: Shield,
    title: "100% Local",
    description: "All processing runs on your own hardware. No data leaves the room.",
    color: "from-green-500 to-emerald-600",
  },
  {
    icon: Database,
    title: "Document RAG",
    description: "Upload documents and get instant answers during meetings.",
    color: "from-blue-500 to-cyan-600",
  },
  {
    icon: Bot,
    title: "Ollama Powered",
    description: "Uses local LLMs via Ollama for fast, private AI responses.",
    color: "from-purple-500 to-violet-600",
  },
  {
    icon: MessageSquare,
    title: "Voice + Visual",
    description: "Responds via voice and displays insight cards on screen.",
    color: "from-orange-500 to-amber-600",
  },
];

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

export default function Home() {
  const { isDatabaseReady, isOllamaReady, loading } = useDiagnostics();
  const isReady = isDatabaseReady && isOllamaReady && !loading;

  return (
    <main className="flex-1">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />

        <div className="container mx-auto px-4 py-16 md:py-24">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="max-w-4xl mx-auto text-center space-y-6"
          >
            {/* Icon */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
              className="flex justify-center"
            >
              <div className="relative">
                <div className="absolute inset-0 bg-primary/20 rounded-2xl blur-xl animate-pulse" />
                <div className="relative flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary/80 shadow-lg">
                  <Mic className="h-8 w-8 text-primary-foreground" />
                </div>
              </div>
            </motion.div>

            {/* Title */}
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-4xl md:text-6xl font-bold tracking-tight"
            >
              <span className="bg-gradient-to-r from-primary via-primary/90 to-primary/70 bg-clip-text text-transparent">
                AI Meeting Assistant
              </span>
            </motion.h1>

            {/* Subtitle */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="text-xl md:text-2xl text-muted-foreground"
            >
              Your Meeting Room&apos;s Memory
            </motion.p>

            {/* Description */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="text-lg text-muted-foreground max-w-2xl mx-auto"
            >
              A local-first AI voice assistant for team meetings. Always
              listening, never leaking, instantly helpful.
            </motion.p>

            {/* CTA Button */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="pt-4"
            >
              <Button
                asChild
                size="lg"
                className="group text-base px-8"
                disabled={!isReady}
              >
                <Link href="/meeting">
                  <Radio className="mr-2 h-5 w-5" />
                  Start Meeting
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </Button>
              {!isReady && (
                <p className="text-sm text-muted-foreground mt-3">
                  Complete setup below to enable
                </p>
              )}
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4">
          <motion.div
            variants={container}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-100px" }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
          >
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <motion.div
                  key={feature.title}
                  variants={item}
                  className="group relative p-6 rounded-2xl border bg-card hover:shadow-lg transition-all duration-300"
                >
                  {/* Gradient accent on hover */}
                  <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${feature.color} opacity-0 group-hover:opacity-5 transition-opacity`} />

                  <div className={`inline-flex p-3 rounded-xl bg-gradient-to-br ${feature.color} mb-4`}>
                    <Icon className="h-5 w-5 text-white" />
                  </div>

                  <h3 className="font-semibold text-lg mb-2">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    {feature.description}
                  </p>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </section>

      {/* Setup Section */}
      <section className="py-16 md:py-24 bg-muted/30">
        <div className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-4xl mx-auto"
          >
            <h2 className="text-2xl md:text-3xl font-bold text-center mb-8">
              Get Started
            </h2>

            <SetupChecklist />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 }}
                className="p-6 rounded-xl border bg-card"
              >
                <h3 className="font-semibold text-lg mb-3">
                  1. Environment Setup
                </h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Copy <code className="bg-muted px-1.5 py-0.5 rounded">.env.example</code> to{" "}
                  <code className="bg-muted px-1.5 py-0.5 rounded">.env.local</code> and configure:
                </p>
                <ul className="text-sm text-muted-foreground space-y-1.5">
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                    POSTGRES_URL
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                    OLLAMA_BASE_URL
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                    OLLAMA_MODEL
                  </li>
                </ul>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2 }}
                className="p-6 rounded-xl border bg-card"
              >
                <h3 className="font-semibold text-lg mb-3">
                  2. Database Setup
                </h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Run database migrations:
                </p>
                <div className="space-y-2">
                  <code className="text-sm bg-muted px-3 py-2 rounded-lg block font-mono">
                    pnpm run db:generate
                  </code>
                  <code className="text-sm bg-muted px-3 py-2 rounded-lg block font-mono">
                    pnpm run db:migrate
                  </code>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.3 }}
                className="p-6 rounded-xl border bg-card"
              >
                <h3 className="font-semibold text-lg mb-3">
                  3. Start Ollama
                </h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Make sure Ollama is running with a model:
                </p>
                <div className="space-y-2">
                  <code className="text-sm bg-muted px-3 py-2 rounded-lg block font-mono">
                    ollama serve
                  </code>
                  <code className="text-sm bg-muted px-3 py-2 rounded-lg block font-mono">
                    ollama pull llama3.2
                  </code>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.4 }}
                className="p-6 rounded-xl border bg-card"
              >
                <h3 className="font-semibold text-lg mb-3">
                  4. Start Using
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Once setup is complete, start your first meeting!
                </p>
                <Button
                  asChild
                  className="w-full"
                  disabled={!isReady}
                >
                  <Link href="/meeting">
                    <Radio className="mr-2 h-4 w-4" />
                    Launch Meeting Room
                  </Link>
                </Button>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </section>
    </main>
  );
}
