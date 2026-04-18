import 'dotenv/config';
import express from 'express';
import cors from 'cors';

import listings from './routes/listings.js';
import leads from './routes/leads.js';
import showings from './routes/showings.js';
import webhook from './routes/webhook.js';
import { startReminderCron } from './services/reminders.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// static serving of generated videos (dev convenience)
app.use('/media', express.static('out'));

app.get('/api/health', (_req, res) => res.json({ ok: true, ts: Date.now() }));

app.use('/api/listings', listings);
app.use('/api/leads', leads);
app.use('/api/showings', showings);
app.use('/api/webhook', webhook);

// Error handler
app.use((err, _req, res, _next) => {
  console.error('[api error]', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal error',
    details: err.details,
  });
});

const port = Number(process.env.PORT || 8787);
app.listen(port, () => {
  console.log(`realtor-ai server listening on :${port}`);
  startReminderCron();
});
