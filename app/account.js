// ===== TÀI KHOẢN: đăng nhập Google/Apple bằng Firebase, lưu tiến độ học lên Firestore
// Người chưa đăng nhập vẫn học bình thường, tiến độ lưu trên trình duyệt (localStorage).
const cfg = window.FIREBASE_CONFIG;
const V = "10.12.2";
const $ = id => document.getElementById(id);

if (cfg && cfg.apiKey) start().catch(e => console.error("[tài khoản]", e));

async function start(){
  const base = `https://www.gstatic.com/firebasejs/${V}/`;
  const [{ initializeApp }, A, F] = await Promise.all([
    import(base + "firebase-app.js"), import(base + "firebase-auth.js"), import(base + "firebase-firestore.js")]);
  const app = initializeApp(cfg);
  const auth = A.getAuth(app);
  const db = F.getFirestore(app);
  auth.languageCode = "vi";

  const btn = $("acct"), dlg = $("acct-dlg"), err = $("acct-err");
  btn.hidden = false;
  if (window.FIREBASE_APPLE) $("login-apple").hidden = false;
  btn.onclick = () => { err.hidden = true; dlg.showModal(); };

  const showErr = e => {
    const c = e && e.code || "";
    err.textContent = c.includes("popup-closed") || c.includes("cancelled") ? "Bạn đã đóng cửa sổ đăng nhập." :
      c.includes("unauthorized-domain") ? "Trang web này chưa được cho phép đăng nhập (cần thêm tên miền trong Firebase)." :
      c.includes("network") ? "Mất kết nối mạng, thử lại nhé." : "Không đăng nhập được: " + (c || e);
    err.hidden = false;
  };
  async function login(provider){
    err.hidden = true;
    try { await A.signInWithPopup(auth, provider); }
    catch(e){
      if (e.code === "auth/popup-blocked" || e.code === "auth/operation-not-supported-in-this-environment") {
        try { await A.signInWithRedirect(auth, provider); } catch(e2){ showErr(e2); }
      } else showErr(e);
    }
  }
  $("login-google").onclick = () => login(new A.GoogleAuthProvider());
  $("login-apple").onclick = () => { const p = new A.OAuthProvider("apple.com"); p.addScope("email"); p.addScope("name"); login(p); };
  $("logout").onclick = async () => { await A.signOut(auth); dlg.close(); window.HSK.toast("Đã đăng xuất. Tiến độ vẫn còn trên máy này."); };
  A.getRedirectResult(auth).catch(showErr);

  let uid = null, timer = null, ready = false;
  const ref = () => F.doc(db, "users", uid);
  async function push(){
    if (!uid || !ready) return;
    try {
      await F.setDoc(ref(), { data: JSON.stringify(window.HSK.get()), updatedAt: F.serverTimestamp() });
      $("acct-sync").textContent = "Đã lưu lên mạng lúc " + new Date().toLocaleTimeString("vi-VN", {hour:"2-digit", minute:"2-digit"}) + ".";
    } catch(e){ $("acct-sync").textContent = "Chưa lưu được lên mạng, sẽ thử lại khi bạn học tiếp."; console.error(e); }
  }
  window.HSK_onSave = () => { if (!uid) return; clearTimeout(timer); timer = setTimeout(push, 1500); };
  window.addEventListener("pagehide", () => { if (timer){ clearTimeout(timer); push(); } });

  A.onAuthStateChanged(auth, async user => {
    uid = user ? user.uid : null; ready = false;
    $("acct-out").hidden = !!user; $("acct-in").hidden = !user;
    if (!user){ btn.textContent = "Đăng nhập"; btn.classList.remove("on"); btn.setAttribute("aria-label", "Đăng nhập"); return; }
    const name = user.displayName || user.email || "Bạn";
    $("acct-name").textContent = user.email ? `${name} (${user.email})` : name;
    btn.textContent = name.trim()[0].toUpperCase(); btn.classList.add("on"); btn.setAttribute("aria-label", "Tài khoản: " + name);
    try {
      const snap = await F.getDoc(ref());
      const cloud = snap.exists() ? JSON.parse(snap.data().data || "null") : null;
      const merged = merge(window.HSK.get(), cloud);
      window.HSK.set(merged); ready = true; await push();
      if (dlg.open) dlg.close();
      window.HSK.toast(cloud ? "Đã đồng bộ tiến độ học" : "Đã lưu tiến độ lên tài khoản");
    } catch(e){ console.error(e); $("acct-sync").textContent = "Chưa tải được tiến độ trên mạng. Kiểm tra mạng rồi tải lại trang."; }
  });
}

// Gộp tiến độ trên máy và trên mạng: không làm mất từ nào đã học.
function merge(a, b){
  if (!b) return a;
  if (!a || !a.profile) return b;
  if (!b.profile) return a;
  const later = (x, y) => (x?.updated || 0) >= (y?.updated || 0);
  const base = later(a, b) ? a : b, other = base === a ? b : a;
  const out = { ...other, ...base };
  const cards = { ...(other.cards || {}) };
  for (const [k, c] of Object.entries(base.cards || {})) {
    const o = cards[k];
    cards[k] = !o || c.box > o.box || (c.box === o.box && c.due >= o.due) ? c : o;
  }
  out.cards = cards;
  const maxMap = (x = {}, y = {}) => { const r = { ...x }; for (const k in y) r[k] = Math.max(r[k] || 0, y[k] || 0); return r; };
  out.steps = maxMap(a.steps, b.steps); out.rad = maxMap(a.rad, b.rad); out.reviews = maxMap(a.reviews, b.reviews);
  out.stars = { ...(other.stars || {}), ...(base.stars || {}) };
  out.tips = { ...(other.tips || {}), ...(base.tips || {}) };
  out.xp = Math.max(a.xp || 0, b.xp || 0);
  out.unlock = Math.max(a.unlock || 1, b.unlock || 1);
  const sa = a.streak || {}, sb = b.streak || {};
  out.streak = (sa.last || "") === (sb.last || "") ? { last: sa.last, count: Math.max(sa.count || 0, sb.count || 0) } : ((sa.last || "") > (sb.last || "") ? sa : sb);
  const da = a.day || {}, db = b.day || {};
  out.day = da.date === db.date ? ((da.newDone || 0) + (da.reviewDone || 0) >= (db.newDone || 0) + (db.reviewDone || 0) ? da : db) : ((da.date || "") > (db.date || "") ? da : db);
  out.updated = Date.now();
  return out;
}
window.HSK_merge = merge;
