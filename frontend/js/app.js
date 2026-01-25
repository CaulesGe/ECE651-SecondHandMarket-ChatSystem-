const API_BASE = "http://localhost:3000/api";

const goodsGrid = document.getElementById("goodsGrid");
const cartItems = document.getElementById("cartItems");
const cartCount = document.getElementById("cartCount");
const cartTotal = document.getElementById("cartTotal");
const cartTotalTop = document.getElementById("cartTotalTop");
const listingCount = document.getElementById("listingCount");
const guestNotice = document.getElementById("guestNotice");
const userBadge = document.getElementById("userBadge");
const loginLink = document.getElementById("loginLink");
const registerLink = document.getElementById("registerLink");
const logoutBtn = document.getElementById("logoutBtn");
const adminLink = document.getElementById("adminLink");
const checkoutBtn = document.getElementById("checkoutBtn");
const browseBtn = document.getElementById("browseBtn");
const sellPanel = document.getElementById("sellPanel");
const listItemBtn = document.getElementById("listItemBtn");
const sellNotice = document.getElementById("sellNotice");

const getUser = () => {
  const raw = localStorage.getItem("secondhand_user");
  return raw ? JSON.parse(raw) : { role: "guest" };
};

const saveCart = (cart) => {
  localStorage.setItem("secondhand_cart", JSON.stringify(cart));
};

const getCart = () => {
  const raw = localStorage.getItem("secondhand_cart");
  return raw ? JSON.parse(raw) : [];
};

const formatPrice = (value) => `$${Number(value).toFixed(2)}`;

const renderCart = () => {
  const cart = getCart();
  cartItems.innerHTML = "";
  let total = 0;

  if (cart.length === 0) {
    cartItems.innerHTML = `<p style="color:#7a86a1;font-size:13px;">Your cart is empty.</p>`;
  }

  cart.forEach((item) => {
    total += item.price * item.quantity;
    const element = document.createElement("div");
    element.className = "cart-item";
    element.innerHTML = `
      <div>
        <strong>${item.title}</strong>
        <div style="font-size:12px;color:#7a86a1;">
          ${item.quantity} x ${formatPrice(item.price)}
        </div>
        <div style="font-size:11px;color:#7a86a1;">
          ${item.condition} | ${item.sellerName}
        </div>
      </div>
      <button class="btn btn-secondary" data-id="${item.id}">Remove</button>
    `;
    element.querySelector("button").addEventListener("click", () => {
      const updated = getCart().filter((cartItem) => cartItem.id !== item.id);
      saveCart(updated);
      renderCart();
    });
    cartItems.appendChild(element);
  });

  cartCount.textContent = cart.length;
  cartTotal.textContent = formatPrice(total);
  cartTotalTop.textContent = formatPrice(total);
};

const renderGoods = (items, user) => {
  goodsGrid.innerHTML = "";
  items.forEach((item) => {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <img src="${item.images[0] || "https://picsum.photos/seed/gear/600/400"}" alt="${item.title}" />
      <div class="meta">
        <span class="badge">${item.category}</span>
        <span>${item.condition}</span>
      </div>
      <h3>${item.title}</h3>
      <p>${item.description}</p>
      <div class="meta">
        <span>${item.sellerName}</span>
        <span>${item.location}</span>
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;">
        <span class="price">${formatPrice(item.price)}</span>
        <button class="btn btn-primary" data-id="${item.id}">
          Add to cart
        </button>
      </div>
    `;
    const button = card.querySelector("button");
    if (user.role === "guest") {
      button.disabled = true;
      button.style.opacity = 0.5;
      button.title = "Register to add items to cart";
    } else {
      button.addEventListener("click", () => {
        const cart = getCart();
        const exists = cart.find((cartItem) => cartItem.id === item.id);
        if (exists) {
          exists.quantity += 1;
        } else {
          cart.push({
            id: item.id,
            title: item.title,
            price: item.price,
            quantity: 1,
            condition: item.condition,
            sellerName: item.sellerName,
            location: item.location
          });
        }
        saveCart(cart);
        renderCart();
      });
    }
    goodsGrid.appendChild(card);
  });
  listingCount.textContent = items.length;
};

const updateNav = (user) => {
  userBadge.textContent =
    user.role === "guest" ? "Guest" : `${user.name} (${user.role})`;
  const isLoggedIn = user.role !== "guest";
  loginLink.style.display = isLoggedIn ? "none" : "inline-flex";
  registerLink.style.display = isLoggedIn ? "none" : "inline-flex";
  logoutBtn.style.display = isLoggedIn ? "inline-flex" : "none";
  adminLink.style.display = user.role === "admin" ? "inline-flex" : "none";
  guestNotice.style.display = user.role === "guest" ? "block" : "none";
  sellPanel.style.display = isLoggedIn ? "block" : "none";
};

const loadGoods = async () => {
  try {
    const res = await fetch(`${API_BASE}/goods`);
    if (!res.ok) {
      throw new Error("Failed to load goods");
    }
    const data = await res.json();
    return data.items || [];
  } catch (error) {
    return [
      {
        id: "fallback-1",
        title: "Starter Listing",
        description: "Backend not connected. Start the API server to load data.",
        price: 0,
        condition: "Info",
        category: "System",
        images: ["https://picsum.photos/seed/fallback/600/400"],
        sellerName: "System",
        location: "Local"
      }
    ];
  }
};

const handleListItem = async (user) => {
  if (!listItemBtn) {
    return;
  }
  listItemBtn.addEventListener("click", async () => {
    const payload = {
      title: document.getElementById("newTitle").value.trim(),
      price: document.getElementById("newPrice").value,
      condition: document.getElementById("newCondition").value,
      category: document.getElementById("newCategory").value.trim(),
      description: document.getElementById("newDescription").value.trim(),
      images: [document.getElementById("newImage").value.trim()]
    };

    if (!payload.title || !payload.price || !payload.category) {
      sellNotice.textContent = "Please fill out the required fields.";
      sellNotice.style.display = "block";
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/goods`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-role": user.role,
          "x-user-name": user.name || "Seller"
        },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        throw new Error("Unable to list item.");
      }
      sellNotice.textContent = "Listing published successfully!";
      sellNotice.style.display = "block";
      const goods = await loadGoods();
      renderGoods(goods, user);
    } catch (error) {
      sellNotice.textContent = "Failed to publish listing. Try again.";
      sellNotice.style.display = "block";
    }
  });
};

const init = async () => {
  const user = getUser();
  updateNav(user);
  renderCart();

  const goods = await loadGoods();
  renderGoods(goods, user);

  checkoutBtn.addEventListener("click", () => {
    if (user.role === "guest") {
      guestNotice.style.display = "block";
      return;
    }
    const cart = getCart();
    if (cart.length === 0) {
      guestNotice.textContent = "Add items to cart before checking out.";
      guestNotice.style.display = "block";
      return;
    }
    window.location.href = "payment.html";
  });

  browseBtn.addEventListener("click", () => {
    document
      .getElementById("goodsGrid")
      .scrollIntoView({ behavior: "smooth" });
  });

  logoutBtn.addEventListener("click", () => {
    localStorage.removeItem("secondhand_user");
    localStorage.removeItem("secondhand_cart");
    window.location.reload();
  });

  handleListItem(user);
};

init();
