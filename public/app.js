const $=id=>document.getElementById(id);
let messages=[];setTimeout(()=>{let e=document.querySelector("#chat .bubble.bot");if(!e)return;let t=e.textContent,i=0,d=1;e.textContent="";(function run(){e.textContent=t.slice(0,i);if(i===t.length&&d===1){d=-1;setTimeout(run,1200);return}if(i===0&&d===-1){d=1;setTimeout(run,400);return}i+=d;setTimeout(run,d===1?55:28)})()},100);function typeText(e,t){e.textContent="";let i=0;function step(){if(i<t.length){e.textContent+=t[i++];setTimeout(step,28)}}step()}
function bubble(text,who){const el=document.createElement('div');el.className='bubble '+who;el.textContent=text;$('chat').append(el);$('chat').scrollTop=$('chat').scrollHeight;return el}
function intelEsc(v){return String(v??"—").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll(String.fromCharCode(34),"&quot;");}
function intelMoney(v){const n=Number(v);return Number.isFinite(n)?"$"+n.toLocaleString("en-US",{maximumFractionDigits:2}):"—";}
function renderMarket(d){const el=$("marketVisual");if(!el)return;if(!d.found){el.innerHTML=`<div class="intel-empty">◈ NO PAIR FOUND · NOT VERIFIED<br>${intelEsc(d.note||"No matching market pair was found.")}</div>`;return;}const stale=d.marketDataStatus==="stale"||String(d.marketCacheStatus||"").toUpperCase()==="STALE",cacheState=String(d.marketCacheStatus||"").toUpperCase(),cacheLabel=stale?"STALE":cacheState==="HIT"?"CACHE":cacheState==="MISS"?"LIVE":"UNKNOWN",cacheAgeText=cacheState==="HIT"&&Number.isFinite(d.marketCacheAgeSeconds)?` · CACHE AGE ${d.marketCacheAgeSeconds}s`:"",level=d.screening?.severity||"unverified",high=level==="high",warn=level==="elevated",status=high?"HIGH RISK":warn?"WARNING":"NO BASIC FLAGS",cls=high?"high":warn?"warn":"unknown",m=d.metrics||{},t=d.token||{},flags=d.screening?.flags||[];const change=Number(m.priceChange24hPct);const metrics=[["PRICE",intelMoney(t.priceUsd),"USD per token"],["LIQUIDITY",intelMoney(m.liquidityUsd),"Pool liquidity"],["24H VOLUME",intelMoney(m.volume24hUsd),"Trading volume"],["FDV",intelMoney(m.fdvUsd),"Fully diluted valuation"],["24H CHANGE",Number.isFinite(change)?(change>0?"+":"")+change.toFixed(2)+"%":"—","Price movement"],["NETWORK",d.chain||"—","Selected chain"]];el.innerHTML=`<div class="intel-hero"><div class="intel-kicker">◈ ${stale?"STALE MARKET DATA · MAY BE OUTDATED":`${cacheLabel} MARKET DATA${cacheAgeText}`}</div>${stale?`<div class="intel-empty">⚠ ${intelEsc(d.marketDataWarning||"Showing previously cached data. Values may be outdated.")}</div>`:""}<div class="intel-title">${intelEsc(t.name||"Unknown token")} <span style="color:#67d9ff">${intelEsc(t.symbol||"")}</span></div><div class="intel-sub">${intelEsc(d.chain)} · Pair ${intelEsc(d.pair||"—")}</div><div class="intel-status ${cls}">${status}</div></div><div class="intel-metrics">${metrics.map(x=>`<div class="intel-metric"><small>${x[0]}</small><b>${intelEsc(x[1])}</b><em>${intelEsc(x[2])}</em></div>`).join("")}</div><div class="intel-section"><h3>◈ SCREENING FINDINGS · ${flags.length}</h3>${flags.length?`<ul class="intel-findings">${flags.map(x=>`<li>${intelEsc(x)}</li>`).join("")}</ul>`:`<div class="intel-empty">No basic market screening flags detected. This is not proof of token safety.</div>`}</div><div class="intel-meta"><span class="intel-chip">SOURCE · ${intelEsc(d.provider||"DexScreener")}</span><span class="intel-chip">SCREENING ONLY</span><span class="intel-chip">NOT A SMART-CONTRACT AUDIT</span></div><div class="intel-disclaimer">${intelEsc(d.disclaimer||"Market screening only. No guarantee of safety.")}</div><details class="intel-raw"><summary>View raw API data</summary><pre>${intelEsc(JSON.stringify(d,null,2))}</pre></details>`;}
$("scan").onclick=async()=>{const chain=$("chain").value,address=$("address").value.trim();if(!address){$("research").textContent="Enter a contract/mint address first.";return;}$("scan").disabled=true;$("research").textContent="Fetching public market data…";$("marketVisual").innerHTML=`<div class="intel-empty">◈ ANALYZING LIVE MARKET DATA…</div>`;try{const r=await fetch(`/api/research/token?chain=${encodeURIComponent(chain)}&address=${encodeURIComponent(address)}`);const d=await r.json();d.marketCacheStatus=r.headers.get("x-market-cache")||"unknown";const ageHeader=r.headers.get("age"),cacheAge=ageHeader===null?null:Number(ageHeader);d.marketCacheAgeSeconds=Number.isFinite(cacheAge)?cacheAge:null;if(!r.ok)throw Error(d.error||"Research failed");window.lastResearch={chain,address};$("research").textContent=JSON.stringify(d,null,2);renderMarket(d);if(d.found)bubble(`Screening complete: ${d.token?.symbol||"token"} | liquidity ${intelMoney(d.metrics.liquidityUsd)} | flags: ${d.screening.flags.length}. Ask me to interpret the results.`,"bot");}catch(e){$("research").textContent="Error: "+e.message;$("marketVisual").innerHTML=`<div class="intel-empty">SCREENING ERROR · ${intelEsc(e.message)}</div>`;}finally{$("scan").disabled=false;}};
$("forensicsScan").onclick=async()=>{const chain=$("chain").value,address=$("address").value.trim();if(!address){$("forensicsResult").textContent="Enter a contract/mint address in Market first.";return;}const button=$("forensicsScan");button.disabled=true;$("forensicsResult").textContent="Reading on-chain data…";for(const id of ["auditStatus","holderStatus","whaleStatus","botStatus","scamStatus","kolStatus","bubbleMap"])$(id).textContent="ANALYZING · Waiting for RPC evidence…";try{const r=await fetch(`/api/forensics/token?chain=${encodeURIComponent(chain)}&address=${encodeURIComponent(address)}`);const d=await r.json();if(!r.ok)throw Error(d.error||"Forensics request failed");$("forensicsResult").textContent=JSON.stringify(d,null,2);if(d.contractAudit){const a=d.contractAudit;$("auditStatus").textContent=[`STATUS · ${a.status}`,`BYTECODE · ${a.bytecodeBytes??"—"} bytes`,`OWNER · ${a.owner||"Not exposed / unavailable"}`,`PROXY · ${a.proxy?.detected?"Detected: "+a.proxy.implementation:"Not detected in EIP-1967 slot"}`,`FINDINGS · ${(a.findings||[]).join(" | ")||"No preliminary flags; this is not proof of safety."}`,`SOURCE · ${a.sourceVerification||"Not checked"}`,`FORMAL AUDIT · ${a.formalAudit||"Not performed"}`].join("\\n");}const ha=d.holderAnalysis||{};const holders=ha.topHolders||d.topHolders||[];if(holders.length){const isSolana=d.chain==="solana";const places=Math.max(0,Math.min(36,Number(d.contractAudit?.decimals??0)));const divisor=10n**BigInt(places);const supply=isSolana?0n:BigInt(d.contractAudit?.totalSupply||"0");const fmt=raw=>{if(isSolana)return String(raw??"—");try{const n=BigInt(raw??"0");const whole=(n/divisor).toLocaleString("en-US");const frac=(n%divisor).toString().padStart(places,"0").slice(0,4).replace(/0+$/,"");return whole+(frac?"."+frac:"");}catch{return String(raw??"—");}};const rows=holders.slice(0,10).map((h,i)=>{let pct=null;if(isSolana){const value=Number(h.percentage);if(Number.isFinite(value))pct=value;}else{try{if(supply>0n)pct=Number((BigInt(h.amount??"0")*1000000n)/supply)/10000;}catch{}}return (i+1)+". "+(h.address||h.owner||h.tokenAccount||"Unknown")+" · "+fmt(h.amount)+" · "+(pct===null?"—":pct.toFixed(4)+"%");});$("holderStatus").textContent=isSolana?"SAMPLED HOLDERS · "+(d.coverage?.tokenAccountsInspected??0)+" ACCOUNTS · "+(d.coverage?.pagesFetched??0)+" PAGES · PARTIAL SNAPSHOT"+String.fromCharCode(10)+rows.join(String.fromCharCode(10)):"TOP "+holders.length+" / "+(ha.totalCount??"unknown")+" HOLDERS · "+(ha.provider||"RPC")+String.fromCharCode(10)+rows.join(String.fromCharCode(10));}else{$("holderStatus").textContent="HOLDER DATA · "+(ha.status||"unavailable")+" · "+(ha.provider||"unknown")+(ha.httpStatus?" · HTTP "+ha.httpStatus:"")+(ha.primaryError?String.fromCharCode(10)+"PRIMARY · "+ha.primaryError:"");}const wi=d.walletIntelligence||{};const wa=d.whaleAnalysis||{};const whaleRows=Array.isArray(wa.whales)?wa.whales:[];const largeRows=Array.isArray(wa.largeHolders)?wa.largeHolders:[];$("whaleStatus").textContent=wa.status==="sampled"?"Whales ≥1%: "+whaleRows.length+" · Large holders ≥0.1%: "+largeRows.length+" · Provider: "+(wa.provider||"unknown")+" · "+whaleRows.slice(0,10).map((h,i)=>(i+1)+". "+(h.address||"Unknown wallet")+" — "+Number(h.percentage).toFixed(4)+"%").join("\n")+"\nCoverage: provider sample only; not complete.":"Whale analysis: "+(wa.status||"unavailable")+" · Holder data unavailable.";const activity=wi.activity||{};const activeWallets=Array.isArray(activity.topActiveWallets)?activity.topActiveWallets:[];const sniper=d.sniperAnalysis||{};const sniperCandidates=Array.isArray(sniper.earlyTransactionInitiators)?sniper.earlyTransactionInitiators:[];const sniperText=sniper.status==="sampled"?"\n\nEarly swap initiators · "+sniperCandidates.length+" candidates · "+sniper.transactionsResolved+"/"+sniper.transactionsChecked+" transactions resolved · "+sniper.blocksScanned+" blocks scanned"+(sniper.logsTruncated?" · capped log sample":"")+(sniper.transactionLookupTruncated?" · transaction list capped":"")+"\n"+(sniperCandidates.length?sniperCandidates.map((w,i)=>(i+1)+". "+w.address+" · "+w.swapTransactions+" swap tx · first block "+w.firstBlock).join("\n"):"No early swap initiators found in this sample")+"\nAssessment: unverified candidates only; swap order does not prove sniper/bot activity.":"\n\nEarly swap initiators: "+(sniper.status||"unavailable")+" · "+(sniper.error||"No compatible, verified pool sample.")+"\nAssessment: unverified.";$("botStatus").textContent=(activity.status==="sampled"?"Transfer activity · "+activity.blocksScanned+" blocks · "+activity.logsScanned+" logs · "+activity.uniqueWallets+" wallets"+(activity.logsTruncated?" · capped sample":"")+"\nTop active wallets:\n"+(activeWallets.length?activeWallets.map((w,i)=>(i+1)+". "+w.address+" · "+w.transferLogs+" transfers · "+w.uniqueTransactions+" tx · "+w.activeBlocks+" active blocks · "+w.transfersPerActiveBlock+"/block · "+w.transactionsPerTransfer+" tx/transfer").join("\n"):"No wallet activity found")+'\nBot/sniper: unverified · High transfer activity alone is not proof of automation.':"Transfer activity: "+(activity.status||"unavailable")+" · "+(activity.error||"No supported RPC sample.")+"\nBot/sniper: unverified.")+sniperText;$("scamStatus").textContent="Scam reputation: "+(wi.scamLabels||"unverified")+" · No verified reputation feed connected.";$("kolStatus").textContent="KOL attribution: "+(wi.kolAttribution||"unverified")+" · Public identity evidence required.";$("bubbleMap").textContent="Wallet graph: "+(wi.bubbleMap||"pending")+" · Transfer indexer required for relationship mapping."; }catch(e){$("forensicsResult").textContent="FORENSICS ERROR · "+e.message;for(const id of ["auditStatus","holderStatus"])$(id).textContent="ERROR · "+e.message;}finally{button.disabled=false;}};async function send(){const prompt=$('prompt').value.trim();if(!prompt)return;$('prompt').value='';bubble(prompt,'user');messages.push({role:'user',content:prompt});$('send').disabled=true;
const pending=bubble('LIMFXAI is thinking…','bot');
try{const r=await fetch('/api/chat',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({provider:$('provider').value,messages,research:window.lastResearch||null})});const d=await r.json();if(!r.ok)throw Error(d.error||'AI request failed');typeText(pending,d.reply);messages.push({role:'assistant',content:d.reply});}
catch(e){pending.textContent='Error: '+e.message+' — pastikan API key provider sudah diatur di server.'}finally{$('send').disabled=false}}
$('send').onclick=send;$('prompt').addEventListener('keydown',e=>{if(e.key==='Enter')send()});

