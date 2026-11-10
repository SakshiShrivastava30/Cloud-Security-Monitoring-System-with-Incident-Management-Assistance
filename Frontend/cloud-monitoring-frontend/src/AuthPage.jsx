import { useState } from "react";
import "./AuthPage.css";

const API_URL = "http://localhost:8080/api/auth";

const passwordRules = [
  {
    label: "At least 8 characters",
    test: (password) => password.length >= 8,
  },
  {
    label: "One uppercase letter (A–Z)",
    test: (password) => /[A-Z]/.test(password),
  },
  {
    label: "One lowercase letter (a–z)",
    test: (password) => /[a-z]/.test(password),
  },
  {
    label: "One number (0–9)",
    test: (password) => /[0-9]/.test(password),
  },
  {
    label: "One special character (!@#$%)",
    test: (password) => /[^A-Za-z0-9\s]/.test(password),
  },
];

export default function AuthPage({ onAuthenticated }) {
  const [mode, setMode] = useState("login");
  const [selectedRole, setSelectedRole] = useState("Viewer");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("error");

  const isRegister = mode === "register";
  const checks = passwordRules.map((rule) => ({
    label: rule.label,
    valid: rule.test(password),
  }));

  const strength = checks.filter((rule) => rule.valid).length;

  function switchMode(nextMode) {
    setMode(nextMode);
    setMessage("");
    setPassword("");
    setConfirmPassword("");
    setShowPassword(false);
    setShowConfirmPassword(false);
  }

  async function readResponse(response) {
    const body = (await response.text()).trim();

    if (!response.ok) {
      throw new Error(body || `Request failed (${response.status})`);
    }

    return body;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage("");

    const cleanEmail = email.trim();

    if (!cleanEmail) {
      setMessage("Please enter your email address.");
      setMessageType("error");
      return;
    }

    if (isRegister) {
      if (!name.trim()) {
        setMessage("Please enter your full name.");
        setMessageType("error");
        return;
      }

      if (!checks.every((rule) => rule.valid)) {
        setMessage("Please meet all five password requirements.");
        setMessageType("error");
        return;
      }

      if (password !== confirmPassword) {
        setMessage("Passwords do not match.");
        setMessageType("error");
        return;
      }
    }

    setLoading(true);

    try {
      const formData = new URLSearchParams();
      formData.append("email", cleanEmail);
      formData.append("password", password);

      if (isRegister) {
        formData.append("name", name.trim());
      }

      const response = await fetch(
        `${API_URL}/${isRegister ? "register" : "login"}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: formData.toString(),
        }
      );

      const result = await readResponse(response);

      if (isRegister) {
        setMessage(
          "Registration successful! You can now sign in with your account."
        );
        setMessageType("success");

        setMode("login");
        setName("");
        setPassword("");
        setConfirmPassword("");
      } else {
        // The backend JWT is the source of truth for the user's actual role.
        if (!result || result.split(".").length !== 3) {
          throw new Error(
            "The server response was not a valid JWT. Check AuthService.login()."
          );
        }

        // Read the role assigned by the backend. A user cannot grant themselves
        // Admin access merely by selecting Admin on this screen.
        const payload = JSON.parse(
          atob(result.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))
        );
        const tokenRole = String(payload.role || "VIEWER")
          .toUpperCase()
          .replace(/^ROLE_/, "");
        const actualRole =
          tokenRole === "ADMIN"
            ? "Admin"
            : tokenRole === "ANALYST"
              ? "Analyst"
              : tokenRole === "VIEWER"
                ? "Viewer"
                : null;

        if (!actualRole) {
          throw new Error("Your account has an unsupported role. Contact the administrator.");
        }

        if (actualRole !== selectedRole) {
          throw new Error(
            `This account is registered as ${actualRole}. Please select ${actualRole} to sign in.`
          );
        }

        // Session storage keeps the token for this browser tab session.
        sessionStorage.setItem("token", result);

        setMessage("Login successful!");
        setMessageType("success");

        if (onAuthenticated) {
          onAuthenticated(result);
        }
      }
    } catch (error) {
      let errorMessage = error.message || "Something went wrong.";

      if (error instanceof TypeError) {
        errorMessage =
          "Cannot connect to the backend. Check that Spring Boot is running on port 8080.";
      }

      setMessage(errorMessage);
      setMessageType("error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-visual">
        <div className="auth-brand">
          <div className="auth-brand-icon">C</div>
          <span>CloudMonitor</span>
        </div>

        <div className="auth-visual-content">
          <div className="auth-status">
            <span className="auth-status-dot" />
            CLOUD SECURITY PLATFORM
          </div>

          <h1>
            See threats.
            <br />
            Secure your
            <br />
            <span>cloud.</span>
          </h1>

          <p>
            Monitor your cloud infrastructure, detect security incidents,
            and manage risk from one unified workspace.
          </p>

          <div className="auth-feature-list">
            <div className="auth-feature">
              <span className="auth-feature-icon">⌁</span>
              <div>
                <strong>Real-time monitoring</strong>
                <small>Keep visibility across your cloud environment.</small>
              </div>
            </div>

            <div className="auth-feature">
              <span className="auth-feature-icon">◈</span>
              <div>
                <strong>Incident management</strong>
                <small>Investigate alerts and track security events.</small>
              </div>
            </div>

            <div className="auth-feature">
              <span className="auth-feature-icon">⛨</span>
              <div>
                <strong>Access protection</strong>
                <small>Authenticate with your own secure account.</small>
              </div>
            </div>
          </div>
        </div>

        <div className="auth-visual-footer">
          CLOUD MONITORING SYSTEM <span>•</span> SECURE ACCESS
        </div>
      </section>

      <section className="auth-form-panel">
        <div className="auth-form-container">
          <div className="auth-mobile-brand">
            <div className="auth-brand-icon">C</div>
            <span>CloudMonitor</span>
          </div>

          <div className="auth-heading">
            <span className="auth-eyebrow">
              {isRegister ? "GET STARTED" : "WELCOME BACK"}
            </span>

            <h2>
              {isRegister ? "Create your account" : "Sign in to your account"}
            </h2>

            <p>
              {isRegister
                ? "Set up your account to access your security workspace."
                : "Enter your credentials to access your workspace."}
            </p>
          </div>

          <div className="auth-tabs">
            <button
              type="button"
              className={!isRegister ? "active" : ""}
              onClick={() => switchMode("login")}
            >
              Sign in
            </button>

            <button
              type="button"
              className={isRegister ? "active" : ""}
              onClick={() => switchMode("register")}
            >
              Create account
            </button>
          </div>

          {!isRegister && (
            <div style={{ marginBottom: 18 }}>
              <label
                style={{
                  display: "block",
                  marginBottom: 9,
                  color: "#dce9f9",
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                Login as
              </label>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                  gap: 8,
                }}
              >
                {["Admin", "Analyst", "Viewer"].map((roleOption) => (
                  <button
                    key={roleOption}
                    type="button"
                    onClick={() => setSelectedRole(roleOption)}
                    aria-pressed={selectedRole === roleOption}
                    style={{
                      padding: "11px 8px",
                      borderRadius: 8,
                      border: selectedRole === roleOption
                        ? "1px solid #08d6f5"
                        : "1px solid #29465d",
                      background: selectedRole === roleOption
                        ? "rgba(8, 214, 245, 0.12)"
                        : "#071e30",
                      color: selectedRole === roleOption ? "#08d6f5" : "#c7d7e8",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    {roleOption}
                  </button>
                ))}
              </div>
            </div>
          )}

          <form className="auth-form" onSubmit={handleSubmit}>
            {isRegister && (
              <div className="auth-field">
                <label htmlFor="auth-name">Full name</label>
                <input
                  id="auth-name"
                  type="text"
                  placeholder="Enter your full name"
                  autoComplete="name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                />
              </div>
            )}

            <div className="auth-field">
              <label htmlFor="auth-email">Email address</label>
              <input
                id="auth-email"
                type="email"
                placeholder="you@company.com"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>

            <div className="auth-field">
              <div className="auth-label-row">
                <label htmlFor="auth-password">Password</label>
                {!isRegister && (
                  <span className="auth-small-note">Your account password</span>
                )}
              </div>

              <div className="auth-password-wrap">
                <input
                  id="auth-password"
                  type={showPassword ? "text" : "password"}
                  placeholder={
                    isRegister ? "Create a strong password" : "Enter your password"
                  }
                  autoComplete={isRegister ? "new-password" : "current-password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />

                <button
                  type="button"
                  className="auth-show-password"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>

              {isRegister && password.length > 0 && (
                <div className="auth-password-strength">
                  <div className="auth-strength-bars">
                    {[1, 2, 3, 4, 5].map((number) => (
                      <span
                        key={number}
                        className={
                          number <= strength
                            ? strength === 5
                              ? "filled strong"
                              : strength >= 3
                                ? "filled medium"
                                : "filled weak"
                            : ""
                        }
                      />
                    ))}
                  </div>

                  <div className="auth-strength-label">
                    <span>Password strength</span>
                    <strong
                      className={
                        strength === 5
                          ? "strong-text"
                          : strength >= 3
                            ? "medium-text"
                            : "weak-text"
                      }
                    >
                      {strength === 5
                        ? "Strong"
                        : strength >= 3
                          ? "Moderate"
                          : "Weak"}
                    </strong>
                  </div>

                  <ul className="auth-password-rules">
                    {checks.map((rule) => (
                      <li
                        key={rule.label}
                        className={rule.valid ? "valid" : ""}
                      >
                        <span>{rule.valid ? "✓" : "○"}</span>
                        {rule.label}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {isRegister && (
              <div className="auth-field">
                <label htmlFor="auth-confirm-password">
                  Confirm password
                </label>

                <div className="auth-password-wrap">
                  <input
                    id="auth-confirm-password"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Re-enter your password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(event) =>
                      setConfirmPassword(event.target.value)
                    }
                    required
                  />

                  <button
                    type="button"
                    className="auth-show-password"
                    onClick={() =>
                      setShowConfirmPassword((value) => !value)
                    }
                    aria-label={
                      showConfirmPassword
                        ? "Hide confirmation password"
                        : "Show confirmation password"
                    }
                  >
                    {showConfirmPassword ? "Hide" : "Show"}
                  </button>
                </div>

                {confirmPassword.length > 0 && (
                  <small
                    className={
                      password === confirmPassword
                        ? "auth-match valid"
                        : "auth-match invalid"
                    }
                  >
                    {password === confirmPassword
                      ? "✓ Passwords match"
                      : "Passwords do not match"}
                  </small>
                )}
              </div>
            )}

            {!isRegister && (
              <div className="auth-login-note">
                Use the password you chose when registering.
              </div>
            )}

            {message && (
              <div
                className={`auth-message ${messageType}`}
                role="status"
                aria-live="polite"
              >
                {message}
              </div>
            )}

            <button
              type="submit"
              className="auth-submit"
              disabled={loading}
            >
              {loading
                ? "Please wait..."
                : isRegister
                  ? "Create account"
                  : "Sign in to CloudMonitor"}

              {!loading && <span>→</span>}
            </button>
          </form>

          <div className="auth-bottom-note">
            <span className="auth-lock">⌑</span>
            Your credentials are transmitted to your configured backend.
          </div>

          <div className="auth-copyright">
            © {new Date().getFullYear()} CloudMonitor. Cloud security workspace.
          </div>
        </div>
      </section>
    </main>
  );
}