import test from "node:test";
import assert from "node:assert/strict";
import worker from "../worker/index.js";
import { privateKeyToAccount } from "viem/accounts";
import nacl from "tweetnacl";
import bs58 from "bs58";

import { webcrypto } from "node:crypto";

if (!globalThis.crypto) globalThis.crypto = webcrypto;

const TEST_WALLET = "0x1111111111111111111111111111111111111111";
const TEST_PRIVATE_KEY = "0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const TEST_SECRET = "test-only-secret-for-rate-limit-32-chars";

function b64u(value) {
  return Buffer.from(value).toString("base64url");
}

async function testSession(wallet = TEST_WALLET, chain = "ethereum") {
  const now = Math.floor(Date.now() / 1000);
  const head = b64u(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64u(JSON.stringify({
    iss: "limfxai", sub: wallet, chain, iat: now, exp: now + 3600
  }));
  const input = `${head}.${body}`;
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(TEST_SECRET),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC", key, new TextEncoder().encode(input)
  );
  return `${input}.${Buffer.from(signature).toString("base64url")}`;
}

const tradeIntents = new Map();
const approvalChallenges = new Map();
const solanaSwapOrders = new Map();
let failNextApprovalBatchStatement = false;

const env = {
  SESSION_SECRET: TEST_SECRET,
  DB: {
    prepare(sql) {
      let params = [];

      return {
        bind(...values) {
          params = values;
          return this;
        },
        async first() {
          if (sql.includes("INSERT INTO rate_limits")) {
            return { request_count: 1 };
          }

          if (sql.includes("SELECT wallet,chain FROM trade_intents")) {
            const row = tradeIntents.get(params[0]);
            return row ? { wallet: row.wallet, chain: row.chain } : null;
          }

          if (sql.includes("SELECT id,wallet,chain,asset,side,amount,rationale,status FROM trade_intents")) {
            return tradeIntents.get(params[0]) || null;
          }

          if (sql.includes("FROM trade_approval_challenges WHERE id=?")) {
            return approvalChallenges.get(params[0]) || null;
          }

          if (sql.includes("FROM solana_swap_orders WHERE id=? AND wallet=?")) {
            const row = solanaSwapOrders.get(params[0]);
            return row && row.wallet === params[1] ? { ...row } : null;
          }

          return null;
        },
        async run() {
          if (sql.includes("UPDATE solana_swap_orders SET execution_status='submitting'")) {
            const [startedAt, updatedAt, usedAt, signature, id, wallet, now, messageHash] = params;
            const row = solanaSwapOrders.get(id);
            if (!row || row.wallet !== wallet || row.execution_status !== "pending" ||
                row.expires_at <= now || row.message_hash !== messageHash)
              return { meta: { changes: 0 } };
            Object.assign(row, {
              execution_status: "submitting",
              execution_started_at: startedAt,
              execution_updated_at: updatedAt,
              used_at: usedAt,
              execution_signature: signature
            });
            return { meta: { changes: 1 } };
          }

          if (sql.includes("UPDATE solana_swap_orders SET execution_status='unknown'")) {
            const [updatedAt, id, wallet] = params;
            const row = solanaSwapOrders.get(id);
            if (!row || row.wallet !== wallet || row.execution_status !== "submitting")
              return { meta: { changes: 0 } };
            row.execution_status = "unknown";
            row.execution_updated_at = updatedAt;
            return { meta: { changes: 1 } };
          }

          if (sql.includes("UPDATE solana_swap_orders SET execution_status=?")) {
            const [status, updatedAt, id, wallet, signature] = params;
            const row = solanaSwapOrders.get(id);
            if (!row || row.wallet !== wallet || row.execution_status !== "submitting" ||
                row.execution_signature !== signature)
              return { meta: { changes: 0 } };
            row.execution_status = status;
            row.execution_updated_at = updatedAt;
            return { meta: { changes: 1 } };
          }

          if (sql.includes("INSERT INTO solana_swap_orders")) {
            const [id, request_id, wallet, input_mint, output_mint, input_amount,
              output_amount, unsigned_transaction, message_hash,
              last_valid_block_height, expires_at] = params;
            if ([...solanaSwapOrders.values()].some(row => row.request_id === request_id))
              return { meta: { changes: 0 } };
            solanaSwapOrders.set(id, {
              id, request_id, wallet, input_mint, output_mint, input_amount,
              output_amount, unsigned_transaction, message_hash,
              last_valid_block_height, expires_at, used_at: null
            });
            return { meta: { changes: 1 } };
          }

          if (sql.includes("INSERT INTO trade_approval_challenges")) {
            const [id, trade_intent_id, wallet, chain, proposal_hash, message, nonce, expires_at] = params;
            approvalChallenges.set(id, {
              id, trade_intent_id, wallet, chain, proposal_hash, message, nonce,
              expires_at, used_at: null
            });
            return { meta: { changes: 1 } };
          }

          if (sql.includes("UPDATE trade_approval_challenges SET used_at")) {
            const [used_at, challengeId, tradeId, wallet, chain, proposalHash, now, intentId] = params;
            const challenge = approvalChallenges.get(challengeId);
            const proposal = tradeIntents.get(intentId);
            if (!challenge || challenge.trade_intent_id !== tradeId ||
                challenge.wallet !== wallet || challenge.chain !== chain ||
                challenge.proposal_hash !== proposalHash || challenge.used_at !== null ||
                challenge.expires_at < now || !proposal || proposal.status !== "proposed") {
              return { meta: { changes: 0 } };
            }
            challenge.used_at = used_at;
            return { meta: { changes: 1 } };
          }

          if (sql.includes("UPDATE trade_intents SET status='wallet_approved'")) {
            const [signature, approvedAt, id, wallet, chain] = params;
            const row = tradeIntents.get(id);
            if (!row || row.status !== "proposed" || row.wallet !== wallet || row.chain !== chain) {
              return { meta: { changes: 0 } };
            }
            row.status = "wallet_approved";
            row.approval_signature = signature;
            row.approved_at = approvedAt;
            return { meta: { changes: 1 } };
          }

          if (sql.includes("INSERT INTO trade_intents")) {
            const [id, wallet, chain, asset, side, amount, rationale] = params;
            if (tradeIntents.has(id)) return { meta: { changes: 0 } };

            tradeIntents.set(id, {
              id, wallet, chain, asset, side, amount, rationale,
              status: "proposed"
            });
            return { meta: { changes: 1 } };
          }

          if (sql.includes("UPDATE trade_intents SET status")) {
            const [status, id, wallet, chain] = params;
            const row = tradeIntents.get(id);

            if (
              !row ||
              row.status !== "proposed" ||
              row.wallet !== wallet ||
              row.chain !== chain
            ) {
              return { meta: { changes: 0 } };
            }

            row.status = status;
            return { meta: { changes: 1 } };
          }

          return { meta: { changes: 0 } };
        },
        async all() {
          const wallet = params[0];
          const results = [...tradeIntents.values()]
            .filter(row => row.wallet.toLowerCase() === String(wallet).toLowerCase())
            .slice(0, 50);
          return { results };
        }
      };
    }
  ,
  async batch(statements) {
    const intentSnapshot = new Map(
      [...tradeIntents].map(([id, row]) => [id, structuredClone(row)])
    );
    const challengeSnapshot = new Map(
      [...approvalChallenges].map(([id, row]) => [id, structuredClone(row)])
    );
    const results = [];
    try {
      for (let index = 0; index < statements.length; index++) {
        if (failNextApprovalBatchStatement && index === 1) {
          failNextApprovalBatchStatement = false;
          throw new Error("Simulated D1 batch statement failure");
        }
        results.push(await statements[index].run());
      }
      return results;
    } catch (error) {
      tradeIntents.clear();
      for (const [id, row] of intentSnapshot) tradeIntents.set(id, row);
      approvalChallenges.clear();
      for (const [id, row] of challengeSnapshot) approvalChallenges.set(id, row);
      failNextApprovalBatchStatement = false;
      throw error;
    }
  }
  },
  ASSETS: {
    fetch: async () => new Response("asset", { status: 200 })
  }
};

