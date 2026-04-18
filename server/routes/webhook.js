import { Router } from 'express';
import bb from '../services/butterbase.js';
import { runLeadAgent } from '../services/lead-agent.js';
import { sendIMessage, normaliseInbound } from '../services/photon.js';

const r = Router();

const VALID_STATUSES = new Set([
  'new', 'qualifying', 'interested', 'showing_scheduled',
  'offer_stage', 'closed', 'disqualified', 'cold',
]);

/** POST /api/webhook/imessage — Photon Spectrum inbound */
r.post('/imessage', async (req, res, next) => {
  try {
    const { from, body, timestamp } = normaliseInbound(req.body);
    if (!from || !body) {
      return res.status(400).json({ error: 'from + body required' });
    }

    // 1. Upsert lead by phone
    let lead = await bb.one(`SELECT * FROM leads WHERE phone=$1`, [from]);
    if (!lead) {
      lead = await bb.insert('leads', {
        phone: from,
        status: 'new',
        qualifying_data: '{}',
      });
    }

    // 2. Log inbound
    await bb.insert('messages', {
      lead_id: lead.id,
      direction: 'inbound',
      body,
      sent_at: new Date(timestamp).toISOString(),
      sender: 'lead',
    });

    // 3. Load history + listing context
    const history = await bb.query(
      `SELECT direction, body, sent_at FROM messages
       WHERE lead_id=$1 ORDER BY sent_at ASC LIMIT 40`,
      [lead.id]
    );
    const listing = lead.listing_id
      ? await bb.one(`SELECT * FROM listings WHERE id=$1`, [lead.listing_id])
      : null;

    // 4. Ask Claude
    const ai = await runLeadAgent({ lead, listing, history, incoming: body });

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

    // 6. Send outbound
    let reply = ai.reply?.trim();
    if (ai.action === 'send_listing' && listing?.video_url) {
      reply = `${reply}\n\n${listing.address} — ${listing.video_url}`;
    }
    if (ai.action === 'book_showing' && process.env.REALTOR_CALENDAR_LINK) {
      reply = `${reply}\n\nPick a time here: ${process.env.REALTOR_CALENDAR_LINK}`;
    }
    if (reply) {
      await sendIMessage({ to: from, body: reply });
      await bb.insert('messages', {
        lead_id: lead.id,
        direction: 'outbound',
        body: reply,
        sender: 'agent',
      });
    }

    res.json({ ok: true, lead_id: lead.id, action: ai.action, reply });
  } catch (e) { next(e); }
});

export default r;
