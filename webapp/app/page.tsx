import Link from "next/link";
import Testimonials from "@/components/Testimonials";

const RITUALS = [
  "Post an embarrassing reel to your story",
  "Comment heart eyes on a random reel",
  "DM a love confession to someone",
  "Post a thirst trap with zero context",
  "Comment 'I miss you' on an ex's post",
  "Story a screenshot of your camera roll",
];

export default function LandingPage() {
  return (
    <main className="min-h-dvh bg-cream-light">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-5 max-w-6xl mx-auto">
        <span className="text-lg font-bold tracking-tight text-zinc-900">
          shame<span className="text-rose">.ai</span>
        </span>
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="text-sm font-medium text-zinc-600 hover:text-zinc-900 transition-colors"
          >
            Log in
          </Link>
          <Link
            href="/login"
            className="text-sm font-semibold px-5 py-2.5 bg-rose text-white rounded-full hover:bg-rose-dark transition-colors"
          >
            Get started
          </Link>
        </div>
      </nav>

      {/* Hero — asymmetric split */}
      <section className="max-w-6xl mx-auto px-6 pt-20 pb-28">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          {/* Left — big type */}
          <div className="lg:col-span-7 stagger-children">
            <p className="text-sm font-semibold text-rose tracking-wide uppercase mb-4">
              For friend groups with no boundaries
            </p>
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-zinc-900 leading-[1.05]">
              The AI that<br />
              humiliates your<br />
              <span className="text-rose">friends for you</span>
            </h1>
            <p className="mt-6 text-lg text-zinc-500 max-w-lg leading-relaxed">
              Three roulette spins. One picks the victim. One picks the
              ritual. One picks the target. All connected to Instagram.
              No mercy.
            </p>
            <div className="mt-8 flex items-center gap-4">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 px-7 py-3.5 bg-zinc-900 text-cream font-semibold rounded-full hover:bg-zinc-800 transition-colors text-sm"
              >
                Start shaming
                <span aria-hidden="true">&rarr;</span>
              </Link>
              <span className="text-xs text-zinc-400">Free. No cap. Literally.</span>
            </div>
          </div>

          {/* Right — ritual preview card */}
          <div className="lg:col-span-5 lg:mt-8">
            <div className="bg-white border border-beige/60 rounded-2xl p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-2 h-2 rounded-full bg-rose animate-pulse-soft" />
                <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
                  Live ritual feed
                </span>
              </div>
              <ul className="space-y-3">
                {RITUALS.map((r, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-3 text-sm text-zinc-600 leading-snug"
                  >
                    <span className="mt-0.5 w-5 h-5 rounded-full bg-blush/60 flex items-center justify-center text-[10px] font-bold text-rose shrink-0">
                      {i + 1}
                    </span>
                    {r}
                  </li>
                ))}
              </ul>
              <div className="mt-5 pt-4 border-t border-beige/40 flex items-center justify-between">
                <span className="text-xs text-zinc-400">and many more...</span>
                <span className="text-xs font-medium text-rose">AI-generated</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <Testimonials />

      {/* Features strip */}
      <section className="max-w-6xl mx-auto px-6 py-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-start">
          <div className="lg:col-span-5">
            <p className="text-xs font-semibold text-gold uppercase tracking-wider mb-2">
              Current rituals
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-zinc-900 mb-4">
              All the ways to<br />ruin friendships
            </h2>
            <p className="text-sm text-zinc-500 leading-relaxed">
              Every ritual is an actual Instagram action. Not hypothetical.
              Not a screenshot. Real posts, real DMs, real comments.
              Connected to your actual account.
            </p>
          </div>

          <div className="lg:col-span-7">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 stagger-children">
              {[
                { label: "Story posts", detail: "Force embarrassing content onto their story" },
                { label: "Reel comments", detail: "Leave unhinged comments on public reels" },
                { label: "Love confessions", detail: "DM heartfelt (fake) confessions to people" },
                { label: "Thirst traps", detail: "Post questionable content with zero context" },
                { label: "Ex interactions", detail: "Comment on an ex's post. Chaos guaranteed." },
                { label: "Camera roll roulette", detail: "Story a random screenshot. Pray." },
              ].map((item, i) => (
                <div
                  key={i}
                  className="bg-white border border-beige/50 rounded-xl px-5 py-4 hover:border-pink/40 transition-colors"
                >
                  <p className="text-sm font-semibold text-zinc-900">{item.label}</p>
                  <p className="text-xs text-zinc-400 mt-1">{item.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-zinc-900 border-t border-zinc-800">
        <div className="max-w-6xl mx-auto px-6 py-20 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight mb-3">
            Ready to destroy some friendships?
          </h2>
          <p className="text-sm text-zinc-400 mb-8 max-w-md mx-auto">
            Connect your Instagram. Add your friends. Let the AI do the rest.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 px-8 py-4 bg-rose text-white font-semibold rounded-full hover:bg-rose-dark transition-colors text-sm"
          >
            Get started free
            <span aria-hidden="true">&rarr;</span>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-zinc-950 px-6 py-8">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <span className="text-xs text-zinc-500">
            shame<span className="text-rose">.ai</span> &mdash; made with questionable intentions
          </span>
          <span className="text-xs text-zinc-600">
            not affiliated with Instagram (obviously)
          </span>
        </div>
      </footer>
    </main>
  );
}
