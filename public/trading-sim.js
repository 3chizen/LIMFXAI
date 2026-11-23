// LIMFXAI — split from public/app.js. Keep these as classic scripts in loader order.

// // Read-only transaction simulation; endpoint never broadcasts a transaction.
$('simType').onchange=()=>{
 const sol=$('simType').value==='solana';
 $('evmSimFields').style.display=sol?'none':'block';
 $('solSimFields').style.display=sol?'block':'none';
};
$('runSimulation').onclick=async()=>{
 if(!authSession||authSession.expiresAt<Date.now()){ $('simResult').textContent='Authenticate your wallet first.';return; }
 const sol=$('simType').value==='solana';
 let endpoint,body;
 if(sol){endpoint='/api/simulate/solana';body={serializedTransaction:$('simSolTx').value.trim()};}
 else {
  const rawValue=$('simValue').value.trim();
  if(!/^\d+$/.test(rawValue)){ $('simResult').textContent='Native value must be an integer amount in wei.';return; }
  endpoint='/api/simulate/evm';body={chain:authSession.chain,to:$('simTo').value.trim(),data:$('simData').value.trim()||'0x',value:'0x'+BigInt(rawValue).toString(16)};
 }
 $('runSimulation').disabled=true;$('simResult').textContent='Calling read-only RPC simulation…';
 try{
  const r=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json','authorization':`Bearer ${authSession.token}`},body:JSON.stringify(body)});
  const d=await r.json();if(!r.ok)throw Error(d.error||'Simulation request failed');
  $('simResult').textContent=JSON.stringify(d,null,2);
 }catch(e){$('simResult').textContent='Simulation error: '+e.message}
 finally{$('runSimulation').disabled=false}
};


// DEX quote preview only. This endpoint never returns an executable transaction.
$('quoteChain').onchange=()=>{
 const c=$('quoteChain').value;
 if(authSession && authSession.chain!==c) $('quoteResult').textContent=`Selected ${c}. Authenticate a wallet on ${c} before requesting a quote.`;
};
$('getQuote').onclick=async()=>{
 if(!authSession||authSession.expiresAt<Date.now()){$('quoteResult').textContent='Authenticate your wallet first.';return;}
 const chain=$('quoteChain').value;
 if(authSession.chain!==chain){$('quoteResult').textContent=`Wallet session is ${authSession.chain}; selected quote chain is ${chain}. Re-authenticate on the same chain.`;return;}
 const body={chain,inputToken:$('quoteInputToken').value.trim(),outputToken:$('quoteOutputToken').value.trim(),amount:$('quoteAmount').value.trim()};
 $('getQuote').disabled=true;$('quoteResult').textContent='Requesting indicative route from aggregator…';
 try{
  const r=await fetch('/api/quote',{method:'POST',headers:{'content-type':'application/json','authorization':`Bearer ${authSession.token}`},body:JSON.stringify(body)});
  const d=await r.json();if(!r.ok)throw Error(d.error||'Quote request failed');
  $('quoteResult').textContent=JSON.stringify(d,null,2);
 }catch(e){$('quoteResult').textContent='Quote error: '+e.message}
 finally{$('getQuote').disabled=false}
};


