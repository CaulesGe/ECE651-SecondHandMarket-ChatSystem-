const API_BASE = "http://localhost:3000/api";

const loginBtn = document.getElementById("loginBtn");
const registerBtn = document.getElementById("registerBtn");
const loginNotice = document.getElementById("loginNotice");
const registerNotice = document.getElementById("registerNotice");

const showNotice = (element, message) => {
  if (!element) {
    return;
  }
  element.textContent = message;
  element.style.display = "block";
};

if (loginBtn) {
  loginBtn.addEventListener("click", async () => {
    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value.trim();

    if (!email || !password) {
      showNotice(loginNotice, "Please enter your email and password.");
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      if (!res.ok) {
        throw new Error("Login failed");
      }
      const data = await res.json();
      localStorage.setItem("secondhand_user", JSON.stringify(data.user));
      window.location.href =
        data.user.role === "admin" ? "admin.html" : "index.html";
    } catch (error) {
      showNotice(loginNotice, "Invalid credentials. Try again.");
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

    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password })
      });
      if (!res.ok) {
        throw new Error("Register failed");
      }
      const data = await res.json();
      localStorage.setItem("secondhand_user", JSON.stringify(data.user));
      window.location.href = "index.html";
    } catch (error) {
      showNotice(registerNotice, "Unable to register. Try a new email.");
    }
  });
}
