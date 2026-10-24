import { apiRequest } from "./api";

/**
 * Fetch aggregate statistics for the Admin Dashboard.
 */
export async function getAdminStats() {
  return apiRequest("/admin/stats/");
}

/**
 * Fetch list of registered users with optional search term.
 */
export async function getAdminUsers(search = "") {
  const query = search.trim() ? `?search=${encodeURIComponent(search.trim())}` : "";
  return apiRequest(`/admin/users/${query}`);
}

/**
 * Update a user's active status (activate or deactivate).
 */
export async function updateUserStatus(userId, isActive) {
  return apiRequest(`/admin/users/${userId}/status/`, {
    method: "PATCH",
    body: JSON.stringify({ is_active: isActive }),
  });
}
