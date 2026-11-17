(()=>{
const $=id=>document.getElementById(id);
const rpc=window.limfxaiRpcCall;
if(typeof rpc!=="function")return;

const set=(id,value)=>{const e=$(id);if(e)e.textContent=String(value)};
const fmt=v=>BigInt(v).toLocaleString("en-US");
const short=v=>v?String(v).slice(0,10)+"…":"—";
const age=v=>{
 const n=Math.max(0,Math.floor(Date.now()/1000-Number(BigInt(v))));
 return n<60?n+"s ago":n<3600?Math.floor(n/60)+"m ago":n<86400?Math.floor(n/3600)+"h ago":Math.floor(n/86400)+"d ago";
};
function table(id,rows,cols){
 const body=$(id);if(!body)return;
 body.replaceChildren();
 if(!rows.length){
  const tr=document.createElement("tr"),td=document.createElement("td");
  td.colSpan=cols;td.className="scan-table-empty";
  td.textContent="No data returned by RPC.";tr.append(td);body.append(tr);return;
 }
 rows.forEach(values=>{
  const tr=document.createElement("tr");
  values.forEach(value=>{
   const td=document.createElement("td");td.textContent=String(value);tr.append(td);
  });
  body.append(tr);
 });
}
async function refresh(){
 const [heightHex,gasHex]=await Promise.all([
  rpc("eth_blockNumber"),rpc("eth_gasPrice")
 ]);
 const height=BigInt(heightHex);
 const count=Number(height>7n?8n:height+1n);
 const numbers=Array.from({length:count},(_,i)=>height-BigInt(i));
 const blocks=await Promise.all(numbers.map(n=>
  rpc("eth_getBlockByNumber",["0x"+n.toString(16),true])
 ));
 const valid=blocks.filter(Boolean),latest=valid[0];
 if(!latest)throw Error("RPC returned no block data");

 set("scanLatestBlock",fmt(height));
 set("netBlock",fmt(height));
 set("scanChainId",fmt(await rpc("eth_chainId")));
 set("scanGasPrice",(Number(BigInt(gasHex))/1e9).toFixed(4));
 set("scanTxCount",latest.transactions?.length??0);
 set("scanConnectionState","CONNECTED");

 table("scanBlocksBody",valid.map(b=>[
  fmt(b.number),age(b.timestamp),b.transactions?.length??0,fmt(b.gasUsed)
 ]),4);

 const txs=valid.flatMap(b=>(b.transactions||[])
  .filter(t=>t&&typeof t==="object")
  .map(t=>[short(t.hash),fmt(t.blockNumber||b.number),short(t.from),
   t.to?short(t.to):"Contract creation"])
 ).slice(0,12);
 table("scanTransactionsBody",txs,4);

 const bars=$("scanActivityBars");
 if(bars){
  bars.replaceChildren();
  const ordered=valid.slice().reverse();
  const max=Math.max(1,...ordered.map(b=>(b.transactions||[]).length));
  if(ordered.every(b=>(b.transactions||[]).length===0)){
   const empty=document.createElement("div");
   empty.className="scan-empty";
   empty.textContent="No transactions in recent blocks.";
   bars.append(empty);
  }else ordered.forEach(b=>{
   const bar=document.createElement("div");
   bar.className="scan-bar";
   bar.style.height=Math.max(7,(b.transactions.length/max)*100)+"%";
   const label=document.createElement("span");
   label.textContent=String(BigInt(b.number)).slice(-4);
   bar.append(label);bars.append(bar);
  });
 }
 set("scanActivityMessage",valid.length+" recent blocks · RPC data");
}
const connect=$("netConnect");
if(connect&&connect.onclick){
 const original=connect.onclick;
 connect.onclick=async()=>{
  connect.disabled=true;
  try{
   await original.call(connect);
   if($("netStatus")?.textContent.trim()!=="CONNECTED"){
    set("scanConnectionState","ERROR");return;
   }
   await refresh();
  }catch(e){
   set("scanActivityMessage","Explorer refresh failed: "+e.message);
   set("scanConnectionState","ERROR");
  }finally{connect.disabled=false}
 };
}
const button=$("scanRefresh");
if(button)button.onclick=async()=>{
 button.disabled=true;
 try{await refresh()}
 catch(e){set("scanActivityMessage","Refresh failed: "+e.message)}
 finally{button.disabled=false}
};
window.limfxaiExplorerRefresh=refresh;
})();
