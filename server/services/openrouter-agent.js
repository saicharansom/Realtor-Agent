/**
 * OpenRouter Agent — EventEmitter-based agent following the OpenRouter skill pattern.
 *
 * Architecture (3 layers):
 *   1. Agent Core (this file)  — EventEmitter, message history, tool registry
 *   2. OpenRouter SDK          — unified access to 300+ models via @openrouter/sdk
 *   3. UI / Integration layer  — callers subscribe to events or use sendSync()
 *
 * Usage (HTTP server pattern):
 *   const sessions = new Map();
 *   app.post('/chat', async (req, res) => {
 *     let agent = sessions.get(req.body.sessionId) ?? createAgent();
 *     sessions.set(req.body.sessionId, agent);
 *     const reply = await agent.sendSync(req.body.message);
 *     res.json({ reply });
 *   });
 *
 * Env:
 *   OPENROUTER_API_KEY  — required
 *   OPENROUTER_MODEL    — default: anthropic/claude-3.5-haiku (fast + cheap)
 */

import EventEmitter from 'node:events';
import { OpenRouter } from '@openrouter/sdk';

const DEFAULT_MODEL = process.env.OPENROUTER_MODEL || 'anthropic/claude-3.5-haiku';

export function createAgent({
  apiKey = process.env.OPENROUTER_API_KEY,
  model = DEFAULT_MODEL,
  systemPrompt = null,
  appTitle = 'RealtorAI',
} = {}) {
  if (!apiKey) throw new Error('OPENROUTER_API_KEY not set');
  return new Agent({ apiKey, model, systemPrompt, appTitle });
}

export class Agent extends EventEmitter {
  #client;
  #model;
  #messages = [];
  #tools = new Map();
  #appTitle;

  constructor({ apiKey, model, systemPrompt, appTitle }) {
    super();
    this.#client = new OpenRouter({ apiKey });
    this.#model = model;
    this.#appTitle = appTitle;

    if (systemPrompt) {
      this.#messages.push({ role: 'system', content: systemPrompt });
    }
  }

  /** Add a tool the agent can call. tool = { name, description, parameters, execute } */
  addTool(tool) {
    this.#tools.set(tool.name, tool);
    return this;
  }

  /** Replace the full message history (e.g. to restore from DB). */
  setMessages(messages) {
    this.#messages = [...messages];
    return this;
  }

  /** Retrieve a copy of the current message history. */
  getMessages() {
    return [...this.#messages];
  }

  /**
   * Send a message and stream the response.
   * Emits: message:user, thinking:start, stream:delta, item:update, message:assistant, thinking:end, error
   * Returns the full assistant reply string.
   */
  async send(content) {
    const userMsg = { role: 'user', content };
    this.#messages.push(userMsg);
    this.emit('message:user', userMsg);
    this.emit('thinking:start');

    let fullReply = '';

    try {
      const tools = this.#buildToolDefs();
      const response = await this.#client.chat.send({
        appTitle: this.#appTitle,
        chatRequest: {
          model: this.#model,
          messages: this.#messages,
          stream: true,
          ...(tools.length ? { tools } : {}),
        },
      });

      // Items-based streaming: replace by ID, don't accumulate chunks
      const items = new Map();

      if (response && typeof response[Symbol.asyncIterator] === 'function') {
        for await (const event of response) {
          const item = event?.data ?? event;
          if (!item) continue;

          // Extract delta text
          const delta = item?.choices?.[0]?.delta?.content ?? '';
          if (delta) {
            fullReply += delta;
            this.emit('stream:delta', delta);

            // Track as an item by a stable ID
            const id = item?.id ?? 'msg-0';
            items.set(id, { id, type: 'message', content: fullReply });
            this.emit('item:update', items.get(id));
          }

          // Handle tool calls in stream
          const toolCall = item?.choices?.[0]?.delta?.tool_calls?.[0];
          if (toolCall?.function?.name) {
            const toolItem = {
              id: toolCall.id ?? `tc-${toolCall.index}`,
              type: 'function_call',
              name: toolCall.function.name,
              arguments: toolCall.function.arguments ?? '',
            };
            items.set(toolItem.id, toolItem);
            this.emit('item:update', toolItem);
          }
        }
      } else if (response?.choices?.[0]?.message?.content) {
        // Non-streaming fallback (shouldn't happen with stream:true)
        fullReply = response.choices[0].message.content;
        this.emit('stream:delta', fullReply);
      }

      // Handle tool execution if needed
      if (items.size > 0) {
        for (const [, item] of items) {
          if (item.type === 'function_call') {
            fullReply = await this.#executeTool(item, fullReply);
          }
        }
      }

    } catch (err) {
      this.emit('error', err);
      throw err;
    }

    const assistantMsg = { role: 'assistant', content: fullReply };
    this.#messages.push(assistantMsg);
    this.emit('message:assistant', assistantMsg);
    this.emit('thinking:end');

    return fullReply;
  }

  /**
   * Non-streaming variant — waits for full response, returns string.
   * Best for server-side use where you just need the reply.
   */
  async sendSync(content) {
    const userMsg = { role: 'user', content };
    this.#messages.push(userMsg);
    this.emit('message:user', userMsg);

    try {
      const tools = this.#buildToolDefs();
      const response = await this.#client.chat.send({
        appTitle: this.#appTitle,
        chatRequest: {
          model: this.#model,
          messages: this.#messages,
          stream: false,
          ...(tools.length ? { tools } : {}),
        },
      });

      const reply = response?.choices?.[0]?.message?.content ?? '';
      const assistantMsg = { role: 'assistant', content: reply };
      this.#messages.push(assistantMsg);
      this.emit('message:assistant', assistantMsg);
      return reply;
    } catch (err) {
      this.emit('error', err);
      throw err;
    }
  }

  // ── private ─────────────────────────────────────────────────────────────

  #buildToolDefs() {
    if (!this.#tools.size) return [];
    return [...this.#tools.values()].map(t => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters ?? { type: 'object', properties: {} },
      },
    }));
  }

  async #executeTool(toolCallItem, currentReply) {
    const tool = this.#tools.get(toolCallItem.name);
    if (!tool) return currentReply;

    let args = {};
    try { args = JSON.parse(toolCallItem.arguments || '{}'); } catch { /* ignore */ }

    this.emit('tool:call', { name: toolCallItem.name, arguments: args });
    let result;
    try {
      result = await tool.execute(args);
    } catch (e) {
      result = { error: e.message };
    }
    this.emit('tool:result', { name: toolCallItem.name, result });

    // Add tool result to history and get follow-up response
    this.#messages.push({
      role: 'tool',
      tool_call_id: toolCallItem.id,
      content: JSON.stringify(result),
    });

    return this.sendSync(''); // follow-up with tool result in context
  }
}
