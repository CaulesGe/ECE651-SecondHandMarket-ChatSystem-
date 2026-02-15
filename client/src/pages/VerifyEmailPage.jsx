import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import Header from "../components/Header";
import { api } from "../utils/api";

export default function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get("token");

  const [status, setStatus] = useState({ loading: true, ok: false, message: "" });

  useEffect(() => {
    if (!token) {
      setStatus({ loading: false, ok: false, message: "Missing verification token." });
      return;
    }

    const controller = new AbortController();

    (async () => {
      try {
        const data = await api.verifyEmail(token, controller.signal);
        setStatus({ loading: false, ok: true, message: data.message || "Email verified." });
      } catch (e) {
        // StrictMode 的第一次请求会被 abort，这里要忽略
        if (e?.name === "AbortError") return;

        const msg = e?.message || "Verification failed.";
        setStatus({ loading: false, ok: false, message: msg });
      }
    })();

    return () => controller.abort();
  }, [token]);

  return (
    <>
      <Header showSearch={false} subtitle="Email verification" />
      <section className="form-container">
        <h2>{status.loading ? "Verifying..." : status.ok ? "Verified ✅" : "Verification failed ❌"}</h2>
        <p>{status.message}</p>

        {!status.loading && (
          <p className="form-footer">
            Back to <Link to="/login">Login</Link>.
          </p>
        )}
      </section>
    </>
  );
}
