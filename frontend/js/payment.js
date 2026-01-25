const API_BASE = "http://localhost:3000/api";

const payBtn = document.getElementById("payBtn");
const paymentNotice = document.getElementById("paymentNotice");
const orderItems = document.getElementById("orderItems");
const orderTotal = document.getElementById("orderTotal");
const previewNumber = document.getElementById("previewNumber");
const previewName = document.getElementById("previewName");
const previewExpiry = document.getElementById("previewExpiry");
const cardName = document.getElementById("cardName");
const cardNumber = document.getElementById("cardNumber");
const cardExpiry = document.getElementById("cardExpiry");

const getUser = () => {
  const raw = localStorage.getItem("secondhand_user");
  return raw ? JSON.parse(raw) : { role: "guest" };
};

const getCart = () => {
  const raw = localStorage.getItem("secondhand_cart");
  return raw ? JSON.parse(raw) : [];
};

const formatPrice = (value) => `$${Number(value).toFixed(2)}`;

const showNotice = (message, isError = true) => {
  const span = paymentNotice.querySelector("span");
  if (span) {
    span.textContent = message;
  } else {
    paymentNotice.textContent = message;
  }
  paymentNotice.className = isError ? "notice notice-error" : "notice notice-success";
  paymentNotice.style.display = "flex";
};

// Render order summary
const renderOrderSummary = () => {
  const cart = getCart();
  let total = 0;

  if (cart.length === 0) {
    orderItems.innerHTML = `<p style="color: var(--text-muted); font-size: 14px;">Your cart is empty</p>`;
    orderTotal.textContent = "$0.00";
    return;
  }

  orderItems.innerHTML = cart
    .map((item) => {
      const subtotal = item.price * item.quantity;
      total += subtotal;
      return `
        <div class="order-item">
          <span>${item.title} x${item.quantity}</span>
          <span><strong>${formatPrice(subtotal)}</strong></span>
        </div>
      `;
    })
    .join("");

  orderTotal.textContent = formatPrice(total);
};

// Format card number with spaces
const formatCardNumber = (value) => {
  const v = value.replace(/\s+/g, "").replace(/[^0-9]/gi, "");
  const matches = v.match(/\d{4,16}/g);
  const match = (matches && matches[0]) || "";
  const parts = [];

  for (let i = 0, len = match.length; i < len; i += 4) {
    parts.push(match.substring(i, i + 4));
  }

  return parts.length ? parts.join(" ") : value;
};

// Format expiry date
const formatExpiry = (value) => {
  const v = value.replace(/\s+/g, "").replace(/[^0-9]/gi, "");
  if (v.length >= 2) {
    return v.substring(0, 2) + "/" + v.substring(2, 4);
  }
  return v;
};

// Update card preview
cardName.addEventListener("input", (e) => {
  previewName.textContent = e.target.value.toUpperCase() || "YOUR NAME";
});

cardNumber.addEventListener("input", (e) => {
  const formatted = formatCardNumber(e.target.value);
  e.target.value = formatted;
  
  const display = formatted || "**** **** **** ****";
  const padded = display.padEnd(19, "*").replace(/(\d{4})/g, "$1 ").trim();
  previewNumber.textContent = padded.substring(0, 19).replace(/\d(?=.{4})/g, (m, i) => 
    i < 15 ? "*" : m
  );
});

cardExpiry.addEventListener("input", (e) => {
  const formatted = formatExpiry(e.target.value);
  e.target.value = formatted;
  previewExpiry.textContent = formatted || "MM/YY";
});

// Handle payment
payBtn.addEventListener("click", async () => {
  const user = getUser();
  
  if (user.role === "guest") {
    showNotice("Please login or register before checking out.");
    return;
  }

  const cart = getCart();
  if (cart.length === 0) {
    showNotice("Your cart is empty.");
    return;
  }

  // Validate form
  const cardNameVal = cardName.value.trim();
  const cardNumberVal = cardNumber.value.replace(/\s/g, "");
  const cardExpiryVal = cardExpiry.value.trim();
  const cardCvv = document.getElementById("cardCvv").value.trim();
  const billingAddress = document.getElementById("billingAddress").value.trim();
  const billingPostal = document.getElementById("billingPostal").value.trim();

  if (!cardNameVal || !cardNumberVal || !cardExpiryVal || !cardCvv) {
    showNotice("Please fill in all payment details.");
    return;
  }

  if (cardNumberVal.length < 13) {
    showNotice("Please enter a valid card number.");
    return;
  }

  // Show loading
  payBtn.disabled = true;
  payBtn.innerHTML = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spin">
      <circle cx="12" cy="12" r="10" stroke-dasharray="32" stroke-dashoffset="12"></circle>
    </svg>
    Processing...
  `;

  const payload = {
    userId: user.id,
    items: cart,
    payment: {
      cardName: cardNameVal,
      cardNumber: cardNumberVal,
      cardExpiry: cardExpiryVal,
      cardCvv: cardCvv,
      billingAddress: billingAddress,
      billingPostal: billingPostal
    }
  };

  try {
    const res = await fetch(`${API_BASE}/transactions/checkout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-user-role": user.role
      },
      body: JSON.stringify(payload)
    });
    
    if (!res.ok) throw new Error("Checkout failed");
    
    localStorage.removeItem("secondhand_cart");
    
    showNotice("Order placed successfully! Thank you for your purchase.", false);
    
    // Update order summary to show empty
    orderItems.innerHTML = `<p style="color: var(--accent); font-size: 14px;">Order confirmed!</p>`;
    
    payBtn.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
      Order Placed
    `;
    payBtn.style.background = "var(--accent)";
    
    setTimeout(() => {
      window.location.href = "index.html";
    }, 2000);
  } catch (error) {
    showNotice("Unable to place order. Please try again.");
    payBtn.disabled = false;
    payBtn.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
      </svg>
      Place Secure Order
    `;
  }
});

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

// Initialize
renderOrderSummary();
