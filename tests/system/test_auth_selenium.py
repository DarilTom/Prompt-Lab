import os
import time
import pytest
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import Select, WebDriverWait


@pytest.mark.system
def test_st_001_login(driver, base_url, test_user, screenshot_helper):
    """
    ST-001: Login System Test
    Verifies authentication behavior on /login:
    1. Validation check with invalid credentials shows an appropriate error.
    2. Valid credentials authenticate successfully and redirect to the dashboard.
    """
    wait = WebDriverWait(driver, 12)
    login_url = f"{base_url}/login"

    # Step 1: Open the login page
    driver.get(login_url)
    wait.until(EC.visibility_of_element_located((By.ID, "email")))
    wait.until(EC.visibility_of_element_located((By.ID, "password")))

    # -------------------------------------------------------------
    # Sub-case 1: Validation check with invalid credentials
    # -------------------------------------------------------------
    email_input = driver.find_element(By.ID, "email")
    password_input = driver.find_element(By.ID, "password")
    submit_button = driver.find_element(By.CSS_SELECTOR, "button[type='submit']")

    email_input.clear()
    email_input.send_keys("invalid_user_999@promptlab.local")
    password_input.clear()
    password_input.send_keys("WrongPassword999!")
    submit_button.click()

    # Wait for the error alert to appear
    error_alert = wait.until(
        EC.visibility_of_element_located((By.CSS_SELECTOR, "p[role='alert'], .text-error"))
    )
    error_text = error_alert.text.strip()
    assert (
        "Invalid email or password." in error_text
        or "invalid" in error_text.lower()
    ), f"Expected invalid credentials error message, but got: '{error_text}'"

    # Confirm user was NOT redirected
    assert "/dashboard" not in driver.current_url, "User should remain on /login after invalid credentials"
    screenshot_helper(driver, "st001_invalid_credentials")

    # -------------------------------------------------------------
    # Sub-case 2: Successful login with valid credentials
    # -------------------------------------------------------------
    email_input = driver.find_element(By.ID, "email")
    password_input = driver.find_element(By.ID, "password")
    submit_button = driver.find_element(By.CSS_SELECTOR, "button[type='submit']")

    email_input.clear()
    email_input.send_keys(test_user["email"])
    password_input.clear()
    password_input.send_keys(test_user["password"])
    submit_button.click()

    # Verify redirection to the authenticated dashboard
    wait.until(EC.url_contains("/dashboard"))
    assert "/dashboard" in driver.current_url, f"Expected dashboard URL, got: {driver.current_url}"

    # Verify authenticated UI elements are visible
    wait.until(
        EC.visibility_of_element_located((By.CSS_SELECTOR, "main, aside, nav, header"))
    )
    screenshot_helper(driver, "st001_login_success")


