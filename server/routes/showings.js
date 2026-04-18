import { Router } from 'express';
import bb from '../services/butterbase.js';

const r = Router();

/** POST /api/showings  { lead_id, listing_id, scheduled_at (ISO) } */
r.post('/', async (req, res, next) => {
  try {
    const { lead_id, listing_id, scheduled_at } = req.body;
    if (!lead_id || !listing_id || !scheduled_at) {
      return res.status(400).json({ error: 'lead_id, listing_id, scheduled_at required' });
    }
    const row = await bb.insert('showings', {
      lead_id, listing_id,
      scheduled_at: new Date(scheduled_at).toISOString(),
      status: 'scheduled',
    });
    // bump lead status
    await bb.update('leads', lead_id, { status: 'showing_scheduled' });
    res.json(row);
  } catch (e) { next(e); }
});

/** GET /api/showings */
r.get('/', async (_req, res, next) => {
  try {
    const rows = await bb.query(`
      SELECT s.*, l.name as lead_name, l.phone, li.address
      FROM showings s
      JOIN leads l ON l.id = s.lead_id
      JOIN listings li ON li.id = s.listing_id
      ORDER BY s.scheduled_at ASC
      LIMIT 200;
    `);
    res.json(rows);
  } catch (e) { next(e); }
});

/** PATCH /api/showings/:id  { status } */
r.patch('/:id', async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['scheduled', 'completed', 'no_show', 'cancelled'].includes(status)) {
      return res.status(400).json({ error: 'bad status' });
    }
    const updated = await bb.update('showings', req.params.id, { status });
    res.json(updated);
  } catch (e) { next(e); }
});

export default r;
