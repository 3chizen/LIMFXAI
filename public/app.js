const $=id=>document.getElementById(id);
let messages=[];
function bubble(text,who){const el=document.createElement('div');el.className='bubble '+who;el.textContent=text;$('chat').append(el);$('chat').scrollTop=$('chat').scrollHeight;return el}
function intelEsc(v){return String(v??"—").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll(String.fromCharCode(34),"&quot;");}
function intelMoney(v){const n=Number(v);return Number.isFinite(n)?"$"+n.toLocaleString("en-US",{maximumFractionDigits:2}):"—";}
function renderMarket(d){const el=$("marketVisual");if(!el)return;if(!d.found){el.innerHTML=`<div class="intel-empty">◈ NO PAIR FOUND · NOT VERIFIED<br>${intelEsc(d.note||"No matching market pair was found.")}</div>`;return;}const level=d.screening?.severity||"unverified",high=level==="high",warn=level==="elevated",status=high?"HIGH RISK":warn?"WARNING":"NO BASIC FLAGS",cls=high?"high":warn?"warn":"unknown",m=d.metrics||{},t=d.token||{},flags=d.screening?.flags||[];const change=Number(m.priceChange24hPct);const metrics=[["PRICE",intelMoney(t.priceUsd),"USD per token"],["LIQUIDITY",intelMoney(m.liquidityUsd),"Pool liquidity"],["24H VOLUME",intelMoney(m.volume24hUsd),"Trading volume"],["FDV",intelMoney(m.fdvUsd),"Fully diluted valuation"],["24H CHANGE",Number.isFinite(change)?(change>0?"+":"")+change.toFixed(2)+"%":"—","Price movement"],["NETWORK",d.chain||"—","Selected chain"]];el.innerHTML=`<div class="intel-hero"><div class="intel-kicker">◈ LIVE MARKET INTELLIGENCE</div><div class="intel-title">${intelEsc(t.name||"Unknown token")} <span style="color:#67d9ff">${intelEsc(t.symbol||"")}</span></div><div class="intel-sub">${intelEsc(d.chain)} · Pair ${intelEsc(d.pair||"—")}</div><div class="intel-status ${cls}">${status}</div></div><div class="intel-metrics">${metrics.map(x=>`<div class="intel-metric"><small>${x[0]}</small><b>${intelEsc(x[1])}</b><em>${intelEsc(x[2])}</em></div>`).join("")}</div><div class="intel-section"><h3>◈ SCREENING FINDINGS · ${flags.length}</h3>${flags.length?`<ul class="intel-findings">${flags.map(x=>`<li>${intelEsc(x)}</li>`).join("")}</ul>`:`<div class="intel-empty">No basic market screening flags detected. This is not proof of token safety.</div>`}</div><div class="intel-meta"><span class="intel-chip">SOURCE · DexScreener</span><span class="intel-chip">SCREENING ONLY</span><span class="intel-chip">NOT A SMART-CONTRACT AUDIT</span></div><div class="intel-disclaimer">${intelEsc(d.disclaimer||"Market screening only. No guarantee of safety.")}</div><details class="intel-raw"><summary>View raw API data</summary><pre>${intelEsc(JSON.stringify(d,null,2))}</pre></details>`;}
$("scan").onclick=async()=>{const chain=$("chain").value,address=$("address").value.trim();if(!address){$("research").textContent="Masukkan contract/mint address dulu.";return;}$("scan").disabled=true;$("research").textContent="Fetching public market data…";$("marketVisual").innerHTML=`<div class="intel-empty">◈ ANALYZING LIVE MARKET DATA…</div>`;try{const r=await fetch(`/api/research/token?chain=${encodeURIComponent(chain)}&address=${encodeURIComponent(address)}`);const d=await r.json();if(!r.ok)throw Error(d.error||"Research failed");window.lastResearch={chain,address};$("research").textContent=JSON.stringify(d,null,2);renderMarket(d);if(d.found)bubble(`Screening selesai: ${d.token?.symbol||"token"} | liquidity ${intelMoney(d.metrics.liquidityUsd)} | flags: ${d.screening.flags.length}. Tanya gw untuk interpretasi hasil.`,"bot");}catch(e){$("research").textContent="Error: "+e.message;$("marketVisual").innerHTML=`<div class="intel-empty">SCREENING ERROR · ${intelEsc(e.message)}</div>`;}finally{$("scan").disabled=false;}};
$("forensicsScan").onclick=async()=>{const chain=$("chain").value,address=$("address").value.trim();if(!address){$("forensicsResult").textContent="Masukkan contract/mint address di Market terlebih dahulu.";return;}const button=$("forensicsScan");button.disabled=true;$("forensicsResult").textContent="Reading on-chain data…";for(const id of ["auditStatus","holderStatus","whaleStatus","botStatus","scamStatus","kolStatus","bubbleMap"])$(id).textContent="ANALYZING · Waiting for RPC evidence…";try{const r=await fetch(`/api/forensics/token?chain=${encodeURIComponent(chain)}&address=${encodeURIComponent(address)}`);const d=await r.json();if(!r.ok)throw Error(d.error||"Forensics request failed");$("forensicsResult").textContent=JSON.stringify(d,null,2);if(d.contractAudit){const a=d.contractAudit;$("auditStatus").textContent=[`STATUS · ${a.status}`,`BYTECODE · ${a.bytecodeBytes??"—"} bytes`,`OWNER · ${a.owner||"Not exposed / unavailable"}`,`PROXY · ${a.proxy?.detected?"Detected: "+a.proxy.implementation:"Not detected in EIP-1967 slot"}`,`FINDINGS · ${(a.findings||[]).join(" | ")||"No preliminary flags; this is not proof of safety."}`,`SOURCE · ${a.sourceVerification||"Not checked"}`,`FORMAL AUDIT · ${a.formalAudit||"Not performed"}`].join("\\n");}const ha=d.holderAnalysis||{};const holders=ha.topHolders||d.topHolders||[];if(holders.length){const places=Math.max(0,Math.min(36,Number(d.contractAudit?.decimals??0)));const divisor=10n**BigInt(places);const supply=BigInt(d.contractAudit?.totalSupply||"0");const fmt=raw=>{try{const n=BigInt(raw??"0");const whole=(n/divisor).toLocaleString("en-US");const frac=(n%divisor).toString().padStart(places,"0").slice(0,4).replace(/0+$/,"");return whole+(frac?"."+frac:"");}catch{return String(raw??"—");}};const rows=holders.slice(0,10).map((h,i)=>{let pct=null;try{if(supply>0n)pct=Number((BigInt(h.amount??"0")*1000000n)/supply)/10000;}catch{}return (i+1)+". "+(h.address||h.owner||h.tokenAccount||"Unknown")+" · "+fmt(h.amount)+" · "+(pct===null?"—":pct.toFixed(4)+"%");});$("holderStatus").textContent="TOP "+holders.length+" / "+(ha.totalCount??"unknown")+" HOLDERS · "+(ha.provider||"RPC")+String.fromCharCode(10)+rows.join(String.fromCharCode(10));}else{$("holderStatus").textContent="HOLDER DATA · "+(ha.status||"unavailable")+" · "+(ha.provider||"unknown")+(ha.httpStatus?" · HTTP "+ha.httpStatus:"")+(ha.primaryError?String.fromCharCode(10)+"PRIMARY · "+ha.primaryError:"");}const wi=d.walletIntelligence||{};$("whaleStatus").textContent="Wallet labels: "+(wi.status||"unavailable")+" · No smart-wallet ranking provider connected.";$("botStatus").textContent="Bot/sniper classification: "+(wi.bots||"unverified")+" · Transaction history indexer required.";$("scamStatus").textContent="Scam reputation: "+(wi.scamLabels||"unverified")+" · No verified reputation feed connected.";$("kolStatus").textContent="KOL attribution: "+(wi.kolAttribution||"unverified")+" · Public identity evidence required.";$("bubbleMap").textContent="Wallet graph: "+(wi.bubbleMap||"pending")+" · Transfer indexer required for relationship mapping."; }catch(e){$("forensicsResult").textContent="FORENSICS ERROR · "+e.message;for(const id of ["auditStatus","holderStatus"])$(id).textContent="ERROR · "+e.message;}finally{button.disabled=false;}};async function send(){const prompt=$('prompt').value.trim();if(!prompt)return;$('prompt').value='';bubble(prompt,'user');messages.push({role:'user',content:prompt});$('send').disabled=true;
const pending=bubble('LIMFXAI is thinking…','bot');
try{const r=await fetch('/api/chat',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({provider:$('provider').value,messages,research:window.lastResearch||null})});const d=await r.json();if(!r.ok)throw Error(d.error||'AI request failed');pending.textContent=d.reply;messages.push({role:'assistant',content:d.reply});}
catch(e){pending.textContent='Error: '+e.message+' — pastikan API key provider sudah diatur di server.'}finally{$('send').disabled=false}}
$('send').onclick=send;$('prompt').addEventListener('keydown',e=>{if(e.key==='Enter')send()});

