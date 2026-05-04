"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "./ui/button";

const STORAGE_KEY = "ghostpay:waitlist";

export function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes("@")) {
      toast.error("That doesn't look like an email address.");
      return;
    }
    setSubmitting(true);
    try {
      // Local-only persistence for now. Easy to swap for a /api/waitlist
      // route once Supabase or Resend is wired up.
      const existing: string[] = JSON.parse(
        typeof window !== "undefined"
          ? window.localStorage.getItem(STORAGE_KEY) ?? "[]"
          : "[]"
      );
      if (!existing.includes(email)) existing.push(email);
      if (typeof window !== "undefined")
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
      await new Promise((r) => setTimeout(r, 600));
      setDone(true);
      toast.success("You're on the list. We'll be in touch.");
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="rounded-xl border border-[var(--accent)]/30 bg-[var(--accent)]/[0.06] p-6 text-center">
        <p className="text-sm text-[var(--accent)]">
          Welcome aboard. We'll email when we open the next cohort.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="flex w-full flex-col gap-2 sm:flex-row sm:gap-3"
    >
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="founder@dao.example"
        className="flex-1 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-card)] px-4 py-3 text-sm text-[var(--fg)] placeholder-[var(--fg-subtle)] outline-none transition-colors focus:border-[var(--accent)]"
      />
      <Button type="submit" loading={submitting} size="lg">
        Join waitlist
      </Button>
    </form>
  );
}
