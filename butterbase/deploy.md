# Butterbase deployment

You've already added the Butterbase MCP in Claude Code:

```
claude mcp add butterbase https://api.butterbase.ai/mcp \
  --transport http --scope user \
  --header "Authorization: Bearer bb_sk_2e6eb839bcd06fa05298b82d0a4c82d2cfd5cd6c"
```

## 1. Apply schema

From a Claude Code session at this project root, say:

> with butterbase, apply `butterbase/schema.sql` to my project

Or paste the contents of `schema.sql` into the SQL console at
[dashboard.butterbase.ai](https://dashboard.butterbase.ai).

## 2. Deploy serverless functions

Each file in `server/routes/*.js` is intended to map to a Butterbase function.
From Claude Code:

> with butterbase, deploy the Express app in `server/` as a serverless function group and expose the routes under `/api/*`

## 3. Deploy the frontend

> with butterbase, build `client/` with `npm run build` and deploy `client/dist` as static site hosting.
> Wire `VITE_API_BASE` at build time to the functions URL.

## 4. Webhook URL

After deploy, grab the public `/api/webhook/imessage` URL and paste it into the
Photon Spectrum dashboard as the inbound-message webhook for your phone number.
