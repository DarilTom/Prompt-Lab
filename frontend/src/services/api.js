import {
  getAccessToken,
  getRefreshToken,
  setAccessToken,
  clearTokens,
} from "./tokenService";

export const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  "http://127.0.0.1:8000/api"
).replace(/\/+$/, "");

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
  const { timeout, ...fetchOptions } = options;

  const headers = {
    "Content-Type": "application/json",
    ...(fetchOptions.headers || {}),
  };

  if (accessToken && !headers.Authorization) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  let controller = null;
  let timerId = null;

  if (timeout && !fetchOptions.signal) {
    controller = new AbortController();
    fetchOptions.signal = controller.signal;
    timerId = setTimeout(() => {
      controller.abort(
        new Error(
          `Request timed out after ${Math.round(timeout / 1000)} seconds.`
        )
      );
    }, timeout);
  }

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...fetchOptions,
      headers,
    });
  } catch (err) {
    if (err.name === "AbortError" && controller) {
      throw new Error(
        `Request timed out after ${Math.round(timeout / 1000)} seconds.`,
        { cause: err }
      );
    }
    throw err;
  } finally {
    if (timerId) {
      clearTimeout(timerId);
    }
  }

  if (response.status === 401 && retry && !endpoint.includes("/auth/login")) {
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
          ...(fetchOptions.headers || {}),
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
        data?.error ||
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
