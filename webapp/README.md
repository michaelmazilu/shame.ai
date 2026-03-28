This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Multiplayer lobby (`/room`)

The **group room** UI calls Next.js **API routes** under `/api/mp/*`, which proxy to Supabase **Edge Functions** in [`../supabase/`](../supabase/) (same API as [`../scripts/shame-mp`](../scripts/shame-mp)). Supabase URL and publishable key stay **server-side** only (not in the browser bundle).

1. Copy `webapp/.env.example` → `webapp/.env.local`
2. Set `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` (same values as repo root `.env.local` if you use `SUPABASE_URL` there; no `NEXT_PUBLIC_` prefix needed).
3. `npm run dev` → open [http://localhost:3000/room](http://localhost:3000/room)

For production (e.g. Vercel), add the same `SUPABASE_*` variables in the project environment settings.

The Chrome extension in the repo root stays separate; use the web lobby for rooms and the extension for Instagram actions when you wire them later.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
