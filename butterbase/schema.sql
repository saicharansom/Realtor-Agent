-- RealtorAI schema for Butterbase (Postgres-compatible)
-- Run this in the Butterbase SQL console or via the MCP:
--   "with butterbase, apply this schema.sql to my project"

-- ========= ENUMS =========
DO $$ BEGIN
  CREATE TYPE contact_type AS ENUM ('buyer', 'renter', 'seller');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE lead_status AS ENUM (
    'new',
    'qualifying',
    'interested',
    'showing_scheduled',
    'offer_stage',
    'closed',
    'disqualified',
    'cold'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE message_direction AS ENUM ('inbound', 'outbound');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE message_sender AS ENUM ('agent', 'realtor', 'lead');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE showing_status AS ENUM ('scheduled', 'completed', 'no_show', 'cancelled');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ========= listings =========
CREATE TABLE IF NOT EXISTS listings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zillow_url      TEXT NOT NULL,
  address         TEXT,
  price           INTEGER,
  beds            INTEGER,
  baths           NUMERIC(3,1),
  sqft            INTEGER,
  photos          JSONB NOT NULL DEFAULT '[]'::jsonb,
  description     TEXT,
  video_url       TEXT,
  script          TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_listings_created ON listings (created_at DESC);

-- ========= leads =========
CREATE TABLE IF NOT EXISTS leads (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT,
  phone           TEXT NOT NULL,
  contact_type    contact_type,
  status          lead_status NOT NULL DEFAULT 'new',
  listing_id      UUID REFERENCES listings(id) ON DELETE SET NULL,
  notes           TEXT,
  qualifying_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_phone ON leads (phone);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads (status);
CREATE INDEX IF NOT EXISTS idx_leads_updated ON leads (updated_at DESC);

-- ========= messages =========
CREATE TABLE IF NOT EXISTS messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id         UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  direction       message_direction NOT NULL,
  body            TEXT NOT NULL,
  sent_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  sender          message_sender NOT NULL DEFAULT 'agent'
);

CREATE INDEX IF NOT EXISTS idx_messages_lead_time ON messages (lead_id, sent_at DESC);

-- ========= showings =========
CREATE TABLE IF NOT EXISTS showings (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id            UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  listing_id         UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  scheduled_at       TIMESTAMPTZ NOT NULL,
  status             showing_status NOT NULL DEFAULT 'scheduled',
  reminder_24h_sent  BOOLEAN NOT NULL DEFAULT false,
  reminder_1h_sent   BOOLEAN NOT NULL DEFAULT false,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_showings_time ON showings (scheduled_at);

-- ========= trigger: keep leads.updated_at fresh =========
CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_leads_touch ON leads;
CREATE TRIGGER trg_leads_touch
  BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