// Wallet proof-of-ownership flow. Never requests a seed phrase/private key.
let authSession=null, pendingChallenge=null;
const evmIds={ethereum:1,bnb:56,base:8453,arbitrum:42161};
let authWalletSource='injected';
let reownCaipNetworkId=null, reownChainId=null;
let reownUnsubAccount=null, reownUnsubNetwork=null;

function setWalletUi(connected){
 $('connectWallet').textContent=connected?'Disconnect wallet':'Connect wallet';
 const row=[...document.querySelectorAll('.status-row')].find(el=>el.firstElementChild?.textContent.trim()==='Wallet');
 if(row){const status=row.querySelector('b');if(status)status.textContent=connected?'Connected':'Not connected';}
}
function syncReownVerify(){
 const connected=!!$('authWallet').value.trim();
 const supported=Object.values(evmIds).includes(Number(reownChainId));
 $('verifyWallet').disabled=!(connected&&supported&&!!reownCaipNetworkId);
}

const toBase64UrlBytes = bytes => {
  let s=''; bytes.forEach(b=>s+=String.fromCharCode(b));
  return btoa(s).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
};
$('connectWallet').onclick=async()=>{
 if(authWalletSource==='reown' && window.LIMFXAIWallet?.getAddress()){
  try{
   await window.LIMFXAIWallet.disconnect();
   authSession=null;pendingChallenge=null;
   $('authWallet').value='';
   $('verifyWallet').disabled=true;
   reownCaipNetworkId=null;reownChainId=null;
   setWalletUi(false);
   $('authStatus').textContent='Wallet disconnected.';
   return;
  }catch(e){
   $('authStatus').textContent='Disconnect error: '+e.message;
   return;
  }
 }

 const chain=$('authChain').value;
 try{
  if(chain==='solana'){
   authWalletSource='solana';
   const provider=window.solana;
   if(!provider?.connect)throw Error('Solana wallet provider not found. Install a compatible wallet/browser.');
   const out=await provider.connect();
   $('authWallet').value=out.publicKey.toString();
  }else if(window.ethereum){
   authWalletSource='injected';
   const accounts=await window.ethereum.request({method:'eth_requestAccounts'});
   if(!accounts?.length)throw Error('No wallet account returned');
   const wanted='0x'+evmIds[chain].toString(16);
   const current=await window.ethereum.request({method:'eth_chainId'});
   if(current.toLowerCase()!==wanted){
    await window.ethereum.request({method:'wallet_switchEthereumChain',params:[{chainId:wanted}]});
   }
   $('authWallet').value=accounts[0];
  }else{
   const rw=window.LIMFXAIWallet;
   if(!rw)throw Error('Reown belum siap. Refresh halaman lalu coba lagi.');

   authWalletSource='reown';
   $('verifyWallet').disabled=true;
   $('authStatus').textContent='Pilih wallet dari jendela WalletConnect…';

   if(!reownUnsubNetwork){
    reownUnsubNetwork=rw.subscribeNetwork(state=>{
     reownCaipNetworkId=state.caipNetworkId||rw.getCaipNetworkId();
     reownChainId=state.chainId??rw.getChainId();
     const selected=Object.entries(evmIds).find(([,id])=>id===Number(reownChainId));
     if(selected){
      $('authChain').value=selected[0];
      $('authStatus').textContent='Network connected: '+selected[0]+'. Menunggu akun wallet…';
     }else{
      $('authStatus').textContent='Network belum didukung. Pilih Ethereum, BNB, Base, atau Arbitrum.';
     }
     syncReownVerify();
    });
   }

   if(!reownUnsubAccount){
    reownUnsubAccount=rw.subscribeAccount(state=>{
     if(state.isConnected&&state.address){
      authWalletSource='reown';
      $('authWallet').value=state.address;
      setWalletUi(true);
      $('authStatus').textContent='Wallet connected. Periksa jaringan, lalu verifikasi signature.';
     }else{
      authSession=null;pendingChallenge=null;
      $('authWallet').value='';
      $('verifyWallet').disabled=true;
      setWalletUi(false);
      $('authStatus').textContent='Wallet belum terhubung.';
     }
     syncReownVerify();
    });
   }

   await rw.open();
   return;
  }

  setWalletUi(true);
  $('verifyWallet').disabled=false;
  $('authStatus').textContent='Wallet connected. Next: request a one-time sign-in challenge and sign the displayed message.';
 }catch(e){
  $('authStatus').textContent='Connect error: '+e.message;
 }
};

