/**
 * Shared inbound message handler.
 * Used by both the Spectrum SDK listener and the HTTP webhook fallback.
 */
import bb from './butterbase.js';
import { runLeadAgent } from './lead-agent.js';
import { replyToSpace, sendIMessage } from './photon.js';

const VALID_STATUSES = new Set([
  'new', 'qualifying', 'interested', 'showing_scheduled',
  'offer_stage', 'closed', 'disqualified', 'cold',
]);

/**
 * Process an inbound iMessage and send an AI reply.
 *
 * @param {{ from: string, body: string, timestamp?: number|string, space?: object }} opts
 *   space — Spectrum Space object (present when called from SDK listener, absent from webhook)
 * @returns {{ reply: string, lead_id: string, action: string }}
 */
export async function handleInboundMessage({ from, body, timestamp, space }) {
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
    sent_at: timestamp ? new Date(timestamp).toISOString() : new Date().toISOString(),
    sender: 'lead',
  });

  // 3. Load history + listing
  const history = await bb.query(
    `SELECT direction, body, sent_at FROM messages
     WHERE lead_id=$1 ORDER BY sent_at ASC LIMIT 40`,
    [lead.id]
  );
  const listing = lead.listing_id
    ? await bb.one(`SELECT * FROM listings WHERE id=$1`, [lead.listing_id])
    : null;

  // 4. Run AI agent
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

  // 6. Build reply
  let reply = ai.reply?.trim() || "Thanks for your message — I'll circle back shortly!";
  if (ai.action === 'send_listing' && listing?.video_url) {
    reply = `${reply}\n\n${listing.address} — ${listing.video_url}`;
  }
  if (ai.action === 'book_showing' && process.env.REALTOR_CALENDAR_LINK) {
    reply = `${reply}\n\nPick a time here: ${process.env.REALTOR_CALENDAR_LINK}`;
  }

  // 7. Send reply — prefer space.send (SDK), fall back to REST
  if (reply) {
    if (space) {
      await replyToSpace(space, reply);
    } else {
      await sendIMessage({ to: from, body: reply });
    }
    await bb.insert('messages', {
      lead_id: lead.id,
      direction: 'outbound',
      body: reply,
      sender: 'agent',
    });
  }

  return { reply, lead_id: lead.id, action: ai.action };
}
