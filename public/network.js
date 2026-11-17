
(()=>{
const $=id=>document.getElementById(id);
let rpc='',rid=0;
async function call(method,params=[]){
 const r=await fetch(rpc,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:++rid,method,params})});
 if(!r.ok)throw Error('HTTP '+r.status);
 const j=await r.json();if(j.error)throw Error(j.error.message||'RPC error');return j.result;
}
window.limfxaiRpcCall=(method,params=[])=>call(method,params);
$('netConnect').onclick=async()=>{
 rpc=$('netRpc').value.trim();
 try{
  if(!/^https?:\/\//i.test(rpc))throw Error('Enter a valid HTTP(S) RPC URL');
  $('netOutput').textContent='Connecting...';
  const [chain,block]=await Promise.all([call('eth_chainId'),call('eth_blockNumber')]);
  $('netChain').textContent=BigInt(chain).toString();
  $('netBlock').textContent=BigInt(block).toString();
  $('netStatus').textContent='CONNECTED';
  $('netOutput').textContent='RPC connection successful. Read-only access.';
  $('scanOutput').textContent='Ready to search blocks and transactions.';
 }catch(e){$('netStatus').textContent='ERROR';$('netOutput').textContent=e.message}
};
$('scanQueryBtn').onclick=async()=>{
 try{
  if(!rpc)throw Error('Connect RPC first');
  const q=$('scanQuery').value.trim();
  if(/^0x[0-9a-fA-F]{64}$/.test(q)){
   const result=await call('eth_getTransactionByHash',[q]);
   $('scanOutput').textContent=result?JSON.stringify(result,null,2):'Transaction not found.';
  }else if(/^(0x[0-9a-fA-F]+|[0-9]+)$/.test(q)){
   const n='0x'+BigInt(q).toString(16);
   const result=await call('eth_getBlockByNumber',[n,true]);
   $('scanOutput').textContent=result?JSON.stringify(result,null,2):'Block not found.';
  }else throw Error('Enter a block number or 32-byte transaction hash');
 }catch(e){$('scanOutput').textContent=e.message}
};

/* ASI_READER_LOGIC */
const aw=(d,i=0)=>{let w=String(d).replace(/^0x/,"").slice(i*64,(i+1)*64);if(w.length!==64)throw Error("Invalid ABI response");return w};
const ac=()=> $("asiContract").value.trim();
$("asiRead").onclick=async()=>{try{
if(!rpc)throw Error("Connect RPC first");
let a=ac();if(!/^0x[0-9a-fA-F]{40}$/.test(a))throw Error("Invalid contract address");
let code=await call("eth_getCode",[a,"latest"]);if(!code||/^0x0*$/.test(code))throw Error("No deployed contract code at this address");
let sels=["0xf5ff5c76","0x02fb0c5e","0xf29fbab1","0xee808656","0xb6cb58a5","0x8da5cb5b"];
let v=await Promise.all(sels.map(data=>call("eth_call",[{to:a,data},"latest"])));
$("asiOutput").textContent=JSON.stringify({contract:a,agent:"0x"+aw(v[0]).slice(24),active:BigInt("0x"+aw(v[1]))!==0n,identityCommitment:"0x"+aw(v[2]),buildHash:"0x"+aw(v[3]),taskCount:BigInt("0x"+aw(v[4])).toString(),owner:"0x"+aw(v[5]).slice(24),verifiedCode:true},null,2);
}catch(e){$("asiOutput").textContent="ERROR: "+e.message}};
$("asiTaskRead").onclick=async()=>{try{
if(!rpc)throw Error("Connect RPC first");
let a=ac(),id=$("asiTaskId").value.trim();if(!/^0x[0-9a-fA-F]{40}$/.test(a))throw Error("Invalid contract address");if(!/^[0-9]+$/.test(id))throw Error("Enter a numeric task ID");
let code=await call("eth_getCode",[a,"latest"]);if(!code||/^0x0*$/.test(code))throw Error("Contract code not found");
let data="0x8d977672"+BigInt(id).toString(16).padStart(64,"0"),r=await call("eth_call",[{to:a,data},"latest"]),w=[0,1,2,3,4].map(i=>aw(r,i)),st=Number(BigInt("0x"+w[4]));
$("asiTaskOutput").textContent=JSON.stringify({taskId:id,inputHash:"0x"+w[0],resultHash:"0x"+w[1],createdAt:Number(BigInt("0x"+w[2])),completedAt:Number(BigInt("0x"+w[3])),status:({0:"none",1:"pending",2:"completed"}[st]||"unknown")},null,2);
}catch(e){$("asiTaskOutput").textContent="ERROR: "+e.message}};

})();