// Wallet proof-of-ownership flow. Never requests a seed phrase/private key.
let authSession=null, pendingChallenge=null;
let pendingSolanaOrder=null;
const evmIds={ethereum:1,bnb:56,base:8453,arbitrum:42161};
let authWalletSource='injected';
let reownCaipNetworkId=null, reownChainId=null;
let reownUnsubAccount=null, reownUnsubNetwork=null;
let reownSubscriptionGeneration=0;
let reownProviderWrapper=null;

function setWalletUi(connected){
 $('connectWallet').textContent=connected?'Disconnect wallet':'Connect wallet';
 const row=[...document.querySelectorAll('.status-row')].find(el=>el.firstElementChild?.textContent.trim()==='Wallet');
 if(row){const status=row.querySelector('b');if(status)status.textContent=connected?'Connected':'Not connected';}
}
function syncReownVerify(){
 const address=$('authWallet').value.trim();
 const connected=authWalletSource==='reown'&&/^0x[0-9a-fA-F]{40}$/.test(address);
 const caipMatch=typeof reownCaipNetworkId==='string'?/^eip155:(0|[1-9][0-9]*)$/.exec(reownCaipNetworkId):null;
 const chainId=Number(reownChainId);
 const supported=!!caipMatch&&Number(caipMatch[1])===chainId&&Number.isSafeInteger(chainId)&&Object.values(evmIds).includes(chainId);
 $('verifyWallet').disabled=!(connected&&supported);
}
function detachReownListeners(){
 reownSubscriptionGeneration++;
 for(const key of ['reownUnsubAccount','reownUnsubNetwork']){
  const unsubscribe=key==='reownUnsubAccount'?reownUnsubAccount:reownUnsubNetwork;
  try{if(typeof unsubscribe==='function')unsubscribe();}catch{}
 }
 reownUnsubAccount=null;
 reownUnsubNetwork=null;
 reownProviderWrapper=null;
 reownCaipNetworkId=null;
 reownChainId=null;
}

