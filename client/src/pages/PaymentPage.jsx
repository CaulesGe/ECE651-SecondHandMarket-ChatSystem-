import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { api, formatPrice } from '../utils/api';

export default function PaymentPage() {
  const navigate = useNavigate();
  const { user, isLoggedIn } = useAuth();
  const { cart, cartTotal, clearCart } = useCart();

  const [cardName, setCardName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [billingAddress, setBillingAddress] = useState('');
  const [billingCity, setBillingCity] = useState('');
  const [billingPostal, setBillingPostal] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState({ show: false, message: '', isError: true });
  const [success, setSuccess] = useState(false);

  // Card preview values
  const previewNumber = cardNumber || '**** **** **** ****';
  const previewName = cardName.toUpperCase() || 'YOUR NAME';
  const previewExpiry = cardExpiry || 'MM/YY';

  // Format card number with spaces
  const formatCardNumber = (value) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    const matches = v.match(/\d{4,16}/g);
    const match = (matches && matches[0]) || '';
    const parts = [];

    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }

    return parts.length ? parts.join(' ') : v;
  };

  // Format expiry date
  const formatExpiry = (value) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    if (v.length >= 2) {
      return v.substring(0, 2) + '/' + v.substring(2, 4);
    }
    return v;
  };

  const handleCardNumberChange = (e) => {
    setCardNumber(formatCardNumber(e.target.value));
  };

  const handleExpiryChange = (e) => {
    setCardExpiry(formatExpiry(e.target.value));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!isLoggedIn) {
      setNotice({ show: true, message: 'Please login or register before checking out.', isError: true });
      return;
    }

    if (cart.length === 0) {
      setNotice({ show: true, message: 'Your cart is empty.', isError: true });
      return;
    }

    if (!cardName || !cardNumber || !cardExpiry || !cardCvv) {
      setNotice({ show: true, message: 'Please fill in all payment details.', isError: true });
      return;
    }

    const cardNumClean = cardNumber.replace(/\s/g, '');
    if (cardNumClean.length < 13) {
      setNotice({ show: true, message: 'Please enter a valid card number.', isError: true });
      return;
    }

    setLoading(true);

    try {
      await api.checkout({
        userId: user.id,
        items: cart,
        payment: {
          cardName,
          cardNumber: cardNumClean,
          cardExpiry,
          cardCvv,
          billingAddress,
          billingPostal
        }
      }, user);

      clearCart();
      setSuccess(true);
      setNotice({ show: true, message: 'Order placed successfully! Thank you for your purchase.', isError: false });

      setTimeout(() => {
        navigate('/');
      }, 2000);
    } catch (error) {
      setNotice({ show: true, message: 'Unable to place order. Please try again.', isError: true });
      setLoading(false);
    }
  };

  return (
    <>
      <Header showSearch={false} subtitle="Complete your purchase" />

      <div className="payment-grid">
        <div className="payment-form">
          <h2>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect>
              <line x1="1" y1="10" x2="23" y2="10"></line>
            </svg>
            Payment Details
          </h2>

          <div className="card-preview">
            <div style={{ fontSize: '12px', opacity: 0.7 }}>Card Number</div>
            <div className="card-preview-number">
              {previewNumber.padEnd(19, '*').substring(0, 19)}
            </div>
            <div className="card-preview-row">
              <div>
                <div style={{ marginBottom: '4px' }}>Card Holder</div>
                <div style={{ fontSize: '14px', opacity: 1 }}>{previewName}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ marginBottom: '4px' }}>Expires</div>
                <div style={{ fontSize: '14px', opacity: 1 }}>{previewExpiry}</div>
              </div>
            </div>
          </div>

          {notice.show && (
            <p className={`notice ${notice.isError ? 'notice-error' : 'notice-success'}`}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
              <span>{notice.message}</span>
            </p>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="cardName">Name on card</label>
              <input 
                id="cardName"
                type="text"
                placeholder="Jordan Lee"
                autoComplete="cc-name"
                value={cardName}
                onChange={(e) => setCardName(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label htmlFor="cardNumber">Card number</label>
              <input 
                id="cardNumber"
                type="text"
                placeholder="4111 1111 1111 1111"
                maxLength="19"
                autoComplete="cc-number"
                value={cardNumber}
                onChange={handleCardNumberChange}
              />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="cardExpiry">Expiry date</label>
                <input 
                  id="cardExpiry"
                  type="text"
                  placeholder="MM/YY"
                  maxLength="5"
                  autoComplete="cc-exp"
                  value={cardExpiry}
                  onChange={handleExpiryChange}
                />
              </div>
              <div className="form-group">
                <label htmlFor="cardCvv">CVV</label>
                <input 
                  id="cardCvv"
                  type="password"
                  placeholder="123"
                  maxLength="4"
                  autoComplete="cc-csc"
                  value={cardCvv}
                  onChange={(e) => setCardCvv(e.target.value)}
                />
              </div>
            </div>

            <h3 style={{ margin: '24px 0 16px', fontSize: '16px' }}>Billing Address</h3>

            <div className="form-group">
              <label htmlFor="billingAddress">Street address</label>
              <input 
                id="billingAddress"
                type="text"
                placeholder="123 King St W"
                autoComplete="street-address"
                value={billingAddress}
                onChange={(e) => setBillingAddress(e.target.value)}
              />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="billingCity">City</label>
                <input 
                  id="billingCity"
                  type="text"
                  placeholder="Waterloo"
                  autoComplete="address-level2"
                  value={billingCity}
                  onChange={(e) => setBillingCity(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label htmlFor="billingPostal">Postal code</label>
                <input 
                  id="billingPostal"
                  type="text"
                  placeholder="N2L 3G1"
                  autoComplete="postal-code"
                  value={billingPostal}
                  onChange={(e) => setBillingPostal(e.target.value)}
                />
              </div>
            </div>

            <button 
              type="submit"
              className="btn btn-primary"
              style={{ 
                width: '100%', 
                marginTop: '16px', 
                padding: '16px',
                ...(success ? { background: 'var(--accent)' } : {})
              }}
              disabled={loading || success}
            >
              {loading ? (
                <>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="spin">
                    <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="12"></circle>
                  </svg>
                  Processing...
                </>
              ) : success ? (
                <>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                  Order Placed
                </>
              ) : (
                <>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                  </svg>
                  Place Secure Order
                </>
              )}
            </button>

            <p style={{ textAlign: 'center', fontSize: '12px', color: 'var(--text-muted)', marginTop: '16px' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ verticalAlign: '-2px', marginRight: '4px' }}>
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
              </svg>
              Your payment information is secure and encrypted
            </p>
          </form>
        </div>

        <div className="order-summary">
          <h3>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: '-3px', marginRight: '8px' }}>
              <circle cx="9" cy="21" r="1"></circle>
              <circle cx="20" cy="21" r="1"></circle>
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
            </svg>
            Order Summary
          </h3>
          <div className="order-items">
            {cart.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
                {success ? 'Order confirmed!' : 'Your cart is empty'}
              </p>
            ) : (
              cart.map(item => (
                <div key={item.id} className="order-item">
                  <span>{item.title} x{item.quantity}</span>
                  <span><strong>{formatPrice(item.price * item.quantity)}</strong></span>
                </div>
              ))
            )}
          </div>
          <div className="order-total">
            <span>Total</span>
            <span>{formatPrice(cartTotal)}</span>
          </div>
        </div>
      </div>
    </>
  );
}
