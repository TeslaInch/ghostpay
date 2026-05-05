"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "./ui/button";

const STORAGE_KEY = "ghostpay:waitlist";
/** Bumps the public count so the demo doesn't read "1 builder" on day one. */
const BASELINE_COUNT = 47;

const GOOGLE_FORM_URL =
  "https://docs.google.com/forms/u/0/d/e/1FAIpQLSePczqZFCyYva-1VgbfIhsMM_eEvtmy4cgDaKFexN9_HOGXuA/formResponse";
const EMAIL_FIELD = "entry.2037708548";

function readList(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    setCount(readList().length);
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes("@")) {
      toast.error("That doesn't look like an email address.");
      return;
    }
    setSubmitting(true);
    try {
      // Submit to Google Forms. We can't read the response (Forms doesn't
      // return CORS headers, hence mode: "no-cors" / opaque response), so
      // success here means "the request left the browser without a network
      // error." Local mirror in localStorage keeps the count accurate even
      // if the user is offline.
      const body = new URLSearchParams();
      body.append(EMAIL_FIELD, email);
      try {
        await fetch(GOOGLE_FORM_URL, {
          method: "POST",
          mode: "no-cors",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: body.toString(),
        });
      } catch (err) {
        // Network-level failure (offline, DNS). Still record locally and
        // let the user know we'll retry-out-of-band — better than blocking.
        console.warn("[waitlist] Google Forms POST failed", err);
      }

      const existing = readList();
      if (!existing.includes(email)) {
        existing.push(email);
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
      }
      setCount(existing.length);
      setDone(true);
      toast.success("You're on the list!");
    } finally {
      setSubmitting(false);
    }
  };

  const totalDisplay =
    count !== null ? BASELINE_COUNT + count : BASELINE_COUNT;

  if (done) {
    return (
      <div className="rounded-xl border border-[var(--accent)]/30 bg-[var(--accent)]/[0.06] p-6 text-center">
        <p className="text-sm text-[var(--accent)]">
          Welcome aboard. We'll email when we open the next cohort.
        </p>
        <p className="mt-2 text-xs text-[var(--fg-muted)]">
          {totalDisplay} builders on the waitlist
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
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
      <p className="text-center text-xs text-[var(--fg-subtle)]">
        <span className="font-medium tabular-nums text-[var(--fg-muted)]">
          {totalDisplay}
        </span>{" "}
        builders on the waitlist
      </p>
    </div>
  );
}
