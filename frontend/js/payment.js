const API_BASE = "http://localhost:3000/api";

const payBtn = document.getElementById("payBtn");
const paymentNotice = document.getElementById("paymentNotice");

const getUser = () => {
  const raw = localStorage.getItem("secondhand_user");
  return raw ? JSON.parse(raw) : { role: "guest" };
};

const getCart = () => {
  const raw = localStorage.getItem("secondhand_cart");
  return raw ? JSON.parse(raw) : [];
};

const showNotice = (message) => {
  paymentNotice.textContent = message;
  paymentNotice.style.display = "block";
};

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

  const payload = {
    userId: user.id,
    items: cart,
    payment: {
      cardName: document.getElementById("cardName").value.trim(),
      cardNumber: document.getElementById("cardNumber").value.trim(),
      cardExpiry: document.getElementById("cardExpiry").value.trim(),
      cardCvv: document.getElementById("cardCvv").value.trim(),
      billingAddress: document.getElementById("billingAddress").value.trim(),
      billingPostal: document.getElementById("billingPostal").value.trim()
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
    if (!res.ok) {
      throw new Error("Checkout failed");
    }
    localStorage.removeItem("secondhand_cart");
    showNotice("Order placed! You can view it in the admin console.");
  } catch (error) {
    showNotice("Unable to place order. Please try again.");
  }
});
