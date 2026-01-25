const API_BASE = "http://localhost:3000/api";

// DOM Elements
const productContainer = document.getElementById("productContainer");
const recommendationsGrid = document.getElementById("recommendationsGrid");
const recentlyViewedSection = document.getElementById("recentlyViewedSection");
const recentlyViewedGrid = document.getElementById("recentlyViewedGrid");
const breadcrumbCategory = document.getElementById("breadcrumbCategory");
const breadcrumbTitle = document.getElementById("breadcrumbTitle");
const userBadge = document.getElementById("userBadge");
const loginLink = document.getElementById("loginLink");
const registerLink = document.getElementById("registerLink");
const logoutBtn = document.getElementById("logoutBtn");
const adminLink = document.getElementById("adminLink");
const navCartCount = document.getElementById("navCartCount");
const searchInput = document.getElementById("searchInput");
const searchBtn = document.getElementById("searchBtn");

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
  if (navCartCount) navCartCount.textContent = cart.length;
};

// Get product ID from URL
const getProductId = () => {
  const params = new URLSearchParams(window.location.search);
  return params.get("id");
};

// Update Nav
const updateNav = (user) => {
  if (userBadge) userBadge.textContent = user.role === "guest" ? "Guest" : user.name;
  const isLoggedIn = user.role !== "guest";
  if (loginLink) loginLink.style.display = isLoggedIn ? "none" : "inline-flex";
  if (registerLink) registerLink.style.display = isLoggedIn ? "none" : "inline-flex";
  if (logoutBtn) logoutBtn.style.display = isLoggedIn ? "inline-flex" : "none";
  if (adminLink) adminLink.style.display = user.role === "admin" ? "inline-flex" : "none";
};

// Create Product Card (for recommendations)
const createProductCard = (item, user) => {
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
      <button class="btn btn-sm btn-primary add-cart-btn" data-id="${item.id}">Add</button>
    </div>
  `;
  
  // Click card to view product
  card.addEventListener("click", (e) => {
    if (e.target.closest(".add-cart-btn")) return;
    addToRecentlyViewed(item);
    window.location.href = `product.html?id=${item.id}`;
  });
  
  // Add to cart
  const addBtn = card.querySelector(".add-cart-btn");
  if (user.role === "guest") {
    addBtn.disabled = true;
    addBtn.style.opacity = 0.5;
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
          quantity: 1
        });
      }
      saveCart(cart);
      addBtn.textContent = "Added!";
      setTimeout(() => { addBtn.textContent = "Add"; }, 1500);
    });
  }
  
  return card;
};

// Render Product Details
const renderProduct = (item, user) => {
  const conditionClass = item.condition === "Like New" ? "badge-success" : 
                        item.condition === "Good" ? "badge-primary" : "badge-warning";
  
  const isInCart = getCart().some(c => c.id === item.id);
  
  productContainer.innerHTML = `
    <div class="product-gallery">
      <img class="product-main-image" src="${item.images?.[0] || 'https://picsum.photos/seed/' + item.id + '/800/800'}" alt="${item.title}" />
    </div>
    <div class="product-info">
      <div class="product-badges">
        <span class="badge badge-primary">${item.category}</span>
        <span class="badge ${conditionClass}">${item.condition}</span>
      </div>
      <h1 class="product-title">${item.title}</h1>
      <div class="product-price">
        <span class="currency">CAD</span> ${formatPrice(item.price)}
      </div>
      <div class="product-meta">
        <div class="product-meta-item">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
            <circle cx="12" cy="7" r="4"></circle>
          </svg>
          <span>Seller:</span>
          <strong>${item.sellerName}</strong>
        </div>
        <div class="product-meta-item">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
            <circle cx="12" cy="10" r="3"></circle>
          </svg>
          <span>Location:</span>
          <strong>${item.location}</strong>
        </div>
        <div class="product-meta-item">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
          <span>Listed:</span>
          <strong>${new Date(item.listedAt).toLocaleDateString()}</strong>
        </div>
      </div>
      <div class="product-description">
        <h3>Description</h3>
        <p>${item.description || 'No description provided by the seller.'}</p>
      </div>
      <div class="product-actions">
        <button class="btn btn-lg btn-primary" id="addToCartBtn" ${user.role === "guest" ? "disabled" : ""}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="9" cy="21" r="1"></circle>
            <circle cx="20" cy="21" r="1"></circle>
            <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
          </svg>
          ${isInCart ? "In Cart" : "Add to Cart"}
        </button>
        <button class="btn btn-lg btn-secondary" id="buyNowBtn" ${user.role === "guest" ? "disabled" : ""}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect>
            <line x1="1" y1="10" x2="23" y2="10"></line>
          </svg>
          Buy Now
        </button>
      </div>
      ${user.role === "guest" ? '<p class="notice" style="margin-top: 16px;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg> Please login or register to purchase</p>' : ''}
    </div>
  `;

  // Update breadcrumbs
  if (breadcrumbCategory) {
    breadcrumbCategory.textContent = item.category;
    breadcrumbCategory.href = `index.html?category=${encodeURIComponent(item.category)}`;
  }
  if (breadcrumbTitle) breadcrumbTitle.textContent = item.title;
  
  // Update page title
  document.title = `${item.title} | Secondhand Hub`;

  // Add to cart button
  const addToCartBtn = document.getElementById("addToCartBtn");
  if (addToCartBtn && user.role !== "guest") {
    addToCartBtn.addEventListener("click", () => {
      const cart = getCart();
      const exists = cart.find((c) => c.id === item.id);
      if (exists) {
        exists.quantity += 1;
      } else {
        cart.push({
          id: item.id,
          title: item.title,
          price: item.price,
          quantity: 1
        });
      }
      saveCart(cart);
      addToCartBtn.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
        Added to Cart!
      `;
    });
  }

  // Buy now button
  const buyNowBtn = document.getElementById("buyNowBtn");
  if (buyNowBtn && user.role !== "guest") {
    buyNowBtn.addEventListener("click", () => {
      const cart = getCart();
      if (!cart.some(c => c.id === item.id)) {
        cart.push({
          id: item.id,
          title: item.title,
          price: item.price,
          quantity: 1
        });
        saveCart(cart);
      }
      window.location.href = "payment.html";
    });
  }
};