$('verifyWallet').onclick=async()=>{
 const chain=$('authChain').value,wallet=$('authWallet').value.trim();
 $('verifyWallet').disabled=true;
 try{
  const c=await fetch('/api/auth/challenge',{
   method:'POST',
   headers:{'content-type':'application/json'},
   body:JSON.stringify({chain,wallet})
  });
  const challenge=await c.json();
  if(!c.ok)throw Error(challenge.error||'Challenge request failed');
  pendingChallenge=challenge;

  let signature;
  if(chain==='solana'){
   const bytes=new TextEncoder().encode(challenge.message);
   const signed=await window.solana.signMessage(bytes,'utf8');
   signature=toBase64UrlBytes(signed.signature);
  }else if(authWalletSource==='reown'){
   const rw=window.LIMFXAIWallet;
   const currentId=Number(rw?.getChainId?.());
   const selected=Object.entries(evmIds).find(([,id])=>id===currentId);
   if(!rw||!selected||selected[0]!==chain)throw Error('Jaringan Reown tidak cocok dengan jaringan yang dipilih.');
   const caipId=rw.getCaipNetworkId()||reownCaipNetworkId;
   if(!caipId)throw Error('Network ID Reown belum tersedia. Hubungkan ulang wallet.');
   signature=await rw.signMessage(challenge.message,wallet,caipId);
  }else{
   if(!window.ethereum)throw Error('Injected wallet provider tidak tersedia.');
   signature=await window.ethereum.request({
    method:'personal_sign',
    params:[challenge.message,wallet]
   });
  }

  const v=await fetch('/api/auth/verify',{
   method:'POST',
   headers:{'content-type':'application/json'},
   body:JSON.stringify({challengeId:challenge.challengeId,signature})
  });
  const raw=await v.text();
  let result;
  try{result=JSON.parse(raw)}catch{
   throw Error(`HTTP ${v.status} | URL: ${v.url} | Type: ${v.headers.get('content-type')} | Response: ${raw.slice(0,250)}`);
  }
  if(!v.ok)throw Error(result.error||`Signature verification failed (HTTP ${v.status})`);

  authSession={
   token:result.sessionToken,
   wallet:result.wallet,
   chain:result.chain,
   expiresAt:Date.now()+result.expiresInSeconds*1000
  };
  $('authStatus').textContent=`VERIFIED ✓
Wallet: ${result.wallet}
Network: ${result.chain}
Session: 1 hour
Scope: wallet authentication only
No trade approval or transaction was created.`;
 }catch(e){
  $('authStatus').textContent='Verification error: '+e.message;
 }finally{
  if(authWalletSource==='reown')syncReownVerify();
  else $('verifyWallet').disabled=false;
 }
};

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
