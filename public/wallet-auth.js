// LIMFXAI — split from public/app.js. Keep these as classic scripts in loader order.

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
  const currentCaipValue=rw.getCaipNetworkId();
  const currentCaip=typeof currentCaipValue==='number'&&Number.isSafeInteger(currentCaipValue)?'eip155:'+currentCaipValue:currentCaipValue;
  if(typeof currentAddress!=='string'||!/^0x[0-9a-fA-F]{40}$/.test(currentAddress)||currentAddress.toLowerCase()!==wallet.toLowerCase())
   throw Error('Reown wallet account changed or is invalid.');
  const caipMatch=typeof currentCaip==='string'?/^eip155:(0|[1-9][0-9]*)$/.exec(currentCaip):null;
  if(!Number.isSafeInteger(currentChain)||currentChain!==evmIds[chain]||!caipMatch||Number(caipMatch[1])!==currentChain||currentCaip!==reownCaipNetworkId||currentChain!==Number(reownChainId))
   throw Error('Reown live network identity changed or does not match the subscription.');
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