const toBase64UrlBytes = bytes => {
  let s=''; bytes.forEach(b=>s+=String.fromCharCode(b));
  return btoa(s).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
};

const SOLANA_BASE58_ALPHABET='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function isValidSolanaAddress(value){
 if(typeof value!=='string'||value.length<32||value.length>44)return false;
 let decoded=0n;
 for(const char of value){
  const digit=SOLANA_BASE58_ALPHABET.indexOf(char);
  if(digit<0)return false;
  decoded=decoded*58n+BigInt(digit);
 }
 let byteLength=0;
 while(decoded>0n){byteLength++;decoded>>=8n;}
 let leadingZeroBytes=0;
 while(value[leadingZeroBytes]==='1')leadingZeroBytes++;
 return byteLength+leadingZeroBytes===32;
}

let authGeneration=0;
let walletConnectAttempt=0;
let injectedProvider=null,solanaProvider=null;
let injectedHandlers=null,solanaHandlers=null;

function invalidateAuth(message,clearWallet=false){
 authGeneration++;
 authSession=null;
 pendingChallenge=null;
 pendingSolanaOrder=null;
 const executeButton=$("signExecuteSolanaOrder");
 if(executeButton)executeButton.disabled=true;
 activeTradeApproval=null;
 const tradePanel=$('tradeApprovalPanel');
 if(tradePanel)tradePanel.style.display='none';
 const tradeMessage=$('tradeApprovalMessage');
 if(tradeMessage)tradeMessage.value='';
 $('verifyWallet').disabled=true;
 if(clearWallet){
  $('authWallet').value='';
  setWalletUi(false);
 }
 if(message)$('authStatus').textContent=message;
}

