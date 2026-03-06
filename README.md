# Content Messenger

Daily content pills for your WhatsApp audience, powered by Ghost.org subscribers.

## What it does

- **Sync subscribers** from your Ghost.org newsletter
- **Create content pills** — text messages, photos, videos, or audio clips
- **Schedule delivery** for a specific date/time
- **Send via WhatsApp** Business Cloud API to all active subscribers
- **Auto-send daily** via CRON endpoint (9 AM UTC by default)

## Stack

- Next.js 14 (App Router) + TypeScript
- Prisma ORM with SQLite (swap to Postgres for production)
- Ghost Admin API for subscriber sync
- WhatsApp Business Cloud API for messaging
- NextAuth.js for admin authentication

## Setup

```bash
npm install
```

Edit `.env` with your credentials (see below).

### Environment variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | SQLite file path (default: `file:./dev.db`) |
| `GHOST_URL` | Your Ghost blog URL |
| `GHOST_CONTENT_API_KEY` | Ghost Content API key (26 hex chars) |
| `GHOST_ADMIN_API_KEY` | Ghost Admin API key (`id:secret` format) |
| `WHATSAPP_API_TOKEN` | Meta WhatsApp Business API token |
| `WHATSAPP_PHONE_NUMBER_ID` | Your WhatsApp phone number ID |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | Your WhatsApp Business account ID |
| `NEXTAUTH_SECRET` | Random secret for session encryption |
| `NEXTAUTH_URL` | App URL (e.g., `http://localhost:3000`) |
| `ADMIN_EMAIL` | Admin login email |
| `ADMIN_PASSWORD` | Admin login password |

### Run database migrations

```bash
npx prisma migrate dev
npx prisma generate
```

### Start development server

```bash
npm run dev
```

Visit `http://localhost:3000` — you'll be redirected to the admin dashboard (login required).

## Admin pages

- `/admin` — Dashboard with stats and recent pills
- `/admin/pills` — List all content pills, send manually
- `/admin/pills/new` — Create a new content pill (text, photo, video, audio)
- `/admin/subscribers` — View subscribers, sync from Ghost, manage phone numbers

## CRON / Scheduled delivery

The `/api/cron` endpoint sends all unsent pills whose `scheduledAt` is in the past.

- **Vercel**: Configured in `vercel.json` to run daily at 9 AM UTC
- **Self-hosted**: Call `GET /api/cron` with `Authorization: Bearer <NEXTAUTH_SECRET>`

## WhatsApp setup

1. Create a Meta Business account and WhatsApp Business app
2. Get your API token and phone number ID from the Meta Developer dashboard
3. Add subscriber phone numbers (international format, e.g., `+1234567890`)
4. Media URLs (for photo/video/audio pills) must be publicly accessible
