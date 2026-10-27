# Nima

Nima is an AI companion app for postpartum recovery — a calm, private space where new mothers check in daily, talk things through with Nima (an empathetic AI companion), track their recovery journey, learn from curated weekly articles, and optionally share highlights with a partner.

Built with [TanStack Start](https://tanstack.com/start) (React 19, Vite), Tailwind CSS v4, shadcn/ui, and [Lovable Cloud](https://lovable.dev) (managed auth, database and AI).

## Features

- **Talk to Nima** — an empathetic AI chat companion with a daily personalized pulse question, memory of your story, and crisis-support escalation
- **Daily check-in** — quick mood and symptom check-ins that feed Nima's understanding
- **Your journey with Nima** — a living portrait of what Nima has noticed, relevant research, and your story so far
- **Wellness library** — real articles from trusted sources (NHS, Mayo Clinic, …), refreshed weekly
- **Community experiences** — share and browse stories from other mothers
- **Partner mode** — a shared view with its own companion chat and care alerts when extra support is needed
- **Smart scan** — capture health records and let Nima organize them

## Development

```bash
bun install
bun run dev
```

The app expects a Lovable Cloud (Supabase) backend configured via `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