async function assertAuthContext(generation,chain,wallet){
 if(generation!==authGeneration)throw Error('Authentication cancelled: wallet state changed.');
 if($('authChain').value!==chain||$('authWallet').value.trim()!==wallet)
  throw Error('Authentication cancelled: selected wallet or network changed.');

 if(authWalletSource==='solana'){
  const provider=solanaProvider;
  if(!provider||window.solana!==provider)
   throw Error('Solana wallet provider changed. Reconnect your wallet.');
  const current=provider.publicKey?.toString?.()||'';
  if(!isValidSolanaAddress(current)||current!==wallet)
   throw Error('Solana wallet account no longer matches or is invalid.');
  return;
 }

 if(authWalletSource==='injected'){
  const provider=injectedProvider;
  if(!provider?.request||window.ethereum!==provider)
   throw Error('Injected wallet provider unavailable or changed.');
  const [accounts,chainId]=await Promise.all([
   provider.request({method:'eth_accounts'}),
   provider.request({method:'eth_chainId'})
  ]);
  if(authWalletSource!=='injected'||injectedProvider!==provider||window.ethereum!==provider)
   throw Error('Injected wallet provider changed during verification.');
  const expected='0x'+evmIds[chain].toString(16);
  if(!Array.isArray(accounts)||typeof accounts[0]!=='string'||accounts[0].toLowerCase()!==wallet.toLowerCase())
   throw Error('Injected wallet selected account changed.');
  if(typeof chainId!=='string'||chainId.toLowerCase()!==expected.toLowerCase())
   throw Error('Injected wallet network changed.');
  return;
 }

 if(authWalletSource==='reown'){
  const rw=window.LIMFXAIWallet;
  if(!rw||rw!==reownProviderWrapper)throw Error('Reown wallet provider changed. Reconnect your wallet.');
  const currentAddress=rw.getAddress();
  const currentChain=Number(rw.getChainId());
  const currentCaip=rw.getCaipNetworkId();
  if(typeof currentAddress!=='string'||!/^0x[0-9a-fA-F]{40}$/.test(currentAddress)||currentAddress.toLowerCase()!==wallet.toLowerCase())
   throw Error('Reown wallet account changed or is invalid.');
  const caipMatch=typeof currentCaip==='string'?/^eip155:(0|[1-9][0-9]*)$/.exec(currentCaip):null;
  if(!Number.isSafeInteger(currentChain)||currentChain!==evmIds[chain]||!caipMatch||Number(caipMatch[1])!==currentChain||currentCaip!==reownCaipNetworkId||currentChain!==Number(reownChainId))
   throw Error('Reown network diagnostic: '+JSON.stringify({currentChain,currentCaip,subscribedChain:reownChainId,subscribedCaip:reownCaipNetworkId,expectedChain:evmIds[chain],selectedChain:chain}));
  return;
 }

 throw Error('Unknown wallet authentication provider.');
}

function detachWalletListeners(){
 const remove=(provider,event,handler)=>{
  if(!provider||!handler)return;
  try{
   if(typeof provider.removeListener==='function')provider.removeListener(event,handler);
   else if(typeof provider.off==='function')provider.off(event,handler);
  }catch{}
 };
 if(injectedHandlers){
  for(const [event,handler] of Object.entries(injectedHandlers))remove(injectedProvider,event,handler);
 }
 if(solanaHandlers){
  for(const [event,handler] of Object.entries(solanaHandlers))remove(solanaProvider,event,handler);
 }
 injectedProvider=null;
 solanaProvider=null;
 injectedHandlers=null;
 solanaHandlers=null;
}

