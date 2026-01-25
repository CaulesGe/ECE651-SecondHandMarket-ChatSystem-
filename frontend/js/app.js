const API_BASE = "http://localhost:3000/api";

// DOM Elements
const goodsGrid = document.getElementById("goodsGrid");
const cartItems = document.getElementById("cartItems");
const cartCount = document.getElementById("cartCount");
const navCartCount = document.getElementById("navCartCount");
const cartTotal = document.getElementById("cartTotal");
const userBadge = document.getElementById("userBadge");
const loginLink = document.getElementById("loginLink");
const registerLink = document.getElementById("registerLink");
const logoutBtn = document.getElementById("logoutBtn");
const adminLink = document.getElementById("adminLink");
const checkoutBtn = document.getElementById("checkoutBtn");
const sellPanel = document.getElementById("sellPanel");
const listItemBtn = document.getElementById("listItemBtn");
const sellNotice = document.getElementById("sellNotice");
const guestNotice = document.getElementById("guestNotice");
const searchInput = document.getElementById("searchInput");
const searchBtn = document.getElementById("searchBtn");
const categorySelect = document.getElementById("categorySelect");
const categoryPills = document.getElementById("categoryPills");
const totalListings = document.getElementById("totalListings");
const totalCategories = document.getElementById("totalCategories");
const resultsCount = document.getElementById("resultsCount");
const productsTitle = document.getElementById("productsTitle");
const recommendedGrid = document.getElementById("recommendedGrid");
const recentlyViewedSection = document.getElementById("recentlyViewedSection");
const recentlyViewedGrid = document.getElementById("recentlyViewedGrid");
const clearRecentBtn = document.getElementById("clearRecentBtn");

// State
let allGoods = [];
let categories = [];
let currentCategory = "All";
let searchQuery = "";

// Helpers
const getUser = () => {
  const raw = localStorage.getItem("secondhand_user");
  return raw ? JSON.parse(raw) : { role: "guest" };
};

const saveCart = (cart) => {
  localStorage.setItem("secondhand_cart", JSON.stringify(cart));
  updateCartBadge();
};

const getCart = () => {
  const raw = localStorage.getItem("secondhand_cart");
  return raw ? JSON.parse(raw) : [];
};

const getRecentlyViewed = () => {
  const raw = localStorage.getItem("secondhand_recently_viewed");
  return raw ? JSON.parse(raw) : [];
};

const saveRecentlyViewed = (items) => {
  localStorage.setItem("secondhand_recently_viewed", JSON.stringify(items));
};

const addToRecentlyViewed = (item) => {
  let recent = getRecentlyViewed();
  recent = recent.filter(r => r.id !== item.id);
  recent.unshift(item);
  recent = recent.slice(0, 10);
  saveRecentlyViewed(recent);
};

const formatPrice = (value) => `$${Number(value).toFixed(2)}`;

const updateCartBadge = () => {
  const cart = getCart();
  const count = cart.length;
  if (cartCount) cartCount.textContent = count;
  if (navCartCount) navCartCount.textContent = count;
};

// Render Cart
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
      const el = document.createElement("div");
      el.className = "cart-item";
      el.innerHTML = `
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
      el.querySelector("button").addEventListener("click", (e) => {
        e.stopPropagation();
        const updated = getCart().filter((c) => c.id !== item.id);
        saveCart(updated);
        renderCart();
      });
      cartItems.appendChild(el);
    });
  }

  updateCartBadge();
  if (cartTotal) cartTotal.textContent = formatPrice(total);
};

// Create Product Card
const createProductCard = (item, user, isSmall = false) => {
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
      ${!isSmall ? `<p>${item.description || 'No description provided.'}</p>` : ''}
      <div class="card-meta">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
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
      <button class="btn btn-sm btn-primary add-cart-btn" data-id="${item.id}">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="9" cy="21" r="1"></circle>
          <circle cx="20" cy="21" r="1"></circle>
          <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
        </svg>
        Add
      </button>
    </div>
  `;
  
  // Click card to view product
  card.addEventListener("click", (e) => {
    if (e.target.closest(".add-cart-btn")) return;
    addToRecentlyViewed(item);
    window.location.href = `product.html?id=${item.id}`;
  });
  
  // Add to cart button
  const addBtn = card.querySelector(".add-cart-btn");
  if (user.role === "guest") {
    addBtn.disabled = true;
    addBtn.style.opacity = 0.5;
    addBtn.title = "Register to add items to cart";
  } else {
    addBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const cart = getCart();
      const exists = cart.find((c) => c.id === item.id);
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
      addBtn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
        Added!
      `;
      setTimeout(() => {
        addBtn.innerHTML = `
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
  
  return card;
};

