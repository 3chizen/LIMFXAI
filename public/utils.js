// LIMFXAI — split from public/app.js. Keep these as classic scripts in loader order.

const $=id=>document.getElementById(id);
function showLimfxSkeleton(el,label='LOADING'){
 if(!el)return;
 el.innerHTML=`<div class="limfx-skeleton-stack" role="status" aria-label="${label}"><span class="limfx-skeleton-label">${label}</span><div class="limfx-skeleton-line short"></div><div class="limfx-skeleton-line long"></div><div class="limfx-skeleton-line medium"></div><div class="limfx-skeleton-grid"><div class="limfx-skeleton-card"></div><div class="limfx-skeleton-card"></div><div class="limfx-skeleton-card"></div></div></div>`;
}

function intelEsc(v){return String(v??"—").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll(String.fromCharCode(34),"&quot;");}
function intelMoney(v){const n=Number(v);return Number.isFinite(n)?"$"+n.toLocaleString("en-US",{maximumFractionDigits:2}):"—";}
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