async function request(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (!headers.has("CF-Connecting-IP")) {
    headers.set("CF-Connecting-IP", "192.0.2.10");
  }

  return worker.fetch(
    new Request(`https://limfxai.test${path}`, {
      ...options,
      headers
    }),
    env
  );
}

function assertSecurityHeaders(response, { https = true } = {}) {
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("x-frame-options"), "DENY");
  assert.equal(response.headers.get("referrer-policy"), "strict-origin-when-cross-origin");
  assert.equal(response.headers.get("permissions-policy"), "camera=(), microphone=(), geolocation=()");
  assert.equal(
    response.headers.get("strict-transport-security"),
    https ? "max-age=31536000" : null
  );
}

test("RPC health check never exposes provider error details", async (t) => {
  const previousRpc = env.RPC_ETHEREUM;
  env.RPC_ETHEREUM = "https://rpc-provider.invalid/secret-api-key";

  t.mock.method(globalThis, "fetch", async () => new Response(
    JSON.stringify({
      error: "PRIVATE_PROVIDER_SECRET https://internal-provider.invalid"
    }),
    {
      status: 400,
      headers: { "content-type": "application/json" }
    }
  ));

  try {
    const response = await request("/api/rpc/health");
    const body = await response.json();
    const ethereum = body.checks.find(item => item.chain === "ethereum");

    assert.equal(response.status, 200);
    assert.equal(ethereum.ok, false);
    assert.equal(ethereum.error, "RPC request failed");
    assert.equal(ethereum.errorCode, "RPC_UNAVAILABLE");

    const serialized = JSON.stringify(body);
    assert.equal(serialized.includes("PRIVATE_PROVIDER_SECRET"), false);
    assert.equal(serialized.includes("internal-provider.invalid"), false);
    assert.equal(serialized.includes("secret-api-key"), false);
  } finally {
    if (previousRpc === undefined) delete env.RPC_ETHEREUM;
    else env.RPC_ETHEREUM = previousRpc;
  }
});

