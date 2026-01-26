import { useState } from "react";
import "./App.css";

export default function App() {
  const [profile, setProfile] = useState({
    address: "",
    email: "",
    phone: "",
    gender: "",
  });

  const [tab, setTab] = useState("purchased");

  const products = {
    purchased: [
      { id: 1, name: "Used iPhone", price: 300 },
      { id: 2, name: "Textbook", price: 20 },
    ],
    selling: [{ id: 3, name: "Mechanical Keyboard", price: 80 }],
    sold: [{ id: 4, name: "Monitor", price: 120 }],
  };

  function handleChange(e) {
    setProfile({ ...profile, [e.target.name]: e.target.value });
  }

  return (
    <div className="page">
      <h1>My Profile</h1>

      <div className="profile-layout">
        {/* 左侧 */}
        <div className="card profile-card">
          <div className="avatar">SZ</div>
          <div className="username">Shuqi Zhang</div>

          <h2>Personal Information</h2>

          <label>
            Address
            <input name="address" value={profile.address} onChange={handleChange} />
          </label>

          <label>
            Email
            <input name="email" value={profile.email} onChange={handleChange} />
          </label>

          <label>
            Phone
            <input name="phone" value={profile.phone} onChange={handleChange} />
          </label>

          <label>
            Gender
            <select name="gender" value={profile.gender} onChange={handleChange}>
              <option value="">Select</option>
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="other">Other</option>
            </select>
          </label>

          <button>Save</button>
        </div>

        {/* 右侧 */}
        <div className="card products-card">
          <h2>My Products</h2>

          <div className="tabs">
            <button
              className={tab === "purchased" ? "active" : ""}
              onClick={() => setTab("purchased")}
            >
              Purchased
            </button>
            <button
              className={tab === "selling" ? "active" : ""}
              onClick={() => setTab("selling")}
            >
              Selling
            </button>
            <button
              className={tab === "sold" ? "active" : ""}
              onClick={() => setTab("sold")}
            >
              Sold
            </button>
          </div>

          <ul className="product-list">
            {products[tab].map((item) => (
              <li key={item.id} className="product-item">
                <span>
                  {item.name} — ${item.price}
                </span>
                <span className={`badge ${tab}`}>
                  {tab}
                </span>
              </li>

            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
