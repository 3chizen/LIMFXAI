(()=>{
const nav=document.querySelector(".module-nav");
if(!nav)return;
const icons={
market:'<svg viewBox="0 0 32 32" aria-hidden="true"><defs><linearGradient id="mkt4d" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#e5caff"/><stop offset=".5" stop-color="#a855ff"/><stop offset="1" stop-color="#00e5ff"/></linearGradient></defs><g stroke="url(#mkt4d)" stroke-width="1.35" stroke-linejoin="round"><path d="M4 25V18l6-5 5 3 7-9 6 3v15Z" fill="#9b5cff" fill-opacity=".12"/><path d="M4 25V18l6-5 5 3 7-9 6 3v15Z" fill="none"/><path d="m4 18 6 2v5H4Zm6-5 5 3v9h-5Zm5 3 7-9v18h-7Zm7-9 6 3v15h-6Z" fill="#9b5cff" fill-opacity=".28"/><path d="m4 18 6 2 5-4 7-9 6 3" fill="none"/></g></svg>',
copilot:'<svg viewBox="0 0 32 32" aria-hidden="true"><defs><linearGradient id="ai4d" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#f0d5ff"/><stop offset=".5" stop-color="#a855ff"/><stop offset="1" stop-color="#00e5ff"/></linearGradient></defs><g stroke="url(#ai4d)" stroke-width="1.35" stroke-linejoin="round"><path d="m16 2 4.2 9.8L30 16l-9.8 4.2L16 30l-4.2-9.8L2 16l9.8-4.2Z" fill="#9b5cff" fill-opacity=".2"/><path d="m16 2 0 14 4.2 4.2M16 16 2 16m14 0 14 0m-14 0-4.2 4.2M16 2l-4.2 9.8L16 16l4.2-4.2Z" fill="none"/><path d="m16 2 4.2 9.8L16 16Z" fill="#00e5ff" fill-opacity=".3"/><path d="M25 3v5m-2.5-2.5h5" fill="none"/></g></svg>',
wallet:'<svg viewBox="0 0 32 32" aria-hidden="true"><defs><linearGradient id="wal4d" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#e8d0ff"/><stop offset=".5" stop-color="#9b5cff"/><stop offset="1" stop-color="#00e5ff"/></linearGradient></defs><g stroke="url(#wal4d)" stroke-width="1.35" stroke-linejoin="round"><path d="M6 8 23 4l5 4v19H6Z" fill="#9b5cff" fill-opacity=".13"/><path d="m6 8 17-4 5 4M6 8v19h22V8Z" fill="none"/><path d="m3 12 3-4 17-4v5H8v16H3Z" fill="#a855ff" fill-opacity=".22"/><path d="M3 12h25v15H6a3 3 0 0 1-3-3Z" fill="none"/><path d="M21 15h8v6h-8a3 3 0 0 1 0-6Z" fill="#00e5ff" fill-opacity=".2"/><circle cx="23" cy="18" r="1" fill="#e5caff"/></g></svg>',
trade:'<svg viewBox="0 0 32 32" aria-hidden="true"><defs><linearGradient id="trd4d" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#e5caff"/><stop offset=".5" stop-color="#a855ff"/><stop offset="1" stop-color="#00e5ff"/></linearGradient></defs><g stroke="url(#trd4d)" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round"><path d="m3 10 7-7v5h15l4 5H10v5Z" fill="#9b5cff" fill-opacity=".2"/><path d="m3 10 7-7v5h15l4 5H10v5Z" fill="none"/><path d="m29 22-7 7v-5H7l-4-5h19v-5Z" fill="#00e5ff" fill-opacity=".2"/><path d="m29 22-7 7v-5H7l-4-5h19v-5Z" fill="none"/><path d="m10 3 5 5m7 16-5-5" fill="none"/></g></svg>',
security:'<svg viewBox="0 0 32 32" aria-hidden="true"><defs><linearGradient id="sec4d" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#e8d0ff"/><stop offset=".5" stop-color="#9b5cff"/><stop offset="1" stop-color="#00e5ff"/></linearGradient></defs><g stroke="url(#sec4d)" stroke-width="1.35" stroke-linejoin="round"><path d="M16 2 28 7v8c0 8-5 12-12 15C9 27 4 23 4 15V7Z" fill="#9b5cff" fill-opacity=".16"/><path d="M16 2 28 7v8c0 8-5 12-12 15C9 27 4 23 4 15V7Z" fill="none"/><path d="M16 6 24 9v6c0 5-3 8-8 11-5-3-8-6-8-11V9Z" fill="#00e5ff" fill-opacity=".12"/><path d="m10 16 4 4 8-9" fill="none" stroke-width="2.1"/><path d="m16 2 8 7-8 6Z" fill="#a855ff" fill-opacity=".18"/></g></svg>',
domain:'<svg viewBox="0 0 32 32" aria-hidden="true"><defs><linearGradient id="dom4d" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#e5caff"/><stop offset=".5" stop-color="#9b5cff"/><stop offset="1" stop-color="#00e5ff"/></linearGradient></defs><g stroke="url(#dom4d)" stroke-width="1.3"><circle cx="16" cy="16" r="13" fill="#9b5cff" fill-opacity=".12"/><ellipse cx="16" cy="16" rx="6" ry="13" fill="none"/><path d="M3 16h26M5 9h22M5 23h22" fill="none"/><path d="M16 3a13 13 0 0 1 0 26Z" fill="#00e5ff" fill-opacity=".12"/><path d="m16 3 8 4 5 9-5 9-8 4" fill="none"/></g><circle cx="16" cy="16" r="2" fill="#e5caff"/></svg>',
network:'<svg viewBox="0 0 32 32" aria-hidden="true"><defs><linearGradient id="net4d" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#e2c5ff"/><stop offset=".48" stop-color="#9b5cff"/><stop offset="1" stop-color="#00e5ff"/></linearGradient></defs><g stroke="url(#net4d)" stroke-width="1.35" stroke-linejoin="round"><path d="M16 3 27 9.5 25 22 16 29 7 22 5 9.5Z" fill="#8b5cff" fill-opacity=".12"/><path d="M16 3v13L5 9.5M16 16l11-6.5M16 16l9 6-9 7-9-7Z" fill="none"/><path d="m16 3 11 6.5-11 6.5Z" fill="#a879ff" fill-opacity=".35"/><path d="m16 16 9 6-9 7Z" fill="#00e5ff" fill-opacity=".22"/><path d="m4 3 3-1.5 3 1.5v3.5L7 8 4 6.5Z M24 2l2-1 2 1v2.5l-2 1-2-1Z M26 25l2-1 2 1v2.5l-2 1-2-1Z M2 23l2-1 2 1v2.5l-2 1-2-1Z" fill="#8b5cff" fill-opacity=".4"/></g></svg>'
};
const buttons=[...nav.querySelectorAll("button[data-page]")];
buttons.forEach(b=>{
 const key=b.dataset.page,icon=b.querySelector("span");
 if(icon){icon.className="nav-icon";icon.innerHTML=icons[key]||""}
 b.setAttribute("aria-label",b.querySelector("b")?.textContent.trim()||key);
});
const overlay=document.createElement("div");
overlay.className="limfx-command-overlay";
overlay.innerHTML='<section class="limfx-command-box" role="dialog" aria-modal="true" aria-label="LIMFXAI Command Palette"><header><span>✦ LIMFXAI COMMAND</span><kbd>ESC</kbd></header><input class="limfx-command-input" placeholder="Search pages and commands..." autocomplete="off"><div class="limfx-command-results"></div><footer>Navigate <kbd>↑</kbd> <kbd>↓</kbd> · Open <kbd>ENTER</kbd> · Close <kbd>ESC</kbd></footer></section>';
document.body.append(overlay);
const input=overlay.querySelector("input"),results=overlay.querySelector(".limfx-command-results");
function render(){
 const q=input.value.trim().toLowerCase();results.replaceChildren();
 buttons.filter(b=>(b.textContent+" "+b.dataset.page).toLowerCase().includes(q)).forEach(b=>{
  const item=document.createElement("button");item.type="button";
  item.innerHTML=(icons[b.dataset.page]||"")+"<span>"+b.querySelector("b").textContent+"</span><kbd>↵</kbd>";
  item.onclick=()=>{b.click();close()};
  results.append(item);
 });
}
function open(){overlay.classList.add("visible");input.value="";render();input.focus()}
function close(){overlay.classList.remove("visible")}
input.addEventListener("input",render);
input.addEventListener("keydown",e=>{
 if(e.key==="Enter"){e.preventDefault();results.querySelector("button")?.click()}
 if(e.key==="ArrowDown"){e.preventDefault();results.querySelector("button")?.focus()}
});
overlay.addEventListener("click",e=>{if(e.target===overlay)close()});
document.addEventListener("keydown",e=>{
 if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="k"){e.preventDefault();open()}
 if(e.key==="Escape"){close();closeMenu()}
});
const sidebar=nav.closest(".sidebar");
const backdrop=document.createElement("div");
backdrop.className="limfx-menu-backdrop";
(document.querySelector(".app-shell")||document.body).append(backdrop);
function openMenu(){sidebar?.classList.add("menu-open");backdrop.classList.add("visible");trigger.setAttribute("aria-expanded","true")}
function closeMenu(){sidebar?.classList.remove("menu-open");backdrop.classList.remove("visible");trigger.setAttribute("aria-expanded","false")}
function toggleMenu(){sidebar?.classList.contains("menu-open")?closeMenu():openMenu()}
const trigger=document.createElement("button");
trigger.type="button";trigger.className="limfx-menu-trigger";
trigger.innerHTML='<span class="menu-star">✦</span> MENU <kbd>OPEN</kbd>';
trigger.setAttribute("aria-expanded","false");
trigger.setAttribute("aria-label","Toggle navigation menu");
trigger.onclick=toggleMenu;
document.querySelector(".limfx-menu-slot")?.replaceWith(trigger);
backdrop.addEventListener("click",closeMenu);
buttons.forEach(b=>b.addEventListener("click",closeMenu));
window.limfxaiOpenCommandPalette=open;
window.limfxaiToggleMenu=toggleMenu;
})();