test("Solana swap order returns only a validated unsigned Jupiter transaction", async (t) => {
  const wallet = "11111111111111111111111111111111";
  const token = await testSession(wallet, "solana");
  const unsignedTransaction = Buffer.from([
    1, ...new Array(64).fill(0),
    1, 0, 0,
    1, ...new Array(32).fill(0),
    ...new Array(32).fill(0),
    0
  ]).toString("base64");
  let requestedUrl = "";
  t.mock.method(globalThis, "fetch", async (url) => {
    requestedUrl = String(url);
    return new Response(JSON.stringify({
      transaction: unsignedTransaction,
      requestId: "jupiter-order-test",
      inAmount: "1000",
      outAmount: "950",
      otherAmountThreshold: "940",
      lastValidBlockHeight: 12345
    }), { headers: { "content-type": "application/json" } });
  });

  const response = await request("/api/swap/solana/order", {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      chain: "solana",
      inputToken: "So11111111111111111111111111111111111111112",
      outputToken: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      amount: "1000"
    })
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.unsigned, true);
  assert.equal(body.signed, false);
  assert.equal(body.broadcast, false);
  assert.equal(body.transaction, unsignedTransaction);
  assert.equal(body.requestId, "jupiter-order-test");
  assert.equal(body.wallet, wallet);
  assert.match(body.orderId, /^[0-9a-f-]{36}$/i);
  assert.match(body.messageHash, /^[0-9a-f]{64}$/);
  assert.equal(solanaSwapOrders.get(body.orderId)?.request_id, "jupiter-order-test");
  assert.equal(solanaSwapOrders.get(body.orderId)?.wallet, wallet);
  assert.match(requestedUrl, /swap\/v2\/order/);
  assert.match(requestedUrl, /taker=11111111111111111111111111111111/);
});

test("Solana V0 accepts valid ALT indexes and rejects out-of-range indexes", async (t) => {
  const wallet = "11111111111111111111111111111111";
  const token = await testSession(wallet, "solana");

  const makeV0Transaction = (loadedIndex) => Buffer.from([
    1, ...new Array(64).fill(0),
    0x80, 1, 0, 0,
    1, ...new Array(32).fill(0),
    ...new Array(32).fill(0),
    1,
    0, 1, loadedIndex, 0,
    1,
    ...new Array(32).fill(1),
    1, 0,
    0
  ]).toString("base64");

  const responses = [
    { transaction: makeV0Transaction(1), requestId: "jupiter-v0-valid", outAmount: "950" },
    { transaction: makeV0Transaction(2), requestId: "jupiter-v0-invalid", outAmount: "950" }
  ];

  t.mock.method(globalThis, "fetch", async () => new Response(
    JSON.stringify(responses.shift()),
    { headers: { "content-type": "application/json" } }
  ));

  async function createOrder() {
    return request("/api/swap/solana/order", {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        chain: "solana",
        inputToken: "So11111111111111111111111111111111111111112",
        outputToken: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        amount: "1000"
      })
    });
  }

  const validResponse = await createOrder();
  const validBody = await validResponse.json();
  assert.equal(validResponse.status, 200);
  assert.equal(validBody.unsigned, true);
  assert.equal(validBody.executionEnabled, false);
  assert.equal(validBody.signed, false);
  assert.equal(validBody.broadcast, false);

  const invalidResponse = await createOrder();
  assert.equal(invalidResponse.status, 502);
  assert.match((await invalidResponse.json()).error, /failed unsigned wallet validation/);
});

