import { useEffect, useRef } from "react";

export default function GoogleSignInButton({ onSuccess, onError }) {
  const containerRef = useRef(null);

  useEffect(() => {
    let attempts = 0;
    let timer;

    const handleCredential = (response) => {
      if (!response?.credential) {
        onError?.("Google did not return a credential.");
        return;
      }

      onSuccess?.(response.credential);
    };

    // Keep the current callback available globally so Google only
    // needs to be initialized once.
    window.__promptLabGoogleCallback = handleCredential;

    function initializeGoogle() {
      if (!window.google?.accounts?.id) {
        attempts += 1;

        if (attempts < 50) {
          timer = setTimeout(initializeGoogle, 100);
        } else {
          onError?.("Google Sign-In could not be loaded.");
        }

        return;
      }

      const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

      if (!clientId) {
        onError?.("Google Sign-In is not configured.");
        return;
      }

      if (!containerRef.current) {
        return;
      }

      containerRef.current.innerHTML = "";

      // Initialize Google only once per page.
      if (!window.__promptLabGoogleInitialized) {
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (response) => {
            window.__promptLabGoogleCallback?.(response);
          },
        });

        window.__promptLabGoogleInitialized = true;
      }

      window.google.accounts.id.renderButton(
        containerRef.current,
        {
          type: "standard",
          theme: "outline",
          size: "large",
          text: "continue_with",
          shape: "rectangular",
          logo_alignment: "left",
          width: 400,
        }
      );
    }

    initializeGoogle();

    return () => {
      window.__promptLabGoogleCallback = null;

      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [onSuccess, onError]);

  return (
    <div
      ref={containerRef}
      className="flex min-h-10 w-full justify-center overflow-hidden"
    />
  );
}