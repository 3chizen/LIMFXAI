import { recoverMessageAddress, getAddress } from "viem";
import nacl from "tweetnacl";
import bs58 from "bs58";

const CHAINS = {
  solana: { label: "Solana", family: "solana" },
  ethereum: { label: "Ethereum", family: "evm", chainId: 1 },
  bnb: { label: "BNB Chain", family: "evm", chainId: 56 },
  ton: { label: "TON", family: "ton" },
  base: { label: "Base", family: "evm", chainId: 8453 },
  arbitrum: { label: "Arbitrum", family: "evm", chainId: 42161 }
};
const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store", "access-control-allow-origin": "*" }
});
const err = (message, status=400) => json({ error: message }, status);
const uid = () => crypto.randomUUID();
const b64u = (s) => btoa(String.fromCharCode(...new TextEncoder().encode(s))).replace(/=/g,"").replace(/\+/g,"-").replace(/\//g,"_");
const decodeB64u = (s) => Uint8Array.from(atob(s.replace(/-/g,"+").replace(/_/g,"/")+"=".repeat((4-s.length%4)%4)),c=>c.charCodeAt(0));
const encodeB64uBytes = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/=/g,"").replace(/\+/g,"-").replace(/\//g,"_");
const fromB64u = (s) => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g,"+").replace(/_/g,"/")+"=".repeat((4-s.length%4)%4)),c=>c.charCodeAt(0)));
async function hmacKey(secret) {
  return crypto.subtle.importKey("raw",new TextEncoder().encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign","verify"]);
}
async function issueSession(env, wallet, chain) {
  if (!env.SESSION_SECRET || env.SESSION_SECRET.length < 32) throw new Error("SESSION_SECRET must be configured (at least 32 characters)");
  const now=Math.floor(Date.now()/1000);
  const head=b64u(JSON.stringify({alg:"HS256",typ:"JWT"}));
  const body=b64u(JSON.stringify({iss:"limfxai",sub:wallet,chain,iat:now,exp:now+3600}));
  const input=`${head}.${body}`;
  const sig=await crypto.subtle.sign("HMAC",await hmacKey(env.SESSION_SECRET),new TextEncoder().encode(input));
  return `${input}.${encodeB64uBytes(new Uint8Array(sig))}`;
}
async function readSession(request, env) {
  const token=(request.headers.get("authorization")||"").replace(/^Bearer\s+/i,"");
  if (!token || !env.SESSION_SECRET) return null;
  const parts=token.split("."); if(parts.length!==3)return null;
  const input=`${parts[0]}.${parts[1]}`;
  let sig; try { sig=Uint8Array.from(atob(parts[2].replace(/-/g,"+").replace(/_/g,"/")+"=".repeat((4-parts[2].length%4)%4)),c=>c.charCodeAt(0)); } catch{return null;}
  const valid=await crypto.subtle.verify("HMAC",await hmacKey(env.SESSION_SECRET),sig,new TextEncoder().encode(input));
  if(!valid)return null;
  try { const p=JSON.parse(fromB64u(parts[1])); if(p.iss!=="limfxai"||p.exp<=Date.now()/1000)return null; return p; } catch{return null;}
}
function validWallet(chain,wallet) {
  if(chain==="solana") { try{return bs58.decode(wallet).length===32;}catch{return false;} }
  if(chain==="ton") return typeof wallet==="string" && /^(?:-1|0):[a-fA-F0-9]{64}$/.test(wallet);
  return /^0x[a-fA-F0-9]{40}$/.test(wallet);
}
async function createChallenge(request, env, body) {
  const {chain,wallet}=body;
  if(!CHAINS[chain]) return err("Unsupported chain");
  if(chain==="ton") return err("TON proof authentication is not enabled yet. Integrate official TON Connect ton_proof verification before enabling TON sessions.",501);
  if(!validWallet(chain,wallet)) return err("Wallet address format is invalid for this chain");
  const id=uid(), nonce=crypto.randomUUID().replace(/-/g,""), now=Math.floor(Date.now()/1000);
  const host=new URL(request.url).host;
  const message = chain==="solana"
    ? `LIMFXAI wants you to sign in with your Solana account:\n${wallet}\n\nSign in to LIMFXAI. This signature does not authorize token transfers or trading.\n\nURI: ${new URL(request.url).origin}\nVersion: 1\nChain ID: solana\nNonce: ${nonce}\nIssued At: ${new Date(now*1000).toISOString()}\nExpiration Time: ${new Date((now+300)*1000).toISOString()}`
    : `${host} wants you to sign in with your Ethereum account:\n${getAddress(wallet)}\n\nSign in to LIMFXAI. This signature does not authorize token transfers or trading.\n\nURI: ${new URL(request.url).origin}\nVersion: 1\nChain ID: eip155:${CHAINS[chain].chainId}\nNonce: ${nonce}\nIssued At: ${new Date(now*1000).toISOString()}\nExpiration Time: ${new Date((now+300)*1000).toISOString()}`;
  await env.DB.prepare("INSERT INTO auth_challenges(id,wallet,chain,message,nonce,expires_at) VALUES(?,?,?,?,?,?)")
    .bind(id,wallet,chain,message,nonce,now+300).run();
  return json({challengeId:id,message,expiresInSeconds:300,chain,warning:"Sign-in only. This signature does not approve trades or transfers."});
}
async function verifyChallenge(env, body) {
  const {challengeId,signature}=body;
  if(!challengeId||!signature)return err("challengeId and signature are required");
  const row=await env.DB.prepare("SELECT * FROM auth_challenges WHERE id=?").bind(challengeId).first();
  const now=Math.floor(Date.now()/1000);
  if(!row)return err("Challenge not found",404);
  if(row.used_at)return err("Challenge already used",409);
  if(row.expires_at<now)return err("Challenge expired",410);
  let verified=false;
  try {
    if(row.chain==="solana") {
      const pub=bs58.decode(row.wallet), sig=decodeB64u(signature);
      verified=nacl.sign.detached.verify(new TextEncoder().encode(row.message),sig,pub);
    } else if(CHAINS[row.chain]?.family==="evm") {
      const recovered=await recoverMessageAddress({message:row.message,signature});
      verified=recovered.toLowerCase()===row.wallet.toLowerCase();
    }
  } catch { verified=false; }
  if(!verified)return err("Wallet signature verification failed",401);
  const consumed=await env.DB.prepare("UPDATE auth_challenges SET used_at=? WHERE id=? AND used_at IS NULL AND expires_at>=?")
    .bind(now,challengeId,now).run();
  if(!consumed.meta?.changes)return err("Challenge was already consumed",409);
  const sessionToken=await issueSession(env,row.wallet,row.chain);
  return json({verified:true,wallet:row.wallet,chain:row.chain,sessionToken,expiresInSeconds:3600,
    scope:"wallet-authentication-only",message:"Wallet ownership verified. No trade approval or transaction was created."});
}


const RPC_CHAIN = {
  ethereum: { env: "RPC_ETHEREUM", chainId: 1, native: "ETH" },
  bnb: { env: "RPC_BNB", chainId: 56, native: "BNB" },
  base: { env: "RPC_BASE", chainId: 8453, native: "ETH" },
  arbitrum: { env: "RPC_ARBITRUM", chainId: 42161, native: "ETH" }
};
async function rpcCall(endpoint,method,params=[]) {
  let lastError;
  for(let attempt=0;attempt<3;attempt++){
    try {
      const response=await fetch(endpoint,{
        method:"POST",
        headers:{"content-type":"application/json"},
        body:JSON.stringify({jsonrpc:"2.0",id:1,method,params})
      });
      if((response.status===429||response.status>=500)&&attempt<2){
        const retryAfter=Number(response.headers.get("retry-after")||0);
        const delay=retryAfter>0?Math.min(retryAfter*1000,3000):300*(2**attempt);
        await new Promise(resolve=>setTimeout(resolve,delay));
        continue;
      }
      if(!response.ok){const detail=await response.text();throw new Error(`RPC HTTP ${response.status}: ${detail.slice(0,300)}`);}
      const payload=await response.json();
      if(payload.error)throw new Error(payload.error.message||"RPC call failed");
      return payload.result;
    } catch(e) {
      lastError=e;
      if(attempt===2||! /429|fetch failed|network/i.test(e.message))throw e;
      await new Promise(resolve=>setTimeout(resolve,300*(2**attempt)));
    }
  }
  throw lastError||new Error("RPC request failed");
}
function hexToBigInt(value) {
  if(typeof value!=="string"||!/^0x[0-9a-fA-F]+$/.test(value))throw new Error("Invalid hex quantity from RPC");
  return BigInt(value);
}
function toHexQuantity(value) {
  const n=BigInt(value||"0");
  if(n<0n)throw new Error("Negative transaction value is not allowed");
  return "0x"+n.toString(16);
}
async function simulateEvm(request,env,body) {
  const session=await readSession(request,env);
  if(!session)return err("Wallet authentication required",401);
  const {chain,to,data,value="0x0"}=body;
  const cfg=RPC_CHAIN[chain];
  if(!cfg)return err("EVM simulation supports Ethereum, BNB Chain, Base, and Arbitrum only");
  if(session.chain!==chain)return err("Simulation chain must match authenticated wallet session",403);
  if(!/^0x[a-fA-F0-9]{40}$/.test(to||""))return err("Destination contract/address must be a valid EVM address");
  if(typeof data!=="string"||!/^0x([a-fA-F0-9]{2})*$/.test(data)||data.length>200002)return err("Calldata must be even-length hex and no larger than 100 KB");
  let valueHex;
  try { valueHex=toHexQuantity(value); } catch(e){return err(e.message);}
  const rpc=env[cfg.env];
  if(!rpc)return err(`${cfg.env} is not configured on the server`,503);
  const tx={from:session.sub,to,data,value:valueHex};
  try {
    const chainId=hexToBigInt(await rpcCall(rpc,"eth_chainId"));
    if(chainId!==BigInt(cfg.chainId))return err("Configured RPC endpoint reports the wrong chain ID",502);
    const block=await rpcCall(rpc,"eth_getBlockByNumber",["latest",false]);
    let callResult;
    try { callResult=await rpcCall(rpc,"eth_call",[tx,"latest"]); }
    catch(e){return json({ok:false,simulation:"reverted",chain,from:session.sub,to,
      reason:e.message,warning:"eth_call reverted. No transaction was sent."},200);}
    const gas=hexToBigInt(await rpcCall(rpc,"eth_estimateGas",[tx]));
    const baseFee=block?.baseFeePerGas?hexToBigInt(block.baseFeePerGas):null;
    const gasPrice=hexToBigInt(await rpcCall(rpc,"eth_gasPrice"));
    const estimatedFeeWei=gas*gasPrice;
    const gasLimitWithBuffer=(gas*120n+99n)/100n;
    const bufferedFeeWei=gasLimitWithBuffer*gasPrice;
    return json({ok:true,simulation:"call_and_gas_estimate_passed",broadcast:false,chain,
      chainId:cfg.chainId,from:session.sub,to,valueWei:valueHex,dataBytes:(data.length-2)/2,
      gasEstimate:gas.toString(),suggestedGasLimitWith20PercentBuffer:gasLimitWithBuffer.toString(),
      gasPriceWei:gasPrice.toString(),estimatedNetworkFeeWei:estimatedFeeWei.toString(),
      estimatedNetworkFeeNative:(Number(estimatedFeeWei)/1e18).toString(),
      estimatedNetworkFeeNativeSymbol:cfg.native,
      estimatedFeeWithBufferNative:(Number(bufferedFeeWei)/1e18).toString(),
      latestBlock:block?.number||null,baseFeePerGasWei:baseFee?.toString()||null,
      returnDataBytes:typeof callResult==="string"?(callResult.length-2)/2:null,
      warnings:["Simulation is a point-in-time RPC estimate, not a guarantee of inclusion or success.",
        "Token approvals, transfer effects, MEV, price movement, and protocol-specific risks are not fully assessed.",
        "No wallet signature was requested and no transaction was broadcast."]});
  } catch(e) { return err(`Simulation RPC error: ${e.message}`,502); }
}
async function simulateSolana(request,env,body) {
  const session=await readSession(request,env);
  if(!session)return err("Wallet authentication required",401);
  if(session.chain!=="solana")return err("Solana simulation requires a Solana-authenticated session",403);
  const {serializedTransaction}=body;
  if(typeof serializedTransaction!=="string"||serializedTransaction.length<20||serializedTransaction.length>20000)
    return err("serializedTransaction must be a base64-encoded transaction under 15 KB");
  if(!/^[A-Za-z0-9+/]+={0,2}$/.test(serializedTransaction))return err("Transaction must be standard base64");
  const rpc=env.RPC_SOLANA;
  if(!rpc)return err("RPC_SOLANA is not configured on the server",503);
  try {
    const result=await rpcCall(rpc,"simulateTransaction",[serializedTransaction,
      {encoding:"base64",sigVerify:false,replaceRecentBlockhash:true,commitment:"confirmed"}]);
    const value=result?.value;
    if(!value)return err("Solana RPC returned no simulation result",502);
    return json({ok:!value.err,simulation:value.err?"failed":"passed",broadcast:false,
      chain:"solana",slot:result.context?.slot??null,error:value.err||null,
      logs:(value.logs||[]).slice(-30),unitsConsumed:value.unitsConsumed??null,
      returnData:value.returnData??null,
      warnings:["Signature verification is disabled for this unsigned simulation.",
        "This does not verify that the wallet owner approved the transaction.",
        "No transaction was broadcast."]});
  } catch(e){return err(`Solana simulation RPC error: ${e.message}`,502);}
}


const QUOTE_CHAINS = { ethereum:1, bnb:56, base:8453, arbitrum:42161 };
function cleanQuoteNumber(value) {
  if (value === undefined || value === null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
async function getDexQuote(request, env, body) {
  const session = await readSession(request, env);
  if (!session) return err("Wallet authentication required", 401);
  const { chain, inputToken, outputToken, amount } = body;
  if (chain !== session.chain) return err("Quote chain must match authenticated wallet session", 403);
  if (!CHAINS[chain] || chain === "ton") return err("TON quote adapter is not enabled. Supported quote chains: Solana, Ethereum, BNB, Base, Arbitrum.");
  if (typeof inputToken !== "string" || inputToken.length < 20 || inputToken.length > 100 ||
      typeof outputToken !== "string" || outputToken.length < 20 || outputToken.length > 100)
    return err("Input and output token addresses/mints are required");
  if (inputToken === outputToken) return err("Input and output token must be different");
  if (typeof amount !== "string" || !/^\d{1,78}$/.test(amount) || BigInt(amount) <= 0n)
    return err("Amount must be a positive integer in the input token's smallest unit");
  try {
    let provider, result;
    if (chain === "solana") {
      const params = new URLSearchParams({ inputMint: inputToken, outputMint: outputToken, amount, taker: session.sub });
      const headers = { accept: "application/json" };
      if (env.JUPITER_API_KEY) headers["x-api-key"] = env.JUPITER_API_KEY;
      const r = await fetch(`https://api.jup.ag/swap/v2/order?${params}`, { headers });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || d.message || `Jupiter returned HTTP ${r.status}`);
      provider = "Jupiter Swap API v2";
      result = {
        inputAmount: d.inAmount || amount,
        outputAmount: d.outAmount || d.outAmountResult || null,
        minOutputAmount: d.otherAmountThreshold || d.minOutAmount || null,
        priceImpactPct: cleanQuoteNumber(d.priceImpactPct ?? d.priceImpact),
        route: Array.isArray(d.routePlan) ? d.routePlan.map(x => ({
          venue: x.swapInfo?.label || x.label || "Jupiter route",
          inputMint: x.swapInfo?.inputMint || null,
          outputMint: x.swapInfo?.outputMint || null,
          percent: cleanQuoteNumber(x.percent)
        })) : [],
        networkFee: d.feeBps != null ? { feeBps: d.feeBps } : null,
        quoteId: d.requestId || null
      };
    } else {
      const chainId = QUOTE_CHAINS[chain];
      if (!env.ZEROX_API_KEY) return err("ZEROX_API_KEY is not configured on the server", 503);
      const params = new URLSearchParams({ sellToken: inputToken, buyToken: outputToken,
        sellAmount: amount, taker: session.sub, chainId: String(chainId) });
      const r = await fetch(`https://api.0x.org/swap/allowance-holder/price?${params}`, {
        headers: { "0x-api-key": env.ZEROX_API_KEY, "0x-version": "v2", accept: "application/json" }
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.reason || d.message || d.validationErrors?.[0]?.reason || `0x returned HTTP ${r.status}`);
      provider = "0x Swap API v2";
      result = {
        inputAmount: d.sellAmount || amount,
        outputAmount: d.buyAmount || null,
        minOutputAmount: d.minBuyAmount || null,
        priceImpactPct: cleanQuoteNumber(d.estimatedPriceImpact),
        route: Array.isArray(d.route?.fills) ? d.route.fills.map(x => ({
          venue: x.source || "0x liquidity source",
          proportionBps: cleanQuoteNumber(x.proportionBps)
        })) : [],
        gas: d.gas || null,
        gasPrice: d.gasPrice || null,
        estimatedGas: d.estimatedGas || null,
        allowanceTarget: d.allowanceTarget?.address || null,
        issues: d.issues || null
      };
    }
    if (!result.outputAmount) throw new Error("Provider returned no output amount; no usable route was found.");
    return json({ ok: true, quoteOnly: true, broadcast: false, signed: false,
      chain, provider, wallet: session.sub, fetchedAt: new Date().toISOString(),
      expiresInSeconds: 20, ...result,
      warnings: ["Indicative quote only; execution price and route may change.",
        "Amounts are raw token units; token decimals and symbols must be verified by the UI/token metadata layer.",
        "No approval, wallet signature, or transaction broadcast occurred.",
        "Allowance target is informational only. Do not approve unlimited token allowance by default."] });
  } catch (e) { return err(`Quote provider error: ${e.message}`, 502); }
}

function decodeWordAddress(word) {
  if (!/^[0-9a-fA-F]{64}$/.test(word) || !/^0{24}/i.test(word)) return null;
  return "0x" + word.slice(24).toLowerCase();
}
function decodeErc20Call(data) {
  if (typeof data !== "string" || !/^0x(?:[0-9a-fA-F]{2})*$/.test(data) || data.length > 200002)
    throw new Error("Calldata must be even-length hex under 100 KB");
  const hex = data.slice(2).toLowerCase();
  if (hex.length < 8) return { method: "native_or_empty_call", recognized: false, risk: "unknown" };
  const selector = hex.slice(0, 8), args = hex.slice(8);
  const word = (i) => args.slice(i * 64, (i + 1) * 64);
  const amount = (v) => v && /^[0-9a-f]{64}$/.test(v) ? BigInt("0x" + v).toString() : null;
  if (selector === "095ea7b3") {
    if (args.length !== 128) throw new Error("Malformed ERC-20 approve(address,uint256) calldata");
    const spender = decodeWordAddress(word(0)), value = amount(word(1));
    if (!spender || value === null) throw new Error("Malformed approve arguments");
    const unlimited = BigInt(value) >= (1n << 255n);
    return { method: "approve(address,uint256)", selector: "0x"+selector, recognized: true,
      spender, allowanceRaw: value, unlimitedApproval: unlimited,
      risk: unlimited ? "critical" : BigInt(value) === 0n ? "low" : "elevated",
      findings: [unlimited ? "Unlimited token allowance detected." : BigInt(value) === 0n ? "Allowance is being set to zero." : "Finite token allowance detected."],
      recommendation: unlimited ? "Reject unless unlimited approval is explicitly intended; prefer exact-amount approval." : "Verify spender identity and token decimals before signing." };
  }
  if (selector === "a22cb465") {
    if (args.length !== 128) throw new Error("Malformed setApprovalForAll(address,bool) calldata");
    const operator = decodeWordAddress(word(0)), enabled = BigInt("0x"+word(1)) !== 0n;
    if (!operator || !/^[0-9a-f]{64}$/.test(word(1)) || BigInt("0x"+word(1)) > 1n) throw new Error("Malformed operator approval arguments");
    return { method:"setApprovalForAll(address,bool)",selector:"0x"+selector,recognized:true,operator,enabled,
      risk:enabled?"critical":"low",findings:[enabled?"Operator receives approval over all assets in this collection.":"Operator-wide approval is being revoked."],
      recommendation:"Verify the operator contract and collection before signing." };
  }
  if (selector === "a9059cbb") {
    if (args.length !== 128) throw new Error("Malformed transfer(address,uint256) calldata");
    const recipient=decodeWordAddress(word(0)), value=amount(word(1)); if(!recipient||value===null)throw new Error("Malformed transfer arguments");
    return {method:"transfer(address,uint256)",selector:"0x"+selector,recognized:true,recipient,amountRaw:value,risk:"high",findings:["Direct token transfer: assets leave the token contract balance of the sender."],recommendation:"Confirm recipient and amount independently."};
  }
  if (selector === "23b872dd") {
    if (args.length !== 192) throw new Error("Malformed transferFrom(address,address,uint256) calldata");
    const from=decodeWordAddress(word(0)),to=decodeWordAddress(word(1)),value=amount(word(2));if(!from||!to||value===null)throw new Error("Malformed transferFrom arguments");
    return {method:"transferFrom(address,address,uint256)",selector:"0x"+selector,recognized:true,from,to,amountRaw:value,risk:"high",findings:["Third-party token transfer call. Existing allowance or authorization may be consumed."],recommendation:"Verify owner, recipient, amount, and the calling contract."};
  }
  if (selector === "39509351") {
    if (args.length !== 128) throw new Error("Malformed increaseAllowance(address,uint256) calldata");
    const spender=decodeWordAddress(word(0)),value=amount(word(1));if(!spender||value===null)throw new Error("Malformed allowance arguments");
    return {method:"increaseAllowance(address,uint256)",selector:"0x"+selector,recognized:true,spender,incrementRaw:value,risk:"elevated",findings:["Existing allowance is being increased."],recommendation:"Check current allowance and the exact increment before signing."};
  }
  return {method:"unknown_selector",selector:"0x"+selector,recognized:false,risk:"unknown",findings:["Function selector is not recognized by this basic ERC-20 decoder."],recommendation:"Do not sign based on this decoder. Inspect verified contract source and ABI."};
}
async function inspectEvmTransaction(request, env, body) {
  const session=await readSession(request,env);
  if(!session)return err("Wallet authentication required",401);
  if(!RPC_CHAIN[session.chain])return err("This inspection endpoint supports EVM-authenticated sessions only",403);
  const {to,data="0x",value="0"}=body;
  if(!/^0x[a-fA-F0-9]{40}$/.test(to||""))return err("Destination must be a valid EVM address");
  let nativeValue;try{nativeValue=BigInt(value);if(nativeValue<0n||nativeValue>=(1n<<256n))throw Error();}catch{return err("value must be an unsigned integer in wei");}
  try {
    const decoded=decodeErc20Call(data);
    const rpc=env[RPC_CHAIN[session.chain].env];
    let chainVerified=false;
    if(rpc){const chainId=hexToBigInt(await rpcCall(rpc,"eth_chainId"));chainVerified=chainId===BigInt(RPC_CHAIN[session.chain].chainId);if(!chainVerified)return err("Configured RPC endpoint reports the wrong chain ID",502);}
    const riskRank={low:0,elevated:1,high:2,critical:3,unknown:2};
    let risk=decoded.risk;
    if(nativeValue>0n && riskRank[risk]<riskRank.high)risk="high";
    return json({ok:true,inspectionOnly:true,broadcast:false,chain:session.chain,chainId:RPC_CHAIN[session.chain].chainId,
      from:session.sub,to:to.toLowerCase(),nativeValueWei:nativeValue.toString(),decoded,risk,
      rpcChainVerified:chainVerified,
      warnings:["This is a selector-level decoder, not full ABI or bytecode verification.","A decoded spender/operator is not proof that it is a trusted protocol.","Proxy upgrades, delegatecall, hidden side effects, token tax, and malicious contract logic are not detected.","Never sign solely because this inspection reports low risk.","No approval, signature, or transaction broadcast occurred."]});
  } catch(e){return err(`Transaction inspection failed: ${e.message}`);}
}



const EIP1967_IMPL_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
function slotAddress(value) {
  if (typeof value !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(value)) return null;
  const tail = value.slice(-40).toLowerCase();
  return /^0{40}$/.test(tail) ? null : "0x" + tail;
}
async function spenderIntel(request, env, body) {
  const session = await readSession(request, env);
  if (!session) return err("Wallet authentication required", 401);
  const cfg = RPC_CHAIN[session.chain];
  if (!cfg) return err("Spender intelligence currently supports EVM chains only", 403);
  const { token, spender } = body;
  if (!/^0x[a-fA-F0-9]{40}$/.test(token || "") || !/^0x[a-fA-F0-9]{40}$/.test(spender || ""))
    return err("Token and spender must be valid EVM addresses");
  const rpc = env[cfg.env];
  if (!rpc) return err(`${cfg.env} is not configured on the server`, 503);
  try {
    const chainId = Number(hexToBigInt(await rpcCall(rpc, "eth_chainId")));
    if (chainId !== cfg.chainId) return err("Configured RPC endpoint reports the wrong chain ID", 502);
    const [tokenCode, spenderCode] = await Promise.all([
      rpcCall(rpc, "eth_getCode", [token, "latest"]), rpcCall(rpc, "eth_getCode", [spender, "latest"])
    ]);
    const tokenHasCode = typeof tokenCode === "string" && tokenCode !== "0x";
    const spenderHasCode = typeof spenderCode === "string" && spenderCode !== "0x";
    let implementation = null, proxySlotReadable = false;
    if (spenderHasCode) {
      implementation = slotAddress(await rpcCall(rpc, "eth_getStorageAt", [spender, EIP1967_IMPL_SLOT, "latest"]));
      proxySlotReadable = true;
    }
    const registry = (() => { try { return JSON.parse(env.TRUSTED_SPENDER_REGISTRY || "{}"); } catch { return {}; } })();
    const entry = registry[`${session.chain}:${spender.toLowerCase()}`] || null;
    const expectedCodeHash = entry && typeof entry.codeHashSha256 === "string" ? entry.codeHashSha256.toLowerCase().replace(/^0x/, "") : null;
    const actualCodeHash = spenderHasCode
      ? Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(spenderCode))))
          .map(x => x.toString(16).padStart(2, "0")).join("") : null;
    const codeHashMatches = expectedCodeHash ? expectedCodeHash === actualCodeHash : null;
    const registryStatus = !entry ? "not_listed" : expectedCodeHash && !codeHashMatches ? "code_hash_mismatch" : "operator_configured";
    const findings = [];
    if (!tokenHasCode) findings.push("Token address has no deployed bytecode on the selected chain.");
    if (!spenderHasCode) findings.push("Spender address has no deployed bytecode; it may be an EOA or invalid address.");
    if (implementation) findings.push(`EIP-1967 implementation slot points to ${implementation}. Review implementation separately.`);
    if (registryStatus === "not_listed") findings.push("Spender is not in the operator-maintained registry. This does not prove it is malicious.");
    if (registryStatus === "code_hash_mismatch") findings.push("Spender bytecode hash differs from the operator registry entry. Treat as high risk.");
    if (registryStatus === "operator_configured" && !expectedCodeHash) findings.push("Spender is listed by operator configuration, but no code hash pin is configured.");
    const risk = !tokenHasCode || !spenderHasCode || registryStatus === "code_hash_mismatch" ? "high"
      : registryStatus === "operator_configured" && expectedCodeHash && codeHashMatches ? "registry_match" : "unverified";
    return json({ok:true,inspectionOnly:true,broadcast:false,chain:session.chain,chainId,wallet:session.sub,
      token:token.toLowerCase(),spender:spender.toLowerCase(),tokenHasCode,spenderHasCode,spenderBytecodeSha256:actualCodeHash,
      proxy:{eip1967ImplementationSlotRead:proxySlotReadable,implementation},
      registry:{status:registryStatus,label:entry?.label||null,source:entry?.source||null,expectedCodeHashSha256:expectedCodeHash,codeHashMatches},
      risk,findings,warnings:[
        "Registry entries are supplied by the LIMFXAI operator; they are not independently certified.",
        "Only the EIP-1967 implementation slot is checked; beacon, diamond, custom proxy, delegatecall, and upgrade-admin risks may remain.",
        "Bytecode hash pinning is SHA-256 of the RPC-returned hex string, not audited source-code verification.",
        "This endpoint does not prove token legitimacy, audit protocol behavior, or read the current allowance.",
        "Never sign solely because a spender appears in the configured registry. No signature or transaction was created."
      ]});
  } catch(e) { return err(`Spender intelligence failed: ${e.message}`,502); }
}