test("Solana swap order rejects a Jupiter response without a transaction", async (t) => {
  const wallet = "11111111111111111111111111111111";
  const token = await testSession(wallet, "solana");
  t.mock.method(globalThis, "fetch", async () => new Response(JSON.stringify({
    transaction: "",
    requestId: "price-only",
    outAmount: "950"
  }), { headers: { "content-type": "application/json" } }));

  const response = await request("/api/swap/solana/order", {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      chain: "solana",
      inputToken: "So11111111111111111111111111111111111111112",
      outputToken: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      amount: "1000"
    })
  });

  assert.equal(response.status, 502);
  assert.match((await response.json()).error, /valid unsigned transaction/);
});

test("EVM quote rejects malformed token addresses", async () => {
  const token = await testSession();
  const response = await request("/api/quote", {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      chain: "ethereum",
      inputToken: "0x" + "g".repeat(40),
      outputToken: "0x2222222222222222222222222222222222222222",
      amount: "100"
    })
  });

  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /Invalid input or output token address/);
});

test("Solana quote rejects malformed mint addresses", async () => {
  const wallet = "11111111111111111111111111111111";
  const token = await testSession(wallet, "solana");
  const response = await request("/api/quote", {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      chain: "solana",
      inputToken: "0OIl0OIl0OIl0OIl0OIl0OIl",
      outputToken: "So11111111111111111111111111111111111111112",
      amount: "100"
    })
  });

  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /Invalid input or output token address/);
});

test("EVM quote rejects identical tokens regardless of letter case", async () => {
  const token = await testSession();
  const address = "0x2222222222222222222222222222222222222222";
  const response = await request("/api/quote", {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      chain: "ethereum",
      inputToken: address.toLowerCase(),
      outputToken: address.toUpperCase().replace("0X", "0x"),
      amount: "100"
    })
  });

  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /must be different/);
});

test("GET /api/health returns service information", async () => {
  const response = await request("/api/health");
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.service, "LIMFXAI Agent Engine");
  assert.equal(body.walletAuth.ton, false);
  assertSecurityHeaders(response);
});

test("GET /api/chains returns supported chains", async () => {
  const response = await request("/api/chains");
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.ok(body.ethereum);
  assert.ok(body.solana);
  assert.equal(body.ton?.family, "ton");
  assertSecurityHeaders(response);
});

test("Unknown API route returns 404", async () => {
  const response = await request("/api/not-a-real-route");

  assert.equal(response.status, 404);
  assertSecurityHeaders(response);
});

test("Foreign Origin is rejected", async () => {
  const response = await request("/api/health", {
    headers: { Origin: "https://attacker.example" }
  });

  assert.equal(response.status, 403);
  assertSecurityHeaders(response);
});

test("Same-origin API request is accepted", async () => {
  const response = await request("/api/health", {
    headers: { Origin: "https://limfxai.test" }
  });

  assert.equal(response.status, 200);
});

test("Non-API requests reach the asset handler", async () => {
  const response = await request("/");

  assert.equal(response.status, 200);
  assert.equal(await response.text(), "asset");
  assertSecurityHeaders(response);
});

test("Malformed JSON is rejected", async () => {
  const response = await request("/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{invalid"
  });

  assert.equal(response.status, 400);
});

test("JSON array is rejected", async () => {
  const response = await request("/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "[]"
  });

  assert.equal(response.status, 400);
});

test("Missing POST body is rejected", async () => {
  const response = await request("/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json" }
  });

  assert.equal(response.status, 400);
});

test("Foreign-origin preflight is rejected", async () => {
  const response = await request("/api/health", {
    method: "OPTIONS",
    headers: { Origin: "https://attacker.example" }
  });

  assert.equal(response.status, 403);
  assertSecurityHeaders(response);
});


test("Trade intent requires wallet authentication", async () => {
  const response = await request("/api/trade-intents", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      wallet: TEST_WALLET, chain: "ethereum",
      asset: "0x2222222222222222222222222222222222222222",
      side: "buy", amount: "1", rationale: "test"
    })
  });

  assert.equal(response.status, 401);
});