function attachInjectedListeners(provider){
 if(injectedProvider===provider&&injectedHandlers)return;
 detachWalletListeners();
 injectedProvider=provider;
 injectedHandlers={
  accountsChanged:accounts=>{
   if(authWalletSource!=='injected'||injectedProvider!==provider||window.ethereum!==provider)return;
   const next=Array.isArray(accounts)&&typeof accounts[0]==='string'?accounts[0]:'';
   const previous=$('authWallet').value.trim();
   if(!next||!/^0x[0-9a-fA-F]{40}$/.test(next)){
    invalidateAuth('Wallet account disconnected or invalid.',true);
    return;
   }
   if(previous.toLowerCase()!==next.toLowerCase())
    invalidateAuth('Wallet account changed. Verify ownership again.');
   $('authWallet').value=next;
   setWalletUi(true);
   $('verifyWallet').disabled=true;
   $('authStatus').textContent='Wallet account changed. Check network and verify ownership again.';
  },
  chainChanged:chainId=>{
   if(authWalletSource!=='injected'||injectedProvider!==provider||window.ethereum!==provider)return;
   const parsed=typeof chainId==='string'&&/^0x[0-9a-f]+$/i.test(chainId)?Number.parseInt(chainId,16):NaN;
   const selected=Object.entries(evmIds).find(([,id])=>id===parsed);
   invalidateAuth('Wallet network changed. Verify ownership again.');
   if(selected){
    $('authChain').value=selected[0];
    $('authStatus').textContent='Network changed to '+selected[0]+'. Verify wallet ownership again.';
   }else{
    $('verifyWallet').disabled=true;
    $('authStatus').textContent='Unsupported wallet network. Select a supported network.';
   }
  },
  disconnect:()=>{
   if(authWalletSource==='injected'&&injectedProvider===provider&&window.ethereum===provider)
    invalidateAuth('Wallet disconnected.',true);
  }
 };
 if(typeof provider.on==='function'){
  for(const [event,handler] of Object.entries(injectedHandlers))provider.on(event,handler);
 }
}

function attachSolanaListeners(provider){
 if(solanaProvider===provider&&solanaHandlers)return;
 detachWalletListeners();
 solanaProvider=provider;
 solanaHandlers={
  accountChanged:publicKey=>{
   if(authWalletSource!=='solana'||solanaProvider!==provider||window.solana!==provider)return;
   const next=publicKey?.toString?.()||'';
   if(!isValidSolanaAddress(next)){
    invalidateAuth('Solana wallet account disconnected or invalid.',true);
    return;
   }
   invalidateAuth('Solana wallet account changed. Verify ownership again.');
   $('authWallet').value=next;
   setWalletUi(true);
   $('verifyWallet').disabled=true;
   $('authStatus').textContent='Solana account changed. Verify wallet ownership again.';
  },
  disconnect:()=>{
   if(authWalletSource==='solana'&&solanaProvider===provider&&window.solana===provider)
    invalidateAuth('Solana wallet disconnected.',true);
  }
 };
 if(typeof provider.on==='function'){
  for(const [event,handler] of Object.entries(solanaHandlers))provider.on(event,handler);
 }
}

$('authChain').addEventListener('change',()=>{
 walletConnectAttempt++;
 invalidateAuth('Selected network changed. Verify wallet ownership again.');
});