@pytest.mark.system
def test_st_002_prompt_library(driver, base_url, test_user, login_helper, screenshot_helper, django_db_helper):
    """
    ST-002: Prompt Library System Test
    Verifies prompt authoring and library persistence:
    1. Log in with dedicated test account.
    2. Navigate to /dashboard/prompts and launch prompt creation.
    3. Fill out title, description, category, and initial prompt content.
    4. Save the prompt and verify it appears with DRAFT status badge in the library.
    5. Refresh page to verify persistence in PostgreSQL.
    6. Database cleanup safely removes the created prompt.
    """
    wait = WebDriverWait(driver, 15)
    unique_title = f"Selenium Test Prompt {int(time.time())}"

    # Authenticate
    login_helper(driver, base_url, test_user["email"], test_user["password"])

    try:
        # Navigate to Prompt Library
        driver.get(f"{base_url}/dashboard/prompts")
        wait.until(EC.visibility_of_element_located((By.CSS_SELECTOR, "main")))

        # Click "New Prompt" button
        new_prompt_button = wait.until(
            EC.element_to_be_clickable(
                (By.XPATH, "//button[contains(., 'New Prompt')]")
            )
        )
        new_prompt_button.click()

        # Wait for New Prompt form elements
        wait.until(EC.url_contains("/dashboard/prompts/new"))
        wait.until(EC.visibility_of_element_located((By.ID, "title")))
        wait.until(EC.visibility_of_element_located((By.ID, "content")))

        title_input = driver.find_element(By.ID, "title")
        description_input = driver.find_element(By.ID, "description")
        category_select = Select(driver.find_element(By.ID, "category"))
        content_input = driver.find_element(By.ID, "content")
        system_prompt_input = driver.find_element(By.ID, "system_prompt")
        create_button = driver.find_element(By.CSS_SELECTOR, "button[type='submit']")

        # Fill out form fields
        title_input.send_keys(unique_title)
        description_input.send_keys("Automated test prompt created during Selenium system testing.")
        category_select.select_by_value("engineering")
        content_input.send_keys("You are an automated testing assistant. Please output a concise confirmation message.")
        system_prompt_input.send_keys("Respond concisely and professionally.")

        # Submit prompt creation
        create_button.click()

        # Should redirect back to /dashboard/prompts
        wait.until(EC.url_to_be(f"{base_url}/dashboard/prompts"))

        # Verify prompt card is displayed in the library grid
        card_heading = wait.until(
            EC.visibility_of_element_located(
                (By.XPATH, f"//article[.//h3[text()='{unique_title}']]")
            )
        )
        assert unique_title in card_heading.text, f"Expected prompt '{unique_title}' in library card"

        # Verify DRAFT status pill is rendered on the card
        draft_pill = card_heading.find_element(By.XPATH, ".//span[contains(text(), 'DRAFT')]")
        assert draft_pill is not None, "Expected DRAFT status pill on newly created prompt card"

        # Refresh page to verify persistence in PostgreSQL
        driver.refresh()
        wait.until(EC.visibility_of_element_located((By.CSS_SELECTOR, "main")))

        card_after_refresh = wait.until(
            EC.visibility_of_element_located(
                (By.XPATH, f"//article[.//h3[text()='{unique_title}']]")
            )
        )
        assert card_after_refresh is not None, "Prompt should persist in library after page refresh"
        screenshot_helper(driver, "st002_prompt_library")

    finally:
        # Cleanup created prompt
        django_db_helper["delete_prompts_by_title_prefix"]("Selenium Test Prompt")


@pytest.mark.system
def test_st_003_execution_sandbox(driver, base_url, test_user, login_helper, screenshot_helper, django_db_helper):
    """
    ST-003: Execution Sandbox System Test
    Verifies end-to-end LLM execution against local Ollama:
    1. Authenticate with test account.
    2. Open a disposable prompt detail/sandbox page.
    3. Verify and select an installed Ollama model.
    4. Submit test input and explicitly wait for generation output.
    5. Verify non-empty response rendered and automatic save indication.
    6. Navigate to Execution History and verify execution record with model/version.
    7. Database cleanup safely removes the disposable prompt and execution data.
    """
    wait = WebDriverWait(driver, 15)
    execution_wait = WebDriverWait(driver, 90)  # Generous wait for local LLM inference

    target_model = os.getenv("SELENIUM_MODEL", "llama3.2:1b")
    unique_title = f"Selenium Sandbox Prompt {int(time.time())}"

    # Create dedicated disposable prompt
    prompt_info = django_db_helper["create_prompt"](
        owner_email=test_user["email"],
        title=unique_title,
        content="What is 2 + 2? Return only the single digit.",
        description="Disposable prompt for automated execution sandbox system testing.",
        system_prompt="You are a precise calculator. Reply with just the numeric answer.",
        status="draft",
    )
    prompt_id = prompt_info["prompt_id"]

    # Authenticate
    login_helper(driver, base_url, test_user["email"], test_user["password"])

    try:
        # Navigate to Prompt Sandbox page
        driver.get(f"{base_url}/dashboard/prompts/{prompt_id}")
        sandbox_section = wait.until(
            EC.visibility_of_element_located((By.ID, "execution-sandbox"))
        )

        # Wait for model selector to load installed models
        model_select_elem = wait.until(
            EC.element_to_be_clickable((By.CSS_SELECTOR, "#execution-sandbox select"))
        )
        model_select = Select(model_select_elem)

        # Select target model if available; otherwise pick first available model option
        available_options = [opt.get_attribute("value") for opt in model_select.options if opt.get_attribute("value")]
        assert len(available_options) > 0, "No Ollama models available in sandbox dropdown"

        if target_model in available_options:
            model_select.select_by_value(target_model)
        else:
            model_select.select_by_value(available_options[0])

        # Enter test input
        input_textarea = wait.until(
            EC.visibility_of_element_located(
                (By.CSS_SELECTOR, "#execution-sandbox textarea")
            )
        )
        input_textarea.clear()
        input_textarea.send_keys("Compute 2 + 2 and reply with just the number.")

        # Click "Run Prompt" button
        run_button = wait.until(
            EC.element_to_be_clickable(
                (By.CSS_SELECTOR, "#execution-sandbox button[type='submit']")
            )
        )
        run_button.click()

        # Explicitly wait for output response section to appear
        response_heading = execution_wait.until(
            EC.visibility_of_element_located(
                (By.XPATH, "//*[@id='execution-sandbox']//h3[text()='Response']")
            )
        )
        assert response_heading is not None, "Response header should be rendered after execution"

        # Verify output text container is non-empty
        output_paragraph = execution_wait.until(
            EC.visibility_of_element_located(
                (By.CSS_SELECTOR, "#execution-sandbox .whitespace-pre-wrap")
            )
        )
        output_text = output_paragraph.text.strip()
        assert len(output_text) > 0, "Execution output should not be empty"

        # Verify automatic save indication or completed status
        save_badge = wait.until(
            EC.visibility_of_element_located(
                (By.XPATH, "//*[@id='execution-sandbox']//span[contains(text(), 'Saved to Execution History') or contains(text(), 'completed')]")
            )
        )
        assert save_badge is not None, "Execution should indicate successful completion or history persistence"
        screenshot_helper(driver, "st003_sandbox_execution")

        # Navigate to Execution History page
        driver.get(f"{base_url}/dashboard/executions")
        wait.until(EC.visibility_of_element_located((By.CSS_SELECTOR, "main")))

        # Verify newly completed execution record appears in history
        history_entry = wait.until(
            EC.visibility_of_element_located(
                (By.XPATH, f"//article[.//h2[contains(text(), '{unique_title}')]]")
            )
        )
        assert history_entry is not None, f"Execution record for '{unique_title}' should appear in history"
        assert "completed" in history_entry.text.lower(), "Execution card should display completed status"
        screenshot_helper(driver, "st003_execution_history")

    finally:
        # Cleanup prompt (cascades to prompt versions and executions)
        django_db_helper["delete_prompt"](prompt_id)


