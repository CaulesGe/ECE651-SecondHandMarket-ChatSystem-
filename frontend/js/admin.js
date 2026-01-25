const API_BASE = "http://localhost:3000/api";

const adminNotice = document.getElementById("adminNotice");
const adminStats = document.getElementById("adminStats");
const userCount = document.getElementById("userCount");
const goodsCount = document.getElementById("goodsCount");
const transactionCount = document.getElementById("transactionCount");
const usersTable = document.getElementById("usersTable");
const goodsTable = document.getElementById("goodsTable");
const transactionsTable = document.getElementById("transactionsTable");
const usersCard = document.getElementById("usersCard");
const goodsCard = document.getElementById("goodsCard");
const transactionsCard = document.getElementById("transactionsCard");
const logoutBtn = document.getElementById("logoutBtn");

const getUser = () => {
  const raw = localStorage.getItem("secondhand_user");
  return raw ? JSON.parse(raw) : { role: "guest" };
};

const formatDate = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
};

const buildTable = (element, headers, rows) => {
  if (rows.length === 0) {
    element.innerHTML = `
      <thead>
        <tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr>
      </thead>
      <tbody>
        <tr><td colspan="${headers.length}" style="text-align: center; color: var(--text-muted); padding: 32px;">No data available</td></tr>
      </tbody>
    `;
    return;
  }
  
  element.innerHTML = `
    <thead>
      <tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr>
    </thead>
    <tbody>
      ${rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`).join("")}
    </tbody>
  `;
};

const getRolePill = (role) => {
  const pillClass = role === "admin" ? "pill-admin" : "pill-user";
  return `<span class="pill ${pillClass}">${role}</span>`;
};

const getStatusPill = (status) => {
  return `<span class="pill pill-pending">${status}</span>`;
};

const init = async () => {
  const user = getUser();
  
  if (user.role !== "admin") {
    adminNotice.style.display = "flex";
    adminStats.style.display = "none";
    return;
  }

  adminNotice.style.display = "none";
  adminStats.style.display = "grid";
  usersCard.style.display = "block";
  goodsCard.style.display = "block";
  transactionsCard.style.display = "block";

  const headers = { "x-user-role": "admin" };

  try {
    const [usersRes, goodsRes, transactionsRes] = await Promise.all([
      fetch(`${API_BASE}/users`, { headers }),
      fetch(`${API_BASE}/goods`),
      fetch(`${API_BASE}/transactions`, { headers })
    ]);

    const usersData = usersRes.ok ? await usersRes.json() : { items: [] };
    const goodsData = goodsRes.ok ? await goodsRes.json() : { items: [] };
    const transactionsData = transactionsRes.ok ? await transactionsRes.json() : { items: [] };

    // Update stats
    userCount.textContent = usersData.items.length;
    goodsCount.textContent = goodsData.items.length;
    transactionCount.textContent = transactionsData.items.length;

    // Build users table
    buildTable(
      usersTable,
      ["Name", "Email", "Role", "Joined"],
      usersData.items.map((item) => [
        `<strong>${item.name}</strong>`,
        item.email,
        getRolePill(item.role),
        formatDate(item.createdAt)
      ])
    );

    // Build goods table
    buildTable(
      goodsTable,
      ["Item", "Category", "Condition", "Price", "Seller"],
      goodsData.items.map((item) => [
        `<strong>${item.title}</strong>`,
        `<span class="badge badge-primary">${item.category}</span>`,
        item.condition,
        `<strong>$${item.price}</strong>`,
        item.sellerName
      ])
    );

    // Build transactions table
    buildTable(
      transactionsTable,
      ["ID", "User", "Total", "Status", "Date"],
      transactionsData.items.map((item) => [
        `<code style="font-size: 11px; background: var(--bg); padding: 2px 6px; border-radius: 4px;">${item.id}</code>`,
        item.userId,
        `<strong>$${item.total.toFixed(2)}</strong>`,
        getStatusPill(item.status),
        formatDate(item.createdAt)
      ])
    );
  } catch (error) {
    console.error("Error loading admin data:", error);
    adminNotice.textContent = "Failed to load data. Please try again.";
    adminNotice.style.display = "flex";
  }
};

logoutBtn.addEventListener("click", () => {
  localStorage.removeItem("secondhand_user");
  window.location.href = "index.html";
});

init();
