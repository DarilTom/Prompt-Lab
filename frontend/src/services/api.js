import {
  getAccessToken,
  getRefreshToken,
  setAccessToken,
  clearTokens,
} from "./tokenService";

const API_BASE_URL = "http://127.0.0.1:8000/api";

async function requestNewAccessToken() {
  const refreshToken = getRefreshToken();

  if (!refreshToken) {
    return null;
  }

  const response = await fetch(
    `${API_BASE_URL}/auth/token/refresh/`,
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

export async function apiRequest(endpoint, options = {}, retry = true) {
  const accessToken = getAccessToken();

  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  if (accessToken && !headers.Authorization) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 401 && retry) {
    const newAccessToken = await requestNewAccessToken();

    if (!newAccessToken) {
      clearTokens();
      throw new Error("Your session has expired. Please sign in again.");
    }

    return apiRequest(
      endpoint,
      {
        ...options,
        headers: {
          ...(options.headers || {}),
          Authorization: `Bearer ${newAccessToken}`,
        },
      },
      false,
    );
  }

  const contentType = response.headers.get("content-type") || "";

  const data = contentType.includes("application/json")
    ? await response.json()
    : null;

  if (!response.ok) {
    const error = new Error(
      data?.detail ||
        data?.email?.[0] ||
        data?.password?.[0] ||
        data?.password_confirm?.[0] ||
        "Something went wrong.",
    );

    error.status = response.status;
    error.data = data;

    throw error;
  }

  return data;
}