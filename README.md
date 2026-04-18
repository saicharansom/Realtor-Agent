# RealtorAI

One platform for real estate agents that (a) turns a Zillow URL into a
scroll-stopping vertical video and (b) runs iMessage conversations with buyers,
renters and sellers autonomously until the lead is ready for the human.

```
┌─ Video Studio ───┐     ┌─ iMessage Agent ─────┐     ┌─ Dashboard ──────┐
│ paste Zillow URL │ →   │ qualify · send video │ →   │ pipeline + inbox │
│ MP4 out          │     │ book showing         │     │ notifications    │
└──────────────────┘     └──────────────────────┘     └──────────────────┘
                                  ▲   ▼
                       Photon Spectrum (iMessage)
                       IonRouter (vision + TTS)
                       Butterbase (db + hosting)
                       Claude Sonnet 4 (agent brain)
```

## Stack

- **Frontend** — React + Vite + Tailwind (`client/`)
- **Backend** — Node + Express (`server/`)
- **DB + hosting** — Butterbase
- **iMessage** — Photon Spectrum (`spectrum-ts`)
- **Video + agent brain** — Cumulus Labs / IonRouter (GLM-5 via OpenAI-compatible SDK, one key covers text, vision, voice, video) + ffmpeg

---

## 1. First-time setup

```bash
git init
npm install
npm --workspace server install
npm --workspace client install
cp .env.example .env   # then paste your keys into .env
```

You need accounts on:

| Service | Signup | Put in `.env` |
|---|---|---|
| Butterbase | dashboard.butterbase.ai | `BUTTERBASE_API_KEY` |
| Photon Spectrum | dashboard.photonapp.ai (promo `HACKWITHPHOTON`) | `PHOTON_API_KEY` |
| Cumulus Labs / IonRouter | ionrouter.io | `IONROUTER_API_KEY` |

## 2. Create the database

`butterbase/schema.sql` is the full schema (leads, listings, messages, showings).

From a Claude Code session at the project root (the Butterbase MCP is already
registered), just say:

> with butterbase, apply `butterbase/schema.sql` to my project

Or paste the SQL into the dashboard SQL console.

## 3. Run locally

```bash
npm run dev
# server → http://localhost:8787
# client → http://localhost:8000
```

Smoke test:

```bash
curl http://localhost:8787/api/health
node server/scripts/smoke.js   # runs end-to-end happy-path sanity checks
```

## 4. Deploy to Butterbase

See [`butterbase/deploy.md`](butterbase/deploy.md). Summary:

1. Deploy `server/` as a Butterbase serverless function group (routes mount at `/api/*`).
2. Deploy `client/dist` as a static site, passing `VITE_API_BASE=<functions-url>`.
3. Copy the deployed `/api/webhook/imessage` URL into the Photon Spectrum
   dashboard as the inbound-message webhook.

## 5. Demo script for judges (4 min)

1. Paste a real Zillow URL in Video Studio → watch it parse.
2. Click **Generate video** → a vertical MP4 renders with photo slideshow,
   burned-in captions, and AI voiceover.
3. Send a test iMessage to your Photon number ("Hi, is 123 Oak Ave still available?").
4. The pipeline moves the card New → Qualifying in real time. Open the thread,
   watch Claude ask about budget, pre-approval, timeline — one question at a time.
5. Say "I'd love to see it Saturday at 2pm" → Qualifying → Showing scheduled,
   a reminder is queued.
6. Mark the lead **Offer stage** → header pulses with a notification.

Prize coverage: Track 1 (AI Video Agents), Photon Spectrum, Cumulus Labs, Butterbase.

---

## Project layout

```
Realter Agent/
├── butterbase/
│   ├── schema.sql          # DDL for all tables
│   └── deploy.md           # Butterbase deploy steps
├── server/
│   ├── index.js            # Express entrypoint
│   ├── routes/             # /api/* endpoints
│   ├── services/           # butterbase, zillow, ionrouter, photon, claude, video, reminders
│   ├── prompts/            # Claude system prompts
│   └── scripts/smoke.js    # smoke test
└── client/
    ├── src/
    │   ├── App.jsx         # top-level shell
    │   ├── api.js          # fetch wrapper
    │   └── components/     # VideoStudio, LeadPipeline, LeadDrawer
    └── vite.config.js
```
