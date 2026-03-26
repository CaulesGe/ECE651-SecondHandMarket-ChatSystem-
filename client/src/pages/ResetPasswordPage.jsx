import { useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import Header from '../components/Header';
import { api } from "../utils/api";

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const token = searchParams.get("token");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [notice, setNotice] = useState({ show: false, message: '', isError: true });

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const res = await api.resetPassword(token, newPassword, confirmPassword);

      setNotice({show : true, message : res.message, isError : false});

      setTimeout(() => {
        navigate("/login");
      }, 2000);
    } catch (error) {
      setNotice({show : true, message : error.message || "Something went wrong", isError : true});
    }
  };

  return (
    <>
        <Header showSearch={false} subtitle="Reset Password" />
        <section className="form-container">
            <h2>Welcome back</h2>
            <p>Enter your new password that you like to have for the account.</p>
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
            <label htmlFor="registerPassword">Password</label>
            <div className="passwordDiv">
            <input 
              id="registerPassword"
              type={showPassword ? "text" : "password"}
              placeholder="Create a password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <button type="button" class="toggle-password" id="togglePassword" style = {{position : "absolute", right : "10px", top : "35%", border : "none", background : "var(--bg)"}} onClick={() => setShowPassword(!showPassword)}>{showPassword ? "\u{1F648}" : "\u{1F441}"}</button>
            </div>
          </div>
          <div className="form-group">
            <label htmlFor="registerPassword">Confirm Password</label>
            <div className="passwordDiv">
            <input 
              id="registerPassword"
              type={showConfirmPassword ? "text" : "password"}
              placeholder="Confirm the password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
            <button type="button" class="toggle-password" id="togglePassword" style = {{position : "absolute", right : "10px", top : "35%", border : "none", background : "var(--bg)"}} onClick={() => setShowConfirmPassword(!showConfirmPassword)}>{showConfirmPassword ? "\u{1F648}" : "\u{1F441}"}</button>
            </div>
            </div>
              <button 
                type="submit" 
                className="btn btn-primary" 
                style={{ width: '100%', marginTop: '8px' }}
              >Reset Password</button>
              </form>
        </section>
        </>
  );
}