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
  let total = 0;

  if (cart.length === 0) {
    cartItems.innerHTML = `
      <div class="empty-cart">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="9" cy="21" r="1"></circle>
          <circle cx="20" cy="21" r="1"></circle>
          <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
        </svg>
        <p>Your cart is empty</p>
      </div>
    `;
  } else {
    cartItems.innerHTML = "";
    cart.forEach((item) => {
      total += item.price * item.quantity;
      const element = document.createElement("div");
      element.className = "cart-item";
      element.innerHTML = `
        <div class="cart-item-info">
          <strong>${item.title}</strong>
          <span>${item.quantity} x ${formatPrice(item.price)}</span>
        </div>
        <button class="btn btn-sm btn-secondary" data-id="${item.id}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      `;
      element.querySelector("button").addEventListener("click", () => {
        const updated = getCart().filter((cartItem) => cartItem.id !== item.id);
        saveCart(updated);
        renderCart();
      });
      cartItems.appendChild(element);
    });
  }

  cartCount.textContent = cart.length;
  cartTotal.textContent = formatPrice(total);
  cartTotalTop.textContent = formatPrice(total);
};

const renderGoods = (items, user) => {
  goodsGrid.innerHTML = "";
  
  if (items.length === 0) {
    goodsGrid.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 60px 20px; color: var(--text-muted);">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom: 16px; opacity: 0.5;">
          <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
          <line x1="3" y1="6" x2="21" y2="6"></line>
          <path d="M16 10a4 4 0 0 1-8 0"></path>
        </svg>
        <p>No items available yet</p>
      </div>
    `;
    return;
  }

  items.forEach((item) => {
    const card = document.createElement("div");
    card.className = "card";
    
    const conditionClass = item.condition === "Like New" ? "badge-success" : 
                          item.condition === "Good" ? "badge-primary" : "badge-warning";
    
    card.innerHTML = `
      <div class="card-image">
        <img src="${item.images?.[0] || 'https://picsum.photos/seed/' + item.id + '/600/400'}" alt="${item.title}" loading="lazy" />
      </div>
      <div class="card-body">
        <div class="card-badges">
          <span class="badge badge-primary">${item.category}</span>
          <span class="badge ${conditionClass}">${item.condition}</span>
        </div>
        <h3>${item.title}</h3>
        <p>${item.description || 'No description provided.'}</p>
        <div class="card-meta">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
            <circle cx="12" cy="7" r="4"></circle>
          </svg>
          ${item.sellerName}
          <span style="margin: 0 6px;">·</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
            <circle cx="12" cy="10" r="3"></circle>
          </svg>
          ${item.location}
        </div>
      </div>
      <div class="card-footer">
        <div class="price">
          <span class="price-currency">CAD</span> ${formatPrice(item.price)}
        </div>
        <button class="btn btn-sm btn-primary" data-id="${item.id}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="9" cy="21" r="1"></circle>
            <circle cx="20" cy="21" r="1"></circle>
            <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
          </svg>
          Add
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
        
        // Visual feedback
        button.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          Added!
        `;
        setTimeout(() => {
          button.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="9" cy="21" r="1"></circle>
              <circle cx="20" cy="21" r="1"></circle>
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
            </svg>
            Add
          `;
        }, 1500);
      });
    }
    goodsGrid.appendChild(card);
  });
  
  listingCount.textContent = items.length;
};

const updateNav = (user) => {
  userBadge.textContent = user.role === "guest" ? "Guest" : user.name;
  const isLoggedIn = user.role !== "guest";
  loginLink.style.display = isLoggedIn ? "none" : "inline-flex";
  registerLink.style.display = isLoggedIn ? "none" : "inline-flex";
  logoutBtn.style.display = isLoggedIn ? "inline-flex" : "none";
  adminLink.style.display = user.role === "admin" ? "inline-flex" : "none";
  guestNotice.style.display = user.role === "guest" ? "flex" : "none";
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
    console.error("Error loading goods:", error);
    return [];
  }
};

const handleListItem = async (user) => {
  if (!listItemBtn) return;
  
  listItemBtn.addEventListener("click", async () => {
    const payload = {
      title: document.getElementById("newTitle").value.trim(),
      price: document.getElementById("newPrice").value,
      condition: document.getElementById("newCondition").value,
      category: document.getElementById("newCategory").value.trim(),
      description: document.getElementById("newDescription").value.trim(),
      images: [document.getElementById("newImage").value.trim()].filter(Boolean)
    };

    if (!payload.title || !payload.price || !payload.category) {
      sellNotice.textContent = "Please fill out all required fields.";
      sellNotice.className = "notice notice-error";
      sellNotice.style.display = "flex";
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
      
      if (!res.ok) throw new Error("Unable to list item.");
      
      sellNotice.textContent = "Listing published successfully!";
      sellNotice.className = "notice notice-success";
      sellNotice.style.display = "flex";
      
      // Clear form
      document.getElementById("newTitle").value = "";
      document.getElementById("newPrice").value = "";
      document.getElementById("newCategory").value = "";
      document.getElementById("newDescription").value = "";
      document.getElementById("newImage").value = "";
      
      // Reload goods
      const goods = await loadGoods();
      renderGoods(goods, user);
    } catch (error) {
      sellNotice.textContent = "Failed to publish listing. Try again.";
      sellNotice.className = "notice notice-error";
      sellNotice.style.display = "flex";
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
      guestNotice.style.display = "flex";
      return;
    }
    const cart = getCart();
    if (cart.length === 0) {
      guestNotice.textContent = "Add items to cart before checking out.";
      guestNotice.style.display = "flex";
      return;
    }
    window.location.href = "payment.html";
  });

  browseBtn.addEventListener("click", () => {
    document.getElementById("goodsGrid").scrollIntoView({ behavior: "smooth" });
  });

  logoutBtn.addEventListener("click", () => {
    localStorage.removeItem("secondhand_user");
    localStorage.removeItem("secondhand_cart");
    window.location.reload();
  });

  handleListItem(user);
};

init();
