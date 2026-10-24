import { useEffect, useRef, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { getAdminUsers, updateUserStatus } from "../../services/adminService";

function formatDate(value) {
  if (!value) return "Never";
  return new Intl.DateTimeFormat("en-IN", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function AdminUsers() {
  const { user: currentUser } = useAuth();

  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Live autocomplete states
  const [suggestions, setSuggestions] = useState([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionsError, setSuggestionsError] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const searchContainerRef = useRef(null);
  const debounceTimerRef = useRef(null);
  const requestIdRef = useRef(0);

  // Modal confirmation state
  const [confirmTarget, setConfirmTarget] = useState(null); // { user, nextStatus }
  const [updating, setUpdating] = useState(false);

  const loadUsers = useCallback(async (searchQuery = "") => {
    try {
      setLoading(true);
      setError("");
      const data = await getAdminUsers(searchQuery);
      setUsers(data.users || []);
    } catch (err) {
      setError(err.message || "Failed to load registered users.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isCancelled = false;

    async function init() {
      try {
        setError("");
        const data = await getAdminUsers("");
        if (!isCancelled) {
          setUsers(data.users || []);
        }
      } catch (err) {
        if (!isCancelled) {
          setError(err.message || "Failed to load registered users.");
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    }

    init();

    return () => {
      isCancelled = true;
    };
  }, []);

  // Debounced live autocomplete suggestion fetcher
  const fetchSuggestions = useCallback((query) => {
    clearTimeout(debounceTimerRef.current);
    const trimmed = query.trim();

    if (!trimmed) {
      setSuggestions([]);
      setIsDropdownOpen(false);
      setSuggestionsLoading(false);
      setSuggestionsError("");
      return;
    }

    setIsDropdownOpen(true);
    setSuggestionsLoading(true);
    setSuggestionsError("");
    setHighlightedIndex(-1);

    const currentReqId = ++requestIdRef.current;

    debounceTimerRef.current = setTimeout(async () => {
      try {
        const data = await getAdminUsers(trimmed);
        if (currentReqId === requestIdRef.current) {
          const list = (data.users || []).slice(0, 6);
          setSuggestions(list);
          setSuggestionsLoading(false);
        }
      } catch (err) {
        if (currentReqId === requestIdRef.current) {
          setSuggestionsError(err.message || "Failed to load suggestions.");
          setSuggestionsLoading(false);
        }
      }
    }, 300);
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target)
      ) {
        setIsDropdownOpen(false);
        setHighlightedIndex(-1);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      clearTimeout(debounceTimerRef.current);
    };
  }, []);

  function handleInputChange(e) {
    const val = e.target.value;
    setSearch(val);
    fetchSuggestions(val);
  }

  function handleInputFocus() {
    if (search.trim()) {
      setIsDropdownOpen(true);
      if (suggestions.length === 0 && !suggestionsLoading && !suggestionsError) {
        fetchSuggestions(search);
      }
    }
  }

  function handleSelectSuggestion(selectedUser) {
    clearTimeout(debounceTimerRef.current);
    requestIdRef.current += 1;
    setSearch(selectedUser.username);
    setIsDropdownOpen(false);
    setSuggestions([]);
    setHighlightedIndex(-1);
    loadUsers(selectedUser.username);
  }

  function handleKeyDown(e) {
    if (!isDropdownOpen) {
      if (e.key === "ArrowDown" && search.trim()) {
        e.preventDefault();
        setIsDropdownOpen(true);
        if (suggestions.length === 0 && !suggestionsLoading) {
          fetchSuggestions(search);
        }
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (suggestions.length > 0) {
        setHighlightedIndex((prev) => (prev + 1) % suggestions.length);
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (suggestions.length > 0) {
        setHighlightedIndex((prev) =>
          prev <= 0 ? suggestions.length - 1 : prev - 1
        );
      }
    } else if (e.key === "Enter") {
      if (highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
        e.preventDefault();
        handleSelectSuggestion(suggestions[highlightedIndex]);
      } else {
        // Submit raw search
        setIsDropdownOpen(false);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setIsDropdownOpen(false);
      setHighlightedIndex(-1);
    }
  }

  function handleSearchSubmit(e) {
    e.preventDefault();
    clearTimeout(debounceTimerRef.current);
    requestIdRef.current += 1;
    setIsDropdownOpen(false);
    setHighlightedIndex(-1);
    loadUsers(search);
  }

  function handleSearchClear() {
    clearTimeout(debounceTimerRef.current);
    requestIdRef.current += 1;
    setSearch("");
    setSuggestions([]);
    setIsDropdownOpen(false);
    setHighlightedIndex(-1);
    setSuggestionsLoading(false);
    setSuggestionsError("");
    loadUsers("");
  }

  function promptStatusChange(targetUser, nextStatus) {
    if (targetUser.id === currentUser?.id) {
      setError("You cannot change the active status of your own account.");
      return;
    }
    setConfirmTarget({ user: targetUser, nextStatus });
  }

  async function handleConfirmStatusChange() {
    if (!confirmTarget) return;

    const { user: targetUser, nextStatus } = confirmTarget;

    try {
      setUpdating(true);
      setError("");
      setSuccessMessage("");

      const res = await updateUserStatus(targetUser.id, nextStatus);

      // Update in local state
      setUsers((prev) =>
        prev.map((u) => (u.id === targetUser.id ? { ...u, is_active: nextStatus } : u))
      );

      setSuccessMessage(
        res.detail ||
          `User '${targetUser.username}' has been ${nextStatus ? "activated" : "deactivated"}.`
      );
      setConfirmTarget(null);
    } catch (err) {
      setError(err.message || "Failed to update user account status.");
    } finally {
      setUpdating(false);
    }
  }

  return (
    <div className="space-y-8 pb-16 max-w-6xl">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Link
              to="/dashboard/admin"
              className="text-xs font-mono text-muted hover:text-ink transition-colors"
            >
              ← Admin Overview
            </Link>
          </div>
          <h1 className="mt-1 font-serif text-3xl sm:text-4xl text-ink">
            User Management
          </h1>
          <p className="mt-1 text-sm text-muted">
            Inspect registered Prompt Lab accounts, monitor activity, and manage access statuses.
          </p>
        </div>

        <button
          type="button"
          onClick={() => loadUsers(search)}
          className="w-fit rounded-control border border-border bg-surface px-3 py-2 text-xs font-medium text-ink hover:border-brand hover:text-brand transition-colors"
        >
          Refresh Users
        </button>
      </div>

      {/* Success Notification */}
      {successMessage && (
        <div className="flex items-center justify-between rounded-card border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs font-medium text-emerald-800">
          <span>{successMessage}</span>
          <button
            type="button"
            onClick={() => setSuccessMessage("")}
            className="text-emerald-700 hover:text-emerald-950 p-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* Error Notification */}
      {error && (
        <div className="flex items-center justify-between rounded-card border border-error/20 bg-error/5 p-4 text-xs font-medium text-error">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError("")}
            className="text-error hover:opacity-80 p-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* Search and Filters Bar with Live Autocomplete */}
      <div className="relative z-20 rounded-card border border-border bg-surface p-4 shadow-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <form onSubmit={handleSearchSubmit} className="flex flex-1 items-center gap-2 max-w-lg">
          <div ref={searchContainerRef} className="relative flex-1">
            <input
              type="text"
              role="combobox"
              aria-expanded={isDropdownOpen}
              aria-autocomplete="list"
              aria-controls="user-autocomplete-list"
              aria-activedescendant={
                highlightedIndex >= 0 ? `suggestion-${highlightedIndex}` : undefined
              }
              value={search}
              onChange={handleInputChange}
              onFocus={handleInputFocus}
              onKeyDown={handleKeyDown}
              placeholder="Search by username, email, or name..."
              className="w-full rounded-control border border-border bg-background px-3 py-2 pl-9 pr-8 text-xs font-mono text-ink outline-none transition-colors focus:border-brand placeholder:text-muted/60"
            />
            <svg
              className="absolute left-3 top-2.5 h-4 w-4 text-muted"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            {search && (
              <button
                type="button"
                onClick={handleSearchClear}
                className="absolute right-2.5 top-2 text-xs text-muted hover:text-ink"
                title="Clear search"
              >
                ✕
              </button>
            )}

            {/* Live Autocomplete Dropdown */}
            {isDropdownOpen && search.trim() && (
              <div
                id="user-autocomplete-list"
                role="listbox"
                className="absolute left-0 right-0 top-full mt-1.5 z-50 rounded-card border border-border bg-surface shadow-xl overflow-hidden max-h-80 flex flex-col"
              >
                {/* Header */}
                <div className="flex items-center justify-between border-b border-border bg-background/50 px-3.5 py-1.5 font-mono text-[10px] uppercase tracking-wider text-muted">
                  <span>Matching Users</span>
                  <span className="hidden sm:inline text-[9px] text-muted/70">
                    ↑↓ navigate · Enter select · Esc close
                  </span>
                </div>

                {/* Body: Loading / Error / Empty / Results */}
                {suggestionsLoading ? (
                  <div className="flex items-center justify-center gap-2.5 p-5 text-muted">
                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-brand/40 border-t-brand" />
                    <span className="font-mono text-xs">Searching accounts...</span>
                  </div>
                ) : suggestionsError ? (
                  <div className="p-4 text-center">
                    <p className="font-mono text-xs text-error">{suggestionsError}</p>
                    <button
                      type="button"
                      onClick={() => fetchSuggestions(search)}
                      className="mt-2 font-mono text-[10px] text-brand underline underline-offset-4"
                    >
                      Retry search
                    </button>
                  </div>
                ) : suggestions.length === 0 ? (
                  <div className="p-5 text-center">
                    <p className="font-serif text-sm text-ink">No matching users</p>
                    <p className="mt-1 text-xs text-muted">
                      No accounts matched &ldquo;<span className="font-semibold text-ink">{search}</span>&rdquo;
                    </p>
                  </div>
                ) : (
                  <ul className="divide-y divide-border/50 overflow-y-auto">
                    {suggestions.map((sUser, idx) => {
                      const isSelected = highlightedIndex === idx;
                      const isCurrent = sUser.id === currentUser?.id;
                      const isAdministrator = sUser.is_superuser || sUser.is_staff;

                      return (
                        <li
                          key={sUser.id}
                          id={`suggestion-${idx}`}
                          role="option"
                          aria-selected={isSelected}
                          onMouseEnter={() => setHighlightedIndex(idx)}
                          onClick={() => handleSelectSuggestion(sUser)}
                          className={`flex items-center justify-between gap-3 px-3.5 py-2.5 cursor-pointer transition-colors ${
                            isSelected
                              ? "bg-brand/5 border-l-2 border-l-brand"
                              : "hover:bg-background/60"
                          }`}
                        >
                          {/* Left: Avatar + Name + Username/Email */}
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand/10 font-mono text-xs font-semibold text-brand">
                              {(sUser.name?.[0] || sUser.username?.[0] || "?").toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 truncate">
                                <span className="font-semibold text-ink text-xs truncate">
                                  {sUser.name || sUser.username}
                                </span>
                                {isCurrent && (
                                  <span className="shrink-0 rounded bg-brand/10 px-1.5 py-0.2 font-mono text-[9px] uppercase tracking-wider text-brand">
                                    You
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1 font-mono text-[10px] text-muted truncate">
                                <span>@{sUser.username}</span>
                                <span>·</span>
                                <span className="truncate">{sUser.email}</span>
                              </div>
                            </div>
                          </div>

                          {/* Right: Role & Status Badges */}
                          <div className="flex shrink-0 items-center gap-1.5">
                            {isAdministrator && (
                              <span className="rounded-full border border-brand/30 bg-brand/10 px-1.5 py-0.5 font-mono text-[9px] font-semibold text-brand">
                                {sUser.is_superuser ? "Superuser" : "Staff"}
                              </span>
                            )}
                            {sUser.is_active ? (
                              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 font-mono text-[9px] font-medium text-emerald-700">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                                Active
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 font-mono text-[9px] font-medium text-amber-700">
                                <span className="h-1.5 w-1.5 rounded-full bg-amber-600" />
                                Inactive
                              </span>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}

                {/* Footer showing match count */}
                {suggestions.length > 0 && !suggestionsLoading && (
                  <div className="border-t border-border bg-background/30 px-3.5 py-1 text-right font-mono text-[10px] text-muted">
                    Showing top {suggestions.length} match{suggestions.length === 1 ? "" : "es"}
                  </div>
                )}
              </div>
            )}
          </div>

          <button
            type="submit"
            className="rounded-control bg-ink px-4 py-2 text-xs font-semibold text-white hover:opacity-90 transition-opacity shrink-0"
          >
            Search
          </button>
        </form>

        <div className="font-mono text-xs text-muted">
          Showing <span className="font-semibold text-ink">{users.length}</span> account{users.length === 1 ? "" : "s"}
        </div>
      </div>

      {/* User Accounts Table */}
      <div className="overflow-hidden rounded-card border border-border bg-surface shadow-subtle">
        {loading ? (
          <div className="p-12 text-center">
            <span className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-brand/40 border-t-brand" />
            <p className="mt-3 font-mono text-xs text-muted">
              Loading user accounts...
            </p>
          </div>
        ) : users.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <p className="font-serif text-lg text-ink">No users found</p>
            <p className="text-xs text-muted">
              {search
                ? `No accounts matched your search "${search}". Try searching for another name or email.`
                : "No registered accounts found in the database."}
            </p>
            {search && (
              <button
                type="button"
                onClick={handleSearchClear}
                className="mt-2 text-xs text-brand underline underline-offset-4"
              >
                Clear search filter
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border bg-background/50 font-mono text-[10px] uppercase tracking-wider text-muted">
                  <th className="px-5 py-3">User</th>
                  <th className="px-5 py-3">Email</th>
                  <th className="px-5 py-3">Role</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Registered</th>
                  <th className="px-5 py-3">Last Login</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {users.map((targetUser) => {
                  const isCurrent = targetUser.id === currentUser?.id;
                  const isAdministrator =
                    targetUser.is_superuser || targetUser.is_staff;

                  return (
                    <tr
                      key={targetUser.id}
                      className="hover:bg-background/40 transition-colors"
                    >
                      {/* Name & Username */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand/10 font-mono text-xs font-semibold text-brand">
                            {(targetUser.name?.[0] || targetUser.username?.[0] || "?").toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold text-ink">
                              {targetUser.name || targetUser.username}
                              {isCurrent && (
                                <span className="ml-1.5 rounded bg-brand/10 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-brand">
                                  You
                                </span>
                              )}
                            </p>
                            <p className="font-mono text-[10px] text-muted">
                              @{targetUser.username}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Email */}
                      <td className="px-5 py-4 font-mono text-xs text-ink break-all">
                        {targetUser.email}
                      </td>

                      {/* Role Badge */}
                      <td className="px-5 py-4">
                        {isAdministrator ? (
                          <span className="inline-flex items-center rounded-full border border-brand/30 bg-brand/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-brand">
                            {targetUser.is_superuser ? "Superuser" : "Staff"}
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full border border-border bg-background px-2 py-0.5 font-mono text-[10px] text-muted">
                            Member
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-5 py-4">
                        {targetUser.is_active ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] font-medium text-emerald-700">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 font-mono text-[10px] font-medium text-amber-700">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-600" />
                            Inactive
                          </span>
                        )}
                      </td>

                      {/* Registration Date */}
                      <td className="px-5 py-4 font-mono text-[11px] text-muted">
                        {formatDate(targetUser.date_joined)}
                      </td>

                      {/* Last Login */}
                      <td className="px-5 py-4 font-mono text-[11px] text-muted">
                        {formatDate(targetUser.last_login)}
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-4 text-right">
                        {isCurrent ? (
                          <span
                            className="font-mono text-[11px] text-muted/60"
                            title="You cannot deactivate your own account"
                          >
                            Current Account
                          </span>
                        ) : targetUser.is_active ? (
                          <button
                            type="button"
                            onClick={() => promptStatusChange(targetUser, false)}
                            className="rounded-control border border-border px-3 py-1 text-xs font-medium text-ink hover:border-rose-400 hover:bg-rose-50 hover:text-rose-700 transition-colors"
                          >
                            Deactivate
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => promptStatusChange(targetUser, true)}
                            className="rounded-control border border-emerald-500/30 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors"
                          >
                            Activate
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {confirmTarget && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4"
        >
          <div className="w-full max-w-md rounded-card border border-border bg-surface p-6 shadow-xl space-y-4">
            <div>
              <h3 className="font-serif text-xl text-ink">
                Confirm Account {confirmTarget.nextStatus ? "Activation" : "Deactivation"}
              </h3>
              <p className="mt-2 text-xs text-muted leading-relaxed">
                Are you sure you want to {confirmTarget.nextStatus ? "activate" : "deactivate"}{" "}
                <span className="font-semibold text-ink">{confirmTarget.user.username}</span> (
                {confirmTarget.user.email})?
              </p>
              {!confirmTarget.nextStatus && (
                <p className="mt-2 rounded border border-amber-500/20 bg-amber-500/5 p-2.5 text-[11px] text-amber-800">
                  ⚠️ Deactivating this user will prevent them from signing in or executing prompts.
                  Their saved prompts and historical executions remain safely stored.
                </p>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <button
                type="button"
                disabled={updating}
                onClick={() => setConfirmTarget(null)}
                className="rounded-control border border-border px-3.5 py-1.5 text-xs text-muted hover:text-ink transition-colors disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={updating}
                onClick={handleConfirmStatusChange}
                className={`rounded-control px-4 py-1.5 text-xs font-semibold text-white transition-opacity disabled:opacity-50 ${
                  confirmTarget.nextStatus
                    ? "bg-emerald-600 hover:opacity-90"
                    : "bg-rose-600 hover:opacity-90"
                }`}
              >
                {updating
                  ? "Updating..."
                  : confirmTarget.nextStatus
                  ? "Confirm Activation"
                  : "Confirm Deactivation"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
