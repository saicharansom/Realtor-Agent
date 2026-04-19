/**
 * iMessage lead agent — qualifies buyers/renters/sellers over text.
 * Primary: OpenRouter (via @openrouter/sdk, OPENROUTER_API_KEY)
 * Fallback: IonRouter / GLM-5 (IONROUTER_API_KEY)
 */
import OpenAI from 'openai';
import { createAgent } from './openrouter-agent.js';
import { SYSTEM_PROMPT } from '../prompts/imessage-agent.js';

const BASE = process.env.IONROUTER_BASE_URL || 'https://glm.ionrouter.io/v1';
const IONROUTER_KEY = process.env.IONROUTER_API_KEY;
const IONROUTER_MODEL = process.env.IONROUTER_TEXT_MODEL || 'glm-5';

let ionClient = null;
if (IONROUTER_KEY) ionClient = new OpenAI({ apiKey: IONROUTER_KEY, baseURL: BASE });

/**
 * Call the lead-qualification agent.
 * Returns { reply, new_status, contact_type, qualifying_data_updates, notes, action }.
 */
export async function runLeadAgent({ lead, listing, history, incoming }) {
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

  const systemContent = SYSTEM_PROMPT({ realtorName: context.realtor_name });
  const userContent =
    `CONTEXT:\n${JSON.stringify(context, null, 2)}\n\n` +
    `LATEST INBOUND MESSAGE:\n${incoming}\n\n` +
    `Respond with ONLY the JSON object defined in the system prompt.`;

  // Build history messages
  const historyMsgs = history.map(m => ({
    role: m.direction === 'inbound' ? 'user' : 'assistant',
    content: m.body,
  }));

  // ── Primary: OpenRouter ──────────────────────────────────────────────────
  if (process.env.OPENROUTER_API_KEY) {
    try {
      const agent = createAgent({ systemPrompt: systemContent });
      agent.setMessages([
        { role: 'system', content: systemContent },
        ...historyMsgs,
      ]);
      const text = await agent.sendSync(userContent);
      return parseJsonLoose(text);
    } catch (e) {
      console.warn('[lead-agent] OpenRouter failed, falling back to IonRouter:', e.message);
    }
  }

  // ── Fallback: IonRouter / GLM-5 ─────────────────────────────────────────
  if (!ionClient) throw new Error('No AI provider configured (set OPENROUTER_API_KEY or IONROUTER_API_KEY)');

  const messages = [
    { role: 'system', content: systemContent },
    ...historyMsgs,
    { role: 'user', content: userContent },
  ];

  const out = await ionClient.chat.completions.create({
    model: IONROUTER_MODEL,
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
