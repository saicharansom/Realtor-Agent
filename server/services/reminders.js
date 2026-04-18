import cron from 'node-cron';
import bb from './butterbase.js';
import { sendIMessage } from './photon.js';

/**
 * Scheduled reminders for showings.
 * Runs every 5 minutes, finds showings that cross the 24h/1h thresholds,
 * sends iMessage, and flips the reminder_*_sent flag so we don't re-send.
 */
export function startReminderCron() {
  if (process.env.DISABLE_CRON === '1') return;
  cron.schedule('*/5 * * * *', tick);
  console.log('[cron] reminder job scheduled every 5 minutes');
}

async function tick() {
  try {
    // 24h reminders
    const due24 = await bb.query(`
      SELECT s.*, l.phone, l.name, li.address
      FROM showings s
      JOIN leads l ON l.id = s.lead_id
      JOIN listings li ON li.id = s.listing_id
      WHERE s.status = 'scheduled'
        AND s.reminder_24h_sent = false
        AND s.scheduled_at BETWEEN now() + interval '23 hours'
                              AND now() + interval '25 hours'
    `);
    for (const s of due24) {
      const when = new Date(s.scheduled_at);
      await sendIMessage({
        to: s.phone,
        body: `Hi ${s.name || 'there'}! Friendly reminder — showing at ${s.address} tomorrow at ${fmtTime(when)}. Reply here if anything changes.`,
      });
      await bb.update('showings', s.id, { reminder_24h_sent: true });
    }

    // 1h reminders
    const due1 = await bb.query(`
      SELECT s.*, l.phone, l.name, li.address
      FROM showings s
      JOIN leads l ON l.id = s.lead_id
      JOIN listings li ON li.id = s.listing_id
      WHERE s.status = 'scheduled'
        AND s.reminder_1h_sent = false
        AND s.scheduled_at BETWEEN now() + interval '50 minutes'
                              AND now() + interval '70 minutes'
    `);
    for (const s of due1) {
      await sendIMessage({
        to: s.phone,
        body: `Heads up — your showing at ${s.address} is in about an hour. See you there!`,
      });
      await bb.update('showings', s.id, { reminder_1h_sent: true });
    }
  } catch (e) {
    console.warn('[cron] tick failed', e.message);
  }
}

function fmtTime(d) {
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}
