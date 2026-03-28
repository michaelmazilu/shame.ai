import LoginForm from "@/components/LoginForm";

export default function LoginPage() {
  return (
    <main className="min-h-dvh bg-black flex flex-col items-center justify-center px-6">
      <div className="mb-10 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-white">ShotTaker</h1>
        <p className="mt-2 text-sm text-neutral-400">Sign in with Instagram to start swiping</p>
      </div>
      <LoginForm />
    </main>
  );
}
