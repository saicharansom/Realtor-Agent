# RealtorAI

One platform for real estate agents that (a) turns uploaded listing photos into a
scroll-stopping vertical video and (b) runs iMessage **and** web-chat conversations
with buyers, renters, and sellers autonomously until the lead is ready for the human.

```
┌─ Video Studio ──────────────┐     ┌─ Lead Agent ──────────────────┐     ┌─ Dashboard ──────┐
│ drag-drop up to 20 photos   │ →   │ iMessage  ·  web chat         │ →   │ pipeline + inbox │
│ optional prompt             │     │ qualify · send video          │     │ notifications    │
│ AI script + Seedance MP4    │     │ book showing · reminders      │     │                  │
└─────────────────────────────┘     └───────────────────────────────┘     └──────────────────┘
                                              ▲   ▼
                                   Photon Spectrum (iMessage)
                                   IonRouter / GLM-5 (text + vision + TTS)
                                   Seedance / ByteDance ARK (AI video)
                                   Butterbase (DB + file storage + hosting)
```

## Stack

| Layer | Technology |
|---|---|
| Frontend | React + Vite + Tailwind (`client/`) |
| Backend | Node.js + Express (`server/`) |
| Database & file storage | Butterbase |
| iMessage | Photon Spectrum (`spectrum-ts`) |
| AI text / vision / TTS | IonRouter — GLM-5 via OpenAI-compatible SDK |
| AI video generation | Seedance (ByteDance ARK API) |
| Video post-processing | ffmpeg |

---

## 1. First-time setup

```bash
npm install
npm --workspace server install
npm --workspace client install
cp .env.example .env   # then paste your keys
```

Required accounts:

| Service | Signup | `.env` key |
|---|---|---|
| Butterbase | dashboard.butterbase.ai | `BUTTERBASE_API_KEY`, `BUTTERBASE_APP_ID` |
| Photon Spectrum | dashboard.photonapp.ai | `PHOTON_PROJECT_ID`, `PHOTON_API_KEY` |
| IonRouter | ionrouter.io | `IONROUTER_API_KEY` |
| Seedance (ByteDance ARK) | ark.ap-southeast.bytepluses.com | `SEEDANCE_API_KEY` |

Optional env:

```
REALTOR_NAME=          # shown in agent messages (default: "the realtor")
REALTOR_CALENDAR_LINK= # appended when agent books a showing
PUBLIC_BASE_URL=       # base URL for /media/* video links in production
IONROUTER_TEXT_MODEL=  # default: glm-5
IONROUTER_VISION_MODEL=# default: glm-5
IONROUTER_TTS_MODEL=   # default: tts-1
IONROUTER_VIDEO_MODEL= # optional: enables Cumulus native video fallback
SEEDANCE_MODEL=        # default: dreamina-seedance-2-0-260128
DISABLE_CRON=1         # disable showing reminder cron (useful in dev)
```

## 2. Create the database

`butterbase/schema.sql` defines all tables (listings, leads, messages, showings).

From a Claude Code session with the Butterbase MCP registered:

> with butterbase, apply `butterbase/schema.sql` to my project

Or paste the SQL into the Butterbase dashboard SQL console.

## 3. Run locally

```bash
npm run dev
# server → http://localhost:8788
# client → http://localhost:8000
# buyer chat → http://localhost:8000/chat
```

Health check:

```bash
curl http://localhost:8788/api/health
```

## 4. How it works

### Video Studio

1. User drags and drops up to 20 listing photos (compressed client-side to max 1920px JPEG).
2. Images are uploaded to Butterbase file storage → public HTTPS URLs.
3. GLM-5 vision model looks at the photos and writes a punchy TikTok/Reels script: `{hook, beats[], cta}`.
4. **Seedance** (`dreamina-seedance-2-0-260128`) generates a 15-second 9:16 AI video using the images as reference frames.
5. ffmpeg burns the script text as timed overlays and mixes in an AI voiceover (IonRouter TTS).
6. Final MP4 is served from `/media/<id>.mp4`.

Fallback chain if Seedance is unavailable:
- Cumulus/IonRouter native video model (if `IONROUTER_VIDEO_MODEL` is set)
- ffmpeg photo slideshow with zoom-pan effect

The `/api/listings/parse` endpoint (Zillow URL scraping) is still available for
programmatic use but is no longer exposed in the Video Studio UI.

### Lead Agent (iMessage + Web Chat)

Both channels share the same `runLeadAgent` pipeline (GLM-5 via IonRouter):

**iMessage** — Photon Spectrum SDK connects at startup and streams every inbound
text to `handleInboundMessage`. The agent replies in-thread via `space.send`.
An HTTP webhook at `POST /api/webhook/imessage` serves as fallback when the SDK
isn't streaming.

**Web Chat** — `GET /chat` loads `BuyerChat.jsx`, a mobile-style chat UI.
Sessions are identified by a UUID stored in `localStorage`. Messages hit
`POST /api/chat`, which runs the same lead agent and persists everything to
the same `leads` / `messages` tables. A `?listing=<uuid>` query param links the
session to a specific listing.

