This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Multiplayer lobby (`/room`)

**`/room` requires Instagram login** on shame.ai (same session as solo features) so punishments map to a real IG account. **Supabase keys** are required for synced multiplayer (Dashboard → Settings → API). Run the app from `webapp/`:

```env
SUPABASE_URL=
SUPABASE_PUBLISHABLE_KEY=
```

Put them in **`webapp/.env.local`** or **repo root `.env.local`** (root is auto-loaded when you `npm run dev` from `webapp/`). Copy from [`webapp/.env.example`](./.env.example) if you like. Never commit `.env.local`.

The lobby uses Next.js **`/api/mp/*`** routes, which call Supabase **Edge Functions** in [`../supabase/`](../supabase/) (same API as [`../scripts/shame-mp`](../scripts/shame-mp)).

1. `cd webapp && npm run dev`
2. Open [http://localhost:3000/room](http://localhost:3000/room)

**Production:** set the same `SUPABASE_*` variables in your host (e.g. Vercel).

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
