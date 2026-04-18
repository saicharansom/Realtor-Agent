/**
 * Thin REST client over Butterbase's SQL/query endpoints.
 *
 * Butterbase exposes a SQL-over-HTTP surface at
 * ${BUTTERBASE_BASE_URL}/v1/query. This module wraps two helpers:
 *   - bb.query(sql, params)  → rows
 *   - bb.one(sql, params)    → first row or null
 *
 * The exact path may shift — if Butterbase's live API differs, only this
 * file needs to change.
 */
async function call(path, body) {
  const KEY = process.env.BUTTERBASE_API_KEY;
  const BASE = process.env.BUTTERBASE_BASE_URL || 'https://api.butterbase.ai';
  if (!KEY) throw new Error('BUTTERBASE_API_KEY missing');
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${KEY}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw Object.assign(new Error(`butterbase ${res.status}`), {
      status: res.status,
      details: text,
    });
  }
  return res.json();
}

export async function query(sql, params = []) {
  const out = await call('/v1/query', { sql, params });
  // Butterbase returns { rows: [...] }
  return out.rows || out.data || out;
}

export async function one(sql, params = []) {
  const rows = await query(sql, params);
  return rows[0] || null;
}

export async function insert(table, obj) {
  const cols = Object.keys(obj);
  const placeholders = cols.map((_, i) => `$${i + 1}`);
  const values = Object.values(obj);
  const sql = `INSERT INTO ${table} (${cols.join(',')}) VALUES (${placeholders.join(',')}) RETURNING *`;
  return one(sql, values);
}

export async function update(table, id, patch) {
  const cols = Object.keys(patch);
  if (!cols.length) return one(`SELECT * FROM ${table} WHERE id=$1`, [id]);
  const sets = cols.map((c, i) => `${c}=$${i + 2}`).join(',');
  const values = [id, ...Object.values(patch)];
  return one(`UPDATE ${table} SET ${sets} WHERE id=$1 RETURNING *`, values);
}

export default { query, one, insert, update };
