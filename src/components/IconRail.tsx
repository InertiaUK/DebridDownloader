import { useRef, useState, useEffect } from "react";
import { useAuth } from "../hooks/useAuth";

interface IconRailProps {
  activeView: string;
  onViewChange: (view: string) => void;
  onSearchOpen: () => void;
  onSettingsOpen: () => void;
}

export default function IconRail({
  activeView,
  onViewChange,
  onSearchOpen,
  onSettingsOpen,
}: IconRailProps) {
  const { user, logout } = useAuth();
  const [popoverOpen, setPopoverOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const avatarRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!popoverOpen) return;

    function handleMouseDown(e: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        avatarRef.current &&
        !avatarRef.current.contains(e.target as Node)
      ) {
        setPopoverOpen(false);
      }
    }

    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [popoverOpen]);

  const navItems = [
    {
      id: "torrents",
      title: "Torrents",
      onClick: () => onViewChange("torrents"),
      icon: (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
      ),
    },
    {
      id: "downloads",
      title: "Downloads",
      onClick: () => onViewChange("downloads"),
      icon: (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
          <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
        </svg>
      ),
    },
    {
      id: "search",
      title: "Search",
      onClick: onSearchOpen,
      icon: (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      ),
    },
    {
      id: "settings",
      title: "Settings",
      onClick: onSettingsOpen,
      icon: (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="3" />
          <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
        </svg>
      ),
    },
  ];

  return (
    <aside
      className="w-12 h-full flex flex-col items-center py-3 shrink-0"
      style={{
        backgroundColor: "#06060b",
        borderRight: "1px solid rgba(255,255,255,0.04)",
        boxShadow: "0 1px 2px rgba(0,0,0,0.4)",
      }}
    >
      {/* Logo */}
      <div
        className="w-7 h-7 rounded-lg flex items-center justify-center mb-4 shrink-0"
        style={{ backgroundColor: "#10b981" }}
      >
        <span className="text-white font-bold text-sm leading-none">D</span>
      </div>

      {/* Nav icons */}
      <div className="flex flex-col items-center gap-1.5 flex-1">
        {navItems.map((item) => {
          const isActive =
            (item.id === "torrents" || item.id === "downloads") &&
            activeView === item.id;

          return (
            <button
              key={item.id}
              title={item.title}
              onClick={item.onClick}
              className="w-9 h-9 rounded-lg flex items-center justify-center transition-colors duration-150"
              style={
                isActive
                  ? {
                      backgroundColor: "rgba(16,185,129,0.08)",
                      color: "#10b981",
                    }
                  : undefined
              }
              onMouseEnter={(e) => {
                if (!isActive) {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                    "rgba(255,255,255,0.04)";
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                    "transparent";
                }
              }}
            >
              <span
                style={
                  isActive ? { color: "#10b981" } : { color: "#374151" }
                }
              >
                {item.icon}
              </span>
            </button>
          );
        })}
      </div>

      {/* User avatar + popover */}
      <div className="relative shrink-0">
        <button
          ref={avatarRef}
          onClick={() => setPopoverOpen((prev) => !prev)}
          className="flex items-center justify-center focus:outline-none"
          title={user?.username ?? "Account"}
        >
          {user?.avatar ? (
            <img
              src={user.avatar}
              alt={user.username}
              className="w-7 h-7 rounded-full"
            />
          ) : (
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center font-bold"
              style={{
                backgroundColor: "rgba(16,185,129,0.15)",
                color: "#10b981",
                fontSize: "10px",
              }}
            >
              {user?.username?.charAt(0).toUpperCase() ?? "?"}
            </div>
          )}
        </button>

        {popoverOpen && (
          <div
            ref={popoverRef}
            className="absolute rounded-lg p-3 w-48"
            style={{
              bottom: "2.5rem",
              left: "0.25rem",
              backgroundColor: "#0f0f18",
              border: "1px solid rgba(255,255,255,0.06)",
              zIndex: 50,
            }}
          >
            <p
              className="font-medium truncate"
              style={{ fontSize: "13px", color: "#f1f5f9" }}
            >
              {user?.username}
            </p>
            {user?.expiration && (
              <p style={{ fontSize: "11px", color: "#475569" }}>
                Premium until{" "}
                {new Date(user.expiration).toLocaleDateString()}
              </p>
            )}
            <button
              onClick={async () => {
                setPopoverOpen(false);
                await logout();
              }}
              className="w-full text-left rounded-md px-2 py-1.5 mt-2 transition-colors duration-150"
              style={{ fontSize: "12px", color: "#ef4444" }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                  "rgba(239,68,68,0.08)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                  "transparent";
              }}
            >
              Logout
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
