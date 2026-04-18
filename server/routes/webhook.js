import { Router } from 'express';
import { handleInboundMessage } from '../services/message-handler.js';
import { normaliseInbound } from '../services/photon.js';

const r = Router();

/**
 * POST /api/webhook/imessage
 * Fallback HTTP webhook from Photon (used when SDK listener isn't running
 * or Photon is configured to push webhooks instead of streaming).
 */
r.post('/imessage', async (req, res, next) => {
  try {
    const { from, body, timestamp } = normaliseInbound(req.body);
    if (!from || !body) return res.status(400).json({ error: 'from + body required' });

    const { reply, lead_id, action } = await handleInboundMessage({ from, body, timestamp });
    res.json({ ok: true, lead_id, action, reply });
  } catch (e) { next(e); }
});

export default r;
