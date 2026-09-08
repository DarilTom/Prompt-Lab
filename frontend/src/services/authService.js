import { apiRequest } from "./api";
import {
  clearTokens,
  getAccessToken as readAccessToken,
  getRefreshToken,
  setAccessToken,
  setTokens,
} from "./tokenService";

export async function registerUser({
  name,
  email,
  password,
  password_confirm,
}) {
  return apiRequest("/auth/register/", {
    method: "POST",
    body: JSON.stringify({
      name,
      email,
      password,
      password_confirm,
    }),
  });
}

export async function loginUser({ email, password }) {
  const data = await apiRequest("/auth/login/", {
    method: "POST",
    body: JSON.stringify({
      email,
      password,
    }),
  });

  setTokens(data);

  return data;
}

export async function getCurrentUser() {
  const accessToken = readAccessToken();

  if (!accessToken) {
    return null;
  }

  return apiRequest("/auth/me/", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

export async function refreshAccessToken() {
  const refreshToken = getRefreshToken();

  if (!refreshToken) {
    return null;
  }

  const response = await fetch(
    "http://127.0.0.1:8000/api/auth/token/refresh/",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        refresh: refreshToken,
      }),
    },
  );

  if (!response.ok) {
    clearTokens();
    return null;
  }

  const data = await response.json();

  setAccessToken(data.access);

  return data.access;
}

/*
 * Kept as getAccessToken because AuthContext already
 * expects this public function from authService.
 */
export function getAccessToken() {
  return readAccessToken();
}

export function logoutUser() {
  clearTokens();
}

export async function requestPasswordReset(email) {
  return apiRequest("/auth/password-reset/", {
    method: "POST",
    body: JSON.stringify({
      email,
    }),
  });
}

export async function confirmPasswordReset({
  uid,
  token,
  password,
  password_confirm,
}) {
  return apiRequest(
    `/auth/password-reset-confirm/${uid}/${token}/`,
    {
      method: "POST",
      body: JSON.stringify({
        password,
        password_confirm,
      }),
    }
  );
}

export async function loginWithGoogle(credential) {
  const data = await apiRequest("/auth/google/", {
    method: "POST",
    body: JSON.stringify({ credential }),
  });

  setTokens(data);
  return data;
}