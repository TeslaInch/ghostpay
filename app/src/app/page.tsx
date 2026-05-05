import { BuiltWith } from "@/components/built-with";
import { FadeIn } from "@/components/fade-in";
import { Footer } from "@/components/footer";
import { Hero } from "@/components/hero";
import { HowItWorks } from "@/components/how-it-works";
import { Navbar } from "@/components/navbar";
import { Problem } from "@/components/problem";
import { WaitlistForm } from "@/components/waitlist-form";

export default function HomePage() {
  return (
    <>
      <Navbar />
      <main className="flex-1">
        <Hero />
        <Problem />
        <HowItWorks />
        <BuiltWith />
        <section id="waitlist" className="py-24 scroll-mt-20">
          <div className="mx-auto max-w-3xl px-6 text-center">
            <FadeIn>
              <h2 className="text-3xl font-semibold tracking-tight text-[var(--fg)] sm:text-4xl">
                Get early access.
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-[var(--fg-muted)]">
                We're rolling GhostPay out to a handful of DAOs first. Drop
                your email — we'll let you know when we open the next cohort.
              </p>
              <div className="mx-auto mt-10 max-w-xl">
                <WaitlistForm />
              </div>
            </FadeIn>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
