/**
 * Butterbase file storage — upload images and get public download URLs.
 *
 * Flow per image:
 *   1. POST /storage/{app_id}/upload  → { uploadUrl, objectId }
 *   2. PUT  uploadUrl  (binary buffer, no auth header)
 *   3. GET  /storage/{app_id}/download/{objectId}  → { downloadUrl }
 *
 * publicReadEnabled is ON for app_0aga3lydyw9r, so download URLs are
 * accessible by anyone (including Seedance's servers).
 * Download URLs are valid for 1 hour — sufficient for Seedance processing.
 *
 * Env (read at call time to avoid ESM hoisting issues):
 *   BUTTERBASE_API_KEY
 *   BUTTERBASE_BASE_URL   default: https://api.butterbase.ai
 *   BUTTERBASE_APP_ID     default: app_0aga3lydyw9r
 */

const MAX_IMAGES = 20;

function cfg() {
  return {
    key   : process.env.BUTTERBASE_API_KEY,
    base  : process.env.BUTTERBASE_BASE_URL || 'https://api.butterbase.ai',
    appId : process.env.BUTTERBASE_APP_ID   || 'app_0aga3lydyw9r',
  };
}

/**
 * Upload a single base64 data URL to Butterbase storage.
 * Returns a presigned download URL valid for ~1 hour.
 *
 * @param {string} dataUrl  — e.g. "data:image/jpeg;base64,/9j/..."
 * @param {string} filename — e.g. "img0.jpg"
 * @returns {Promise<string>} public download URL
 */
export async function uploadImage(dataUrl, filename) {
  const { key, base, appId } = cfg();
  if (!key) throw new Error('BUTTERBASE_API_KEY not set');

  // Parse data URL
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/s);
  if (!match) throw new Error(`uploadImage: not a base64 data URL (filename=${filename})`);
  const [, contentType, b64] = match;
  const buffer = Buffer.from(b64, 'base64');

  const authHeader = `Bearer ${key}`;

  // 1. Request presigned upload URL
  const uploadRes = await fetch(`${base}/storage/${appId}/upload`, {
    method : 'POST',
    headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
    body   : JSON.stringify({ filename, contentType, sizeBytes: buffer.byteLength }),
  });
  if (!uploadRes.ok) {
    const txt = await uploadRes.text().catch(() => '');
    throw new Error(`Butterbase upload-url ${uploadRes.status}: ${txt.slice(0, 300)}`);
  }
  const { uploadUrl, objectId } = await uploadRes.json();

  // 2. PUT file to presigned URL (no Authorization header for S3 presigned PUTs)
  const putRes = await fetch(uploadUrl, {
    method : 'PUT',
    headers: { 'Content-Type': contentType },
    body   : buffer,
  });
  if (!putRes.ok) {
    throw new Error(`Butterbase S3 PUT ${putRes.status} for ${filename}`);
  }

  // 3. Get presigned download URL
  const dlRes = await fetch(`${base}/storage/${appId}/download/${objectId}`, {
    headers: { Authorization: authHeader },
  });
  if (!dlRes.ok) {
    const txt = await dlRes.text().catch(() => '');
    throw new Error(`Butterbase download-url ${dlRes.status}: ${txt.slice(0, 300)}`);
  }
  const { downloadUrl } = await dlRes.json();
  return downloadUrl;
}

/**
 * Upload up to MAX_IMAGES base64 data URLs in parallel.
 * Returns an array of public download URLs (same order as input).
 *
 * @param {string[]} dataUrls
 * @returns {Promise<string[]>}
 */
export async function uploadImages(dataUrls) {
  const batch = dataUrls.slice(0, MAX_IMAGES);
  return Promise.all(
    batch.map((url, i) => {
      const ext = url.startsWith('data:image/png') ? 'png'
                : url.startsWith('data:image/webp') ? 'webp'
                : 'jpg';
      return uploadImage(url, `listing-img-${Date.now()}-${i}.${ext}`);
    })
  );
}
