(function () {
  "use strict";

  const I = window.Inventur;

  I.ready(function () {
    const page       = I.$(".register-page");
    if (!page) return;

    const form       = I.$("form", page);
    const name       = I.$('input[name="name"]', page);
    const email      = I.$('input[name="email"]', page);
    const passwords  = Array.from(page.querySelectorAll('input[type="password"]'));
    const submit     = I.$(".register-submit", page);
    const googleHost = I.$("#google-register-button", page);
    const googleBtn  = I.$(".google-fallback", page);
    let googleReady  = false;

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

    async function finishRegister(result) {
      saveSession(result);
      localStorage.setItem("inventur.email", result.user.email);
      I.toast("Akun berhasil dibuat. Selamat datang, " + result.user.name);
      setTimeout(function () { location.href = "./dashboard.html"; }, 600);
    }

    function togglePassword(input, icon) {
      const hidden = input.type === "password";
      input.type = hidden ? "text" : "password";
      icon.src = hidden ? "../assets/img/icons/eye.svg" : "../assets/img/icons/eye-off.svg";
    }

    passwords.forEach(function (password) {
      const eye = password.parentElement.querySelector("img");
      if (!eye) return;
      eye.style.cursor = "pointer";
      eye.addEventListener("click", function () {
        togglePassword(password, eye);
      });
    });

    async function submitForm() {
      const password = passwords[0];
      const confirm  = passwords[1];
      const nameInvalid     = !name.value.trim();
      const emailInvalid    = !email.value.includes("@");
      const passwordInvalid = password.value.trim().length < 4;
      const confirmInvalid  = confirm.value !== password.value || !confirm.value;

      setInvalid(name, nameInvalid);
      setInvalid(email, emailInvalid);
      setInvalid(password, passwordInvalid);
      setInvalid(confirm, confirmInvalid);

      if (nameInvalid || emailInvalid || passwordInvalid || confirmInvalid) {
        I.toast("Lengkapi semua field dan pastikan password sama", "error");
        return;
      }

      if (submit) { submit.disabled = true; submit.textContent = "Mendaftar..."; }

      try {
        const result = await window.InventurAPI.register(name.value.trim(), email.value.trim(), password.value);
        await finishRegister(result);
      } catch (err) {
        I.toast(err.message || "Register gagal", "error");
        if (submit) { submit.disabled = false; submit.textContent = "Sign Up"; }
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
        await finishRegister(result);
      } catch (err) {
        I.toast(err.message || "Google register gagal", "error");
      }
    }

    async function setupGoogleRegister() {
      if (!googleHost) return;
      try {
        const config = await window.InventurAPI.getAuthConfig();
        const clientId = config.googleClientId || "";
        if (!clientId || clientId.includes("GANTI_DENGAN")) {
          if (googleBtn) googleBtn.title = "Isi GOOGLE_CLIENT_ID di file .env untuk mengaktifkan Google Register";
          return;
        }

        await loadGoogleScript();
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: handleGoogleCredential,
          ux_mode: "popup",
        });

        googleHost.innerHTML = "";
        window.google.accounts.id.renderButton(googleHost, {
          theme: "outline",
          size: "large",
          type: "standard",
          shape: "rectangular",
          text: "signup_with",
          logo_alignment: "center",
          width: Math.min(400, Math.max(240, googleHost.clientWidth || 400)),
        });
        googleReady = true;
      } catch (err) {
        console.warn("Google register belum siap:", err);
        if (googleBtn) googleBtn.title = "Google register belum siap. Cek koneksi internet dan GOOGLE_CLIENT_ID.";
      }
    }

    if (submit) submit.addEventListener("click", submitForm);
    if (form) form.addEventListener("keydown", function (event) {
      if (event.key === "Enter") {
        event.preventDefault();
        submitForm();
      }
    });
    if (googleBtn) googleBtn.addEventListener("click", function () {
      if (!googleReady || !window.google || !window.google.accounts) {
        I.toast("Google register belum aktif. Isi GOOGLE_CLIENT_ID di .env lalu restart server.", "warn");
      }
    });

    setupGoogleRegister();
  });
})();
