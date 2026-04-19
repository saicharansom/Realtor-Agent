/**
 * OpenRouter Agent — EventEmitter-based agent following the OpenRouter skill pattern.
 *
 * Uses @openrouter/sdk with anthropic/claude-opus-4.7 for the chatbot.
 *
 * Architecture (3 layers):
 *   1. Agent Core (this file)  — EventEmitter, message history, tool registry
 *   2. OpenRouter SDK          — unified access to 300+ models via @openrouter/sdk
 *   3. Integration layer       — callers subscribe to events or use sendSync()
 *
 * HTTP server pattern (per-session agents):
 *   const sessions = new Map();
 *   app.post('/chat', async (req, res) => {
 *     let agent = sessions.get(req.body.sessionId) ?? createAgent();
 *     sessions.set(req.body.sessionId, agent);
 *     const reply = await agent.sendSync(req.body.message);
 *     res.json({ reply });
 *   });
 *
 * Env:
 *   OPENROUTER_API_KEY   — required (sk-or-v1-...)
 *   OPENROUTER_MODEL     — default: anthropic/claude-opus-4.7
 */

import EventEmitter from 'node:events';
import { OpenRouter } from '@openrouter/sdk';

const DEFAULT_MODEL = process.env.OPENROUTER_MODEL || 'anthropic/claude-opus-4.7';

export function createAgent({
  apiKey = process.env.OPENROUTER_API_KEY,
  model = DEFAULT_MODEL,
  systemPrompt = null,
} = {}) {
  if (!apiKey) throw new Error('OPENROUTER_API_KEY not set');
  return new Agent({ apiKey, model, systemPrompt });
}

export class Agent extends EventEmitter {
  #client;
  #model;
  #messages = [];
  #tools = new Map();

  constructor({ apiKey, model, systemPrompt }) {
    super();
    this.#client = new OpenRouter({ apiKey });
    this.#model = model;
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
   * Stream the response — exact pattern from OpenRouter docs.
   * Emits: message:user, stream:delta, item:update, message:assistant, thinking:end, error
   * Returns the full assistant reply string.
   */
  async send(content) {
    const userMsg = { role: 'user', content };
    this.#messages.push(userMsg);
    this.emit('message:user', userMsg);
    this.emit('thinking:start');

    let response = '';

    try {
      const stream = await this.#client.chat.send({
        model: this.#model,
        messages: this.#messages,
        stream: true,
        ...(this.#tools.size ? { tools: this.#buildToolDefs() } : {}),
      });

      for await (const chunk of stream) {
        const content = chunk.choices?.[0]?.delta?.content;
        if (content) {
          response += content;
          this.emit('stream:delta', content);
          this.emit('item:update', { id: chunk.id ?? 'msg-0', type: 'message', content: response });
        }

        // Usage info arrives in the final chunk
        if (chunk.usage) {
          this.emit('usage', {
            total: chunk.usage.totalTokens,
            reasoning: chunk.usage.reasoningTokens,
          });
        }

        // Tool calls
        const toolCall = chunk.choices?.[0]?.delta?.tool_calls?.[0];
        if (toolCall?.function?.name) {
          this.emit('tool:call', {
            id: toolCall.id,
            name: toolCall.function.name,
            arguments: toolCall.function.arguments ?? '',
          });
        }
      }
    } catch (err) {
      this.emit('error', err);
      throw err;
    }

    const assistantMsg = { role: 'assistant', content: response };
    this.#messages.push(assistantMsg);
    this.emit('message:assistant', assistantMsg);
    this.emit('thinking:end');

    return response;
  }

  /**
   * Non-streaming variant — waits for full response, returns string.
   * Used by lead-agent for server-side JSON responses.
   */
  async sendSync(content) {
    const userMsg = { role: 'user', content };
    this.#messages.push(userMsg);
    this.emit('message:user', userMsg);

    let response = '';

    try {
      // Use streaming even for sendSync to get reasoning tokens in usage
      const stream = await this.#client.chat.send({
        model: this.#model,
        messages: this.#messages,
        stream: true,
        ...(this.#tools.size ? { tools: this.#buildToolDefs() } : {}),
      });

      for await (const chunk of stream) {
        const delta = chunk.choices?.[0]?.delta?.content;
        if (delta) response += delta;

        if (chunk.usage) {
          console.log(`[openrouter] tokens — total: ${chunk.usage.totalTokens}, reasoning: ${chunk.usage.reasoningTokens ?? 0}`);
        }
      }
    } catch (err) {
      this.emit('error', err);
      throw err;
    }

    const assistantMsg = { role: 'assistant', content: response };
    this.#messages.push(assistantMsg);
    this.emit('message:assistant', assistantMsg);

    return response;
  }

  // ── private ─────────────────────────────────────────────────────────────

  #buildToolDefs() {
    return [...this.#tools.values()].map(t => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters ?? { type: 'object', properties: {} },
      },
    }));
  }
}
