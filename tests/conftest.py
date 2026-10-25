import os
import sys
from pathlib import Path

import pytest
from dotenv import load_dotenv
from selenium import webdriver
from selenium.webdriver.chrome.options import Options

# Load local environment variables if available
load_dotenv()

# Project root directory
PROJECT_ROOT = Path(__file__).resolve().parent.parent
SCREENSHOT_DIR = PROJECT_ROOT / "tests" / "screenshots"


def find_chrome_binary():
    """Locate the Google Chrome executable across standard Windows installation paths."""
    candidates = [
        os.path.expandvars(r"%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"),
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    ]
    for path in candidates:
        if path and os.path.isfile(path):
            return path
    return None


@pytest.fixture(scope="session")
def base_url():
    """Base URL of the running frontend application."""
    url = os.getenv("SELENIUM_BASE_URL", "http://localhost:5173")
    return url.rstrip("/")


@pytest.fixture(scope="session")
def test_user():
    """Dedicated test credentials loaded from environment variables."""
    email = os.getenv("TEST_USER_EMAIL", "selenium_tester@promptlab.local")
    password = os.getenv("TEST_USER_PASSWORD", "SeleniumPass123!")
    return {
        "email": email,
        "password": password,
        "name": "Selenium Tester",
    }


@pytest.fixture(scope="function")
def screenshot_helper():
    """Fixture providing a helper function to save labeled test screenshots."""
    SCREENSHOT_DIR.mkdir(parents=True, exist_ok=True)

    def _save(driver, name: str) -> str:
        filename = f"{name}.png"
        target_path = SCREENSHOT_DIR / filename
        driver.save_screenshot(str(target_path))
        return str(target_path)

    return _save


@pytest.fixture(scope="function")
def driver():
    """Chrome WebDriver fixture configured with headless support and explicit waiting."""
    options = Options()

    headless_env = os.getenv("SELENIUM_HEADLESS", "true").strip().lower()
    if headless_env in ("1", "true", "yes", "y"):
        options.add_argument("--headless=new")

    options.add_argument("--disable-gpu")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--window-size=1280,900")
    prefs = {
        "profile.default_content_setting_values.clipboard": 1,
    }
    options.add_experimental_option("prefs", prefs)

    binary = find_chrome_binary()
    if binary:
        options.binary_location = binary

    driver_instance = webdriver.Chrome(options=options)
    # Zero implicit wait to strictly encourage explicit WebDriverWait
    driver_instance.implicitly_wait(0)

    yield driver_instance

    driver_instance.quit()


@pytest.fixture(scope="session")
def django_db_helper():
    """Provides helper functions to interact directly with the database for test seeding/cleanup."""
    sys.path.insert(0, str(PROJECT_ROOT / "backend"))
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
    import django
    django.setup()

    from django.contrib.auth import get_user_model
    from apps.prompts.models import Prompt, PromptVersion
    from apps.executions.models import Execution

    User = get_user_model()

    def _delete_user(email: str):
        try:
            User.objects.filter(email__iexact=email).delete()
        except Exception as exc:
            print(f"[Warning] DB cleanup error for user {email}: {exc}")

    def _create_prompt(owner_email: str, title: str, content: str = "Test prompt content", description: str = "", system_prompt: str = "", status: str = "draft"):
        try:
            user = User.objects.get(email__iexact=owner_email)
            prompt = Prompt.objects.create(
                owner=user,
                title=title,
                description=description,
                category=Prompt.Category.ENGINEERING,
                status=status,
            )
            version = PromptVersion.objects.create(
                prompt=prompt,
                version_number=1,
                content=content,
                system_prompt=system_prompt,
                change_summary="Initial test version",
                created_by=user,
            )
            return {
                "prompt_id": prompt.id,
                "version_id": version.id,
                "title": prompt.title,
                "prompt": prompt,
                "version": version,
            }
        except Exception as exc:
            print(f"[Error] Failed creating test prompt: {exc}")
            raise

    def _delete_prompt(prompt_id: int):
        try:
            Prompt.objects.filter(id=prompt_id).delete()
        except Exception as exc:
            print(f"[Warning] DB cleanup error for prompt {prompt_id}: {exc}")

    def _delete_prompts_by_title_prefix(prefix: str):
        try:
            Prompt.objects.filter(title__startswith=prefix).delete()
        except Exception as exc:
            print(f"[Warning] DB cleanup error for prompts with prefix '{prefix}': {exc}")

    def _create_execution(owner_email: str, prompt_id: int, version_id: int, model: str, input_text: str, output_text: str, status: str = "completed", total_duration: int = 1500000000):
        try:
            user = User.objects.get(email__iexact=owner_email)
            prompt = Prompt.objects.get(id=prompt_id)
            version = PromptVersion.objects.get(id=version_id)
            execution = Execution.objects.create(
                owner=user,
                prompt=prompt,
                prompt_version=version,
                model=model,
                input_text=input_text,
                output_text=output_text,
                status=status,
                total_duration=total_duration,
                eval_count=len(output_text.split()),
            )
            return execution
        except Exception as exc:
            print(f"[Error] Failed creating test execution: {exc}")
            raise

    def _delete_executions(execution_ids: list):
        try:
            Execution.objects.filter(id__in=execution_ids).delete()
        except Exception as exc:
            print(f"[Warning] DB cleanup error for executions {execution_ids}: {exc}")

    return {
        "delete_user": _delete_user,
        "create_prompt": _create_prompt,
        "delete_prompt": _delete_prompt,
        "delete_prompts_by_title_prefix": _delete_prompts_by_title_prefix,
        "create_execution": _create_execution,
        "delete_executions": _delete_executions,
    }


@pytest.fixture(scope="function")
def login_helper():
    """Helper to log in with test credentials and wait for the authenticated dashboard."""
    def _login(driver, base_url, email, password):
        from selenium.webdriver.common.by import By
        from selenium.webdriver.support import expected_conditions as EC
        from selenium.webdriver.support.ui import WebDriverWait

        wait = WebDriverWait(driver, 12)
        driver.get(f"{base_url}/login")
        wait.until(EC.visibility_of_element_located((By.ID, "email")))
        wait.until(EC.visibility_of_element_located((By.ID, "password")))

        email_input = driver.find_element(By.ID, "email")
        password_input = driver.find_element(By.ID, "password")
        submit_btn = driver.find_element(By.CSS_SELECTOR, "button[type='submit']")

        email_input.clear()
        email_input.send_keys(email)
        password_input.clear()
        password_input.send_keys(password)
        submit_btn.click()

        wait.until(EC.url_contains("/dashboard"))
        wait.until(EC.visibility_of_element_located((By.CSS_SELECTOR, "main, aside, nav, header")))

    return _login
