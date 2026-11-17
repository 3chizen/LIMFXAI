(()=>{
const nav=document.querySelector(".module-nav");
if(!nav)return;
const icons={
market:'<svg viewBox="0 0 24 24"><path d="M3 10h18l-2-6H5l-2 6Z M5 10v10h14V10 M9 20v-6h6v6 M3 10c0 2 3 2 3 0 0 2 3 2 3 0 0 2 3 2 3 0 0 2 3 2 3 0 0 3 2 3 0"/></svg>',
copilot:'<svg viewBox="0 0 24 24"><path d="m12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5L12 2Z M19 2v4 M17 4h4"/></svg>',
wallet:'<svg viewBox="0 0 24 24"><path d="M4 6h16v14H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h14 M2 9h18 M15 14h5 M16 14h.01"/></svg>',
trade:'<svg viewBox="0 0 24 24"><path d="M4 7h15l-4-4 M20 17H5l4 4 M19 7l-4-4 M5 17l4 4"/></svg>',
security:'<svg viewBox="0 0 24 24"><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z M9 12l2 2 4-4"/></svg>',
domain:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M2 12h20 M12 2a15 15 0 0 1 0 20 M12 2a15 15 0 0 0 0 20"/></svg>',
network:'<svg viewBox="0 0 24 24"><circle cx="12" cy="5" r="3"/><circle cx="5" cy="18" r="3"/><circle cx="19" cy="18" r="3"/><path d="m10.5 7.5-4 8 M13.5 7.5l4 8 M8 18h8"/></svg>'
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