// Render Products Grid
const renderGoods = (items, user) => {
  goodsGrid.innerHTML = "";
  
  if (items.length === 0) {
    goodsGrid.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 60px 20px; color: var(--text-muted);">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom: 16px; opacity: 0.5;">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <p>No items found matching your search</p>
      </div>
    `;
    return;
  }

  items.forEach((item) => {
    goodsGrid.appendChild(createProductCard(item, user));
  });
  
  if (resultsCount) resultsCount.textContent = `${items.length} items`;
};

// Render Recommendations (random selection based on preferences)
const renderRecommendations = (user) => {
  if (!recommendedGrid) return;
  
  const recentlyViewed = getRecentlyViewed();
  const cart = getCart();
  
  // Get preferred categories from recently viewed and cart
  const preferredCategories = new Set();
  recentlyViewed.forEach(item => preferredCategories.add(item.category));
  cart.forEach(item => {
    const found = allGoods.find(g => g.id === item.id);
    if (found) preferredCategories.add(found.category);
  });
  
  let recommended = [];
  
  if (preferredCategories.size > 0) {
    // Prioritize items from preferred categories
    const fromPreferred = allGoods.filter(g => 
      preferredCategories.has(g.category) && 
      !recentlyViewed.some(r => r.id === g.id)
    );
    recommended = fromPreferred.slice(0, 8);
  }
  
  // Fill remaining with popular/recent items
  if (recommended.length < 8) {
    const others = allGoods.filter(g => 
      !recommended.some(r => r.id === g.id) &&
      !recentlyViewed.some(r => r.id === g.id)
    );
    recommended = [...recommended, ...others.slice(0, 8 - recommended.length)];
  }
  
  recommendedGrid.innerHTML = "";
  recommended.forEach((item) => {
    recommendedGrid.appendChild(createProductCard(item, user, true));
  });
};

// Render Recently Viewed
const renderRecentlyViewed = (user) => {
  if (!recentlyViewedSection || !recentlyViewedGrid) return;
  
  const recent = getRecentlyViewed();
  
  if (recent.length === 0) {
    recentlyViewedSection.style.display = "none";
    return;
  }
  
  recentlyViewedSection.style.display = "block";
  recentlyViewedGrid.innerHTML = "";
  
  recent.forEach((item) => {
    recentlyViewedGrid.appendChild(createProductCard(item, user, true));
  });
};

// Render Categories
const renderCategories = () => {
  if (!categoryPills || !categorySelect) return;
  
  categoryPills.innerHTML = `<button class="category-pill active" data-category="All">All Items</button>`;
  categorySelect.innerHTML = `<option value="All">All Categories</option>`;
  
  categories.forEach((cat) => {
    const pill = document.createElement("button");
    pill.className = "category-pill";
    pill.dataset.category = cat;
    pill.textContent = cat;
    pill.addEventListener("click", () => {
      document.querySelectorAll(".category-pill").forEach(p => p.classList.remove("active"));
      pill.classList.add("active");
      currentCategory = cat;
      filterAndRender();
    });
    categoryPills.appendChild(pill);
    
    const option = document.createElement("option");
    option.value = cat;
    option.textContent = cat;
    categorySelect.appendChild(option);
  });
  
  // All button click
  categoryPills.querySelector('[data-category="All"]').addEventListener("click", function() {
    document.querySelectorAll(".category-pill").forEach(p => p.classList.remove("active"));
    this.classList.add("active");
    currentCategory = "All";
    filterAndRender();
  });
  
  // Populate new category dropdown in sell panel
  const newCategorySelect = document.getElementById("newCategory");
  if (newCategorySelect) {
    newCategorySelect.innerHTML = "";
    categories.forEach((cat) => {
      const option = document.createElement("option");
      option.value = cat;
      option.textContent = cat;
      newCategorySelect.appendChild(option);
    });
  }
};

// Filter and Render
const filterAndRender = () => {
  const user = getUser();
  let filtered = allGoods;
  
  if (currentCategory !== "All") {
    filtered = filtered.filter(g => g.category === currentCategory);
  }
  
  if (searchQuery) {
    const query = searchQuery.toLowerCase();
    filtered = filtered.filter(g => 
      g.title.toLowerCase().includes(query) ||
      g.description.toLowerCase().includes(query) ||
      g.category.toLowerCase().includes(query)
    );
  }
  
  // Update title
  if (productsTitle) {
    let titleText = currentCategory === "All" ? "All Products" : currentCategory;
    if (searchQuery) {
      titleText = `Search results for "${searchQuery}"`;
    }
    productsTitle.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
        <line x1="3" y1="6" x2="21" y2="6"></line>
        <path d="M16 10a4 4 0 0 1-8 0"></path>
      </svg>
      ${titleText}
    `;
  }
  
  renderGoods(filtered, user);
};

