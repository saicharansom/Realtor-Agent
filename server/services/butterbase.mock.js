
export async function query(sql, params = []) {
  console.log('[butterbase.mock] query:', sql, params);
  return [];
}

export async function one(sql, params = []) {
  console.log('[butterbase.mock] one:', sql, params);
  return null;
}

export async function insert(table, obj) {
  console.log('[butterbase.mock] insert:', table, obj);
  return { ...obj, id: Date.now() };
}

export async function update(table, id, patch) {
  console.log('[butterbase.mock] update:', table, id, patch);
  return { ...patch, id };
}

export default { query, one, insert, update };