@pytest.mark.system
def test_st_004_response_comparison(driver, base_url, test_user, login_helper, screenshot_helper, django_db_helper):
    """
    ST-004: Response Comparison System Test
    Verifies side-by-side execution output comparison:
    1. Authenticate with test account.
    2. Seed 2 completed executions via safe database test fixture.
    3. Navigate to /dashboard/comparisons.
    4. Verify side-by-side rendering of Experiment A and Experiment B.
    5. Verify Copy Response control provides immediate feedback.
    6. Database cleanup safely removes test executions and prompt.
    """
    wait = WebDriverWait(driver, 15)
    unique_title = f"Selenium Comparison Prompt {int(time.time())}"

    # Seed prompt and two completed executions
    prompt_info = django_db_helper["create_prompt"](
        owner_email=test_user["email"],
        title=unique_title,
        content="Explain photosynthesis concisely.",
        description="Prompt for comparing multi-model execution responses.",
        status="testing",
    )
    prompt_id = prompt_info["prompt_id"]
    version_id = prompt_info["version_id"]

    exec_1 = django_db_helper["create_execution"](
        owner_email=test_user["email"],
        prompt_id=prompt_id,
        version_id=version_id,
        model="gemma3:4b",
        input_text="Explain photosynthesis concisely.",
        output_text="Photosynthesis is the biological process by which green plants convert light energy into chemical energy in glucose.",
        status="completed",
        total_duration=1450000000,
    )

    exec_2 = django_db_helper["create_execution"](
        owner_email=test_user["email"],
        prompt_id=prompt_id,
        version_id=version_id,
        model="llama3.2:1b",
        input_text="Explain photosynthesis concisely.",
        output_text="Through photosynthesis, plants convert water and carbon dioxide into sugars and oxygen using sunlight.",
        status="completed",
        total_duration=1120000000,
    )

    # Authenticate
    login_helper(driver, base_url, test_user["email"], test_user["password"])

    try:
        # Navigate to Comparisons page
        driver.get(f"{base_url}/dashboard/comparisons")
        wait.until(EC.visibility_of_element_located((By.CSS_SELECTOR, "main")))

        # Verify side-by-side Response Panels are rendered
        panel_a = wait.until(
            EC.visibility_of_element_located(
                (By.XPATH, "//div[contains(@class, 'rounded-card')][.//div[text()='Experiment A'] and .//h3[starts-with(text(), 'RUN-')]]")
            )
        )
        panel_b = wait.until(
            EC.visibility_of_element_located(
                (By.XPATH, "//div[contains(@class, 'rounded-card')][.//div[text()='Experiment B'] and .//h3[starts-with(text(), 'RUN-')]]")
            )
        )

        assert panel_a is not None, "Experiment A comparison panel should be rendered"
        assert panel_b is not None, "Experiment B comparison panel should be rendered"

        # Verify completed status tags in both panels
        assert "completed" in panel_a.text.lower(), "Experiment A panel should display completed status"
        assert "completed" in panel_b.text.lower(), "Experiment B panel should display completed status"

        # Test Copy Response control on Experiment A
        copy_button_a = panel_a.find_element(
            By.XPATH, ".//button[contains(@title, 'Copy') or contains(., 'Copy Response')]"
        )
        copy_button_a.click()

        # Wait for feedback confirming copy action
        copy_feedback = wait.until(
            EC.visibility_of_element_located(
                (By.XPATH, "//button[contains(., 'Response copied') or contains(@title, 'Response copied')]")
            )
        )
        assert copy_feedback is not None, "Copy feedback should indicate successful clipboard copy"
        screenshot_helper(driver, "st004_response_comparison")

    finally:
        # Cleanup seeded prompt (cascades to executions)
        django_db_helper["delete_prompt"](prompt_id)


