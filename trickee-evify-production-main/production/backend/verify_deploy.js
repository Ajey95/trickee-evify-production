#!/usr/bin/env node
/**
 * Trickee EV Intelligence - Deployment & WebSockets Verification Utility (Node.js version)
 * This script performs verification checks on a deployed or local instance of the backend:
 * 1. Pings the REST health check endpoint (/health).
 * 2. Performs login and requests a short-lived WebSocket ticket (if credentials provided).
 * 3. Executes a raw WebSocket handshake upgrade to verify wss:// routing and CORS rules.
 *
 * Usage:
 *   node verify_deploy.js --url http://localhost:8000 --email admin@trickee.ai --password demo_pass
 */

const http = require('http');
const https = require('https');
const url = require('url');

// Helper for colored logs
const colors = {
  success: (msg) => console.log(`\x1b[32m[✓] ${msg}\x1b[0m`),
  info: (msg) => console.log(`\x1b[34m[*] ${msg}\x1b[0m`),
  warn: (msg) => console.log(`\x1b[33m[!] ${msg}\x1b[0m`),
  error: (msg) => console.log(`\x1b[31m[✗] ${msg}\x1b[0m`),
};

// Simple CLI arg parser
const args = {};
process.argv.slice(2).forEach((val, index, array) => {
  if (val.startsWith('--')) {
    const key = val.slice(2);
    const nextVal = array[index + 1];
    if (nextVal && !nextVal.startsWith('--')) {
      args[key] = nextVal;
    } else {
      args[key] = true;
    }
  }
});

const baseUrlArg = args.url || 'http://localhost:8000';
const email = args.email;
const password = args.password;
const origin = args.origin || 'https://trickee-evify-live.vercel.app';

function cleanBaseUrl(u) {
  let cleaned = u.replace(/\/$/, '');
  if (cleaned.endsWith('/api/v1')) {
    cleaned = cleaned.slice(0, -7);
  }
  return cleaned;
}

const baseUrl = cleanBaseUrl(baseUrlArg);
console.log('='.repeat(60));
console.log(`VERIFYING DEPLOYMENT AT: ${baseUrl}`);
console.log('='.repeat(60));

// Request helper returning JSON
function jsonRequest(requestUrl, method, payload = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const parsed = url.parse(requestUrl);
    const isSecure = parsed.protocol === 'https:';
    const lib = isSecure ? https : http;

    const options = {
      hostname: parsed.hostname,
      port: parsed.port || (isSecure ? 443 : 80),
      path: parsed.path,
      method: method,
      headers: {
        'Accept': 'application/json',
        ...headers,
      },
    };

    let bodyData = null;
    if (payload) {
      bodyData = JSON.stringify(payload);
      options.headers['Content-Type'] = 'application/json';
      options.headers['Content-Length'] = Buffer.byteLength(bodyData);
    }

    const req = lib.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const parsedData = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsedData });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });

    req.on('error', (err) => reject(err));
    if (bodyData) {
      req.write(bodyData);
    }
    req.end();
  });
}

// Perform WebSocket Handshake
function testWebSocketHandshake(wsUrl, originHeader, expectedCode = 101) {
  return new Promise((resolve) => {
    const parsed = url.parse(wsUrl);
    const isSecure = parsed.protocol === 'wss:';
    const lib = isSecure ? https : http;

    const options = {
      hostname: parsed.hostname,
      port: parsed.port || (isSecure ? 443 : 80),
      path: parsed.path,
      method: 'GET',
      headers: {
        'Connection': 'Upgrade',
        'Upgrade': 'websocket',
        'Sec-WebSocket-Key': Buffer.from('trickee-verify-key-sec').toString('base64'),
        'Sec-WebSocket-Version': '13',
      },
    };

    if (originHeader) {
      options.headers['Origin'] = originHeader;
    }

    colors.info(`Establishing connection to ${options.hostname}:${options.port}...`);
    const req = lib.request(options);

    req.on('upgrade', (res, socket, upgradeHead) => {
      colors.success(`WebSocket upgrade completed with code ${res.statusCode} (Switching Protocols)!`);
      
      // Listen for socket closed with custom code (like 4001)
      socket.on('data', (chunk) => {
        // WebSocket frame parsing for close frame
        if (chunk.length >= 2) {
          const firstByte = chunk[0];
          const isCloseFrame = (firstByte & 0x0f) === 8;
          if (isCloseFrame) {
            const payloadLen = chunk[1] & 0x7f;
            if (payloadLen >= 2) {
              const closeCode = chunk.readUInt16BE(2);
              if (closeCode === 4001) {
                colors.error('Socket upgraded, but server immediately closed connection with code 4001 (Unauthorized Ticket).');
              } else {
                colors.warn(`Socket upgraded, but connection closed with code ${closeCode}.`);
              }
            }
          }
        }
      });

      socket.end();
      resolve(true);
    });

    req.on('response', (res) => {
      if (res.statusCode === expectedCode) {
        colors.success(`Handshake returned expected HTTP status: ${res.statusCode}`);
      } else {
        colors.error(`WebSocket handshake failed. HTTP Status: ${res.statusCode}`);
      }
      resolve(res.statusCode === expectedCode);
    });

    req.on('error', (err) => {
      colors.error(`Connection failed: ${err.message}`);
      resolve(false);
    });

    req.end();
  });
}