// Create a wallet-bound Jupiter order. This step never signs or broadcasts.
$('createSolanaOrder').onclick=async()=>{
 const session=authSession;
 const generation=authGeneration;
 if(!session||session.expiresAt<Date.now()){
  $('solanaOrderResult').textContent='Authenticate your Solana wallet first.';
  return;
 }
 if(session.chain!=='solana'||$('quoteChain').value!=='solana'||authWalletSource!=='solana'){
  $('solanaOrderResult').textContent='A verified Solana wallet session and Solana quote network are required.';
  return;
 }
 const wallet=session.wallet;
 const body={
  chain:'solana',
  inputToken:$('quoteInputToken').value.trim(),
  outputToken:$('quoteOutputToken').value.trim(),
  amount:$('quoteAmount').value.trim()
 };
 $('createSolanaOrder').disabled=true;
 pendingSolanaOrder=null;
 $('signExecuteSolanaOrder').disabled=true;
 $('solanaOrderResult').textContent='Requesting unsigned Jupiter order…';
 try{
  await assertAuthContext(generation,'solana',wallet);
  const response=await fetch('/api/swap/solana/order',{
   method:'POST',
   headers:{
    'content-type':'application/json',
    'authorization':`Bearer ${session.token}`
   },
   body:JSON.stringify(body)
  });
  const data=await response.json();
  await assertAuthContext(generation,'solana',wallet);
  if(authSession!==session)throw Error('Wallet session changed while creating the order.');
  if(!response.ok)throw Error(data.error||'Solana order request failed');
  if(data.chain!=='solana'||data.wallet!==wallet||data.unsigned!==true||
     data.signed!==false||data.broadcast!==false||
     typeof data.transaction!=='string'||!data.transaction||
     typeof data.requestId!=='string'||!data.requestId||
     typeof data.orderId!=='string'||!/^[A-Za-z0-9_-]{8,128}$/.test(data.orderId)){
   throw Error('Jupiter order response failed wallet and unsigned-transaction validation.');
  }
  pendingSolanaOrder={
   wallet,
   generation,
   orderId:data.orderId,
   transaction:data.transaction,
   requestId:data.requestId,
   inputToken:body.inputToken,
   outputToken:body.outputToken,
   inputAmount:data.inputAmount,
   outputAmount:data.outputAmount,
   minOutputAmount:data.minOutputAmount,
   router:data.router,
   mode:data.mode,
   lastValidBlockHeight:data.lastValidBlockHeight,
   expiresAt:data.expiresAt,
   createdAt:Date.now()
  };
  $('signExecuteSolanaOrder').disabled=data.executionEnabled!==true;
  $('solanaOrderResult').textContent=JSON.stringify({
   status:'UNSIGNED ORDER READY',
   wallet:data.wallet,
   provider:data.provider,
   inputAmount:data.inputAmount,
   outputAmount:data.outputAmount,
   minOutputAmount:data.minOutputAmount,
   router:data.router,
   mode:data.mode,
   lastValidBlockHeight:data.lastValidBlockHeight,
   expiresAt:data.expiresAt,
   signed:false,
   broadcast:false,
   executionEnabled:data.executionEnabled===true,
   nextStep:data.executionEnabled===true?'Review transaction before explicit wallet signing.':'Execution is disabled on the server; no signing is available.'
  },null,2);
 }catch(error){
  pendingSolanaOrder=null;
  $('signExecuteSolanaOrder').disabled=true;
  $('solanaOrderResult').textContent='Solana order error: '+error.message;
 }finally{
  $('createSolanaOrder').disabled=false;
 }
};