@pytest.mark.system
def test_st_005_registration(driver, base_url, test_user, screenshot_helper, django_db_helper):
    """
    ST-005: Registration System Test
    Verifies user registration behavior on /register:
    1. Validation check for an already-registered email displays duplicate error.
    2. Valid registration succeeds and redirects to the login view.
    3. Cleanup ensures the temporary test account is removed from the database.
    """
    wait = WebDriverWait(driver, 12)
    register_url = f"{base_url}/register"
    unique_email = f"selenium_reg_{int(time.time())}@promptlab.test"

    try:
        # Step 1: Open the registration page
        driver.get(register_url)
        wait.until(EC.visibility_of_element_located((By.ID, "name")))
        wait.until(EC.visibility_of_element_located((By.ID, "email")))
        wait.until(EC.visibility_of_element_located((By.ID, "password")))
        wait.until(EC.visibility_of_element_located((By.ID, "confirmPassword")))

        # -------------------------------------------------------------
        # Sub-case 1: Validation check for already-registered email
        # -------------------------------------------------------------
        name_input = driver.find_element(By.ID, "name")
        email_input = driver.find_element(By.ID, "email")
        password_input = driver.find_element(By.ID, "password")
        confirm_input = driver.find_element(By.ID, "confirmPassword")
        submit_button = driver.find_element(By.CSS_SELECTOR, "button[type='submit']")

        name_input.clear()
        name_input.send_keys("Existing User")
        email_input.clear()
        email_input.send_keys(test_user["email"])  # Already registered dedicated user
        password_input.clear()
        password_input.send_keys("ValidPass123!")
        confirm_input.clear()
        confirm_input.send_keys("ValidPass123!")
        submit_button.click()

        # Wait for duplicate email error alert to appear
        error_alert = wait.until(
            EC.visibility_of_element_located((By.CSS_SELECTOR, "p[role='alert'], .text-error"))
        )
        error_text = error_alert.text.strip()
        assert (
            "already exists" in error_text.lower()
            or "email" in error_text.lower()
        ), f"Expected duplicate email error, got: '{error_text}'"

        # Verify browser remains on the registration page
        assert "/register" in driver.current_url, "Browser should remain on /register after duplicate email rejection"
        screenshot_helper(driver, "st005_duplicate_email")

        # -------------------------------------------------------------
        # Sub-case 2: Valid registration with unique user
        # -------------------------------------------------------------
        name_input = driver.find_element(By.ID, "name")
        email_input = driver.find_element(By.ID, "email")
        password_input = driver.find_element(By.ID, "password")
        confirm_input = driver.find_element(By.ID, "confirmPassword")
        submit_button = driver.find_element(By.CSS_SELECTOR, "button[type='submit']")

        name_input.clear()
        name_input.send_keys("New Selenium User")
        email_input.clear()
        email_input.send_keys(unique_email)
        password_input.clear()
        password_input.send_keys("SecureSeleniumPass123!")
        confirm_input.clear()
        confirm_input.send_keys("SecureSeleniumPass123!")
        submit_button.click()

        # Verify navigation to login page on success
        wait.until(EC.url_contains("/login"))
        assert "/login" in driver.current_url, f"Expected redirect to /login, got: {driver.current_url}"
        screenshot_helper(driver, "st005_registration_success")

    finally:
        # Step 3: Cleanup to prevent database pollution
        django_db_helper["delete_user"](unique_email)
