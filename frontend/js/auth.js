const API_BASE = "http://localhost:3000/api";

const loginBtn = document.getElementById("loginBtn");
const registerBtn = document.getElementById("registerBtn");
const loginNotice = document.getElementById("loginNotice");
const registerNotice = document.getElementById("registerNotice");

const showNotice = (element, message, isError = true) => {
  if (!element) return;
  
  const span = element.querySelector("span");
  if (span) {
    span.textContent = message;
  } else {
    element.textContent = message;
  }
  
  element.className = isError ? "notice notice-error" : "notice notice-success";
  element.style.display = "flex";
};

if (loginBtn) {
  loginBtn.addEventListener("click", async () => {
    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value.trim();

    if (!email || !password) {
      showNotice(loginNotice, "Please enter your email and password.");
      return;
    }

    // Show loading state
    loginBtn.disabled = true;
    loginBtn.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spin">
        <circle cx="12" cy="12" r="10" stroke-dasharray="32" stroke-dashoffset="12"></circle>
      </svg>
      Signing in...
    `;

    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Login failed");
      }
      
      const data = await res.json();
      localStorage.setItem("secondhand_user", JSON.stringify(data.user));
      
      showNotice(loginNotice, "Login successful! Redirecting...", false);
      
      setTimeout(() => {
        window.location.href = data.user.role === "admin" ? "admin.html" : "index.html";
      }, 500);
    } catch (error) {
      showNotice(loginNotice, error.message || "Invalid credentials. Try again.");
      loginBtn.disabled = false;
      loginBtn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path>
          <polyline points="10 17 15 12 10 7"></polyline>
          <line x1="15" y1="12" x2="3" y2="12"></line>
        </svg>
        Sign in
      `;
    }
  });
}

if (registerBtn) {
  registerBtn.addEventListener("click", async () => {
    const name = document.getElementById("registerName").value.trim();
    const email = document.getElementById("registerEmail").value.trim();
    const password = document.getElementById("registerPassword").value.trim();

    if (!name || !email || !password) {
      showNotice(registerNotice, "Please complete all fields.");
      return;
    }

    if (password.length < 6) {
      showNotice(registerNotice, "Password must be at least 6 characters.");
      return;
    }

    // Show loading state
    registerBtn.disabled = true;
    registerBtn.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spin">
        <circle cx="12" cy="12" r="10" stroke-dasharray="32" stroke-dashoffset="12"></circle>
      </svg>
      Creating account...
    `;

    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password })
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Registration failed");
      }
      
      const data = await res.json();
      localStorage.setItem("secondhand_user", JSON.stringify(data.user));
      
      showNotice(registerNotice, "Account created! Redirecting...", false);
      
      setTimeout(() => {
        window.location.href = "index.html";
      }, 500);
    } catch (error) {
      showNotice(registerNotice, error.message || "Unable to register. Try a different email.");
      registerBtn.disabled = false;
      registerBtn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
          <circle cx="8.5" cy="7" r="4"></circle>
          <line x1="20" y1="8" x2="20" y2="14"></line>
          <line x1="23" y1="11" x2="17" y2="11"></line>
        </svg>
        Create account
      `;
    }
  });
}

// Add loading spinner animation
const style = document.createElement("style");
style.textContent = `
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  .spin {
    animation: spin 1s linear infinite;
  }
`;
document.head.appendChild(style);