// Explicit Solana wallet signing followed by one backend execution request.
$('signExecuteSolanaOrder').onclick=async()=>{
 const button=$('signExecuteSolanaOrder');
 if(button.disabled)return;
 const pending=pendingSolanaOrder;
 const session=authSession;
 const provider=solanaProvider;
 let submissionAttempted=false;
 button.disabled=true;

 try{
  if(!pending||!session||session.expiresAt<Date.now())
   throw Error('Order or authenticated wallet session is missing or expired.');
  if(session.chain!=='solana'||authWalletSource!=='solana')
   throw Error('An authenticated Solana wallet is required.');
  if(pending.wallet!==session.wallet||pending.generation!==authGeneration)
   throw Error('The pending order no longer matches the active wallet session.');
  if(!provider||window.solana!==provider||typeof provider.signTransaction!=='function')
   throw Error('The connected wallet does not expose signTransaction().');

  const expiry=Date.parse(pending.expiresAt);
  if(!Number.isFinite(expiry)||expiry<=Date.now())
   throw Error('The unsigned order has expired. Create a fresh order.');

  await assertAuthContext(pending.generation,'solana',pending.wallet);
  if(authSession!==session||pendingSolanaOrder!==pending)
   throw Error('Wallet session or pending order changed.');

  const adapter=window.LIMFXAISolana;
  if(!adapter||typeof adapter.deserializeTransaction!=='function')
   throw Error('Solana transaction adapter is unavailable.');

  const unsignedTx=adapter.deserializeTransaction(pending.transaction);
  const payer=unsignedTx.message.staticAccountKeys?.[0]?.toBase58?.();
  if(payer!==pending.wallet)
   throw Error('Transaction fee payer does not match the authenticated wallet.');

  const originalMessage=unsignedTx.message.serialize();
  const summary=[
   'Review this Solana transaction in your wallet.',
   'Wallet: '+pending.wallet,
   'Input token: '+String(pending.inputToken),
   'Output token: '+String(pending.outputToken),
   'Input amount (raw units): '+String(pending.inputAmount),
   'Quoted output (raw units): '+String(pending.outputAmount),
   'Minimum output (raw units): '+String(pending.minOutputAmount),
   'Router: '+String(pending.router),
   'Order ID: '+pending.orderId,
   '',
   'Only continue if the wallet transaction details match what you expect.'
  ].join('\n');
  if(!window.confirm(summary))
   throw Error('Signing cancelled by user.');

  await assertAuthContext(pending.generation,'solana',pending.wallet);
  if(authSession!==session||pendingSolanaOrder!==pending)
   throw Error('Wallet session or pending order changed before signing.');

  const signedTx=await provider.signTransaction(unsignedTx);
  await assertAuthContext(pending.generation,'solana',pending.wallet);
  if(session.expiresAt<Date.now())
   throw Error('Wallet session expired while the signing prompt was open. Create a fresh order.');
  if(Date.parse(pending.expiresAt)<=Date.now())
   throw Error('Solana order expired while the signing prompt was open. Create a fresh order.');
  if(authSession!==session||pendingSolanaOrder!==pending||window.solana!==provider)
   throw Error('Wallet or order changed while the wallet prompt was open.');
  if(!signedTx||typeof signedTx.serialize!=='function')
   throw Error('Wallet did not return a signed Solana transaction.');

  const signedPayer=signedTx.message.staticAccountKeys?.[0]?.toBase58?.();
  if(signedPayer!==pending.wallet)
   throw Error('Signed transaction fee payer changed.');
  const signedMessage=signedTx.message.serialize();
  if(originalMessage.length!==signedMessage.length||
     originalMessage.some((byte,index)=>byte!==signedMessage[index]))
   throw Error('Transaction message changed during wallet signing.');

  const signature=signedTx.signatures?.[0];
  if(!(signature instanceof Uint8Array)||signature.length!==64||
     signature.every(byte=>byte===0))
   throw Error('Wallet did not provide a valid fee payer signature.');

  const bytes=signedTx.serialize();
  let binary='';
  for(let offset=0;offset<bytes.length;offset+=8192)
   binary+=String.fromCharCode(...bytes.subarray(offset,offset+8192));
  const signedTransaction=btoa(binary);
  if(signedTransaction.length>200000)
   throw Error('Signed transaction exceeds the server size limit.');

  await assertAuthContext(pending.generation,'solana',pending.wallet);
  if(session.expiresAt<Date.now())
   throw Error('Wallet session expired before submission. Create a fresh order.');
  if(Date.parse(pending.expiresAt)<=Date.now())
   throw Error('Solana order expired before submission. Create a fresh order.');
  if(authSession!==session||pendingSolanaOrder!==pending)
   throw Error('Wallet session or order changed before submission.');

  // Consume the local order before the network request; never retry an ambiguous result.
  pendingSolanaOrder=null;
  $('solanaOrderResult').textContent='Wallet signature obtained. Sending the signed order once to Jupiter…';
  submissionAttempted=true;
  const response=await fetch('/api/swap/solana/execute',{
   method:'POST',
   headers:{
    'content-type':'application/json',
    'authorization':`Bearer ${session.token}`
   },
   body:JSON.stringify({
    orderId:pending.orderId,
    signedTransaction
   })
  });
  const result=await response.json().catch(()=>null);
  if(!result)
   throw Error('Execution response could not be read. Outcome may be unknown; do not resubmit.');
  $('solanaOrderResult').textContent=JSON.stringify({
   executionHttpStatus:response.status,
   ...result,
   warning:result.status==='unknown'||!response.ok
    ?'Do not resubmit this order. Reconcile its signature and execution status first.'
    :undefined
  },null,2);
  if(!response.ok)
   throw Error(result.message||result.error||'Execution was not confirmed. Do not resubmit this order.');
 }catch(error){
  if(submissionAttempted){
   pendingSolanaOrder=null;
   $('solanaOrderResult').textContent='EXECUTION OUTCOME MAY BE UNKNOWN. DO NOT RESUBMIT.\n'+error.message;
  }else{
   pendingSolanaOrder=null;
   $('solanaOrderResult').textContent='Solana signing/execution cancelled or rejected: '+error.message+'\nCreate a fresh order before trying again.';
  }
 }finally{
  button.disabled=true;
 }
};

