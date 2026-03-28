# shame.ai

```bash
npm install && npm run dev
```

Then open **http://localhost:3000**. For `/room`, add `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` to **repo root** `.env.local` (easiest) or `webapp/.env.local`, save, restart dev.

**Push / Vercel:** same two variables in the project’s Environment Variables. `vercel.json` points at `webapp/`.