// Update Nav
const updateNav = (user) => {
  if (userBadge) userBadge.textContent = user.role === "guest" ? "Guest" : user.name;
  const isLoggedIn = user.role !== "guest";
  if (loginLink) loginLink.style.display = isLoggedIn ? "none" : "inline-flex";
  if (registerLink) registerLink.style.display = isLoggedIn ? "none" : "inline-flex";
  if (logoutBtn) logoutBtn.style.display = isLoggedIn ? "inline-flex" : "none";
  if (adminLink) adminLink.style.display = user.role === "admin" ? "inline-flex" : "none";
  if (guestNotice) guestNotice.style.display = user.role === "guest" ? "flex" : "none";
  if (sellPanel) sellPanel.style.display = isLoggedIn ? "block" : "none";
};

// Load Data
const loadGoods = async () => {
  try {
    const res = await fetch(`${API_BASE}/goods`);
    if (!res.ok) throw new Error("Failed to load goods");
    const data = await res.json();
    return data.items || [];
  } catch (error) {
    console.error("Error loading goods:", error);
    return [];
  }
};

const loadCategories = async () => {
  try {
    const res = await fetch(`${API_BASE}/categories`);
    if (!res.ok) throw new Error("Failed to load categories");
    const data = await res.json();
    return data.categories || [];
  } catch (error) {
    console.error("Error loading categories:", error);
    return [];
  }
};

// Handle List Item
const handleListItem = async (user) => {
  if (!listItemBtn) return;
  
  listItemBtn.addEventListener("click", async () => {
    const payload = {
      title: document.getElementById("newTitle").value.trim(),
      price: document.getElementById("newPrice").value,
      condition: document.getElementById("newCondition").value,
      category: document.getElementById("newCategory").value,
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
      document.getElementById("newDescription").value = "";
      document.getElementById("newImage").value = "";
      
      // Reload goods
      allGoods = await loadGoods();
      filterAndRender();
      if (totalListings) totalListings.textContent = allGoods.length;
    } catch (error) {
      sellNotice.textContent = "Failed to publish listing. Try again.";
      sellNotice.className = "notice notice-error";
      sellNotice.style.display = "flex";
    }
  });
};

// Initialize
const init = async () => {
  const user = getUser();
  updateNav(user);
  renderCart();

  // Load data
  [allGoods, categories] = await Promise.all([loadGoods(), loadCategories()]);
  
  // Update stats
  if (totalListings) totalListings.textContent = allGoods.length;
  if (totalCategories) totalCategories.textContent = categories.length;
  
  // Render
  renderCategories();
  filterAndRender();
  renderRecommendations(user);
  renderRecentlyViewed(user);

  // Search functionality
  const performSearch = () => {
    searchQuery = searchInput?.value.trim() || "";
    const selectedCategory = categorySelect?.value || "All";
    if (selectedCategory !== "All") {
      currentCategory = selectedCategory;
      document.querySelectorAll(".category-pill").forEach(p => {
        p.classList.toggle("active", p.dataset.category === selectedCategory);
      });
    }
    filterAndRender();
  };

  if (searchBtn) searchBtn.addEventListener("click", performSearch);
  if (searchInput) {
    searchInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") performSearch();
    });
  }

  // Clear recently viewed
  if (clearRecentBtn) {
    clearRecentBtn.addEventListener("click", () => {
      saveRecentlyViewed([]);
      renderRecentlyViewed(user);
    });
  }

  // Checkout
  if (checkoutBtn) {
    checkoutBtn.addEventListener("click", () => {
      if (user.role === "guest") {
        if (guestNotice) guestNotice.style.display = "flex";
        return;
      }
      const cart = getCart();
      if (cart.length === 0) {
        if (guestNotice) {
          guestNotice.textContent = "Add items to cart before checking out.";
          guestNotice.style.display = "flex";
        }
        return;
      }
      window.location.href = "payment.html";
    });
  }

  // Logout
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      localStorage.removeItem("secondhand_user");
      localStorage.removeItem("secondhand_cart");
      window.location.reload();
    });
  }

  handleListItem(user);
};

init();