test("Trade intent rejects wallet mismatch", async () => {
  const token = await testSession();
  const response = await request("/api/trade-intents", {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      wallet: "0x2222222222222222222222222222222222222222",
      chain: "ethereum",
      asset: "0x3333333333333333333333333333333333333333",
      side: "buy", amount: "1", rationale: "test"
    })
  });

  assert.equal(response.status, 403);
});

test("Trade intent rejects invalid amount formats", async () => {
  const token = await testSession();

  for (const amount of ["0", "-1", "1e-8", "01", "1.2.3", " 1"]) {
    const response = await request("/api/trade-intents", {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        wallet: TEST_WALLET, chain: "ethereum",
        asset: "0x2222222222222222222222222222222222222222",
        side: "buy", amount, rationale: "test"
      })
    });

    assert.equal(response.status, 400, `amount ${JSON.stringify(amount)} should fail`);
  }
});

test("Trade intent can be proposed and approved only once", async () => {
  tradeIntents.clear();
  const token = await testSession();
  const headers = {
    authorization: `Bearer ${token}`,
    "content-type": "application/json"
  };

  const created = await request("/api/trade-intents", {
    method: "POST",
    headers,
    body: JSON.stringify({
      wallet: TEST_WALLET, chain: "ethereum",
      asset: "0x2222222222222222222222222222222222222222",
      side: "buy", amount: "0.123456789012345678",
      rationale: "Automated integration test"
    })
  });

  assert.equal(created.status, 201);
  const proposal = await created.json();
  assert.match(proposal.id, /^[0-9a-f-]{36}$/i);
  assert.equal(proposal.status, "proposed");
  assert.match(proposal.message, /No transaction or wallet signature has occurred/i);

  const stored = tradeIntents.get(proposal.id);
  assert.equal(stored.amount, "0.123456789012345678");
  assert.equal(stored.status, "proposed");

  const approved = await request(`/api/trade-intents/${proposal.id}`, {
    method: "POST",
    headers,
    body: JSON.stringify({ action: "approve" })
  });

  assert.equal(approved.status, 400);
  assert.match((await approved.json()).error, /Unsigned approval is disabled/i);
  assert.equal(tradeIntents.get(proposal.id).status, "proposed");

  const repeated = await request(`/api/trade-intents/${proposal.id}`, {
    method: "POST",
    headers,
    body: JSON.stringify({ action: "approve" })
  });

  assert.equal(repeated.status, 400);
});


test("EVM trade approval verifies wallet signature and prevents replay", async () => {
  tradeIntents.clear();
  approvalChallenges.clear();

  const account = privateKeyToAccount(TEST_PRIVATE_KEY);
  const token = await testSession(account.address, "ethereum");
  const headers = {
    authorization: `Bearer ${token}`,
    "content-type": "application/json"
  };

  const created = await request("/api/trade-intents", {
    method: "POST",
    headers,
    body: JSON.stringify({
      wallet: account.address,
      chain: "ethereum",
      asset: "0x2222222222222222222222222222222222222222",
      side: "buy",
      amount: "1.25",
      rationale: "EVM signed approval integration test"
    })
  });
  assert.equal(created.status, 201);
  const proposal = await created.json();

  const challengeResponse = await request(
    `/api/trade-intents/${proposal.id}/approval-challenge`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({})
    }
  );
  assert.equal(challengeResponse.status, 200);
  const challenge = await challengeResponse.json();
  assert.match(challenge.message, /LIMFXAI TRADE APPROVAL/);
  assert.match(challenge.message, new RegExp(proposal.id));

  const signature = await account.signMessage({ message: challenge.message });

  const invalid = await request(`/api/trade-intents/${proposal.id}/approve`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      challengeId: challenge.challengeId,
      signature: `0x${"00".repeat(65)}`
    })
  });
  assert.equal(invalid.status, 401);
  assert.equal(tradeIntents.get(proposal.id).status, "proposed");

  const approvalRequest = () => request(`/api/trade-intents/${proposal.id}/approve`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      challengeId: challenge.challengeId,
      signature
    })
  });

  const concurrent = await Promise.all([
    approvalRequest(),
    approvalRequest()
  ]);
  assert.deepEqual(
    concurrent.map(response => response.status).sort((a, b) => a - b),
    [200, 409],
    "exactly one concurrent approval must succeed"
  );

  const successful = concurrent.find(response => response.status === 200);
  assert.equal((await successful.json()).status, "wallet_approved");
  assert.equal(tradeIntents.get(proposal.id).status, "wallet_approved");
  assert.equal(tradeIntents.get(proposal.id).approval_signature, signature);
  assert.equal(typeof tradeIntents.get(proposal.id).approved_at, "number");
  assert.notEqual(approvalChallenges.get(challenge.challengeId).used_at, null);

  const replay = await request(`/api/trade-intents/${proposal.id}/approve`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      challengeId: challenge.challengeId,
      signature
    })
  });
  assert.equal(replay.status, 409);
});