// EVM transaction inspection is informational only; never signs or broadcasts.
$('inspectTx').onclick=async()=>{
 if(!authSession||authSession.expiresAt<Date.now()){$('inspectResult').textContent='Authenticate an EVM wallet first.';return;}
 if(!['ethereum','bnb','base','arbitrum'].includes(authSession.chain)){$('inspectResult').textContent='This inspector supports EVM wallet sessions only.';return;}
 const rawValue=$('inspectValue').value.trim();if(!/^\d+$/.test(rawValue)){$('inspectResult').textContent='Native value must be an integer amount in wei.';return;}
 const body={to:$('inspectTo').value.trim(),data:$('inspectData').value.trim()||'0x',value:rawValue};
 $('inspectTx').disabled=true;$('inspectResult').textContent='Decoding transaction and checking RPC chain…';
 try{const r=await fetch('/api/security/inspect-evm',{method:'POST',headers:{'content-type':'application/json','authorization':`Bearer ${authSession.token}`},body:JSON.stringify(body)});const d=await r.json();if(!r.ok)throw Error(d.error||'Inspection failed');$('inspectResult').textContent=JSON.stringify(d,null,2);}
 catch(e){$('inspectResult').textContent='Inspection error: '+e.message;}finally{$('inspectTx').disabled=false;}
};

// Read-only token/spender intelligence. Registry is operator-configured, not an audit.
function renderSpender(d){const el=$("spenderVisual");if(!el)return;const high=d.risk==="high",match=d.risk==="registry_match",status=high?"HIGH RISK":match?"REGISTRY MATCH":"UNVERIFIED",cls=high?"high":match?"clear":"unknown",findings=d.findings||[],reg=d.registry||{},proxy=d.proxy||{};const rows=[["NETWORK",d.chain||"—"],["TOKEN BYTECODE",d.tokenHasCode?"DEPLOYED":"NOT FOUND"],["SPENDER BYTECODE",d.spenderHasCode?"DEPLOYED":"NOT FOUND"],["REGISTRY",reg.status||"unknown"],["CODE HASH",reg.codeHashMatches===true?"MATCH":reg.codeHashMatches===false?"MISMATCH":"NOT PINNED"],["PROXY IMPLEMENTATION",proxy.implementation||"NOT DETECTED"]];el.innerHTML=`<div class="intel-hero"><div class="intel-kicker">◈ CONTRACT SECURITY INTELLIGENCE</div><div class="intel-title"><span class="intel-security-icon">⬡</span>Spender Analysis</div><div class="intel-sub">${intelEsc(d.chain)} · ${intelEsc(d.spender||"")}</div><div class="intel-status ${cls}">${status}</div></div><div class="intel-metrics">${rows.map(x=>`<div class="intel-metric"><small>${x[0]}</small><b>${intelEsc(x[1])}</b></div>`).join("")}</div><div class="intel-section"><h3>◈ SECURITY FINDINGS · ${findings.length}</h3>${findings.length?`<ul class="intel-findings">${findings.map(x=>`<li>${intelEsc(x)}</li>`).join("")}</ul>`:`<div class="intel-empty">No findings returned by these limited checks.</div>`}</div><div class="intel-meta"><span class="intel-chip">READ ONLY</span><span class="intel-chip">NO TRANSACTION</span><span class="intel-chip">OPERATOR REGISTRY</span></div><div class="intel-disclaimer">Registry match is not an independent audit or guarantee of legitimacy. An unlisted spender is not automatically malicious. Review token allowances and contract source separately.</div><details class="intel-raw"><summary>View raw API data</summary><pre>${intelEsc(JSON.stringify(d,null,2))}</pre></details>`;}
$('checkSpender').onclick=async()=>{
 if(!authSession||authSession.expiresAt<Date.now()){$('spenderResult').textContent='Authenticate an EVM wallet first.';return;}
 if(!['ethereum','bnb','base','arbitrum'].includes(authSession.chain)){$('spenderResult').textContent='EVM wallet session required.';return;}
 const body={token:$('intelToken').value.trim(),spender:$('intelSpender').value.trim()};
 $('checkSpender').disabled=true;$('spenderResult').textContent='Checking deployed bytecode, proxy slot and configured registry…';
 try{
  const r=await fetch('/api/security/spender-intel',{method:'POST',headers:{'content-type':'application/json','authorization':`Bearer ${authSession.token}`},body:JSON.stringify(body)});
  const d=await r.json();if(!r.ok)throw Error(d.error||'Spender check failed');
  $('spenderResult').textContent=JSON.stringify(d,null,2);
  renderSpender(d);
 }catch(e){$('spenderResult').textContent='Spender intelligence error: '+e.message;}
 finally{$('checkSpender').disabled=false;}
};


// LIMFXAI TRADE PROPOSAL AND OFF-CHAIN WALLET APPROVAL
let activeTradeApproval = null;
let tradeActionInProgress = false;

