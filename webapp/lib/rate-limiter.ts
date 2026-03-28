const DELAY_READ = 500;
const DELAY_WRITE = 3000;
const BACKOFF_429 = 30000;

const sessionTimestamps = new Map<string, number>();

function getKey(sessionId: string): string {
  return sessionId;
}

export async function rateLimit(sessionId: string, isWrite: boolean): Promise<void> {
  const key = getKey(sessionId);
  const minDelay = isWrite ? DELAY_WRITE : DELAY_READ;
  const lastCall = sessionTimestamps.get(key) || 0;
  const now = Date.now();
  const elapsed = now - lastCall;

  if (elapsed < minDelay) {
    await new Promise((resolve) => setTimeout(resolve, minDelay - elapsed));
  }

  sessionTimestamps.set(key, Date.now());
}

export async function backoff429(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, BACKOFF_429));
}
