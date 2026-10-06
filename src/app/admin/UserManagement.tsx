"use client";

import React, { useEffect, useMemo, useState } from "react";
import { describeError } from "@/services/db";
import { useAuthStore } from "@/store/useAuthStore";
import { useAppStore } from "@/store/useAppStore";
import {
  addAllowedUser,
  fetchAllowedUsers,
  updateAllowedUserAssignedSites,
  updateAllowedUserRole,
  removeAllowedUser,
  type AllowedUser,
  type UserRole,
} from "@/services/auth-users";
import { Loader2, UserPlus, Trash2, Shield, ShieldCheck } from "lucide-react";

export default function UserManagement() {
  const { user, refreshAccess } = useAuthStore();
  const { sites } = useAppStore();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<UserRole>("user");
  const [selectedAssignedSites, setSelectedAssignedSites] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{
    type: "error" | "success";
    text: string;
  } | null>(null);
  const [users, setUsers] = useState<AllowedUser[]>([]);
  const [assignmentDrafts, setAssignmentDrafts] = useState<Record<string, string[]>>({});

  const activeSites = useMemo(
    () => sites.filter((site) => site.isActive).sort((a, b) => a.order - b.order),
    [sites],
  );

  const normalizeSiteIds = (ids: string[]) =>
    Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean)));

  const toggleSiteId = (ids: string[], siteId: string): string[] => {
    const next = new Set(normalizeSiteIds(ids));
    if (next.has(siteId)) next.delete(siteId);
    else next.add(siteId);
    return Array.from(next);
  };

  // Load the full allowlist on mount and after every mutation. The store's
  // `allowedUsers` only ever holds the signed-in user's own record, so the
  // admin panel must fetch the full list explicitly.
  const loadUsers = async () => {
    try {
      const loadedUsers = await fetchAllowedUsers();
      setUsers(loadedUsers);
      setAssignmentDrafts(
        Object.fromEntries(
          loadedUsers.map((u) => [u.email, normalizeSiteIds(u.assignedSiteIds ?? [])]),
        ),
      );
    } catch (error) {
      console.error("Failed to load allowlist:", error);
      setMsg({ type: "error", text: describeError(error) });
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const myEmail = user?.email?.trim().toLowerCase();

  const run = async (fn: () => Promise<void>, ok: string) => {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      await refreshAccess();
      await loadUsers();
      setMsg({ type: "success", text: ok });
    } catch (error) {
      console.error("User management error:", error);
      setMsg({
        type: "error",
        text: describeError(error),
      });
    } finally {
      setBusy(false);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const em = email.trim().toLowerCase();
    if (!em || !em.includes("@")) {
      setMsg({ type: "error", text: "Enter a valid email address." });
      return;
    }
    if (users.some((u) => u.email === em)) {
      setMsg({ type: "error", text: `${em} is already in the access list.` });
      return;
    }
    await run(
      () =>
        addAllowedUser(
          em,
          role,
          user?.email || "",
          role === "user" ? selectedAssignedSites : [],
        ),
      `Added ${em} as ${role}.`,
    );
    setEmail("");
    setSelectedAssignedSites([]);
  };

  const handleRoleChange = async (em: string, next: UserRole) => {
    if (em === myEmail) {
      setMsg({ type: "error", text: "You cannot change your own role." });
      return;
    }
    await run(
      () => updateAllowedUserRole(em, next),
      `Updated ${em} to ${next}.`,
    );
  };

  const handleRemove = async (em: string) => {
    if (em === myEmail) {
      setMsg({
        type: "error",
        text: "You cannot remove yourself.",
      });
      return;
    }
    await run(() => removeAllowedUser(em), `Removed ${em}.`);
  };

  const handleAssignmentDraftChange = (emailKey: string, ids: string[]) => {
    setAssignmentDrafts((prev) => ({
      ...prev,
      [emailKey]: normalizeSiteIds(ids),
    }));
  };

  const handleAssignmentSave = async (em: string) => {
    const nextIds = normalizeSiteIds(assignmentDrafts[em] ?? []);
    await run(
      () => updateAllowedUserAssignedSites(em, nextIds),
      nextIds.length > 0
        ? `Updated assigned sites for ${em}.`
        : `Cleared assigned sites for ${em}.`,
    );
  };

  const sorted = [...users].sort((a, b) =>
    a.email.localeCompare(b.email),
  );
  return (
    <div className="bg-card border border-border rounded-xl mt-6 overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-foreground flex items-center gap-2">
            <Shield size={17} /> User Management
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Only emails on this list can sign in and use the app.
          </p>
        </div>
        {busy && (
          <Loader2 size={18} className="animate-spin text-muted-foreground" />
        )}
      </div>

      <div className="px-5 pt-4">
        <form onSubmit={handleAdd} className="flex flex-col gap-2">
          <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="user@example.com"
            className="flex-1 px-3 py-2 rounded-md border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <select
            value={role}
            onChange={(e) => {
              const nextRole = e.target.value as UserRole;
              setRole(nextRole);
              if (nextRole !== "user") setSelectedAssignedSites([]);
            }}
            className="px-3 py-2 rounded-md border border-border bg-input text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </select>
          <button
            type="submit"
            disabled={busy}
            className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60"
          >
            <UserPlus size={15} />
            Add
          </button>
          </div>

          {role === "user" && (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Assigned Sites
              </label>
              <div className="max-h-40 overflow-auto rounded-md border border-border bg-input p-2">
                {activeSites.length === 0 ? (
                  <p className="text-xs text-muted-foreground px-1 py-0.5">
                    No active sites found.
                  </p>
                ) : (
                  activeSites.map((site) => {
                    const checked = selectedAssignedSites.includes(site.id);
                    return (
                      <label
                        key={site.id}
                        className="flex items-center gap-2 px-1.5 py-1 rounded hover:bg-secondary/60 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            setSelectedAssignedSites((prev) =>
                              toggleSiteId(prev, site.id),
                            )
                          }
                          className="h-3.5 w-3.5"
                        />
                        <span className="text-sm text-foreground">{site.name}</span>
                      </label>
                    );
                  })
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Tick one or more sites. Users can only access assigned sites.
              </p>
            </div>
          )}
        </form>
        {msg && (
          <p
            className={`mt-2 text-xs ${msg.type === "error" ? "text-red-500" : "text-green-600 dark:text-green-400"}`}
          >
            {msg.text}
          </p>
        )}
      </div>

      <div className="px-2 py-2 mt-2">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Email
              </th>
              <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Role
              </th>
              <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Assigned Sites
              </th>
              <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wide w-32">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((u) => {
              const isMe = u.email === myEmail;
              return (
                <tr
                  key={u.email}
                  className="border-b border-border last:border-0"
                >
                  <td className="px-3 py-2 text-foreground">
                    {u.email}
                    {isMe && (
                      <span className="ml-1.5 text-xs text-primary">(you)</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                        u.role === "admin"
                          ? "bg-primary/10 text-primary"
                          : "bg-secondary text-muted-foreground"
                      }`}
                    >
                      {u.role === "admin" ? (
                        <ShieldCheck size={12} />
                      ) : (
                        <Shield size={12} />
                      )}
                      {u.role}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    {u.role === "admin" || u.role === "admin_viewer" ? (
                      <span className="text-xs text-muted-foreground">All sites (admin access)</span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <div className="max-h-32 min-w-56 overflow-auto rounded-md border border-border bg-input p-1.5">
                          {activeSites.length === 0 ? (
                            <p className="text-xs text-muted-foreground px-1 py-0.5">
                              No active sites found.
                            </p>
                          ) : (
                            activeSites.map((site) => {
                              const checked = (assignmentDrafts[u.email] ?? []).includes(site.id);
                              return (
                                <label
                                  key={site.id}
                                  className="flex items-center gap-2 px-1.5 py-1 rounded hover:bg-secondary/60 cursor-pointer"
                                >
                                  <input
                                    type="checkbox"
                                    disabled={busy}
                                    checked={checked}
                                    onChange={() =>
                                      handleAssignmentDraftChange(
                                        u.email,
                                        toggleSiteId(assignmentDrafts[u.email] ?? [], site.id),
                                      )
                                    }
                                    className="h-3.5 w-3.5"
                                  />
                                  <span className="text-xs text-foreground">{site.name}</span>
                                </label>
                              );
                            })
                          )}
                        </div>
                        <button
                          onClick={() => handleAssignmentSave(u.email)}
                          disabled={busy}
                          className="px-2.5 py-1.5 rounded-md border border-border text-xs text-foreground hover:bg-secondary transition-colors disabled:opacity-40"
                        >
                          Save
                        </button>
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() =>
                          handleRoleChange(
                            u.email,
                            u.role === "admin" ? "user" : "admin",
                          )
                        }
                        disabled={busy || isMe}
                        title={u.role === "admin" ? "Make user" : "Make admin"}
                        className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-40"
                      >
                        {u.role === "admin" ? (
                          <Shield size={14} />
                        ) : (
                          <ShieldCheck size={14} />
                        )}
                      </button>
                      <button
                        onClick={() => handleRemove(u.email)}
                        disabled={
                          busy || isMe
                        }
                        title="Remove access"
                        className="p-1.5 rounded text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-40"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