async function tokenResearch(chain, address) {
  if (!CHAINS[chain]) throw new Error("Unsupported chain");
  if (!address || address.length < 20 || address.length > 100) throw new Error("Token address looks invalid");
  const url = `https://api.dexscreener.com/latest/dex/tokens/${encodeURIComponent(address)}`;
  const res = await fetch(url, { headers: { "accept": "application/json" } });
  if (!res.ok) throw new Error(`Market data provider returned ${res.status}`);
  const body = await res.json();
  const pairs = (body.pairs || []).filter(p => {
    const chainId = String(p.chainId || "").toLowerCase();
    const map = { solana:"solana", ethereum:"ethereum", bnb:"bsc", ton:"ton", base:"base", arbitrum:"arbitrum" };
    return chainId === map[chain];
  }).slice(0, 8);
  if (!pairs.length) return { chain, address, found: false, note: "No matching pair found for this chain." };
  const p = pairs.sort((a,b) => Number(b.liquidity?.usd || 0) - Number(a.liquidity?.usd || 0))[0];
  const liq = Number(p.liquidity?.usd || 0), vol24 = Number(p.volume?.h24 || 0), fdv = Number(p.fdv || 0);
  const priceChange = p.priceChange || {}, flags = [];
  if (liq < 10000) flags.push("Liquidity below $10k: high slippage/exit risk.");
  if (vol24 < 1000) flags.push("24h volume below $1k: low trading activity.");
  if (fdv > 0 && liq > 0 && fdv / liq > 100) flags.push("FDV-to-liquidity ratio above 100: liquidity may be thin relative to valuation.");
  if (Math.abs(Number(priceChange.h24 || 0)) > 50) flags.push("24h price move exceeds 50%: elevated volatility.");
  return {chain,address,found:true,token:{name:p.baseToken?.name,symbol:p.baseToken?.symbol,priceUsd:p.priceUsd},
    pair:p.pairAddress,dex:p.dexId,url:p.url,metrics:{liquidityUsd:liq,volume24hUsd:vol24,fdvUsd:fdv,priceChange24hPct:Number(priceChange.h24||0)},
    screening:{flags,severity:flags.length>=3?"high":flags.length?"elevated":"no-basic-flags"},
    disclaimer:"Screening only. This is not an audit, honeypot test, or guarantee of safety."};
}
async function askAI(env, provider, messages, research) {
  const system=`You are LIMFXAI, a cautious multi-chain research assistant. Analyze evidence, separate facts from assumptions, state uncertainty, and never claim a token is safe based only on market metrics. Never request seed phrases/private keys. Never initiate or execute transactions. A wallet login signature is not a trade approval.`;
  const transcript=[{role:"system",content:system}];
  if(research)transcript.push({role:"system",content:`Latest token screening data:\n${JSON.stringify(research)}`});
  transcript.push(...messages.slice(-16).filter(m=>["user","assistant"].includes(m.role)&&typeof m.content==="string").map(m=>({role:m.role,content:m.content.slice(0,6000)})));
  const isOpen=provider==="openai", key=isOpen?env.OPENAI_API_KEY:env.XAI_API_KEY;
  if(!["openai","xai"].includes(provider))throw new Error("Provider must be openai or xai");
  if(!key)throw new Error(`${isOpen?"OPENAI_API_KEY":"XAI_API_KEY"} is not configured`);
  const r=await fetch(isOpen?"https://api.openai.com/v1/chat/completions":"https://api.x.ai/v1/chat/completions",{
    method:"POST",headers:{authorization:`Bearer ${key}`,"content-type":"application/json"},
    body:JSON.stringify({model:isOpen?(env.OPENAI_MODEL||"gpt-4.1-mini"):(env.XAI_MODEL||"grok-3-mini"),messages:transcript,temperature:0.2})
  });
  const d=await r.json();if(!r.ok)throw new Error(d.error?.message||"AI request failed");
  return d.choices?.[0]?.message?.content||"No response returned.";
}
export default {
 async fetch(request,env) {
  const url=new URL(request.url);
  if(request.method==="OPTIONS")return new Response(null,{headers:{"access-control-allow-origin":"*","access-control-allow-methods":"GET,POST,OPTIONS","access-control-allow-headers":"content-type,authorization"}});
  try {
   if(url.pathname==="/api/rpc/health"&&request.method==="GET"){const targets=[...Object.entries(RPC_CHAIN).map(([chain,cfg])=>[chain,cfg.env,cfg.chainId]),["solana","RPC_SOLANA","ok"]];const checks=await Promise.all(targets.map(async ([chain,key,expected])=>{if(!env[key])return {chain,ok:false,error:"RPC not configured"};try{const result=await rpcCall(env[key],chain==="solana"?"getHealth":"eth_chainId");const actual=chain==="solana"?result:Number(hexToBigInt(result));return {chain,ok:actual===expected,expected,actual};}catch(e){return {chain,ok:false,error:e.message};}}));return json({ok:checks.every(x=>x.ok),checks});}
    if(url.pathname==="/api/health")return json({ok:true,service:"LIMFXAI Agent Engine",version:"0.9.0",chains:Object.keys(CHAINS),walletAuth:{evm:true,solana:true,ton:false}});
   if(url.pathname==="/api/chains")return json(CHAINS);
   if(url.pathname==="/api/auth/challenge"&&request.method==="POST")return createChallenge(request,env,await request.json());
   if(url.pathname==="/api/auth/verify"&&request.method==="POST")return verifyChallenge(env,await request.json());
   if(url.pathname==="/api/simulate/evm"&&request.method==="POST")return simulateEvm(request,env,await request.json());
   if(url.pathname==="/api/simulate/solana"&&request.method==="POST")return simulateSolana(request,env,await request.json());
   if(url.pathname==="/api/quote"&&request.method==="POST")return getDexQuote(request,env,await request.json());
   if(url.pathname==="/api/security/inspect-evm"&&request.method==="POST")return inspectEvmTransaction(request,env,await request.json());
   if(url.pathname==="/api/security/spender-intel"&&request.method==="POST")return spenderIntel(request,env,await request.json());
   if(url.pathname==="/api/forensics/token"&&request.method==="GET"){try{return json(await tokenForensics(url.searchParams.get("chain"),url.searchParams.get("address"),env));}catch(e){return err(e.message,502);}}
    if(url.pathname==="/api/research/token"&&request.method==="GET"){
    try{return json(await tokenResearch(url.searchParams.get("chain"),url.searchParams.get("address")));}catch(e){return err(e.message,502);}
   }
   if(url.pathname==="/api/chat"&&request.method==="POST"){
    const b=await request.json();if(!Array.isArray(b.messages)||!b.messages.length)return err("messages is required");
    let research=null;if(b.research?.chain&&b.research?.address){try{research=await tokenResearch(b.research.chain,b.research.address);}catch(e){research={error:e.message};}}
    return json({reply:await askAI(env,b.provider||"openai",b.messages,research),researchAttached:!!research});
   }
   if(url.pathname==="/api/trade-intents"&&request.method==="POST"){
    const session=await readSession(request,env);if(!session)return err("Wallet authentication required",401);
    const b=await request.json(),required=["wallet","chain","asset","side","amount","rationale"];
    if(required.some(k=>!b[k]))return err("Missing required proposal fields");
    if(!CHAINS[b.chain])return err("Unsupported chain");
    if(!["buy","sell"].includes(b.side))return err("side must be buy or sell");
    if(b.wallet.toLowerCase()!==session.sub.toLowerCase()||b.chain!==session.chain)return err("Proposal wallet/chain must match authenticated session",403);
    const id=uid();
    await env.DB.prepare("INSERT INTO trade_intents(id,wallet,chain,asset,side,amount,rationale) VALUES(?,?,?,?,?,?,?)")
      .bind(id,b.wallet,b.chain,b.asset,b.side,String(b.amount),String(b.rationale).slice(0,2000)).run();
    return json({id,status:"proposed",message:"Proposal stored. No transaction or wallet signature has occurred."},201);
   }
   if(url.pathname.startsWith("/api/trade-intents/")&&request.method==="POST"){
    const session=await readSession(request,env);if(!session)return err("Wallet authentication required",401);
    const id=url.pathname.split("/").pop(),b=await request.json();
    if(!["approve","reject"].includes(b.action))return err("action must be approve or reject");
    const row=await env.DB.prepare("SELECT wallet,chain FROM trade_intents WHERE id=?").bind(id).first();
    if(!row)return err("Proposal not found",404);
    if(row.wallet.toLowerCase()!==session.sub.toLowerCase()||row.chain!==session.chain)return err("Not authorized for this proposal",403);
    const status=b.action==="approve"?"approval_recorded":"rejected";
    const result=await env.DB.prepare("UPDATE trade_intents SET status=? WHERE id=? AND status='proposed'").bind(status,id).run();
    if(!result.meta?.changes)return err("Proposal is no longer pending",409);
    return json({id,status,message:status==="approval_recorded"?"Approval was recorded in the app database only; this is NOT a wallet signature or blockchain execution.":"Proposal rejected. No transaction was sent."});
   }
   if(url.pathname==="/api/trade-intents"&&request.method==="GET"){
    const session=await readSession(request,env);if(!session)return err("Wallet authentication required",401);
    const wallet=url.searchParams.get("wallet");if(!wallet||wallet.toLowerCase()!==session.sub.toLowerCase())return err("Wallet must match authenticated session",403);
    const rows=await env.DB.prepare("SELECT id,wallet,chain,asset,side,amount,rationale,status,created_at FROM trade_intents WHERE wallet=? ORDER BY created_at DESC LIMIT 50").bind(wallet).all();
    return json({items:rows.results||[]});
   }
   if(url.pathname.startsWith("/api/"))return err("Not found",404);
   return env.ASSETS.fetch(request);
  }catch(e){return err(e.message||"Internal error",500);}
 }
};

