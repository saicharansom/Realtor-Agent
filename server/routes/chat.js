import { Router } from 'express';
import bb from '../services/butterbase.js';
import { runLeadAgent } from '../services/lead-agent.js';

const r = Router();

const VALID_STATUSES = new Set([
  'new', 'qualifying', 'interested', 'showing_scheduled',
  'offer_stage', 'closed', 'disqualified', 'cold',
]);

/**
 * POST /api/chat
 * Body: { session_id, message, name?, listing_id? }
 * Used by the buyer-facing chat page (web sessions, not iMessage).
 * session_id is a UUID generated in the browser and stored in localStorage.
 * We store it as `phone = web-<session_id>` so it maps to a unique lead row.
 */
r.post('/', async (req, res, next) => {
  try {
    const { session_id, message, name, listing_id } = req.body;
    if (!session_id || !message) {
      return res.status(400).json({ error: 'session_id and message required' });
    }

    const phone = `web-${session_id}`;

    // 1. Upsert lead by web session phone
    let lead = await bb.one(`SELECT * FROM leads WHERE phone=$1`, [phone]);
    if (!lead) {
      lead = await bb.insert('leads', {
        phone,
        name: name || null,
        status: 'new',
        qualifying_data: '{}',
        listing_id: listing_id || null,
      });
    } else if (name && !lead.name) {
      lead = await bb.update('leads', lead.id, { name });
    }

    // 2. Log inbound message
    await bb.insert('messages', {
      lead_id: lead.id,
      direction: 'inbound',
      body: message,
      sent_at: new Date().toISOString(),
      sender: 'lead',
    });

    // 3. Load history + listing context
    const history = await bb.query(
      `SELECT direction, body, sent_at FROM messages
       WHERE lead_id=$1 ORDER BY sent_at ASC LIMIT 40`,
      [lead.id]
    );
    const listing = (listing_id || lead.listing_id)
      ? await bb.one(`SELECT * FROM listings WHERE id=$1`, [listing_id || lead.listing_id])
      : null;

    // 4. Run AI agent
    const ai = await runLeadAgent({ lead, listing, history, incoming: message });

    // 5. Persist updates
    const patch = {};
    if (ai.new_status && VALID_STATUSES.has(ai.new_status)) patch.status = ai.new_status;
    if (ai.contact_type && ['buyer', 'renter', 'seller'].includes(ai.contact_type)) {
      patch.contact_type = ai.contact_type;
    }
    if (ai.qualifying_data_updates && Object.keys(ai.qualifying_data_updates).length) {
      const merged = { ...(lead.qualifying_data || {}), ...ai.qualifying_data_updates };
      patch.qualifying_data = JSON.stringify(merged);
    }
    if (ai.notes) patch.notes = ai.notes;
    if (Object.keys(patch).length) await bb.update('leads', lead.id, patch);

    // 6. Log outbound reply
    const reply = ai.reply?.trim() || "Thanks for reaching out — I'll be in touch shortly!";
    await bb.insert('messages', {
      lead_id: lead.id,
      direction: 'outbound',
      body: reply,
      sender: 'agent',
    });

    res.json({ reply, lead_id: lead.id });
  } catch (e) { next(e); }
});

/**
 * GET /api/chat/:session_id/thread
 * Returns the chat history for a web session.
 */
r.get('/:session_id/thread', async (req, res, next) => {
  try {
    const phone = `web-${req.params.session_id}`;
    const lead = await bb.one(`SELECT id FROM leads WHERE phone=$1`, [phone]);
    if (!lead) return res.json([]);

    const thread = await bb.query(
      `SELECT direction, body, sent_at, sender FROM messages
       WHERE lead_id=$1 ORDER BY sent_at ASC`,
      [lead.id]
    );
    res.json(thread);
  } catch (e) { next(e); }
});

export default r;
