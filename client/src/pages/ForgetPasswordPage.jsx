import { useState } from "react";
import axios from "axios";
import Header from '../components/Header';
import { api } from "../utils/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [notice, setNotice] = useState({ show: false, message: '', isError: true });

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const res = await api.resetVerification(email);

      setNotice({show : true, message : res.message, isError : false});
    } catch (error) {
      setNotice({show : true, message : error.message || "Something went wrong", isError : true});
    }
  };

  return (
    <>
    <Header showSearch={false} subtitle="Forget Password" />
    <section className="form-container">
        <h2>Welcome back</h2>
        <p>Enter the email that you registered the account with and there will be an email sent to the email with links to reset password.</p>
        {notice.show && (
          <p className={`notice ${notice.isError ? 'notice-error' : 'notice-success'}`}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"></circle>
              {notice.isError ? (
                <>
                  <line x1="15" y1="9" x2="9" y2="15"></line>
                  <line x1="9" y1="9" x2="15" y2="15"></line>
                </>
              ) : (
                <polyline points="9 12 12 15 16 10"></polyline>
              )}
            </svg>
            <span>{notice.message}</span>
          </p>
        )}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="loginEmail">Email address</label>
            <input 
              id="loginEmail"
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <button 
            type="submit" 
            className="btn btn-primary" 
            style={{ width: '100%', marginTop: '8px' }}
          >Send Reset Link</button>
          </form>
    </section>
    </>
  );
}