$('connectWallet').onclick=async()=>{
 const connectAttempt=++walletConnectAttempt;
 const ensureConnectCurrent=()=>{
  if(connectAttempt!==walletConnectAttempt)
   throw Error('Connection cancelled: a newer wallet action started.');
 };
 if(authWalletSource==='reown' && window.LIMFXAIWallet?.getAddress()){
  try{
   await window.LIMFXAIWallet.disconnect();
   ensureConnectCurrent();
   detachReownListeners();
   invalidateAuth('Wallet disconnected.',true);
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

 invalidateAuth('Connecting wallet…',true);
 detachReownListeners();
 detachWalletListeners();
 const chain=$('authChain').value;
 let reownAttemptWrapper=null;
 try{
  if(chain==='solana'){
   authWalletSource='solana';
   const provider=window.solana;
   if(!provider?.connect)throw Error('Solana wallet provider not found. Install a compatible wallet/browser.');
   attachSolanaListeners(provider);
   const out=await provider.connect();
   ensureConnectCurrent();
   if(window.solana!==provider||solanaProvider!==provider)
    throw Error('Solana wallet provider changed during connection.');
   if(!out?.publicKey)throw Error('Solana wallet returned no public key.');
   const address=out.publicKey.toString();
   const current=provider.publicKey?.toString?.()||'';
   if(!isValidSolanaAddress(address)||current!==address)
    throw Error('Solana wallet returned an invalid or changed public key.');
   $('authWallet').value=address;
  }else if(window.ethereum){
   const provider=window.ethereum;
   if(!evmIds[chain])throw Error('Unsupported EVM network selection.');
   authWalletSource='injected';
   attachInjectedListeners(provider);
   await provider.request({method:'eth_requestAccounts'});
   ensureConnectCurrent();
   if(window.ethereum!==provider)throw Error('Wallet provider changed during connection.');
   const wanted='0x'+evmIds[chain].toString(16);
   const current=await provider.request({method:'eth_chainId'});
   ensureConnectCurrent();
   if(window.ethereum!==provider)throw Error('Wallet provider changed during connection.');
   if(typeof current!=='string'||current.toLowerCase()!==wanted){
    await provider.request({method:'wallet_switchEthereumChain',params:[{chainId:wanted}]});
    ensureConnectCurrent();
    if(window.ethereum!==provider)throw Error('Wallet provider changed during network switch.');
   }
   const accounts=await provider.request({method:'eth_accounts'});
   ensureConnectCurrent();
   if(window.ethereum!==provider)throw Error('Wallet provider changed during account refresh.');
   if(!Array.isArray(accounts)||typeof accounts[0]!=='string'||!/^0x[0-9a-fA-F]{40}$/.test(accounts[0]))
    throw Error('No valid wallet account returned after network switch.');
   const confirmedChain=await provider.request({method:'eth_chainId'});
   ensureConnectCurrent();
   if(typeof confirmedChain!=='string'||confirmedChain.toLowerCase()!==wanted)
    throw Error('Wallet network changed during connection. Please retry.');
   $('authWallet').value=accounts[0];
  }else{
   const rw=window.LIMFXAIWallet;
   reownAttemptWrapper=rw;
   if(!rw)throw Error('Reown is not ready. Refresh the page and try again.');
   reownProviderWrapper=rw;

   authWalletSource='reown';
   $('verifyWallet').disabled=true;
   $('authStatus').textContent='Select a wallet from the WalletConnect window…';

   const subscriptionGeneration=++reownSubscriptionGeneration;
   if(!reownUnsubNetwork){
    reownUnsubNetwork=rw.subscribeNetwork(state=>{
     if(subscriptionGeneration!==reownSubscriptionGeneration||authWalletSource!=='reown'||window.LIMFXAIWallet!==rw)return;
     const nextCaip=state.caipNetworkId;
     const nextChain=state.chainId;
     const changed=(reownCaipNetworkId!==null&&reownCaipNetworkId!==nextCaip)||(reownChainId!==null&&Number(reownChainId)!==Number(nextChain));
     reownCaipNetworkId=nextCaip;
     reownChainId=nextChain;
     if(changed)invalidateAuth('Reown network changed. Verify wallet ownership again.');
     const selected=Object.entries(evmIds).find(([,id])=>id===Number(reownChainId));
     if(selected){
      $('authChain').value=selected[0];
      $('authStatus').textContent='Network connected: '+selected[0]+'. Menunggu akun wallet…';
     }else{
      invalidateAuth('Reown network unsupported. Choose Ethereum, BNB, Base, or Arbitrum.');
      $('authStatus').textContent='Unsupported network. Select Ethereum, BNB, Base, or Arbitrum.';
     }
     syncReownVerify();
    });
   }

   if(!reownUnsubAccount){
    reownUnsubAccount=rw.subscribeAccount(state=>{
     if(subscriptionGeneration!==reownSubscriptionGeneration||authWalletSource!=='reown'||window.LIMFXAIWallet!==rw)return;
     if(state.isConnected&&typeof state.address==='string'&&/^0x[0-9a-fA-F]{40}$/.test(state.address)){
      authWalletSource='reown';
      const nextAddress=state.address;
      const previousAddress=$('authWallet').value.trim();
      if(previousAddress&&previousAddress.toLowerCase()!==nextAddress.toLowerCase())invalidateAuth('Reown account changed. Verify wallet ownership again.');
      $('authWallet').value=nextAddress;
      setWalletUi(true);
      $('authStatus').textContent='Wallet connected. Check the network, then verify the signature.';
     }else{
      invalidateAuth('Wallet is not connected.',true);
      $('authWallet').value='';
      $('verifyWallet').disabled=true;
      setWalletUi(false);
      $('authStatus').textContent='Wallet is not connected.';
     }
     syncReownVerify();
    });
   }

   await rw.open();
   ensureConnectCurrent();
   return;
  }

  setWalletUi(true);
  $('verifyWallet').disabled=false;
  $('authStatus').textContent='Wallet connected. Next: request a one-time sign-in challenge and sign the displayed message.';
 }catch(e){
  if(connectAttempt===walletConnectAttempt){
   if(reownAttemptWrapper&&authWalletSource==='reown'&&window.LIMFXAIWallet===reownAttemptWrapper){
    detachReownListeners();
    invalidateAuth('Reown connection failed.',true);
    authWalletSource='injected';
   }
   $('authStatus').textContent='Connect error: '+e.message;
  }
 }
};

$('verifyWallet').onclick=async()=>{
 const chain=$('authChain').value;
 const wallet=$('authWallet').value.trim();
 const generation=authGeneration;
 const source=authWalletSource;
 let challenge=null;

 const ensureCurrent=async()=>{
  if(generation!==authGeneration||source!==authWalletSource)
   throw Error('Authentication cancelled: wallet state changed.');
  await assertAuthContext(generation,chain,wallet);
  if(generation!==authGeneration||source!==authWalletSource)
   throw Error('Authentication cancelled: wallet state changed.');
 };

 $('verifyWallet').disabled=true;
 try{
  await ensureCurrent();
  const c=await fetch('/api/auth/challenge',{
   method:'POST',
   headers:{'content-type':'application/json'},
   body:JSON.stringify({chain,wallet})
  });
  await ensureCurrent();
  const challengeResponse=await c.json();
  await ensureCurrent();
  if(!c.ok)throw Error(challengeResponse.error||'Challenge request failed');
  if(typeof challengeResponse.challengeId!=='string'||typeof challengeResponse.message!=='string')
   throw Error('Invalid authentication challenge response.');
  challenge=challengeResponse;
  pendingChallenge=challenge;

  let signature;
  if(chain==='solana'){
   const provider=solanaProvider;
   if(!provider?.signMessage||window.solana!==provider)
    throw Error('Solana signing provider unavailable or changed.');
   await ensureCurrent();
   const signed=await provider.signMessage(new TextEncoder().encode(challenge.message),'utf8');
   await ensureCurrent();
   if(!signed?.signature||!(signed.signature instanceof Uint8Array)||signed.signature.length!==64)
    throw Error('Solana signature must contain exactly 64 bytes.');
   signature=toBase64UrlBytes(signed.signature);
  }else if(source==='reown'){
   const rw=window.LIMFXAIWallet;
   const currentId=Number(rw?.getChainId?.());
   const selected=Object.entries(evmIds).find(([,id])=>id===currentId);
   if(!rw||!selected||selected[0]!==chain)
    throw Error('The Reown network does not match the selected network.');
   const caipId=rw.getCaipNetworkId()||reownCaipNetworkId;
   if(!caipId)throw Error('Reown network ID is unavailable. Reconnect your wallet.');
   signature=await rw.signMessage(challenge.message,wallet,caipId);
   await ensureCurrent();
  }else if(source==='injected'){
   const provider=window.ethereum;
   if(!provider?.request)throw Error('Injected wallet provider is unavailable.');
   signature=await provider.request({method:'personal_sign',params:[challenge.message,wallet]});
   await ensureCurrent();
  }else{
   throw Error('Unknown wallet authentication provider.');
  }

  if(typeof signature!=='string'||!signature)
   throw Error('Wallet returned an invalid signature.');
  await ensureCurrent();

  const v=await fetch('/api/auth/verify',{
   method:'POST',
   headers:{'content-type':'application/json'},
   body:JSON.stringify({challengeId:challenge.challengeId,signature})
  });
  await ensureCurrent();
  const raw=await v.text();
  await ensureCurrent();

  let result;
  try{result=JSON.parse(raw)}catch{
   throw Error(`HTTP ${v.status} | URL: ${v.url} | Type: ${v.headers.get('content-type')} | Response: ${raw.slice(0,250)}`);
  }
  if(!v.ok)throw Error(result.error||`Signature verification failed (HTTP ${v.status})`);
  if(typeof result.wallet!=='string'||result.wallet.toLowerCase()!==wallet.toLowerCase()||result.chain!==chain)
   throw Error('Server authentication identity does not match the active wallet.');
  if(typeof result.sessionToken!=='string'||!result.sessionToken||
     !Number.isFinite(result.expiresInSeconds)||result.expiresInSeconds<=0||result.expiresInSeconds>3600)
   throw Error('Server returned an invalid session.');

  await ensureCurrent();
  authSession={
   token:result.sessionToken,
   wallet:result.wallet,
   chain:result.chain,
   expiresAt:Date.now()+result.expiresInSeconds*1000
  };
  if(pendingChallenge?.challengeId===challenge.challengeId)pendingChallenge=null;
  $('authStatus').textContent=`VERIFIED ✓
  Wallet: ${result.wallet}
  Network: ${result.chain}
  Session: ${Math.ceil(result.expiresInSeconds/60)} minutes
  Scope: wallet authentication only
  No trade approval or transaction was created.`;
 }catch(e){
  if(generation===authGeneration&&source===authWalletSource){
   if(pendingChallenge?.challengeId===challenge?.challengeId)pendingChallenge=null;
   $('authStatus').textContent='Verification error: '+e.message;
  }
 }finally{
  if(generation===authGeneration&&source===authWalletSource){
   try{
    await assertAuthContext(generation,chain,wallet);
    $('verifyWallet').disabled=false;
   }catch{
    $('verifyWallet').disabled=true;
   }
  }
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
document.addEventListener('pointerdown',e=>e.target.closest('.module-nav button')?.classList.add('void-pressed'));['pointerup','pointercancel'].forEach(t=>document.addEventListener(t,()=>document.querySelectorAll('.void-pressed').forEach(b=>b.classList.remove('void-pressed'))));



(()=>{let layer=null,pid=null,last=null;const sparks=(x,y,dx,dy)=>{const base=Math.atan2(dy,dx);for(let i=0;i<7;i++){const a=base+(Math.random()-.5)*2.3,d=35+Math.random()*115,s=document.createElement("i");s.className="electric-spark";s.style.left=x+"px";s.style.top=y+"px";s.style.setProperty("--dx",Math.cos(a)*d+"px");s.style.setProperty("--dy",Math.sin(a)*d+"px");s.style.setProperty("--ang",a*57.3+"deg");s.style.setProperty("--dur",(.35+Math.random()*.5)+"s");s.style.setProperty("--h",(12+Math.random()*25)+"px");layer.append(s)}while(layer.children.length>180)layer.firstChild.remove()};document.addEventListener("pointerdown",e=>{if(!e.isPrimary)return;layer?.remove();layer=document.createElement("div");layer.className="electric-layer";document.body.append(layer);pid=e.pointerId;last={x:e.clientX,y:e.clientY};sparks(last.x,last.y,1,0)},true);document.addEventListener("pointermove",e=>{if(!layer||e.pointerId!==pid)return;const dx=e.clientX-last.x,dy=e.clientY-last.y;if(Math.hypot(dx,dy)>2){sparks(e.clientX,e.clientY,dx,dy);last={x:e.clientX,y:e.clientY}}},true);const up=e=>{if(!layer||e.pointerId!==pid)return;const old=layer;old.classList.add("electric-release");setTimeout(()=>{old.remove();if(layer===old)layer=null},750);pid=null;last=null};document.addEventListener("pointerup",up,true);document.addEventListener("pointercancel",up,true)})();
(()=>{let box,timer,url,closed=false,candles=[];const native=window.fetch.bind(window);const stop=()=>{clearInterval(timer);timer=null;box?.remove();box=null;closed=true};const chart=()=>{if(!box)return;const c=box.querySelector("canvas"),r=c.getBoundingClientRect(),w=r.width,h=r.height,dpr=devicePixelRatio||1;if(!w)return;c.width=w*dpr;c.height=h*dpr;const x=c.getContext("2d");x.setTransform(dpr,0,0,dpr,0,0);x.clearRect(0,0,w,h);const data=candles.slice(-36);if(!data.length){x.fillStyle="#a99bc9";x.fillText("WAITING FOR PRICE DATA",8,24);return}let lo=Math.min(...data.map(v=>v.low)),hi=Math.max(...data.map(v=>v.high));if(hi===lo){hi*=1.002;lo*=.998}const y=v=>8+(hi-v)/(hi-lo)*(h-22),step=(w-12)/data.length,bw=Math.max(3,Math.min(8,step*.58));x.strokeStyle="#ffffff16";x.lineWidth=1;for(let i=0;i<4;i++){let yy=8+i*(h-22)/3;x.beginPath();x.moveTo(5,yy);x.lineTo(w-5,yy);x.stroke()}data.forEach((v,i)=>{let xx=6+i*step+step/2,up=v.close>=v.open,col=up?"#35e6a0":"#ff557c";x.strokeStyle=col;x.fillStyle=col;x.lineWidth=1.3;x.beginPath();x.moveTo(xx,y(v.high));x.lineTo(xx,y(v.low));x.stroke();let top=y(Math.max(v.open,v.close)),bh=Math.max(2,Math.abs(y(v.open)-y(v.close)));x.fillRect(xx-bw/2,top,bw,bh)})};const sample=d=>{let price=Number(d.token?.priceUsd);if(!(price>0&&Number.isFinite(price)))return;let minute=Math.floor(Date.now()/60000)*60000,v=candles[candles.length-1];if(!v||v.time!==minute){candles.push({time:minute,open:price,high:price,low:price,close:price});if(candles.length>120)candles.shift()}else{v.high=Math.max(v.high,price);v.low=Math.min(v.low,price);v.close=price}chart()};const draw=d=>{if(closed)return;if(!box){box=document.createElement("aside");box.id="limfx-live";box.style.cssText="position:fixed;right:10px;bottom:10px;z-index:99999;width:min(270px,calc(100vw - 20px));padding:10px;background:#090711ed;border:1px solid #a98cff99;border-radius:12px;color:#ddd;font:11px monospace;box-shadow:0 0 22px #8b5cf655;backdrop-filter:blur(14px);max-height:44vh;overflow:auto";box.innerHTML='<header style="display:flex;align-items:center;justify-content:space-between;gap:8px"><b style="color:#c6aaff">◈ LIMFX LIVE</b><span style="color:#67e8a5">● LIVE</span><button id="limfx-live-close" aria-label="Close" style="background:#302044;border:1px solid #a98cff88;color:#fff;border-radius:6px;padding:3px 9px;font-size:16px">×</button></header><hr style="border-color:#a98cff44"><b id="limfx-symbol">TOKEN</b> · <span id="limfx-name">Market feed</span><h2 id="limfx-price" style="color:#fff;font-size:21px;margin:7px 0">$—</h2><div id="limfx-metrics" style="display:grid;grid-template-columns:1fr 1fr;gap:5px;line-height:1.6"></div><div style="color:#bda8ef;margin:9px 0 3px">LIVE CANDLE · 1 MIN · SAMPLED PRICE</div><canvas style="display:block;width:100%;height:105px"></canvas><small style="color:#a99bc9">MARKET FEED · REFRESH 5s</small>';document.body.append(box)}const t=d.token||{},m=d.metrics||{};box.querySelector("#limfx-symbol").textContent=t.symbol||"TOKEN";box.querySelector("#limfx-name").textContent=t.name||"Market feed";box.querySelector("#limfx-price").textContent=t.priceUsd?"$"+Number(t.priceUsd).toPrecision(8):"WAITING...";box.querySelector("#limfx-metrics").innerHTML=[["24H",m.priceChange24hPct??"—"],["VOLUME","$"+(m.volume24hUsd??"—")],["LIQUIDITY","$"+(m.liquidityUsd??"—")],["FDV","$"+(m.fdvUsd??"—")],["CHAIN",d.chain||"—"],["PAIR",d.pair||"—"]].map(([k,v])=>`<span>${k}<br><b>${v}</b></span>`).join("");sample(d)};document.addEventListener("click",e=>{if(e.target.closest("#limfx-live-close"))stop();const p=e.target.closest("[data-page]");if(p&&p.dataset.page!=="market")stop()});window.addEventListener("resize",chart);window.fetch=async(...a)=>{const r=await native(...a);if(String(a[0]).includes("/api/research/token")){url=String(a[0]);closed=false;try{const d=await r.clone().json();if(d.found){draw(d);clearInterval(timer);timer=setInterval(async()=>{try{const q=await native(url),v=await q.json();if(v.found)draw(v)}catch{}},5000)}else stop()}catch{}}return r}})();