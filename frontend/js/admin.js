const API_BASE = "http://localhost:3000/api";

const adminNotice = document.getElementById("adminNotice");
const adminStats = document.getElementById("adminStats");
const userCount = document.getElementById("userCount");
const goodsCount = document.getElementById("goodsCount");
const transactionCount = document.getElementById("transactionCount");
const usersTable = document.getElementById("usersTable");
const goodsTable = document.getElementById("goodsTable");
const transactionsTable = document.getElementById("transactionsTable");
const logoutBtn = document.getElementById("logoutBtn");

const getUser = () => {
  const raw = localStorage.getItem("secondhand_user");
  return raw ? JSON.parse(raw) : { role: "guest" };
};

const buildTable = (element, headers, rows) => {
  element.innerHTML = `
    <thead>
      <tr>
        ${headers.map((header) => `<th>${header}</th>`).join("")}
      </tr>
    </thead>
    <tbody>
      ${rows
        .map(
          (row) =>
            `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`
        )
        .join("")}
    </tbody>
  `;
};

const init = async () => {
  const user = getUser();
  if (user.role !== "admin") {
    adminNotice.style.display = "block";
    adminStats.style.display = "none";
    return;
  }

  adminNotice.style.display = "none";
  adminStats.style.display = "block";

  const headers = {
    "x-user-role": "admin"
  };

  const [usersRes, goodsRes, transactionsRes] = await Promise.all([
    fetch(`${API_BASE}/users`, { headers }),
    fetch(`${API_BASE}/goods`),
    fetch(`${API_BASE}/transactions`, { headers })
  ]);

  const usersData = usersRes.ok ? await usersRes.json() : { items: [] };
  const goodsData = goodsRes.ok ? await goodsRes.json() : { items: [] };
  const transactionsData = transactionsRes.ok
    ? await transactionsRes.json()
    : { items: [] };

  userCount.textContent = usersData.items.length;
  goodsCount.textContent = goodsData.items.length;
  transactionCount.textContent = transactionsData.items.length;

  buildTable(
    usersTable,
    ["Name", "Email", "Role", "Created At"],
    usersData.items.map((item) => [
      item.name,
      item.email,
      `<span class="pill">${item.role}</span>`,
      new Date(item.createdAt).toLocaleString()
    ])
  );

  buildTable(
    goodsTable,
    ["Title", "Category", "Condition", "Price", "Seller"],
    goodsData.items.map((item) => [
      item.title,
      item.category,
      item.condition,
      `$${item.price}`,
      item.sellerName
    ])
  );

  buildTable(
    transactionsTable,
    ["Transaction", "User", "Total", "Status", "Created"],
    transactionsData.items.map((item) => [
      item.id,
      item.userId,
      `$${item.total.toFixed(2)}`,
      item.status,
      new Date(item.createdAt).toLocaleString()
    ])
  );
};

logoutBtn.addEventListener("click", () => {
  localStorage.removeItem("secondhand_user");
  window.location.href = "index.html";
});

init();
