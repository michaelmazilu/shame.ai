import LoginForm from "@/components/LoginForm";
import Link from "next/link";

export default function LoginPage() {
  return (
    <main className="min-h-dvh bg-cream-light flex">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-5/12 bg-zinc-900 flex-col justify-between p-10">
        <Link href="/" className="text-lg font-bold text-white tracking-tight">
          shame<span className="text-rose">.ai</span>
        </Link>

        <div>
          <h2 className="text-3xl font-bold text-white tracking-tight leading-snug mb-3">
            Connect your Instagram.<br />
            Add your friends.<br />
            <span className="text-rose">Let chaos begin.</span>
          </h2>
          <p className="text-sm text-zinc-400 leading-relaxed max-w-sm">
            Three roulette wheels decide who gets humiliated, how, and
            who receives the DM. All real Instagram actions. No mercy.
          </p>
        </div>

        <p className="text-xs text-zinc-600">
          not affiliated with Instagram (obviously)
        </p>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="lg:hidden mb-10 text-center">
            <Link href="/" className="text-lg font-bold text-zinc-900 tracking-tight">
              shame<span className="text-rose">.ai</span>
            </Link>
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
              Sign in
            </h1>
            <p className="mt-1 text-sm text-zinc-400">
              Log in with your Instagram account to start
            </p>
          </div>

          <LoginForm />

          <p className="mt-8 text-center text-xs text-zinc-400">
            Your credentials are encrypted and never stored in plain text.
          </p>
        </div>
      </div>
    </main>
  );
}