test("EVM approval rolls back challenge consumption when the second batch statement fails", async () => {
  tradeIntents.clear();
  approvalChallenges.clear();
  failNextApprovalBatchStatement = false;

  const account = privateKeyToAccount(TEST_PRIVATE_KEY);
  const token = await testSession(account.address, "ethereum");
  const headers = {
    authorization: `Bearer ${token}`,
    "content-type": "application/json"
  };

  const created = await request("/api/trade-intents", {
    method: "POST",
    headers,
    body: JSON.stringify({
      wallet: account.address,
      chain: "ethereum",
      asset: "0x2222222222222222222222222222222222222222",
      side: "buy",
      amount: "1.25",
      rationale: "D1 batch rollback failure-injection test"
    })
  });
  assert.equal(created.status, 201);
  const proposal = await created.json();

  const challengeResponse = await request(
    `/api/trade-intents/${proposal.id}/approval-challenge`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({})
    }
  );
  assert.equal(challengeResponse.status, 200);
  const challenge = await challengeResponse.json();
  const signature = await account.signMessage({ message: challenge.message });

  const approvalRequest = () => request(
    `/api/trade-intents/${proposal.id}/approve`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        challengeId: challenge.challengeId,
        signature
      })
    }
  );

  failNextApprovalBatchStatement = true;
  const failed = await approvalRequest();
  assert.equal(failed.status, 500);

  const storedProposal = tradeIntents.get(proposal.id);
  const storedChallenge = approvalChallenges.get(challenge.challengeId);

  assert.equal(storedProposal.status, "proposed");
  assert.equal(storedProposal.approval_signature, undefined);
  assert.equal(storedProposal.approved_at, undefined);
  assert.equal(storedChallenge.used_at, null);

  const retry = await approvalRequest();
  assert.equal(retry.status, 200);
  assert.equal((await retry.json()).status, "wallet_approved");
  assert.equal(tradeIntents.get(proposal.id).status, "wallet_approved");
  assert.equal(tradeIntents.get(proposal.id).approval_signature, signature);
  assert.notEqual(approvalChallenges.get(challenge.challengeId).used_at, null);
});

test("Solana trade approval verifies Ed25519 wallet signature and prevents replay", async () => {
  tradeIntents.clear();
  approvalChallenges.clear();

  const keyPair = nacl.sign.keyPair();
  const wallet = bs58.encode(keyPair.publicKey);
  const token = await testSession(wallet, "solana");
  const headers = {
    authorization: `Bearer ${token}`,
    "content-type": "application/json"
  };

  const created = await request("/api/trade-intents", {
    method: "POST",
    headers,
    body: JSON.stringify({
      wallet,
      chain: "solana",
      asset: "So11111111111111111111111111111111111111112",
      side: "buy",
      amount: "1.25",
      rationale: "Solana Ed25519 signed approval integration test"
    })
  });
  assert.equal(created.status, 201, await created.clone().text());
  const proposal = await created.json();

  const challengeResponse = await request(
    `/api/trade-intents/${proposal.id}/approval-challenge`,
    { method: "POST", headers, body: JSON.stringify({}) }
  );
  assert.equal(challengeResponse.status, 200, await challengeResponse.clone().text());
  const challenge = await challengeResponse.json();

  const signatureBytes = nacl.sign.detached(
    new TextEncoder().encode(challenge.message),
    keyPair.secretKey
  );
  const signature = Buffer.from(signatureBytes).toString("base64url");

  const invalid = await request(`/api/trade-intents/${proposal.id}/approve`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      challengeId: challenge.challengeId,
      signature: Buffer.from(new Uint8Array(64)).toString("base64url")
    })
  });
  assert.equal(invalid.status, 401);
  assert.equal(tradeIntents.get(proposal.id).status, "proposed");

  const approvalRequest = () => request(`/api/trade-intents/${proposal.id}/approve`, {
    method: "POST",
    headers,
    body: JSON.stringify({ challengeId: challenge.challengeId, signature })
  });

  const concurrent = await Promise.all([
    approvalRequest(),
    approvalRequest()
  ]);
  assert.deepEqual(
    concurrent.map(response => response.status).sort((a, b) => a - b),
    [200, 409],
    "exactly one concurrent Solana approval must succeed"
  );

  const successful = concurrent.find(response => response.status === 200);
  assert.equal((await successful.json()).status, "wallet_approved");
  assert.equal(tradeIntents.get(proposal.id).status, "wallet_approved");
  assert.equal(tradeIntents.get(proposal.id).approval_signature, signature);
  assert.notEqual(approvalChallenges.get(challenge.challengeId).used_at, null);

  const replay = await request(`/api/trade-intents/${proposal.id}/approve`, {
    method: "POST",
    headers,
    body: JSON.stringify({ challengeId: challenge.challengeId, signature })
  });
  assert.equal(replay.status, 409);
});

