import { Router } from 'express';
import bb from '../services/butterbase.js';
import { sendIMessage } from '../services/photon.js';

const r = Router();

const VALID_STATUSES = new Set([
  'new', 'qualifying', 'interested', 'showing_scheduled',
  'offer_stage', 'closed', 'disqualified', 'cold',
]);

/** GET /api/leads */
r.get('/', async (_req, res, next) => {
  try {
    const rows = await bb.query(`
      SELECT l.*,
        (SELECT json_build_object(
            'body', m.body,
            'direction', m.direction,
            'sent_at', m.sent_at
         )
         FROM messages m
         WHERE m.lead_id = l.id
         ORDER BY m.sent_at DESC LIMIT 1) AS last_message,
        (SELECT json_build_object(
            'id', li.id, 'address', li.address, 'price', li.price,
            'video_url', li.video_url)
         FROM listings li WHERE li.id = l.listing_id) AS listing
      FROM leads l
      ORDER BY l.updated_at DESC
      LIMIT 200;
    `);
    res.json(rows);
  } catch (e) { next(e); }
});

/** GET /api/leads/:id */
r.get('/:id', async (req, res, next) => {
  try {
    const row = await bb.one(`SELECT * FROM leads WHERE id=$1`, [req.params.id]);
    if (!row) return res.status(404).json({ error: 'not found' });
    res.json(row);
  } catch (e) { next(e); }
});

/** GET /api/leads/:id/thread */
r.get('/:id/thread', async (req, res, next) => {
  try {
    const rows = await bb.query(
      `SELECT * FROM messages WHERE lead_id=$1 ORDER BY sent_at ASC`,
      [req.params.id]
    );
    res.json(rows);
  } catch (e) { next(e); }
});

/** PATCH /api/leads/:id/status  { status } */
r.patch('/:id/status', async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!VALID_STATUSES.has(status)) return res.status(400).json({ error: 'bad status' });
    const updated = await bb.update('leads', req.params.id, { status });
    res.json(updated);
  } catch (e) { next(e); }
});

/** POST /api/leads/:id/message  { body }  — realtor manual reply */
r.post('/:id/message', async (req, res, next) => {
  try {
    const lead = await bb.one(`SELECT * FROM leads WHERE id=$1`, [req.params.id]);
    if (!lead) return res.status(404).json({ error: 'not found' });
    const { body } = req.body;
    if (!body) return res.status(400).json({ error: 'body required' });

    await sendIMessage({ to: lead.phone, body });
    const msg = await bb.insert('messages', {
      lead_id: lead.id,
      direction: 'outbound',
      body,
      sender: 'realtor',
    });
    res.json(msg);
  } catch (e) { next(e); }
});

/** POST /api/leads  { phone, name?, contact_type?, listing_id? } */
r.post('/', async (req, res, next) => {
  try {
    const { phone, name, contact_type, listing_id } = req.body;
    if (!phone) return res.status(400).json({ error: 'phone required' });
    const row = await bb.insert('leads', {
      phone, name, contact_type, listing_id,
      status: 'new',
      qualifying_data: '{}',
    });
    res.json(row);
  } catch (e) { next(e); }
});

export default r;