**Agent stages:** `new → qualifying → interested → showing_scheduled → offer_stage → closed`
(or `disqualified` / `cold`)

For each inbound message the agent returns JSON:
```json
{
  "reply": "...",
  "new_status": "...",
  "contact_type": "buyer|renter|seller",
  "qualifying_data_updates": {},
  "notes": "...",
  "action": "none|send_listing|book_showing|handoff"
}
```

Qualifying questions asked one at a time per contact type:
- **Buyer:** budget, pre-approval, neighborhoods, timeline, must-haves
- **Renter:** monthly budget, move-in date, bedrooms, pets, lease length
- **Seller:** property address, reason for selling, timeline, agent status

### Showing reminders

A cron job runs every 5 minutes and sends iMessage reminders at **24 hours** and
**1 hour** before each scheduled showing. Each threshold fires once
(`reminder_24h_sent` / `reminder_1h_sent` flags).

### Dashboard

- **Lead pipeline** — Kanban columns for each status, auto-refreshes every 10 s.
- **Lead drawer** — opens on click; shows conversation thread, qualifying data, manual reply box, status change.
- **Offer notification** — pulsing button in the header when any lead reaches `offer_stage`.

## 5. Deploy to Butterbase

See [`butterbase/deploy.md`](butterbase/deploy.md). Summary:

1. Deploy `server/` as a Butterbase serverless function group (routes mount at `/api/*`).
2. Deploy `client/dist` as a static site, passing `VITE_API_BASE=<functions-url>`.
3. Copy the deployed `/api/webhook/imessage` URL into the Photon Spectrum dashboard as the inbound-message webhook.

## 6. API reference

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/health` | Liveness check |
| `POST` | `/api/listings/parse` | Scrape a Zillow URL, save listing |
| `GET` | `/api/listings` | List recent listings |
| `GET` | `/api/listings/:id` | Get one listing |
| `POST` | `/api/listings/:id/generate-video` | Generate video from saved listing photos |
| `POST` | `/api/listings/generate-from-images` | Generate video from uploaded base64 images |
| `GET` | `/api/leads` | List leads with last message + listing snapshot |
| `GET` | `/api/leads/:id` | Get one lead |
| `GET` | `/api/leads/:id/thread` | Full message thread |
| `PATCH` | `/api/leads/:id/status` | Update lead status |
| `POST` | `/api/leads/:id/message` | Realtor manual reply (sends iMessage) |
| `POST` | `/api/leads` | Create lead manually |
| `POST` | `/api/chat` | Web chat message (upserts lead, runs agent) |
| `GET` | `/api/chat/:session_id/thread` | Web chat history |
| `GET` | `/api/showings` | List showings |
| `POST` | `/api/showings` | Book a showing (bumps lead to `showing_scheduled`) |
| `PATCH` | `/api/showings/:id` | Update showing status |
| `POST` | `/api/webhook/imessage` | Photon HTTP webhook fallback |

## 7. Project layout

```
Realter Agent/
├── butterbase/
│   ├── schema.sql              # DDL — listings, leads, messages, showings
│   └── deploy.md               # Butterbase deploy steps
├── server/
│   ├── index.js                # Express entrypoint + Spectrum + cron startup
│   ├── env.js                  # dotenv loader
│   ├── routes/
│   │   ├── listings.js         # /api/listings — parse + video generation
│   │   ├── leads.js            # /api/leads — CRUD + manual reply
│   │   ├── showings.js         # /api/showings — book + status
│   │   ├── chat.js             # /api/chat — web chat sessions
│   │   └── webhook.js          # /api/webhook/imessage — HTTP fallback
│   ├── services/
│   │   ├── butterbase.js       # SQL-over-HTTP client
│   │   ├── butterbase-storage.js # File upload → presigned URLs
│   │   ├── ionrouter.js        # GLM-5: script gen, vision, TTS, Cumulus video
│   │   ├── seedance.js         # ByteDance ARK: text/image/multi-image → video
│   │   ├── video.js            # ffmpeg: slideshow assembly + text overlay
│   │   ├── zillow.js           # Zillow HTML scraper (cheerio + __NEXT_DATA__)
│   │   ├── photon.js           # Photon Spectrum SDK wrapper
│   │   ├── lead-agent.js       # GLM-5 lead qualification agent
│   │   ├── message-handler.js  # Shared inbound message handler (iMessage + webhook)
│   │   └── reminders.js        # node-cron showing reminder job
│   └── prompts/
│       └── imessage-agent.js   # System prompt for the lead agent
└── client/
    ├── src/
    │   ├── App.jsx             # Realtor dashboard shell
    │   ├── api.js              # Fetch wrapper for all API calls
    │   ├── components/
    │   │   ├── VideoStudio.jsx # Image upload + video generation UI
    │   │   ├── LeadPipeline.jsx# Kanban pipeline
    │   │   └── LeadDrawer.jsx  # Lead detail + thread + reply
    │   └── pages/
    │       └── BuyerChat.jsx   # Buyer-facing web chat UI (/chat)
    └── vite.config.js
```