test("Trade intent listing is restricted to the authenticated wallet", async () => {
  tradeIntents.clear();

  const ownerToken = await testSession();
  const ownerHeaders = {
    authorization: `Bearer ${ownerToken}`,
    "content-type": "application/json"
  };

  const created = await request("/api/trade-intents", {
    method: "POST",
    headers: ownerHeaders,
    body: JSON.stringify({
      wallet: TEST_WALLET,
      chain: "ethereum",
      asset: "0x2222222222222222222222222222222222222222",
      side: "buy",
      amount: "2.5",
      rationale: "Wallet isolation test"
    })
  });

  assert.equal(created.status, 201);

  const ownList = await request(
    `/api/trade-intents?wallet=${encodeURIComponent(TEST_WALLET)}`,
    { headers: { authorization: `Bearer ${ownerToken}` } }
  );

  assert.equal(ownList.status, 200);
  const ownBody = await ownList.json();
  assert.equal(ownBody.items.length, 1);
  assert.equal(ownBody.items[0].wallet, TEST_WALLET);

  const otherWallet = "0x4444444444444444444444444444444444444444";
  const otherToken = await testSession(otherWallet);

  const crossWallet = await request(
    `/api/trade-intents?wallet=${encodeURIComponent(TEST_WALLET)}`,
    { headers: { authorization: `Bearer ${otherToken}` } }
  );

  assert.equal(crossWallet.status, 403);

  const missingWallet = await request("/api/trade-intents", {
    headers: { authorization: `Bearer ${ownerToken}` }
  });

  assert.equal(missingWallet.status, 403);

  const unauthenticated = await request(
    `/api/trade-intents?wallet=${encodeURIComponent(TEST_WALLET)}`
  );

  assert.equal(unauthenticated.status, 401);
});

