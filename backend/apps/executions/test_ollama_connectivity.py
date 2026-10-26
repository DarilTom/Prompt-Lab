import base64
from unittest.mock import patch

from django.core.exceptions import ImproperlyConfigured
from django.test import SimpleTestCase, override_settings

from apps.executions.services import (
    OllamaClient,
    OllamaConfigurationError,
    get_installed_models,
    get_ollama_base_url,
    get_ollama_headers,
    get_ollama_tunnel_credentials,
    run_ollama,
    validate_ollama_base_url,
)


class OllamaConnectivityAndTunnelAuthTests(SimpleTestCase):
    """
    Unit tests for Ollama connectivity, URL resolution, and tunnel Basic Auth header generation.
    """

    @override_settings(
        OLLAMA_BASE_URL="http://localhost:11434",
        OLLAMA_TUNNEL_USERNAME="",
        OLLAMA_TUNNEL_PASSWORD="",
    )
    def test_local_ollama_configuration_without_tunnel_credentials(self):
        """In local development without tunnel credentials, no Authorization header is generated."""
        creds = get_ollama_tunnel_credentials()
        self.assertIsNone(creds)

        headers = get_ollama_headers()
        self.assertEqual(headers, {})
        self.assertNotIn("Authorization", headers)

        client = OllamaClient()
        self.assertEqual(client.base_url, "http://localhost:11434")
        self.assertEqual(client.get_headers(), {})

    @override_settings(
        OLLAMA_BASE_URL="https://sample-tunnel.ngrok-free.app",
        OLLAMA_TUNNEL_USERNAME="ngrok_user",
        OLLAMA_TUNNEL_PASSWORD="SecureTunnelPassword123!",
    )
    def test_basic_auth_header_construction_when_both_credentials_exist(self):
        """When both tunnel credentials are configured, proper Basic Auth and ngrok headers are attached."""
        creds = get_ollama_tunnel_credentials()
        self.assertEqual(creds, ("ngrok_user", "SecureTunnelPassword123!"))

        headers = get_ollama_headers()
        expected_raw = "ngrok_user:SecureTunnelPassword123!"
        expected_token = base64.b64encode(expected_raw.encode("utf-8")).decode("utf-8")

        self.assertIn("Authorization", headers)
        self.assertEqual(headers["Authorization"], f"Basic {expected_token}")
        self.assertEqual(headers["ngrok-skip-browser-warning"], "true")

        # Verify decoded header matches original credentials
        auth_type, token = headers["Authorization"].split(" ", 1)
        self.assertEqual(auth_type, "Basic")
        decoded = base64.b64decode(token.encode("utf-8")).decode("utf-8")
        self.assertEqual(decoded, expected_raw)

    @override_settings(
        OLLAMA_BASE_URL="https://secure-tunnel.ngrok-free.app",
        OLLAMA_TUNNEL_USERNAME="admin_user",
        OLLAMA_TUNNEL_PASSWORD="SuperSecretPassword!",
    )
    def test_https_plus_both_tunnel_credentials_accepted(self):
        """HTTPS scheme with both tunnel credentials configured is fully accepted."""
        base_url = get_ollama_base_url()
        self.assertEqual(base_url, "https://secure-tunnel.ngrok-free.app")

        client = OllamaClient()
        self.assertEqual(client.base_url, "https://secure-tunnel.ngrok-free.app")
        headers = client.get_headers()
        self.assertIn("Authorization", headers)
        self.assertTrue(headers["Authorization"].startswith("Basic "))

    @override_settings(
        OLLAMA_BASE_URL="http://insecure-tunnel.ngrok-free.app",
        OLLAMA_TUNNEL_USERNAME="admin_user",
        OLLAMA_TUNNEL_PASSWORD="SecretPassword123!",
    )
    @patch("apps.executions.services.requests.get")
    def test_http_plus_tunnel_credentials_fails_before_requests_get(self, mock_get):
        """Plain HTTP with tunnel credentials fails immediately before requests.get is invoked."""
        with self.assertRaises(OllamaConfigurationError) as ctx:
            get_installed_models()

        mock_get.assert_not_called()
        error_msg = str(ctx.exception)
        self.assertIn("HTTPS", error_msg)
        # Ensure credentials are not leaked in the exception message
        self.assertNotIn("admin_user", error_msg)
        self.assertNotIn("SecretPassword123!", error_msg)

    @override_settings(
        OLLAMA_BASE_URL="http://insecure-tunnel.ngrok-free.app",
        OLLAMA_TUNNEL_USERNAME="admin_user",
        OLLAMA_TUNNEL_PASSWORD="SecretPassword123!",
    )
    @patch("apps.executions.services.requests.post")
    def test_http_plus_tunnel_credentials_fails_before_requests_post(self, mock_post):
        """Plain HTTP with tunnel credentials fails immediately before requests.post is invoked."""
        with self.assertRaises(OllamaConfigurationError) as ctx:
            run_ollama("gemma3:4b", "Hello")

        mock_post.assert_not_called()
        error_msg = str(ctx.exception)
        self.assertIn("HTTPS", error_msg)
        self.assertNotIn("admin_user", error_msg)
        self.assertNotIn("SecretPassword123!", error_msg)

    @override_settings(
        OLLAMA_BASE_URL="http://insecure-tunnel.ngrok-free.app",
        OLLAMA_TUNNEL_USERNAME="admin_user",
        OLLAMA_TUNNEL_PASSWORD="SecretPassword123!",
    )
    def test_get_ollama_headers_rejects_unencrypted_http(self):
        """get_ollama_headers refuses to generate Basic Auth headers for unencrypted HTTP."""
        with self.assertRaises(OllamaConfigurationError):
            get_ollama_headers()

    def test_credential_embedded_urls_rejected(self):
        """URLs with embedded username or password (e.g. user:pass@host) are strictly rejected."""
        embedded_urls = [
            "http://user:pass@localhost:11434",
            "https://user:pass@tunnel.ngrok-free.app",
            "https://user@tunnel.ngrok-free.app",
            "http://user@127.0.0.1:11434",
        ]
        for url in embedded_urls:
            with self.subTest(url=url):
                with self.assertRaises(OllamaConfigurationError) as ctx:
                    validate_ollama_base_url(url, has_credentials=False)
                self.assertIn("embedded credentials", str(ctx.exception).lower())

    def test_invalid_urls_rejected(self):
        """Malformed or unsupported URL schemes are rejected."""
        invalid_urls = [
            "",
            "   ",
            "not-a-valid-url",
            "ftp://localhost:11434",
            "ws://localhost:11434",
            "http://",
            "https://",
        ]
        for url in invalid_urls:
            with self.subTest(url=url):
                with self.assertRaises(OllamaConfigurationError):
                    validate_ollama_base_url(url, has_credentials=False)

    @override_settings(
        OLLAMA_TUNNEL_USERNAME="ngrok_user",
        OLLAMA_TUNNEL_PASSWORD="",
    )
    def test_failure_when_only_username_configured(self):
        """Configuring only the tunnel username must fail clearly."""
        with self.assertRaises(ImproperlyConfigured):
            get_ollama_tunnel_credentials()

        with self.assertRaises(OllamaConfigurationError):
            get_ollama_headers()

        with self.assertRaises(ImproperlyConfigured):
            OllamaClient().get_headers()

    @override_settings(
        OLLAMA_TUNNEL_USERNAME="",
        OLLAMA_TUNNEL_PASSWORD="SecureTunnelPassword123!",
    )
    def test_failure_when_only_password_configured(self):
        """Configuring only the tunnel password must fail clearly."""
        with self.assertRaises(ImproperlyConfigured):
            get_ollama_tunnel_credentials()

        with self.assertRaises(OllamaConfigurationError):
            get_ollama_headers()

        with self.assertRaises(ImproperlyConfigured):
            OllamaClient().get_headers()

    def test_client_instance_fails_with_partial_credentials(self):
        """OllamaClient instantiated with asymmetric credentials raises ImproperlyConfigured."""
        client_user_only = OllamaClient(username="user", password="")
        with self.assertRaises(ImproperlyConfigured):
            client_user_only.get_headers()

        client_pass_only = OllamaClient(username="", password="password")
        with self.assertRaises(ImproperlyConfigured):
            client_pass_only.get_headers()

    def test_client_instance_rejects_http_with_credentials(self):
        """OllamaClient instantiated with HTTP and credentials fails before making calls."""
        client = OllamaClient(
            base_url="http://insecure-tunnel.ngrok.app",
            username="admin",
            password="secret_password",
        )
        with self.assertRaises(OllamaConfigurationError) as ctx:
            client.base_url
        self.assertIn("HTTPS", str(ctx.exception))

    @override_settings(
        OLLAMA_BASE_URL="https://hosted-ollama.ngrok-free.app/",
        OLLAMA_TUNNEL_USERNAME="",
        OLLAMA_TUNNEL_PASSWORD="",
    )
    def test_configured_base_url_strips_trailing_slash(self):
        """Ollama base URL normalizes and strips any trailing slashes."""
        self.assertEqual(get_ollama_base_url(), "https://hosted-ollama.ngrok-free.app")

        client = OllamaClient()
        self.assertEqual(client.base_url, "https://hosted-ollama.ngrok-free.app")
        self.assertEqual(client.tags_url, "https://hosted-ollama.ngrok-free.app/api/tags")
        self.assertEqual(client.chat_url, "https://hosted-ollama.ngrok-free.app/api/chat")

    @override_settings(
        OLLAMA_BASE_URL="https://hosted-tunnel.ngrok-free.app",
        OLLAMA_TUNNEL_USERNAME="my_user",
        OLLAMA_TUNNEL_PASSWORD="my_password",
    )
    @patch("apps.executions.services.requests.get")
    def test_get_installed_models_uses_tunnel_url_and_auth_headers(self, mock_get):
        """get_installed_models queries the configured tunnel base URL with HTTP Basic Auth."""
        mock_response = mock_get.return_value
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "models": [
                {
                    "name": "gemma3:4b",
                    "details": {"family": "gemma", "parameter_size": "4B"},
                    "size": 3338801804,
                }
            ]
        }

        models = get_installed_models()

        mock_get.assert_called_once()
        called_url = mock_get.call_args.args[0]
        called_headers = mock_get.call_args.kwargs.get("headers", {})

        self.assertEqual(called_url, "https://hosted-tunnel.ngrok-free.app/api/tags")
        self.assertIn("Authorization", called_headers)
        self.assertTrue(called_headers["Authorization"].startswith("Basic "))
        self.assertEqual(len(models), 1)
        self.assertEqual(models[0]["name"], "gemma3:4b")

    @override_settings(
        OLLAMA_BASE_URL="https://hosted-tunnel.ngrok-free.app",
        OLLAMA_TUNNEL_USERNAME="my_user",
        OLLAMA_TUNNEL_PASSWORD="my_password",
    )
    @patch("apps.executions.services.requests.post")
    def test_run_ollama_uses_tunnel_url_and_auth_headers(self, mock_post):
        """run_ollama sends completion requests to the configured tunnel URL with Basic Auth."""
        mock_response = mock_post.return_value
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "message": {"role": "assistant", "content": "Tunnel response"},
            "total_duration": 1500000000,
        }

        result = run_ollama("llama3.2:1b", "Tell me a joke")

        mock_post.assert_called_once()
        called_url = mock_post.call_args.args[0]
        called_headers = mock_post.call_args.kwargs.get("headers", {})
        called_json = mock_post.call_args.kwargs.get("json", {})

        self.assertEqual(called_url, "https://hosted-tunnel.ngrok-free.app/api/chat")
        self.assertIn("Authorization", called_headers)
        self.assertTrue(called_headers["Authorization"].startswith("Basic "))
        self.assertEqual(called_json["model"], "llama3.2:1b")
        self.assertEqual(result["message"]["content"], "Tunnel response")

    @override_settings(
        OLLAMA_BASE_URL="http://localhost:11434",
        OLLAMA_TUNNEL_USERNAME="",
        OLLAMA_TUNNEL_PASSWORD="",
    )
    @patch("apps.executions.services.requests.post")
    def test_existing_execution_behavior_intact_without_credentials(self, mock_post):
        """Local development without credentials preserves existing execution payload and behavior."""
        mock_response = mock_post.return_value
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "message": {"role": "assistant", "content": "Local response"}
        }

        result = run_ollama("gemma3:4b", "Hello local Ollama", think=False)

        mock_post.assert_called_once()
        called_url = mock_post.call_args.args[0]
        called_headers = mock_post.call_args.kwargs.get("headers", {})
        called_json = mock_post.call_args.kwargs.get("json", {})

        self.assertEqual(called_url, "http://localhost:11434/api/chat")
        self.assertNotIn("Authorization", called_headers)
        self.assertIs(called_json["think"], False)
        self.assertEqual(result["message"]["content"], "Local response")