// Render Recommendations
const renderRecommendations = async (productId, user) => {
  try {
    const res = await fetch(`${API_BASE}/goods/${productId}/recommendations?limit=8`);
    if (!res.ok) throw new Error("Failed to load recommendations");
    const data = await res.json();
    
    recommendationsGrid.innerHTML = "";
    data.items.forEach((item) => {
      recommendationsGrid.appendChild(createProductCard(item, user));
    });
  } catch (error) {
    console.error("Error loading recommendations:", error);
  }
};

// Render Recently Viewed
const renderRecentlyViewed = (user, currentProductId) => {
  const recent = getRecentlyViewed().filter(r => r.id !== currentProductId);
  
  if (recent.length === 0) {
    recentlyViewedSection.style.display = "none";
    return;
  }
  
  recentlyViewedSection.style.display = "block";
  recentlyViewedGrid.innerHTML = "";
  
  recent.slice(0, 8).forEach((item) => {
    recentlyViewedGrid.appendChild(createProductCard(item, user));
  });
};

// Load Product
const loadProduct = async (id) => {
  try {
    const res = await fetch(`${API_BASE}/goods/${id}`);
    if (!res.ok) throw new Error("Product not found");
    const data = await res.json();
    return data.item;
  } catch (error) {
    console.error("Error loading product:", error);
    return null;
  }
};

// Initialize
const init = async () => {
  const user = getUser();
  updateNav(user);
  updateCartBadge();

  const productId = getProductId();
  
  if (!productId) {
    productContainer.innerHTML = `
      <div style="text-align: center; padding: 60px; grid-column: 1/-1;">
        <h2>Product not found</h2>
        <p style="color: var(--text-muted); margin-top: 8px;">The product you're looking for doesn't exist.</p>
        <a href="index.html" class="btn btn-primary" style="margin-top: 20px;">Back to Home</a>
      </div>
    `;
    return;
  }

  // Load product
  const product = await loadProduct(productId);
  
  if (!product) {
    productContainer.innerHTML = `
      <div style="text-align: center; padding: 60px; grid-column: 1/-1;">
        <h2>Product not found</h2>
        <p style="color: var(--text-muted); margin-top: 8px;">The product you're looking for doesn't exist or has been removed.</p>
        <a href="index.html" class="btn btn-primary" style="margin-top: 20px;">Back to Home</a>
      </div>
    `;
    return;
  }

  // Add to recently viewed
  addToRecentlyViewed(product);
  
  // Render product
  renderProduct(product, user);
  
  // Load recommendations
  await renderRecommendations(productId, user);
  
  // Render recently viewed
  renderRecentlyViewed(user, productId);

  // Search
  if (searchBtn) {
    searchBtn.addEventListener("click", () => {
      const query = searchInput?.value.trim();
      if (query) {
        window.location.href = `index.html?search=${encodeURIComponent(query)}`;
      }
    });
  }
  if (searchInput) {
    searchInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        const query = searchInput.value.trim();
        if (query) {
          window.location.href = `index.html?search=${encodeURIComponent(query)}`;
        }
      }
    });
  }

  // Logout
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      localStorage.removeItem("secondhand_user");
      localStorage.removeItem("secondhand_cart");
      window.location.href = "index.html";
    });
  }
};

init();
