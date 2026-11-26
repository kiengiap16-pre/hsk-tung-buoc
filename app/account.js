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
      await F.setDoc(ref(), { data: JSON.stringify(window.HSK.get()), updatedAt: F.serverTimestamp() }, { merge: true });
      $("acct-sync").textContent = "Đã lưu lên mạng lúc " + new Date().toLocaleTimeString("vi-VN", {hour:"2-digit", minute:"2-digit"}) + ".";
    } catch(e){ $("acct-sync").textContent = "Chưa lưu được lên mạng, sẽ thử lại khi bạn học tiếp."; console.error(e); }
  }
  window.HSK_onSave = () => { if (!uid) return; clearTimeout(timer); timer = setTimeout(push, 1500); };
  window.addEventListener("pagehide", () => { if (timer){ clearTimeout(timer); push(); } });

  // ----- USERNAME kiểu Instagram: duy nhất, giữ chỗ bằng tài liệu usernames/{tên}
  let handle = null, checkT = null, lastOk = null;
  function setHandle(h){
    handle = h;
    $("acct-handle").textContent = h ? "@" + h : "Chưa có username";
    $("uname-edit").textContent = h ? "Đổi username" : "Tạo username";
    if (h){ btn.textContent = h[0].toUpperCase(); btn.setAttribute("aria-label", "Tài khoản @" + h); }
  }
  const unameErr = u => !u ? "" : u.length < 3 ? "Cần ít nhất 3 ký tự." : !/^[a-z0-9._]+$/.test(u) ? "Chỉ dùng chữ thường không dấu, số, dấu chấm, gạch dưới." :
    /^\.|\.$/.test(u) ? "Không bắt đầu hoặc kết thúc bằng dấu chấm." : /\.\./.test(u) ? "Không dùng hai dấu chấm liền nhau." : /^[0-9._]+$/.test(u) ? "Cần có ít nhất một chữ cái." : "";
  const slug = t => (t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D")
    .toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.+|\.+$/g, "").replace(/\.{2,}/g, ".").slice(0, 16);
  async function free(u){ const d = await F.getDoc(F.doc(db, "usernames", u)); return !d.exists() || d.data().uid === uid; }
  async function suggest(user){
    const a = slug(user.displayName) || slug((user.email || "").split("@")[0]) || "hocvien";
    const b = a.replace(/\./g, "_"), r = () => Math.floor(Math.random() * 900 + 100);
    const cands = [...new Set([a, b, a + ".hsk", b + r(), "hsk." + a.split(".").pop(), a + r()])].filter(x => !unameErr(x)).slice(0, 6);
    const ok = [];
    for (const c of cands){ try { if (await free(c)) ok.push(c); } catch(e){} if (ok.length >= 3) break; }
    return ok;
  }
  async function check(){
    const u = $("uname").value.trim().toLowerCase(); $("uname").value = u;
    const msg = $("uname-msg"), save = $("uname-save"); lastOk = null; save.disabled = true; msg.className = "uname-msg";
    const e = unameErr(u); if (!u){ msg.textContent = ""; return; } if (e){ msg.textContent = e; msg.classList.add("bad"); return; }
    if (u === handle){ msg.textContent = "Đây là username hiện tại của bạn."; return; }
    msg.textContent = "Đang kiểm tra…";
    try { const ok = await free(u); if ($("uname").value !== u) return;
      msg.textContent = ok ? `@${u} dùng được.` : `@${u} đã có người dùng, thử tên khác nhé.`; msg.classList.add(ok ? "ok" : "bad");
      if (ok){ lastOk = u; save.disabled = false; } }
    catch(e){ msg.textContent = "Không kiểm tra được, kiểm tra mạng rồi thử lại."; msg.classList.add("bad"); }
  }
  async function askUsername(user){
    err.hidden = true; $("acct-in").hidden = true; $("acct-user").hidden = false;
    $("uname").value = handle || ""; $("uname-msg").textContent = ""; $("uname-save").disabled = true;
    if (!dlg.open) dlg.showModal(); $("uname").focus();
    const sug = await suggest(user || auth.currentUser || {});
    $("uname-sug").innerHTML = sug.map(x => `<button type="button" data-u="${x}">@${x}</button>`).join("");
    if (!$("uname").value && sug[0]){ $("uname").value = sug[0]; check(); }
  }
  $("uname").addEventListener("input", () => { clearTimeout(checkT); checkT = setTimeout(check, 350); });
  $("uname").addEventListener("keydown", e => { if (e.key === "Enter"){ e.preventDefault(); if (!$("uname-save").disabled) $("uname-save").click(); } });
  $("uname-sug").onclick = e => { const b = e.target.closest("button[data-u]"); if (b){ $("uname").value = b.dataset.u; check(); } };
  $("uname-edit").onclick = () => askUsername();
  $("uname-later").onclick = () => { $("acct-user").hidden = true; $("acct-in").hidden = false; if (!handle) dlg.close(); };
  $("uname-save").onclick = async () => {
    const u = lastOk; if (!u || !uid) return; const save = $("uname-save"); save.disabled = true; save.textContent = "Đang lưu…";
    try {
      await F.runTransaction(db, async tx => {
        const nref = F.doc(db, "usernames", u), d = await tx.get(nref);
        if (d.exists() && d.data().uid !== uid) throw new Error("taken");
        if (handle && handle !== u) tx.delete(F.doc(db, "usernames", handle));
        tx.set(nref, { uid, at: F.serverTimestamp() });
        tx.set(ref(), { username: u }, { merge: true });
      });
      setHandle(u); $("acct-user").hidden = true; $("acct-in").hidden = false; dlg.close();
      window.HSK.toast("Chào @" + u + "!");
    } catch(e){
      const m = $("uname-msg"); m.className = "uname-msg bad";
      m.textContent = e.message === "taken" ? `@${u} vừa có người lấy mất, thử tên khác nhé.` : "Chưa lưu được, thử lại nhé."; console.error(e);
    } finally { save.textContent = "Lưu username"; }
  };

  // ----- TÀI KHOẢN USERNAME + MẬT KHẨU (Firebase lưu mật khẩu an toàn, web không giữ mật khẩu)
  const PW_DOMAIN = "taikhoan.hsk-tung-buoc.app";
  const pwEmail = u => `${u}@${PW_DOMAIN}`;
  const isPwUser = u => !!u && u.providerData.some(p => p.providerId === "password");
  let pwMode = "in", pendingSignup = null;
  const pwMsg = (t, ok) => { const m = $("pw-msg"); m.textContent = t; m.className = "uname-msg " + (ok ? "ok" : t ? "bad" : ""); };
  function setPwMode(m){ pwMode = m; $("pw-tab-in").setAttribute("aria-pressed", m === "in"); $("pw-tab-up").setAttribute("aria-pressed", m === "up");
    $("pw-pass2-l").hidden = m === "in"; $("pw-warn").hidden = m === "in"; $("pw-go").textContent = m === "in" ? "Đăng nhập" : "Tạo tài khoản";
    $("pw-pass").autocomplete = m === "in" ? "current-password" : "new-password"; pwMsg(""); }
  $("pw-tab-in").onclick = () => setPwMode("in"); $("pw-tab-up").onclick = () => setPwMode("up");
  $("pw-eye").onclick = () => { const t = $("pw-pass").type === "password"; $("pw-pass").type = $("pw-pass2").type = t ? "text" : "password"; $("pw-eye").textContent = t ? "Ẩn" : "Hiện"; };
  ["pw-user","pw-pass","pw-pass2"].forEach(id => $(id).addEventListener("keydown", e => { if (e.key === "Enter"){ e.preventDefault(); $("pw-go").click(); } }));
  $("pw-go").onclick = async () => {
    const u = $("pw-user").value.trim().toLowerCase().replace(/^@/, ""), pw = $("pw-pass").value; $("pw-user").value = u;
    const e1 = unameErr(u); if (!u) return pwMsg("Nhập username."); if (e1) return pwMsg(e1);
    if (pw.length < 6) return pwMsg("Mật khẩu cần ít nhất 6 ký tự.");
    const go = $("pw-go"); go.disabled = true;
    try {
      if (pwMode === "in"){ go.textContent = "Đang đăng nhập…"; await A.signInWithEmailAndPassword(auth, pwEmail(u), pw); }
      else {
        if (pw !== $("pw-pass2").value) { pwMsg("Hai lần nhập mật khẩu chưa giống nhau."); return; }
        go.textContent = "Đang tạo…";
        const d = await F.getDoc(F.doc(db, "usernames", u)); if (d.exists()){ pwMsg(`@${u} đã có người dùng, thử tên khác nhé.`); return; }
        pendingSignup = u; await A.createUserWithEmailAndPassword(auth, pwEmail(u), pw);
      }
    } catch(e){
      pendingSignup = null; const c = e.code || "";
      pwMsg(c.includes("invalid-credential") || c.includes("wrong-password") || c.includes("user-not-found") ? "Sai username hoặc mật khẩu." :
        c.includes("email-already-in-use") ? `@${u} đã có người dùng, thử tên khác nhé.` : c.includes("too-many-requests") ? "Bạn thử sai nhiều lần quá, đợi một lát rồi thử lại." :
        c.includes("operation-not-allowed") ? "Cách đăng nhập này chưa được bật." : c.includes("network") ? "Mất kết nối mạng, thử lại nhé." : "Không thực hiện được: " + (c || e.message));
    } finally { go.disabled = false; go.textContent = pwMode === "in" ? "Đăng nhập" : "Tạo tài khoản"; }
  };
  $("link-google").onclick = async () => {
    try { await A.linkWithPopup(auth.currentUser, new A.GoogleAuthProvider()); window.HSK.toast("Đã liên kết Google. Từ giờ bạn đăng nhập được bằng cả hai cách."); showPwTools(auth.currentUser); }
    catch(e){ err.textContent = (e.code || "").includes("credential-already-in-use") ? "Gmail này đã gắn với một tài khoản khác." : (e.code || "").includes("popup-closed") ? "Bạn đã đóng cửa sổ Google." : "Chưa liên kết được: " + (e.code || e.message); err.hidden = false; }
  };
  $("cp-go").onclick = async () => {
    const m = $("cp-msg"), o = $("cp-old").value, n = $("cp-new").value; m.className = "uname-msg bad";
    if (n.length < 6){ m.textContent = "Mật khẩu mới cần ít nhất 6 ký tự."; return; }
    try { const u = auth.currentUser; await A.reauthenticateWithCredential(u, A.EmailAuthProvider.credential(u.email, o)); await A.updatePassword(u, n);
      m.textContent = "Đã đổi mật khẩu."; m.className = "uname-msg ok"; $("cp-old").value = $("cp-new").value = ""; }
    catch(e){ m.textContent = (e.code || "").includes("credential") || (e.code || "").includes("wrong-password") ? "Mật khẩu hiện tại chưa đúng." : "Chưa đổi được: " + (e.code || e.message); }
  };
  function showPwTools(user){
    const pwU = isPwUser(user), hasG = user && user.providerData.some(p => p.providerId === "google.com");
    $("pw-tools").hidden = !pwU; $("link-google").hidden = !pwU || hasG; $("uname-edit").hidden = pwU;
  }

  A.onAuthStateChanged(auth, async user => {
    uid = user ? user.uid : null; ready = false;
    $("acct-out").hidden = !!user; $("acct-in").hidden = !user; $("acct-user").hidden = true; handle = null;
    if (!user){ btn.textContent = "Đăng nhập"; btn.classList.remove("on"); btn.setAttribute("aria-label", "Đăng nhập"); return; }
    const pwU = isPwUser(user), pwName = pwU ? user.email.split("@")[0] : null;
    const name = user.displayName || (pwU ? "@" + pwName : user.email) || "Bạn";
    $("acct-name").textContent = pwU ? `đăng nhập bằng username @${pwName}` + (user.providerData.some(p => p.providerId === "google.com") ? " · đã liên kết Google" : "") : user.email ? `${name} (${user.email})` : name;
    showPwTools(user);
    $("pw-pass").value = $("pw-pass2").value = "";
    btn.textContent = name.trim()[0].toUpperCase(); btn.classList.add("on"); btn.setAttribute("aria-label", "Tài khoản: " + name);
    try {
      if (pendingSignup){ // tài khoản username mới: giữ chỗ username ngay
        const u = pendingSignup; pendingSignup = null;
        try { await F.runTransaction(db, async tx => { const nref = F.doc(db, "usernames", u), d = await tx.get(nref);
            if (d.exists() && d.data().uid !== uid) throw new Error("taken");
            tx.set(nref, { uid, at: F.serverTimestamp() }); tx.set(ref(), { username: u }, { merge: true }); }); }
        catch(e){ await user.delete().catch(() => {}); pwMsg(e.message === "taken" ? `@${u} vừa có người lấy mất, thử tên khác nhé.` : "Chưa tạo được tài khoản, thử lại nhé."); return; }
      }
      const snap = await F.getDoc(ref());
      const cloud = snap.exists() ? JSON.parse(snap.data().data || "null") : null;
      setHandle(snap.exists() ? snap.data().username || null : null);
      const merged = merge(window.HSK.get(), cloud);
      window.HSK.set(merged); ready = true; await push();
      window.HSK.toast(cloud ? "Đã đồng bộ tiến độ học" : "Đã lưu tiến độ lên tài khoản");
      if (!handle && !pwU) askUsername(user); else if (dlg.open) dlg.close();
      if (!handle && pwU) setHandle(pwName);
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
