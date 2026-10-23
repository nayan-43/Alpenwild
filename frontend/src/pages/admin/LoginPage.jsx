import React, { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import Icon from "@/components/admin/Icon";
import { thumbnailAssetUrl } from "@/lib/assets";
import $ from "@/vendor/jqueryValidationEngine";

export default function LoginPage({
  onLogin,
  sessionMessage = "",
  sessionMessageType = "error",
}) {
  const [form, setForm] = useState({
    username: "",
    password: "",
    remember: false,
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [forgot, setForgot] = useState(false);
  const [forgotUser, setForgotUser] = useState("");
  const [forgotMessage, setForgotMessage] = useState("");
  const formRef = useRef(null);

  useEffect(() => {
    if (sessionMessage) setError(sessionMessage);
  }, [sessionMessage]);

  useEffect(() => {
    const form = formRef.current;
    if (!form) return undefined;
    const $form = $(form);
    $form.validationEngine("attach", { promptPosition: "topLeft" });
    return () => {
      $form.validationEngine("hideAll");
      $form.validationEngine("detach");
    };
  }, [forgot]);

  function switchRecoveryForm(showForgot) {
    setError("");
    setForgotMessage("");
    setForgot(showForgot);
  }

  async function submit(event) {
    event.preventDefault();
    if (!$(event.currentTarget).validationEngine("validate")) return;
    setError("");
    setBusy(true);
    try {
      const user = await api("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      onLogin(user);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function requestReset(event) {
    event.preventDefault();
    if (!$(event.currentTarget).validationEngine("validate")) return;
    setError("");
    setForgotMessage("");
    setBusy(true);
    try {
      const result = await api("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: forgotUser }),
      });
      setForgotMessage(result.message);
      setForgotUser("");
      setForgot(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-box">
        <div className="login-logo">
          <img
            src={thumbnailAssetUrl(
              "1_1625721414_1_1625662529_1_1518177529_logo.png",
              320,
              64,
            )}
            alt="Alpenwild"
          />
        </div>
        <div className="login-box-body">
          {forgot && <p className="login-box-msg">Forgot Password</p>}
          {!forgot && (
            <p className="login-box-msg">Sign in to start your session</p>
          )}
          {error && (
            <div
              className={`alert ${error === sessionMessage ? sessionMessageType : "error"}`}
              role="alert"
            >
              <button
                type="button"
                className="admin-alert-close"
                onClick={() => setError("")}
                aria-label="Close"
              >
                ×
              </button>
              {error}
            </div>
          )}
          {forgotMessage && (
            <div className="alert success" role="alert">
              <button
                type="button"
                className="admin-alert-close"
                onClick={() => setForgotMessage("")}
                aria-label="Close"
              >
                ×
              </button>
              {forgotMessage}
            </div>
          )}
          {forgot ? (
            <form noValidate ref={formRef} onSubmit={requestReset}>
              <div className="form-group has-feedback">
                <input
                  className="form-control"
                  required
                  data-validation-engine="validate[required]"
                  placeholder="User Name"
                  value={forgotUser}
                  onChange={(event) => setForgotUser(event.target.value)}
                />
              </div>
              <button
                className="btn btn-primary btn-block btn-flat"
                disabled={busy}
              >
                {busy ? "Sending..." : "Send New Password"}
              </button>
              <button
                type="button"
                className="login-link"
                onClick={() => switchRecoveryForm(false)}
                style={{ marginTop: "10px" }}
              >
                <Icon name="chevron" size={14} /> Back to Sign In
              </button>
            </form>
          ) : (
            <form noValidate ref={formRef} onSubmit={submit}>
              <div className="form-group has-feedback">
                <input
                  required
                  data-validation-engine="validate[required]"
                  placeholder="User Name"
                  autoComplete="username"
                  className="form-control"
                  value={form.username}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      username: event.target.value,
                    }))
                  }
                />
                <span className="glyphicon glyphicon-user form-control-feedback" />
              </div>
              <div className="form-group has-feedback">
                <input
                  required
                  data-validation-engine="validate[required]"
                  type="password"
                  placeholder="Password"
                  autoComplete="current-password"
                  className="form-control"
                  value={form.password}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      password: event.target.value,
                    }))
                  }
                />
                <span className="glyphicon glyphicon-lock form-control-feedback" />
              </div>
              <div className="row">
                <div className="col-xs-7">
                  <div className="checkbox">
                    <label>
                      <input
                        type="checkbox"
                        checked={form.remember}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            remember: event.target.checked,
                          }))
                        }
                      />{" "}
                      Remember Me
                    </label>
                  </div>
                </div>
                <div className="col-xs-5">
                  <button
                    className="btn btn-primary btn-block btn-flat"
                    disabled={busy}
                  >
                    {busy ? "Signing In..." : "Sign In"}
                  </button>
                </div>
              </div>
              <a
                href="#forgot-password"
                onClick={(event) => {
                  event.preventDefault();
                  switchRecoveryForm(true);
                }}
              >
                I forgot my password
              </a>
            </form>
          )}
        </div>
      </section>
    </main>
  );
}
