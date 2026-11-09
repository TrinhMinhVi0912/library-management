const https = require('https');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const config = require('../config');

const GOOGLE_CERTS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const GOOGLE_ISSUERS = ['accounts.google.com', 'https://accounts.google.com'];
const DEFAULT_CERT_TTL_MS = 5 * 60 * 1000;
let cachedKeys = null;
let cacheExpiresAt = 0;
let pendingKeyRequest = null;

function fetchGoogleKeys() {
  if (pendingKeyRequest) return pendingKeyRequest;

  pendingKeyRequest = new Promise((resolve, reject) => {
    const request = https.get(GOOGLE_CERTS_URL, { timeout: 5000 }, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => {
        body += chunk;
        if (body.length > 1024 * 1024) request.destroy(new Error('Google certificate response is too large'));
      });
      response.on('end', () => {
        if (response.statusCode !== 200) {
          reject(new Error(`Google certificate endpoint returned ${response.statusCode}`));
          return;
        }

        try {
          const parsed = JSON.parse(body);
          const keys = Array.isArray(parsed.keys) ? parsed.keys : [];
          if (!keys.length) throw new Error('Google certificate response has no keys');
          const maxAge = response.headers['cache-control']?.match(/max-age=(\d+)/i)?.[1];
          cachedKeys = keys;
          cacheExpiresAt = Date.now() + (maxAge ? Number(maxAge) * 1000 : DEFAULT_CERT_TTL_MS);
          resolve(keys);
        } catch (error) {
          reject(error);
        }
      });
    });

    request.on('timeout', () => request.destroy(new Error('Google certificate request timed out')));
    request.on('error', reject);
  }).finally(() => {
    pendingKeyRequest = null;
  });

  return pendingKeyRequest;
}

async function getGoogleKeys(forceRefresh = false) {
  if (!forceRefresh && cachedKeys && Date.now() < cacheExpiresAt) return cachedKeys;
  return fetchGoogleKeys();
}

/**
 * Verifies a Google ID token's signature and OIDC claims before returning identity claims.
 * @param {string} idToken
 * @returns {Promise<object|null>} Verified claims, or null for an invalid token.
 */
async function verifyGoogleIdToken(idToken) {
  const clientId = config.google.clientId;
  if (!clientId) {
    const error = new Error('Google login is not configured');
    error.code = 'GOOGLE_NOT_CONFIGURED';
    throw error;
  }

  const decoded = jwt.decode(idToken, { complete: true });
  if (!decoded?.header?.kid || decoded.header.alg !== 'RS256') return null;

  let keys = await getGoogleKeys();
  let jwk = keys.find((key) => key.kid === decoded.header.kid && key.kty === 'RSA' && key.use === 'sig');
  if (!jwk) {
    keys = await getGoogleKeys(true);
    jwk = keys.find((key) => key.kid === decoded.header.kid && key.kty === 'RSA' && key.use === 'sig');
  }
  if (!jwk) return null;

  try {
    const publicKey = crypto.createPublicKey({ key: jwk, format: 'jwk' });
    const claims = jwt.verify(idToken, publicKey, {
      algorithms: ['RS256'],
      audience: clientId,
      issuer: GOOGLE_ISSUERS,
      clockTolerance: 5,
    });
    if (!claims.sub || !claims.email || claims.email_verified !== true) return null;
    return claims;
  } catch {
    return null;
  }
}

module.exports = {
  GOOGLE_CERTS_URL,
  verifyGoogleIdToken,
};