function setTradeActionBusy(busy) {
  tradeActionInProgress = busy;
  for (const id of [
    "createTradeProposal",
    "signTradeApproval",
    "rejectTradeProposal",
    "refreshTradeProposals"
  ]) {
    const button = $(id);
    if (button) button.disabled = busy;
  }
}

async function tradeAuthSnapshot() {
  if (!authSession || authSession.expiresAt <= Date.now())
    throw Error("Wallet authentication required or expired.");
  const snapshot = {
    session: authSession,
    generation: authGeneration,
    source: authWalletSource,
    chain: authSession.chain,
    wallet: authSession.wallet
  };
  await assertAuthContext(snapshot.generation, snapshot.chain, snapshot.wallet);
  return snapshot;
}

async function tradeAuthCheck(snapshot) {
  if (authGeneration !== snapshot.generation ||
      authWalletSource !== snapshot.source ||
      authSession !== snapshot.session ||
      authSession?.token !== snapshot.session.token)
    throw Error("Wallet session changed. Start again.");
  await assertAuthContext(snapshot.generation, snapshot.chain, snapshot.wallet);
}

async function tradeApi(snapshot, path, method = "GET", body) {
  await tradeAuthCheck(snapshot);
  const options = {
    method,
    headers: {
      authorization: `Bearer ${snapshot.session.token}`,
      ...(body === undefined ? {} : {"content-type": "application/json"})
    }
  };
  if (body !== undefined) options.body = JSON.stringify(body);
  const response = await fetch(path, options);
  await tradeAuthCheck(snapshot);
  const data = await response.json();
  if (!response.ok) throw Error(data.error || `Request failed (${response.status})`);
  return data;
}

async function refreshTradeProposals(snapshot) {
  const data = await tradeApi(
    snapshot,
    `/api/trade-intents?wallet=${encodeURIComponent(snapshot.wallet)}`
  );
  $("tradeProposalList").textContent = JSON.stringify(data.items || [], null, 2);
}