/* LIMFXAI THEME SWITCHER */
(()=>{
 const host=document.querySelector(".topbar-right");
 if(!host||document.querySelector(".limfx-theme-wrap"))return;
 const wrap=document.createElement("div");
 wrap.className="limfx-theme-wrap";
 wrap.innerHTML='<button class="limfx-theme-trigger" type="button" aria-label="Choose appearance" aria-expanded="false"><svg class="limfx-orbital-icon" viewBox="0 0 48 48" aria-hidden="true"><defs><linearGradient id="limfxOrbGlow" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#f2d5ff"/><stop offset=".52" stop-color="#b56aff"/><stop offset="1" stop-color="#6b43ff"/></linearGradient><clipPath id="limfxSunClip"><path d="M24 10a14 14 0 1 0 0 28z"/></clipPath></defs><ellipse class="orbital-ring orbital-ring-horizontal" cx="24" cy="24" rx="22" ry="9"/><ellipse class="orbital-ring orbital-ring-vertical" cx="24" cy="24" rx="22" ry="9"/><g class="orbital-symbol"><circle class="orbital-core" cx="24" cy="24" r="15"/><circle cx="24" cy="24" r="14" fill="url(#limfxOrbGlow)" clip-path="url(#limfxSunClip)"/><path class="orbital-rays" d="M25 7v-3m8 6 2-3m4 10 3-1m-3 10 3 1m-9 8 2 3"/></g></svg></button><div class="limfx-theme-menu" role="menu"><button data-theme-choice="dark">Dark <b>✓</b></button><button data-theme-choice="white">White <b>✓</b></button><button data-theme-choice="crimson">Crimson <b>✓</b></button></div>';
 host.insertBefore(wrap,host.querySelector(".top-divider"));
 const trigger=wrap.querySelector("button"),menu=wrap.querySelector(".limfx-theme-menu"),items=[...menu.querySelectorAll("[data-theme-choice]")];
 const apply=value=>{
  value=["dark","white","crimson"].includes(value)?value:"dark";
  if(value==="dark")document.documentElement.removeAttribute("data-theme");
  else document.documentElement.dataset.theme=value;
  items.forEach(b=>{b.classList.toggle("active",b.dataset.themeChoice===value);b.setAttribute("aria-checked",String(b.dataset.themeChoice===value))});
  const meta=document.querySelector('meta[name="theme-color"]');
  if(meta)meta.content=value==="white"?"#f4f6fb":value==="crimson"?"#100307":"#080615";
 };
 let saved="dark";try{saved=localStorage.getItem("limfxai-theme")||"dark"}catch{}
 apply(saved);
 const close=()=>{menu.classList.remove("visible");trigger.setAttribute("aria-expanded","false")};
 trigger.onclick=()=>{const open=!menu.classList.contains("visible");menu.classList.toggle("visible",open);trigger.setAttribute("aria-expanded",String(open))};
 items.forEach(b=>b.onclick=()=>{apply(b.dataset.themeChoice);try{localStorage.setItem("limfxai-theme",b.dataset.themeChoice)}catch{}close()});
 document.addEventListener("pointerdown",e=>{if(!wrap.contains(e.target))close()});
 document.addEventListener("keydown",e=>{if(e.key==="Escape")close()});
})();