async function run() {
  // 1. Health check check
  try {
    colors.info(`Pinging health check endpoint at: ${baseUrl}/health`);
    const health = await jsonRequest(`${baseUrl}/health`, 'GET');
    if (health.status === 200 && health.data && health.data.status === 'ok') {
      colors.success(`Health check passed! Response: ${JSON.stringify(health.data)}`);
    } else {
      colors.error(`Health check failed (status=${health.status}): ${JSON.stringify(health.data || health.raw)}`);
    }
  } catch (err) {
    colors.error(`Failed to connect to health endpoint: ${err.message}`);
  }

  // Determine WebSocket protocols
  const parsedBase = url.parse(baseUrl);
  const wsScheme = parsedBase.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsBaseUrl = `${wsScheme}//${parsedBase.host}`;

  let ticket = null;

  // 2. Authentication and Ticket Fetching
  if (email && password) {
    try {
      colors.info(`Attempting login for '${email}' at: ${baseUrl}/api/v1/auth/login`);
      const loginRes = await jsonRequest(`${baseUrl}/api/v1/auth/login`, 'POST', { email, password });
      if (loginRes.status === 200 && loginRes.data && loginRes.data.success) {
        const token = loginRes.data.data.access_token;
        colors.success('Login successful! Token acquired.');

        colors.info(`Requesting WebSocket ticket from: ${baseUrl}/api/v1/auth/ws-ticket`);
        const ticketRes = await jsonRequest(`${baseUrl}/api/v1/auth/ws-ticket`, 'GET', null, {
          'Authorization': `Bearer ${token}`,
        });
        if (ticketRes.status === 200 && ticketRes.data && ticketRes.data.success) {
          ticket = ticketRes.data.data.ticket;
          colors.success(`WebSocket ticket acquired: ${ticket.slice(0, 15)}...`);
        } else {
          colors.error(`Failed to acquire ticket: ${JSON.stringify(ticketRes.data || ticketRes.raw)}`);
        }
      } else {
        colors.error(`Login failed: ${JSON.stringify(loginRes.data || loginRes.raw)}`);
      }
    } catch (err) {
      colors.error(`Authentication request sequence failed: ${err.message}`);
    }
  } else {
    colors.warn('No credentials provided via --email and --password. Authentic ticket-based handshake cannot be verified.');
  }

  console.log('\n' + '-'.repeat(50));
  console.log('RUNNING WEBSOCKET HANDSHAKE VERIFICATIONS');
  console.log('-'.repeat(50));

  // Test 3a: Valid WebSocket Upgrade Handshake
  if (ticket) {
    colors.info(`Test A: Handshake with active WebSocket ticket on: ${wsBaseUrl}/ws/live-map`);
    await testWebSocketHandshake(`${wsBaseUrl}/ws/live-map?ticket=${ticket}`, origin, 101);
  } else {
    colors.info(`Test A (Ticketless): Upgrading without query ticket on: ${wsBaseUrl}/ws/live-map`);
    await testWebSocketHandshake(`${wsBaseUrl}/ws/live-map`, origin, 422);
  }

  // Test 3b: Upgrade with invalid ticket
  colors.info(`\nTest B: Handshake with invalid ticket on: ${wsBaseUrl}/ws/live-map?ticket=...`);
  await testWebSocketHandshake(`${wsBaseUrl}/ws/live-map?ticket=invalid_ticket_placeholder`, origin, 101);

  // Test 3c: Test forbidden origin
  colors.info(`\nTest C: Handshake with forbidden Origin (testing CORS origin policy)`);
  const forbiddenOrigin = 'https://malicious-origin-check.com';
  await testWebSocketHandshake(`${wsBaseUrl}/ws/live-map?ticket=invalid_ticket_placeholder`, forbiddenOrigin, 101);

  console.log('\n' + '='.repeat(60));
  console.log('VERIFICATION COMPLETE');
  console.log('='.repeat(60));
}

run().catch((err) => {
  colors.error(`Script error: ${err.message}`);
  process.exit(1);
});
