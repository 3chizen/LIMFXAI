const $=id=>document.getElementById(id);
let messages=[];
function bubble(text,who){const el=document.createElement('div');el.className='bubble '+who;el.textContent=text;$('chat').append(el);$('chat').scrollTop=$('chat').scrollHeight;return el}
$('scan').onclick=async()=>{const chain=$('chain').value,address=$('address').value.trim();if(!address){$('research').textContent='Masukkan contract/mint address dulu.';return}
$('scan').disabled=true;$('research').textContent='Fetching public market data…';
try{const r=await fetch(`/api/research/token?chain=${encodeURIComponent(chain)}&address=${encodeURIComponent(address)}`);const d=await r.json();if(!r.ok)throw Error(d.error||'Research failed');window.lastResearch={chain,address};$('research').textContent=JSON.stringify(d,null,2);if(d.found)bubble(`Screening selesai: ${d.token?.symbol||'token'} | liquidity $${Number(d.metrics.liquidityUsd).toLocaleString()} | flags: ${d.screening.flags.length}. Tanya gw untuk interpretasi hasil.`, 'bot');}
catch(e){$('research').textContent='Error: '+e.message}finally{$('scan').disabled=false}};
async function send(){const prompt=$('prompt').value.trim();if(!prompt)return;$('prompt').value='';bubble(prompt,'user');messages.push({role:'user',content:prompt});$('send').disabled=true;
const pending=bubble('LIMFXAI is thinking…','bot');
try{const r=await fetch('/api/chat',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({provider:$('provider').value,messages,research:window.lastResearch||null})});const d=await r.json();if(!r.ok)throw Error(d.error||'AI request failed');pending.textContent=d.reply;messages.push({role:'assistant',content:d.reply});}
catch(e){pending.textContent='Error: '+e.message+' — pastikan API key provider sudah diatur di server.'}finally{$('send').disabled=false}}
$('send').onclick=send;$('prompt').addEventListener('keydown',e=>{if(e.key==='Enter')send()});

// Wallet proof-of-ownership flow. Never requests a seed phrase/private key.
let authSession=null, pendingChallenge=null;
const evmIds={ethereum:1,bnb:56,base:8453,arbitrum:42161};
const toBase64UrlBytes = bytes => {
  let s=''; bytes.forEach(b=>s+=String.fromCharCode(b));
  return btoa(s).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
};
$('connectWallet').onclick=async()=>{
 const chain=$('authChain').value;
 try{
  if(chain==='solana'){
   const provider=window.solana;
   if(!provider?.connect)throw Error('Solana wallet provider not found. Install a compatible wallet extension/browser.');
   const out=await provider.connect();$('authWallet').value=out.publicKey.toString();
  }else{
   if(!window.ethereum)throw Error('EVM wallet not found. Install MetaMask or another EIP-1193 wallet.');
   const accounts=await window.ethereum.request({method:'eth_requestAccounts'});
   if(!accounts?.length)throw Error('No wallet account returned');
   const wanted='0x'+evmIds[chain].toString(16);
   const current=await window.ethereum.request({method:'eth_chainId'});
   if(current.toLowerCase()!==wanted)await window.ethereum.request({method:'wallet_switchEthereumChain',params:[{chainId:wanted}]});
   $('authWallet').value=accounts[0];
  }
  $('verifyWallet').disabled=false;$('authStatus').textContent='Wallet connected. Next: request a one-time sign-in challenge and sign the displayed message.';
 }catch(e){$('authStatus').textContent='Connect error: '+e.message}
};
$('verifyWallet').onclick=async()=>{
 const chain=$('authChain').value,wallet=$('authWallet').value.trim();
 $('verifyWallet').disabled=true;
 try{
  const c=await fetch('/api/auth/challenge',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({chain,wallet})});
  const challenge=await c.json();if(!c.ok)throw Error(challenge.error||'Challenge request failed');
  pendingChallenge=challenge;
  let signature;
  if(chain==='solana'){
   const bytes=new TextEncoder().encode(challenge.message);
   const signed=await window.solana.signMessage(bytes,'utf8');
   signature=toBase64UrlBytes(signed.signature);
  }else{
   signature=await window.ethereum.request({method:'personal_sign',params:[challenge.message,wallet]});
  }
  const v=await fetch('/api/auth/verify',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({challengeId:challenge.challengeId,signature})});
  const result=await v.json();if(!v.ok)throw Error(result.error||'Signature verification failed');
  authSession={token:result.sessionToken,wallet:result.wallet,chain:result.chain,expiresAt:Date.now()+result.expiresInSeconds*1000};
  $('authStatus').textContent=`VERIFIED ✓\nWallet: ${result.wallet}\nNetwork: ${result.chain}\nSession: 1 hour\nScope: wallet authentication only\nNo trade approval or transaction was created.`;
 }catch(e){$('authStatus').textContent='Verification error: '+e.message}
 finally{$('verifyWallet').disabled=false}
};

// Read-only transaction simulation; endpoint never broadcasts a transaction.
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
$('checkSpender').onclick=async()=>{
 if(!authSession||authSession.expiresAt<Date.now()){$('spenderResult').textContent='Authenticate an EVM wallet first.';return;}
 if(!['ethereum','bnb','base','arbitrum'].includes(authSession.chain)){$('spenderResult').textContent='EVM wallet session required.';return;}
 const body={token:$('intelToken').value.trim(),spender:$('intelSpender').value.trim()};
 $('checkSpender').disabled=true;$('spenderResult').textContent='Checking deployed bytecode, proxy slot and configured registry…';
 try{
  const r=await fetch('/api/security/spender-intel',{method:'POST',headers:{'content-type':'application/json','authorization':`Bearer ${authSession.token}`},body:JSON.stringify(body)});
  const d=await r.json();if(!r.ok)throw Error(d.error||'Spender check failed');
  $('spenderResult').textContent=JSON.stringify(d,null,2);
 }catch(e){$('spenderResult').textContent='Spender intelligence error: '+e.message;}
 finally{$('checkSpender').disabled=false;}
};
