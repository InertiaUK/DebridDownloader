import { useState } from "react";
import { useAuth } from "../hooks/useAuth";

export default function AuthPage() {
  const { login, loginOAuth } = useAuth();
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"token" | "oauth">("token");
  const [oauthStatus, setOauthStatus] = useState("");

  const handleTokenLogin = async () => {
    if (!token.trim()) {
      setError("Please enter your API token");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await login(token.trim());
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthLogin = async () => {
    setLoading(true);
    setError("");
    setOauthStatus("Starting OAuth flow...");
    try {
      await loginOAuth();
    } catch (e) {
      setError(String(e));
      setOauthStatus("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center h-screen bg-rd-darker">
      <div className="w-full max-w-md p-8 bg-rd-dark rounded-2xl border border-rd-border shadow-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-rd-green mb-2">
            DebridDownloader
          </h1>
          <p className="text-zinc-400 text-sm">
            Connect your Real-Debrid account
          </p>
        </div>

        {/* Mode toggle */}
        <div className="flex mb-6 bg-rd-darker rounded-lg p-1">
          <button
            className={`flex-1 py-2 text-sm rounded-md transition-colors ${
              mode === "token"
                ? "bg-rd-green text-black font-semibold"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
            onClick={() => setMode("token")}
          >
            API Token
          </button>
          <button
            className={`flex-1 py-2 text-sm rounded-md transition-colors ${
              mode === "oauth"
                ? "bg-rd-green text-black font-semibold"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
            onClick={() => setMode("oauth")}
          >
            OAuth Login
          </button>
        </div>

        {mode === "token" ? (
          <div>
            <label className="block text-sm text-zinc-300 mb-2">
              API Token
            </label>
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleTokenLogin()}
              placeholder="Paste your token from real-debrid.com/apitoken"
              className="w-full px-4 py-3 bg-rd-darker border border-rd-border rounded-lg text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-rd-green text-sm"
            />
            <p className="text-xs text-zinc-500 mt-2">
              Get your token at{" "}
              <span className="text-rd-green">real-debrid.com/apitoken</span>
            </p>
            <button
              onClick={handleTokenLogin}
              disabled={loading}
              className="w-full mt-4 py-3 bg-rd-green text-black font-semibold rounded-lg hover:bg-green-400 transition-colors disabled:opacity-50"
            >
              {loading ? "Connecting..." : "Connect"}
            </button>
          </div>
        ) : (
          <div>
            <p className="text-sm text-zinc-400 mb-4">
              Authenticate via Real-Debrid's device authorization. A browser
              window will open for you to approve access.
            </p>
            {oauthStatus && (
              <p className="text-sm text-cyan-400 mb-4">{oauthStatus}</p>
            )}
            <button
              onClick={handleOAuthLogin}
              disabled={loading}
              className="w-full py-3 bg-rd-green text-black font-semibold rounded-lg hover:bg-green-400 transition-colors disabled:opacity-50"
            >
              {loading ? "Waiting for authorization..." : "Start OAuth Login"}
            </button>
          </div>
        )}

        {error && (
          <p className="mt-4 text-sm text-red-400 text-center">{error}</p>
        )}
      </div>
    </div>
  );
}
