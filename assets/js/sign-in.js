(function () {
  "use strict";

  const I = window.Inventur;

  I.ready(function () {
    const page       = I.$(".signin-page");
    if (!page) return;

    const form       = I.$("form", page);
    const email      = I.$('input[type="email"]', page);
    const password   = I.$('input[type="password"]', page);
    const remember   = I.$(".remember input", page);
    const submit     = I.$(".signin-submit", page);
    const googleHost = I.$("#google-signin-button", page);
    const googleBtn  = I.$(".google-fallback", page);
    const eye        = password ? password.parentElement.querySelector("img") : null;
    let googleReady  = false;

    const remembered = localStorage.getItem("inventur.email");
    if (remembered && email) email.value = remembered;

    function setInvalid(input, invalid) {
      if (!input || !input.parentElement) return;
      input.parentElement.style.borderColor = invalid ? "#ef4444" : "";
      input.parentElement.style.boxShadow   = invalid ? "0 0 0 3px rgba(239,68,68,.10)" : "";
    }

    function saveSession(result) {
      localStorage.setItem("inventur.session", JSON.stringify({
        token:      result.token,
        email:      result.user.email,
        name:       result.user.name,
        initials:   result.user.initials,
        avatarUrl:  result.user.avatarUrl || "",
        signedInAt: Date.now(),
      }));
    }

    async function finishLogin(result, rememberedEmail) {
      if (remember && remember.checked && rememberedEmail) {
        localStorage.setItem("inventur.email", rememberedEmail);
      } else if (rememberedEmail) {
        localStorage.removeItem("inventur.email");
      }
      saveSession(result);
      I.toast("Login berhasil! Selamat datang, " + result.user.name);
      setTimeout(function () { location.href = "./dashboard.html"; }, 600);
    }

    async function submitForm() {
      const emailInvalid    = !email.value.includes("@");
      const passwordInvalid = password.value.trim().length < 4;
      setInvalid(email, emailInvalid);
      setInvalid(password, passwordInvalid);

      if (emailInvalid || passwordInvalid) {
        I.toast("Gunakan email valid dan password minimal 4 karakter", "error");
        return;
      }

      if (submit) { submit.disabled = true; submit.textContent = "Masuk..."; }

      try {
        const result = await window.InventurAPI.login(email.value, password.value);
        await finishLogin(result, email.value);
      } catch (err) {
        I.toast(err.message || "Login gagal", "error");
        if (submit) { submit.disabled = false; submit.textContent = "Sign In"; }
      }
    }

    function loadGoogleScript() {
      return new Promise(function (resolve, reject) {
        if (window.google && window.google.accounts && window.google.accounts.id) return resolve();
        const script = document.createElement("script");
        script.src = "https://accounts.google.com/gsi/client";
        script.async = true;
        script.defer = true;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
    }

    async function handleGoogleCredential(response) {
      try {
        if (!response || !response.credential) {
          I.toast("Google credential tidak ditemukan", "error");
          return;
        }
        const result = await window.InventurAPI.googleLogin(response.credential);
        await finishLogin(result, result.user.email);
      } catch (err) {
        I.toast(err.message || "Google login gagal", "error");
      }
    }

    async function setupGoogleLogin() {
      if (!googleHost) return;
      try {
        const config = await window.InventurAPI.getAuthConfig();
        const clientId = config.googleClientId || "";
        if (!clientId || clientId.includes("GANTI_DENGAN")) {
          if (googleBtn) googleBtn.title = "Isi GOOGLE_CLIENT_ID di file .env untuk mengaktifkan Google Login";
          return;
        }

        await loadGoogleScript();
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: handleGoogleCredential,
          ux_mode: "popup",
        });

        // Pakai tombol resmi Google. Tombol custom kadang tidak memunculkan popup
        // karena Google Identity Services hanya merender klik login dari iframe resminya.
        googleHost.innerHTML = "";
        window.google.accounts.id.renderButton(googleHost, {
          theme: "outline",
          size: "large",
          type: "standard",
          shape: "rectangular",
          text: "signin_with",
          logo_alignment: "center",
          width: Math.min(400, Math.max(240, googleHost.clientWidth || 400)),
        });
        googleReady = true;
      } catch (err) {
        console.warn("Google login belum siap:", err);
        if (googleBtn) googleBtn.title = "Google login belum siap. Cek koneksi internet dan GOOGLE_CLIENT_ID.";
      }
    }

    if (eye) {
      eye.style.cursor = "pointer";
      eye.addEventListener("click", function () {
        const hidden   = password.type === "password";
        password.type  = hidden ? "text" : "password";
        eye.src        = hidden ? "../assets/img/icons/eye.svg" : "../assets/img/icons/eye-off.svg";
      });
    }

    if (submit) submit.addEventListener("click", submitForm);
    if (form) form.addEventListener("keydown", function (event) {
      if (event.key === "Enter") { event.preventDefault(); submitForm(); }
    });
    if (googleBtn) googleBtn.addEventListener("click", function () {
      if (!googleReady || !window.google || !window.google.accounts) {
        I.toast("Google login belum aktif. Isi GOOGLE_CLIENT_ID di .env lalu restart server.", "warn");
      }
    });

    setupGoogleLogin();
  });
})();
