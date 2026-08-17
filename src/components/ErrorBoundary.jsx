import React from "react";
import { ShieldAlert, RefreshCw, LogIn, Home } from "lucide-react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Uncaught React Error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReset = () => {
    localStorage.removeItem("makpower_active_view");
    window.location.reload();
  };

  handleGoLogin = () => {
    localStorage.removeItem("makpower_active_view");
    localStorage.removeItem("makpower_session_id");
    window.location.href = "/";
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: "100vh",
          backgroundColor: "#090d16",
          color: "#f8fafc",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          fontFamily: "system-ui, -apple-system, sans-serif"
        }}>
          <div style={{
            background: "rgba(15, 23, 42, 0.95)",
            border: "1px solid rgba(239, 68, 68, 0.4)",
            borderRadius: "16px",
            padding: "36px",
            maxWidth: "680px",
            width: "100%",
            boxShadow: "0 25px 50px -12px rgba(239, 68, 68, 0.25)"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "16px" }}>
              <div style={{
                background: "rgba(239, 68, 68, 0.15)",
                border: "1px solid rgba(239, 68, 68, 0.3)",
                borderRadius: "50%",
                padding: "12px",
                display: "flex"
              }}>
                <ShieldAlert size={32} style={{ color: "#ef4444" }} />
              </div>
              <div>
                <h2 style={{ fontSize: "1.4rem", fontWeight: 700, margin: 0, color: "#f8fafc" }}>
                  Application Error Encountered
                </h2>
                <p style={{ fontSize: "0.85rem", color: "#94a3b8", margin: "4px 0 0 0" }}>
                  An unexpected error occurred during rendering. Details are shown below:
                </p>
              </div>
            </div>

            <div style={{
              background: "rgba(0, 0, 0, 0.4)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              borderRadius: "8px",
              padding: "16px",
              marginBottom: "24px",
              fontFamily: "monospace",
              fontSize: "0.85rem",
              color: "#fca5a5",
              overflowX: "auto",
              whiteSpace: "pre-wrap"
            }}>
              <strong>Error:</strong> {this.state.error?.toString() || "Unknown JavaScript Error"}
              {this.state.errorInfo?.componentStack && (
                <details style={{ marginTop: "10px", color: "#94a3b8", cursor: "pointer" }}>
                  <summary style={{ fontSize: "0.8rem", color: "#cbd5e1" }}>View Component Stack Trace</summary>
                  <pre style={{ fontSize: "0.75rem", marginTop: "8px", color: "#94a3b8" }}>
                    {this.state.errorInfo.componentStack}
                  </pre>
                </details>
              )}
            </div>

            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
              <button
                onClick={() => window.location.reload()}
                style={{
                  background: "#2563eb",
                  color: "#fff",
                  border: "none",
                  borderRadius: "8px",
                  padding: "10px 20px",
                  fontSize: "0.9rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px"
                }}
              >
                <RefreshCw size={16} /> Reload Page
              </button>

              <button
                onClick={this.handleReset}
                style={{
                  background: "rgba(255, 255, 255, 0.1)",
                  color: "#e2e8f0",
                  border: "1px solid rgba(255, 255, 255, 0.2)",
                  borderRadius: "8px",
                  padding: "10px 20px",
                  fontSize: "0.9rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px"
                }}
              >
                <Home size={16} /> Reset View & Refresh
              </button>

              <button
                onClick={this.handleGoLogin}
                style={{
                  background: "rgba(239, 68, 68, 0.15)",
                  color: "#fca5a5",
                  border: "1px solid rgba(239, 68, 68, 0.3)",
                  borderRadius: "8px",
                  padding: "10px 20px",
                  fontSize: "0.9rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px"
                }}
              >
                <LogIn size={16} /> Return to Login
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
