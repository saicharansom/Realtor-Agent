/**
 * iMessage lead agent — qualifies buyers/renters/sellers over text.
 * Powered by Cumulus Labs / IonRouter (GLM-5 via OpenAI-compatible API).
 */
import OpenAI from 'openai';
import { SYSTEM_PROMPT } from '../prompts/imessage-agent.js';

const BASE = process.env.IONROUTER_BASE_URL || 'https://glm.ionrouter.io/v1';
const KEY = process.env.IONROUTER_API_KEY;
const MODEL = process.env.IONROUTER_TEXT_MODEL || 'glm-5';

let client = null;
if (KEY) client = new OpenAI({ apiKey: KEY, baseURL: BASE });

/**
 * Call the lead-qualification agent.
 * Returns { reply, new_status, contact_type, qualifying_data_updates, notes, action }.
 */
export async function runLeadAgent({ lead, listing, history, incoming }) {
  if (!client) throw new Error('IONROUTER_API_KEY missing');

  const context = {
    realtor_name: process.env.REALTOR_NAME || 'the realtor',
    calendar_link: process.env.REALTOR_CALENDAR_LINK || null,
    lead: {
      name: lead.name,
      phone: lead.phone,
      contact_type: lead.contact_type,
      status: lead.status,
      qualifying_data: lead.qualifying_data || {},
    },
    listing: listing
      ? {
          address: listing.address,
          price: listing.price,
          beds: listing.beds,
          baths: listing.baths,
          sqft: listing.sqft,
          video_url: listing.video_url,
        }
      : null,
  };

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT({ realtorName: context.realtor_name }) },
  ];
  for (const m of history) {
    messages.push({
      role: m.direction === 'inbound' ? 'user' : 'assistant',
      content: m.body,
    });
  }
  messages.push({
    role: 'user',
    content:
      `CONTEXT:\n${JSON.stringify(context, null, 2)}\n\n` +
      `LATEST INBOUND MESSAGE:\n${incoming}\n\n` +
      `Respond with ONLY the JSON object defined in the system prompt.`,
  });

  const out = await client.chat.completions.create({
    model: MODEL,
    messages,
    temperature: 0.6,
    top_p: 0.9,
    max_tokens: 600,
  });
  const text = out.choices?.[0]?.message?.content || '';
  return parseJsonLoose(text);
}

function parseJsonLoose(text) {
  const stripped = text
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim();
  try { return JSON.parse(stripped); } catch { /* try harder */ }
  const m = stripped.match(/\{[\s\S]*\}/);
  if (m) try { return JSON.parse(m[0]); } catch { /* fall through */ }
  return {
    reply: "Thanks for your message — I'll circle back shortly!",
    new_status: 'qualifying',
    contact_type: null,
    qualifying_data_updates: {},
    notes: 'glm parse failure',
    action: 'none',
  };
}