// FEATURE 01 — ON-CHAIN FORENSICS
async function tokenForensics(chain,address,env) {
  if(!CHAINS[chain])throw new Error("Unsupported chain");
  if(typeof address!=="string")throw new Error("Token address is required");

  if(chain==="solana") {
    if(!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address))throw new Error("Invalid Solana mint address");
    if(!env.RPC_SOLANA)throw new Error("RPC_SOLANA is not configured");

    const [supplyResult,largestResult]=await Promise.all([
      rpcCall(env.RPC_SOLANA,"getTokenSupply",[address,{commitment:"confirmed"}]),
      rpcCall(env.RPC_SOLANA,"getTokenLargestAccounts",[address,{commitment:"confirmed"}])
    ]);

    const supply=supplyResult?.value;
    if(!supply)throw new Error("Token supply unavailable");

    const total=BigInt(supply.amount||"0");
    const accounts=largestResult?.value||[];

    const holders=await Promise.all(accounts.slice(0,20).map(async item=>{
      try {
        const info=await rpcCall(env.RPC_SOLANA,"getAccountInfo",[
          item.address,{encoding:"jsonParsed",commitment:"confirmed"}
        ]);
        const parsed=info?.value?.data?.parsed?.info;
        const amount=BigInt(item.amount||"0");
        return {
          tokenAccount:item.address,
          owner:parsed?.owner||null,
          amount:item.uiAmountString||"0",
          percentage:total>0n?Number(amount*1000000n/total)/10000:0,
          ownerStatus:parsed?.owner?"identified":"unavailable"
        };
      } catch {
        return {tokenAccount:item.address,amount:item.uiAmountString||"0",owner:null,ownerStatus:"unavailable"};
      }
    }));

    const grouped=new Map();
    for(const h of holders) {
      const key=h.owner||h.tokenAccount;
      const old=grouped.get(key);
      if(old) {
        old.amount=String(Number(old.amount)+Number(h.amount));
        old.percentage+=h.percentage;
        old.tokenAccounts++;
      } else {
        grouped.set(key,{...h,tokenAccounts:1});
      }
    }

    return {
      ok:true,chain,address,analysis:"partial_rpc_snapshot",
      contractAudit:{status:"not_applicable",note:"Solana programs require program-specific analysis."},
      supply:{amount:supply.uiAmountString,decimals:supply.decimals},
      topHolders:[...grouped.values()].sort((a,b)=>b.percentage-a.percentage),
      coverage:{tokenAccountsInspected:accounts.length,limit:20,complete:false},
      walletIntelligence:{status:"pending_indexer",bots:"unverified",scamLabels:"unverified",kolAttribution:"unverified",bubbleMap:"pending_transfer_graph"},
      warnings:["Largest token accounts are not a complete holder list.","Some token accounts may not expose owner data.","No wallet is labeled malicious without verified evidence."]
    };
  }

  const cfg=RPC_CHAIN[chain];
  if(!cfg)throw new Error("Forensics RPC is not available for this chain");
  if(!/^0x[a-fA-F0-9]{40}$/.test(address))throw new Error("Invalid EVM contract address");
  const rpc=env[cfg.env];
  if(!rpc)throw new Error(`${cfg.env} is not configured`);

  const code=await rpcCall(rpc,"eth_getCode",[address,"latest"]);
  if(!code||code==="0x") {
    return {ok:true,chain,address,contractAudit:{status:"no_contract_code",risk:"not_applicable",findings:["No deployed contract bytecode found. This may be an EOA wallet or an undeployed address; this alone is not evidence of a scam."]},holderAnalysis:{status:"unsupported_without_indexer"}};
  }

  async function call(selector) {
    try{return await rpcCall(rpc,"eth_call",[{to:address,data:selector},"latest"]);}
    catch{return null;}
  }

  const [supplyRaw,decimalsRaw,ownerRaw,pausedRaw,proxyRaw]=await Promise.all([
    call("0x18160ddd"),
    call("0x313ce567"),
    call("0x8da5cb5b"),
    call("0x5c975abb"),
    rpcCall(rpc,"eth_getStorageAt",[address,"0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc","latest"]).catch(()=>null)
  ]);

  const implementation=slotAddress(proxyRaw);

  const findings=[];
  if(code.length<100)findings.push("Very small runtime bytecode; manual review recommended.");
  if(implementation)findings.push("EIP-1967 implementation slot detected; proxy implementation requires separate review.");
  if(ownerRaw&&/^0x0{24}[a-fA-F0-9]{40}$/.test(ownerRaw))findings.push("Contract exposes an owner() response; privileged functions require source-level review.");
  if(pausedRaw==="0x"+"0".repeat(63)+"1")findings.push("paused() currently reports true.");

  return {
    ok:true,chain,address,analysis:"rpc_static_screening",
    contractAudit:{
      status:"automated_preliminary_screening",
      bytecodeBytes:(code.length-2)/2,
      totalSupply:supplyRaw?BigInt(supplyRaw).toString():null,
      decimals:decimalsRaw?Number(BigInt(decimalsRaw)):null,
      owner:ownerRaw&&/^0x[a-fA-F0-9]{64}$/.test(ownerRaw)?"0x"+ownerRaw.slice(-40):null,
      paused:pausedRaw&&/^0x0{63}[01]$/.test(pausedRaw)?BigInt(pausedRaw)===1n:null,
      proxy:{detected:!!implementation,implementation},
      findings,
      sourceVerification:"not_checked",
      formalAudit:"not_performed"
    },
    holderAnalysis:{status:"requires_external_indexer"},
    walletIntelligence:{status:"pending_indexer",bots:"unverified",scamLabels:"unverified",kolAttribution:"unverified",bubbleMap:"pending_transfer_graph"},
    warnings:["RPC screening is not a source-code audit.","Selector responses do not prove the absence or presence of vulnerabilities.","No CertiK certification is implied."]
  };
}