$("createTradeProposal").onclick = async () => {
  if (tradeActionInProgress) return;
  setTradeActionBusy(true);
  const button = $("createTradeProposal");
  $("tradeProposalResult").textContent = "Validating wallet and creating proposal…";
  $("tradeApprovalPanel").style.display = "none";
  activeTradeApproval = null;
  let snapshot = null;
  let created = null;
  try {
    snapshot = await tradeAuthSnapshot();
    const body = {
      wallet: snapshot.wallet,
      chain: snapshot.chain,
      asset: $("tradeAsset").value.trim(),
      side: $("tradeSide").value,
      amount: $("tradeAmount").value.trim(),
      rationale: $("tradeRationale").value.trim()
    };
    if (!body.asset || !body.rationale ||
        !/^(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/.test(body.amount) ||
        !/[1-9]/.test(body.amount))
      throw Error("Enter a valid asset, positive decimal amount, and rationale.");

    created = await tradeApi(snapshot, "/api/trade-intents", "POST", body);
    $("tradeProposalResult").textContent =
      `PROPOSAL CREATED\nID: ${created.id}\nStatus: ${created.status}\nNo transaction was sent.`;

    const challenge = await tradeApi(
      snapshot,
      `/api/trade-intents/${encodeURIComponent(created.id)}/approval-challenge`,
      "POST",
      {}
    );
    if (typeof challenge.challengeId !== "string" ||
        typeof challenge.message !== "string")
      throw Error("Invalid approval challenge response.");

    activeTradeApproval = {
      id: created.id,
      challengeId: challenge.challengeId,
      message: challenge.message,
      snapshot
    };
    $("tradeApprovalMessage").value = challenge.message;
    $("tradeApprovalPanel").style.display = "block";
    $("tradeProposalResult").textContent +=
      "\n\nApproval challenge ready. Review the complete message before signing.";
    await refreshTradeProposals(snapshot);
  } catch (e) {
    if (!created) {
      $("tradeProposalResult").textContent = "Proposal error: " + e.message;
    } else {
      const challengeReady = activeTradeApproval?.id === created.id;
      $("tradeProposalResult").textContent =
        `PROPOSAL CREATED\\nID: ${created.id}\\nStatus: ${created.status}\\n` +
        (challengeReady
          ? "Approval challenge is ready. You can review and sign it."
          : "Proposal was saved, but its approval challenge is not ready. Refresh proposals before retrying.") +
        `\\nDetails: ${e.message}`;
      if (snapshot) {
        try {
          await refreshTradeProposals(snapshot);
        } catch (refreshError) {
          $("tradeProposalResult").textContent +=
            `\\nProposal list refresh failed: ${refreshError.message}`;
        }
      }
    }
  } finally {
    setTradeActionBusy(false);
  }
};

$("signTradeApproval").onclick = async () => {
  if (tradeActionInProgress) return;
  setTradeActionBusy(true);
  const button = $("signTradeApproval");
  const approval = activeTradeApproval;
  if (!approval) {
    setTradeActionBusy(false);
    $("tradeProposalResult").textContent = "Create a proposal first.";
    return;
  }
  button.disabled = true;
  $("tradeProposalResult").textContent =
    "Review the approval message. Waiting for wallet signature…";
  try {
    const snapshot = approval.snapshot;
    await tradeAuthCheck(snapshot);
    let signature;

    if (snapshot.chain === "solana") {
      const provider = solanaProvider;
      if (!provider?.signMessage || window.solana !== provider)
        throw Error("Solana signing provider unavailable.");
      const signed = await provider.signMessage(
        new TextEncoder().encode(approval.message), "utf8"
      );
      await tradeAuthCheck(snapshot);
      if (!(signed?.signature instanceof Uint8Array) ||
          signed.signature.length !== 64)
        throw Error("Invalid Solana signature.");
      signature = toBase64UrlBytes(signed.signature);
    } else if (snapshot.source === "reown") {
      const rw = window.LIMFXAIWallet;
      if (!rw || rw !== reownProviderWrapper)
        throw Error("Reown wallet provider changed.");
      const caipId = rw.getCaipNetworkId() || reownCaipNetworkId;
      if (!caipId) throw Error("Reown network identity unavailable.");
      signature = await rw.signMessage(
        approval.message, snapshot.wallet, caipId
      );
      await tradeAuthCheck(snapshot);
    } else if (snapshot.source === "injected") {
      const provider = injectedProvider;
      if (!provider?.request || window.ethereum !== provider)
        throw Error("Injected wallet provider changed.");
      signature = await provider.request({
        method: "personal_sign",
        params: [approval.message, snapshot.wallet]
      });
      await tradeAuthCheck(snapshot);
    } else {
      throw Error("Unsupported wallet signing provider.");
    }

    if (typeof signature !== "string" || !signature)
      throw Error("Wallet returned an invalid signature.");

    const result = await tradeApi(
      snapshot,
      `/api/trade-intents/${encodeURIComponent(approval.id)}/approve`,
      "POST",
      {challengeId: approval.challengeId, signature}
    );
    activeTradeApproval = null;
    $("tradeApprovalPanel").style.display = "none";
    $("tradeProposalResult").textContent =
      `APPROVAL VERIFIED ✓\nProposal: ${result.id}\nStatus: ${result.status}\n${result.message}`;
    await refreshTradeProposals(snapshot);
  } catch (e) {
    $("tradeProposalResult").textContent =
      "Approval error: " + e.message +
      "\nIf the challenge expired or wallet changed, create a new proposal.";
  } finally {
    setTradeActionBusy(false);
  }
};

$("rejectTradeProposal").onclick = async () => {
  if (tradeActionInProgress) return;
  const approval = activeTradeApproval;
  if (!approval) return;
  if (!window.confirm("Reject this proposal? No blockchain transaction will be sent."))
    return;
  if (tradeActionInProgress) return;
  setTradeActionBusy(true);
  const button = $("rejectTradeProposal");
  try {
    const snapshot = approval.snapshot;
    const result = await tradeApi(
      snapshot,
      `/api/trade-intents/${encodeURIComponent(approval.id)}`,
      "POST",
      {action: "reject"}
    );
    activeTradeApproval = null;
    $("tradeApprovalPanel").style.display = "none";
    $("tradeProposalResult").textContent =
      `PROPOSAL REJECTED\n${result.message}`;
    await refreshTradeProposals(snapshot);
  } catch (e) {
    $("tradeProposalResult").textContent = "Reject error: " + e.message;
  } finally {
    setTradeActionBusy(false);
  }
};

$("refreshTradeProposals").onclick = async () => {
  if (tradeActionInProgress) return;
  setTradeActionBusy(true);
  const button = $("refreshTradeProposals");
  try {
    const snapshot = await tradeAuthSnapshot();
    await refreshTradeProposals(snapshot);
  } catch (e) {
    $("tradeProposalList").textContent = "Refresh error: " + e.message;
  } finally {
    setTradeActionBusy(false);
  }
};