test("Trade intent actions enforce ownership and rejection state", async () => {
  tradeIntents.clear();

  const ownerToken = await testSession();
  const ownerHeaders = {
    authorization: `Bearer ${ownerToken}`,
    "content-type": "application/json"
  };

  const created = await request("/api/trade-intents", {
    method: "POST",
    headers: ownerHeaders,
    body: JSON.stringify({
      wallet: TEST_WALLET,
      chain: "ethereum",
      asset: "0x2222222222222222222222222222222222222222",
      side: "sell",
      amount: "3.75",
      rationale: "Ownership and rejection test"
    })
  });

  assert.equal(created.status, 201);
  const { id } = await created.json();

  const otherWallet = "0x4444444444444444444444444444444444444444";
  const otherToken = await testSession(otherWallet);

  const unauthorized = await request(`/api/trade-intents/${id}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${otherToken}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({ action: "reject" })
  });

  assert.equal(unauthorized.status, 403);
  assert.equal(tradeIntents.get(id).status, "proposed");

  const invalidId = await request("/api/trade-intents/not-a-uuid", {
    method: "POST",
    headers: ownerHeaders,
    body: JSON.stringify({ action: "reject" })
  });
  assert.equal(invalidId.status, 400);

  const missing = await request(
    "/api/trade-intents/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    {
      method: "POST",
      headers: ownerHeaders,
      body: JSON.stringify({ action: "reject" })
    }
  );
  assert.equal(missing.status, 404);

  const rejected = await request(`/api/trade-intents/${id}`, {
    method: "POST",
    headers: ownerHeaders,
    body: JSON.stringify({ action: "reject" })
  });

  assert.equal(rejected.status, 200);
  assert.equal((await rejected.json()).status, "rejected");
  assert.equal(tradeIntents.get(id).status, "rejected");

  const repeated = await request(`/api/trade-intents/${id}`, {
    method: "POST",
    headers: ownerHeaders,
    body: JSON.stringify({ action: "reject" })
  });

  assert.equal(repeated.status, 409);
});



async function seedSolanaExecutionOrder(orderId, requestId) {
  const kp = nacl.sign.keyPair.fromSeed(
    Uint8Array.from({ length: 32 }, (_, i) => i + 1)
  );
  const wallet = bs58.encode(kp.publicKey);
  const message = Buffer.from([
    1, 0, 0, 1, ...kp.publicKey, ...new Array(32).fill(7), 0
  ]);
  const unsignedTransaction = Buffer.from([
    1, ...new Array(64).fill(0), ...message
  ]).toString("base64");
  const sigBytes = nacl.sign.detached(message, kp.secretKey);
  const signature = bs58.encode(sigBytes);
  const signedTransaction = Buffer.from([
    1, ...sigBytes, ...message
  ]).toString("base64");
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", message));
  const messageHash = Array.from(hash, x => x.toString(16).padStart(2, "0")).join("");

  solanaSwapOrders.set(orderId, {
    id: orderId, request_id: requestId, wallet,
    unsigned_transaction: unsignedTransaction, message_hash: messageHash,
    expires_at: Math.floor(Date.now() / 1000) + 300,
    execution_status: "pending", execution_signature: null, used_at: null
  });
  return { wallet, signature, signedTransaction };
}

test("Solana execution submits a verified order only once", async (t) => {
  const orderId = "solana-exec-success-01";
  const requestId = "jupiter-exec-success";
  const f = await seedSolanaExecutionOrder(orderId, requestId);
  const token = await testSession(f.wallet, "solana");
  const oldFlag = env.ENABLE_SOLANA_EXECUTION;
  env.ENABLE_SOLANA_EXECUTION = "true";
  let calls = 0;

  t.mock.method(globalThis, "fetch", async (url, options) => {
    calls++;
    assert.match(String(url), /swap\/v2\/execute$/);
    const payload = JSON.parse(options.body);
    assert.equal(payload.requestId, requestId);
    assert.equal(payload.signedTransaction, f.signedTransaction);
    return new Response(JSON.stringify({
      status: "Success", signature: f.signature,
      inputAmount: "1000", outputAmount: "950"
    }), { status: 200, headers: { "content-type": "application/json" } });
  });

  try {
    const opts = {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({ orderId, signedTransaction: f.signedTransaction })
    };
    const res = await request("/api/swap/solana/execute", opts);
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.status, "submitted");
    assert.equal(body.signature, f.signature);
    assert.equal(solanaSwapOrders.get(orderId).execution_status, "submitted");
    assert.equal(calls, 1);

    const replay = await request("/api/swap/solana/execute", opts);
    assert.equal(replay.status, 409);
    assert.equal((await replay.json()).status, "submitted");
    assert.equal(calls, 1);
  } finally {
    if (oldFlag === undefined) delete env.ENABLE_SOLANA_EXECUTION;
    else env.ENABLE_SOLANA_EXECUTION = oldFlag;
  }
});

test("Solana execution marks ambiguous provider outcomes unknown", async (t) => {
  const orderId = "solana-exec-ambiguous-01";
  const f = await seedSolanaExecutionOrder(orderId, "jupiter-exec-ambiguous");
  const token = await testSession(f.wallet, "solana");
  const oldFlag = env.ENABLE_SOLANA_EXECUTION;
  env.ENABLE_SOLANA_EXECUTION = "true";
  let calls = 0;

  t.mock.method(globalThis, "fetch", async () => {
    calls++;
    throw new Error("simulated network disconnect");
  });

  try {
    const opts = {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({ orderId, signedTransaction: f.signedTransaction })
    };
    const res = await request("/api/swap/solana/execute", opts);
    assert.equal(res.status, 502);
    assert.equal(solanaSwapOrders.get(orderId).execution_status, "unknown");
    assert.equal(calls, 1);

    const replay = await request("/api/swap/solana/execute", opts);
    assert.equal(replay.status, 409);
    assert.equal((await replay.json()).status, "unknown");
    assert.equal(calls, 1);
  } finally {
    if (oldFlag === undefined) delete env.ENABLE_SOLANA_EXECUTION;
    else env.ENABLE_SOLANA_EXECUTION = oldFlag;
  }
});
