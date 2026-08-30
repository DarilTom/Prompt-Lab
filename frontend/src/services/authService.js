import { apiRequest } from "./api";

const ACCESS_TOKEN_KEY = "prompt_lab_access";
const REFRESH_TOKEN_KEY = "prompt_lab_refresh";

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

  sessionStorage.setItem(ACCESS_TOKEN_KEY, data.access);
  sessionStorage.setItem(REFRESH_TOKEN_KEY, data.refresh);

  return data;
}

export async function refreshAccessToken() {
  const refreshToken = sessionStorage.getItem(REFRESH_TOKEN_KEY);

  if (!refreshToken) {
    return null;
  }

  const data = await apiRequest("/auth/token/refresh/", {
    method: "POST",
    body: JSON.stringify({
      refresh: refreshToken,
    }),
  });

  sessionStorage.setItem(ACCESS_TOKEN_KEY, data.access);

  return data.access;
}

export async function getCurrentUser() {
  const accessToken = sessionStorage.getItem(ACCESS_TOKEN_KEY);

  if (!accessToken) {
    return null;
  }

  return apiRequest("/auth/me/", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

export function getAccessToken() {
  return sessionStorage.getItem(ACCESS_TOKEN_KEY);
}

export function logoutUser() {
  sessionStorage.removeItem(ACCESS_TOKEN_KEY);
  sessionStorage.removeItem(REFRESH_TOKEN_KEY);
}