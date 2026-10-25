# Prompt Lab — Selenium System Testing Documentation

## 1. Scope & Overview

This document specifies the end-to-end system testing suite for the **Prompt Lab** project using **Selenium WebDriver**, **Python**, and **pytest**.

The system test suite evaluates core authentication workflows and critical application functionality across five comprehensive test cases:

1. **ST-001: User Login** — Credential validation, rejection of invalid combinations, and successful dashboard redirection with session establishment.
2. **ST-002: Prompt Library** — Creating a new prompt experiment, initial draft state verification, and UI/database persistence across page reloads.
3. **ST-003: Execution Sandbox** — End-to-end prompt execution against a local language model (Ollama), real-time generation output verification, and verification in Execution History.
4. **ST-004: Response Comparison** — Side-by-side multi-model response comparison, evaluation metadata rendering, and clipboard copy controls.
5. **ST-005: User Registration** — Duplicate email rejection, secure account creation with unique credentials, redirection to login, and database cleanup.

---

## 2. Test Environment & Configuration

| Parameter | Specification |
| :--- | :--- |
| **Operating System** | Windows 11 (64-bit) |
| **Browser** | Google Chrome `155.0.8059.85` |
| **Browser Execution Mode** | Headless Chrome (`--headless=new`) |
| **Automation Framework** | Selenium WebDriver `4.51.0` (with Selenium Manager) |
| **Test Runner** | pytest `9.1.1` |
| **Runtime Environment** | Python `3.13.7` (Virtual Environment: `backend/venv`) |
| **Application Frontend** | React 19 + Vite 8 (`http://localhost:5173` / `http://127.0.0.1:5173`) |
| **Application Backend** | Django 6.1 REST Framework (`http://127.0.0.1:8000`) |
| **Database** | PostgreSQL 16 on port 5432 |
| **Local LLM Engine** | Ollama v0.5.x on port 11434 (`llama3.2:1b`, `gemma3:4b`, `qwen3:4b`) |

---

## 3. Environment Variables & Test Credentials

All sensitive credentials and environment-specific endpoints are loaded dynamically from environment variables. Credentials are never hardcoded in test scripts.

| Variable | Description | Default Value |
| :--- | :--- | :--- |
| `SELENIUM_BASE_URL` | Base URL of the running frontend application | `http://localhost:5173` |
| `TEST_USER_EMAIL` | Dedicated existing test user email | `selenium_tester@promptlab.local` |
| `TEST_USER_PASSWORD` | Password for dedicated test user | `SeleniumPass123!` |
| `SELENIUM_MODEL` | Local Ollama model to use for sandbox test | `llama3.2:1b` (or `gemma3:4b`) |
| `SELENIUM_HEADLESS` | Whether to launch Chrome in headless mode (`true`/`false`) | `true` |

---

## 4. Test Suite Setup & Execution

### 4.1 Install Test Dependencies

Test dependencies are managed in `requirements-test.txt`:

```bash
# Install test requirements into the project virtual environment
backend\venv\Scripts\pip.exe install -r requirements-test.txt
```

### 4.2 Start Application Servers

Before launching the test suite, ensure the backend API, frontend dev server, and Ollama service are active:

```bash
# Terminal 1: Backend Django Server
backend\venv\Scripts\python.exe backend\manage.py runserver 127.0.0.1:8000 --noreload

# Terminal 2: Frontend Vite Server
npm --prefix frontend run dev -- --host 127.0.0.1 --port 5173

# Terminal 3: Ollama Service (if not already running)
ollama serve
```

### 4.3 Execute the System Tests

Run pytest to execute the full system test suite:

```bash
# Run all 5 system tests with verbose output
backend\venv\Scripts\pytest.exe -v tests/system/test_auth_selenium.py

# Run a specific test case (e.g., ST-003 Execution Sandbox)
backend\venv\Scripts\pytest.exe -v -k "test_st_003_execution_sandbox" tests/system/test_auth_selenium.py

# Run in headed mode (visible browser window for debugging)
set SELENIUM_HEADLESS=false
backend\venv\Scripts\pytest.exe -v tests/system/test_auth_selenium.py
```

### 4.4 Screenshot Evidence

Screenshots are automatically captured and saved to `tests/screenshots/` upon completing each verification milestone:

- `st001_invalid_credentials.png` — Validation alert on invalid login credentials.
- `st001_login_success.png` — Authenticated workspace dashboard after successful login.
- `st002_prompt_library.png` — Newly created prompt experiment in the library with `DRAFT` status pill.
- `st003_sandbox_execution.png` — Completed execution response in the sandbox with persistence badge.
- `st003_execution_history.png` — Execution record listed in Execution History with model and status.
- `st004_response_comparison.png` — Side-by-side multi-model response comparison with copied response feedback.
- `st005_duplicate_email.png` — Validation alert when registering an already-existing email.
- `st005_registration_success.png` — Successful registration redirection to the login view.

---

## 5. System Test Cases

### ST-001: User Login

- **Test Case ID:** `ST-001`
- **Test Case Name:** User Login Authentication & Credential Validation
- **Module:** Authentication (`/login`)
- **Objective:** Verify that the login form rejects invalid credentials with a visible error alert and successfully logs in an authorized user with redirection to the dashboard.
- **Preconditions:**
  1. The Django backend server is running on `http://127.0.0.1:8000`.
  2. The React frontend is running on `http://127.0.0.1:5173`.
  3. The dedicated test user `selenium_tester@promptlab.local` exists in PostgreSQL.
- **Test Data:**
  - *Invalid Credentials:* Email: `invalid_user_999@promptlab.local`, Password: `WrongPassword999!`
  - *Valid Credentials:* Email: `selenium_tester@promptlab.local`, Password: `SeleniumPass123!`

#### Step-by-Step Procedure

| Step | Action | Input Data | Target Element |
| :---: | :--- | :--- | :--- |
| 1 | Navigate to the login page | `http://localhost:5173/login` | Browser address bar |
| 2 | Wait for login form elements | N/A | `input#email`, `input#password` |
| 3 | Enter invalid email address | `invalid_user_999@promptlab.local` | `input#email` |
| 4 | Enter invalid password | `WrongPassword999!` | `input#password` |
| 5 | Submit login form | N/A | `button[type="submit"]` |
| 6 | Verify invalid credentials alert | N/A | `p[role="alert"]` / `.text-error` |
| 7 | Clear inputs and enter valid email | `selenium_tester@promptlab.local` | `input#email` |
| 8 | Enter valid password | `SeleniumPass123!` | `input#password` |
| 9 | Submit login form | N/A | `button[type="submit"]` |
| 10 | Wait for dashboard redirection | N/A | URL check (`/dashboard`), `main` layout |

#### Expected Result
1. On invalid credentials submission: An error alert containing `"Invalid email or password."` is displayed. The page remains on `/login`.
2. On valid credentials submission: The user is authenticated, JWT tokens are stored, and the browser redirects to `/dashboard` with authenticated navigation visible.

#### Actual Observed Result
1. On invalid credentials, the error banner displayed: `"Invalid email or password."`. URL remained `http://localhost:5173/login`. Screenshot captured: `tests/screenshots/st001_invalid_credentials.png`.
2. On valid credentials, the browser redirected within 1.1s to `http://localhost:5173/dashboard`. The dashboard header, sidebar, and workspace sections rendered properly. Screenshot captured: `tests/screenshots/st001_login_success.png`.

- **Status:** **PASS**

---

### ST-002: Prompt Library

- **Test Case ID:** `ST-002`
- **Test Case Name:** Prompt Creation & Library Persistence
- **Module:** Prompt Library (`/dashboard/prompts`, `/dashboard/prompts/new`)
- **Objective:** Verify that a user can create a new prompt experiment with initial version content, see it immediately in the library with `DRAFT` status, and confirm it persists after a page reload.
- **Preconditions:**
  1. The Django backend and React frontend are running.
  2. Dedicated test account is authenticated.
- **Test Data:**
  - *Title:* `"Selenium Test Prompt <timestamp>"`
  - *Description:* `"Automated test prompt created during Selenium system testing."`
  - *Category:* `engineering`
  - *Content:* `"You are an automated testing assistant. Please output a concise confirmation message."`
  - *System Prompt:* `"Respond concisely and professionally."`

#### Step-by-Step Procedure

| Step | Action | Input Data | Target Element |
| :---: | :--- | :--- | :--- |
| 1 | Authenticate user via login helper | `selenium_tester@promptlab.local` | `/login` form |
| 2 | Navigate to Prompt Library | `http://localhost:5173/dashboard/prompts` | Browser address bar |
| 3 | Click "New Prompt" button | N/A | `//button[contains(., 'New Prompt')]` |
| 4 | Wait for New Prompt form elements | N/A | `input#title`, `textarea#content` |
| 5 | Fill in prompt metadata and content | Title, Description, Category, Content | Input fields |
| 6 | Submit prompt creation | N/A | `button[type="submit"]` |
| 7 | Wait for redirect to Prompt Library | N/A | URL check (`/dashboard/prompts`) |
| 8 | Verify new prompt card is rendered | Check prompt title heading | `article` containing `h3` |
| 9 | Verify DRAFT status pill | N/A | `.//span[contains(text(), 'DRAFT')]` |
| 10 | Refresh the browser page | N/A | `driver.refresh()` |
| 11 | Verify prompt card persists after reload | Check prompt card visibility | `article` containing `h3` |
| 12 | Perform database teardown | N/A | Delete created prompt from database |

#### Expected Result
1. The New Prompt form submits successfully and redirects back to `/dashboard/prompts`.
2. The newly created prompt card appears in the grid displaying its title and `DRAFT` status.
3. Refreshing the browser confirms persistent storage in PostgreSQL.
4. Database cleanup fixture deletes the test prompt during teardown.

#### Actual Observed Result
1. Prompt created successfully; redirected to `/dashboard/prompts`.
2. The card appeared immediately with `DRAFT` status badge.
3. Page refreshed and card remained present. Screenshot captured: `tests/screenshots/st002_prompt_library.png`.
4. Teardown fixture cleaned up the prompt.

- **Status:** **PASS**

---

### ST-003: Execution Sandbox

- **Test Case ID:** `ST-003`
- **Test Case Name:** LLM Execution Sandbox & Output Generation
- **Module:** Execution Sandbox (`/dashboard/prompts/:id`) & History (`/dashboard/executions`)
- **Objective:** Verify end-to-end LLM inference against local Ollama, confirm non-empty output display and automatic history persistence, and verify the resulting record appears in Execution History.
- **Preconditions:**
  1. Ollama service running locally with installed model (`llama3.2:1b` or `gemma3:4b`).
  2. A disposable prompt exists in the database.
  3. User is authenticated.
- **Test Data:**
  - *Prompt Title:* `"Selenium Sandbox Prompt <timestamp>"`
  - *Test Input:* `"Compute 2 + 2 and reply with just the number."`
  - *Selected Model:* `llama3.2:1b` (or `gemma3:4b`)

#### Step-by-Step Procedure

| Step | Action | Input Data | Target Element |
| :---: | :--- | :--- | :--- |
| 1 | Create disposable test prompt in DB | Title, content, status `draft` | Django DB helper |
| 2 | Authenticate user via login helper | `selenium_tester@promptlab.local` | `/login` form |
| 3 | Navigate to prompt detail / sandbox | `http://localhost:5173/dashboard/prompts/:id` | Browser address bar |
| 4 | Wait for Execution Sandbox section | N/A | `#execution-sandbox` |
| 5 | Verify and select local Ollama model | `llama3.2:1b` (or available model) | `#execution-sandbox select` |
| 6 | Enter test input into input textarea | `"Compute 2 + 2 and reply with just the number."` | `#execution-sandbox textarea` |
| 7 | Submit execution by clicking Run Prompt | N/A | `#execution-sandbox button[type='submit']` |
| 8 | Wait explicitly for Ollama generation | Timeout up to 90s | `//*[@id='execution-sandbox']//h3[text()='Response']` |
| 9 | Verify generated output is non-empty | Check paragraph content | `#execution-sandbox .whitespace-pre-wrap` |
| 10 | Verify automatic persistence badge | N/A | Badge: `"Saved to Execution History"` |
| 11 | Navigate to Execution History | `http://localhost:5173/dashboard/executions` | Browser address bar |
| 12 | Verify execution record in history list | Check prompt title, model, and status | `article` with `completed` status |
| 13 | Perform database teardown | N/A | Cascading deletion of prompt and execution |

#### Expected Result
1. The execution submits without errors and triggers background execution with local Ollama.
2. The response section appears with a non-empty LLM output and `"Saved to Execution History"` badge.
3. Execution History lists the run with its prompt title, model, and `completed` status.
4. Teardown safely purges the test prompt and executions.

#### Actual Observed Result
1. Ollama generated response (`4`) within ~6.2s.
2. Response section rendered with non-empty output and `"Saved to Execution History"` indicator. Screenshot captured: `tests/screenshots/st003_sandbox_execution.png`.
3. Navigated to `/dashboard/executions`; record displayed with `completed` status pill. Screenshot captured: `tests/screenshots/st003_execution_history.png`.
4. Test prompt and execution purged cleanly in teardown.

- **Status:** **PASS**

---

### ST-004: Response Comparison

- **Test Case ID:** `ST-004`
- **Test Case Name:** Side-by-Side Multi-Model Response Comparison
- **Module:** Response Comparison (`/dashboard/comparisons`)
- **Objective:** Verify that two completed executions render side-by-side in Experiment A and Experiment B panels, with accurate status indicators and functional clipboard copy controls.
- **Preconditions:**
  1. User is authenticated.
  2. Two completed executions exist in the database for the test user.
- **Test Data:**
  - *Execution A:* Model: `gemma3:4b`, Input: `"Explain photosynthesis concisely."`, Output: `"Photosynthesis is the biological process by which green plants convert light energy into chemical energy in glucose."`, Status: `completed`
  - *Execution B:* Model: `llama3.2:1b`, Input: `"Explain photosynthesis concisely."`, Output: `"Through photosynthesis, plants convert water and carbon dioxide into sugars and oxygen using sunlight."`, Status: `completed`

#### Step-by-Step Procedure

| Step | Action | Input Data | Target Element |
| :---: | :--- | :--- | :--- |
| 1 | Seed prompt and two completed executions in DB | Model, input, output, duration | Django DB helper |
| 2 | Authenticate user via login helper | `selenium_tester@promptlab.local` | `/login` form |
| 3 | Navigate to Comparisons page | `http://localhost:5173/dashboard/comparisons` | Browser address bar |
| 4 | Wait for comparison view to render | N/A | `main` layout |
| 5 | Verify Experiment A response panel | Check label and `RUN-` header | `rounded-card` with `Experiment A` |
| 6 | Verify Experiment B response panel | Check label and `RUN-` header | `rounded-card` with `Experiment B` |
| 7 | Verify completed status in both panels | N/A | `span` with `completed` status |
| 8 | Click Copy Response button on Experiment A | N/A | `button[title*='Copy']` |
| 9 | Verify immediate feedback indicator | N/A | Button text changes to `"Response copied"` |
| 10 | Perform database teardown | N/A | Delete seeded prompt and executions |

#### Expected Result
1. Both execution outputs render side-by-side in Experiment A and Experiment B cards.
2. Both cards display `completed` status badges and output text.
3. Clicking Copy Response updates the button label to `"Response copied"` without causing page reloads or errors.
4. Database cleanup removes test records during teardown.

#### Actual Observed Result
1. Side-by-side panels rendered both executions with correct model labels and outputs.
2. Completed status verified in both panels.
3. Copy Response action triggered and immediately rendered `"Response copied"` badge. Screenshot captured: `tests/screenshots/st004_response_comparison.png`.
4. Seeded records purged cleanly in teardown.

- **Status:** **PASS**

---

### ST-005: User Registration

- **Test Case ID:** `ST-005`
- **Test Case Name:** User Registration & Duplicate Email Validation
- **Module:** Authentication (`/register`)
- **Objective:** Verify that the registration form prevents duplicate account creation when an existing email is used, successfully creates an account with valid unique data, redirects to `/login`, and leaves no orphan data in the database.
- **Preconditions:**
  1. The Django backend and React frontend are running.
  2. The dedicated account `selenium_tester@promptlab.local` is already registered in PostgreSQL.
- **Test Data:**
  - *Duplicate Check:* Name: `"Existing User"`, Email: `selenium_tester@promptlab.local`, Password: `ValidPass123!`, Confirm Password: `ValidPass123!`
  - *Valid Registration:* Name: `"New Selenium User"`, Email: `selenium_reg_<timestamp>@promptlab.test`, Password: `SecureSeleniumPass123!`, Confirm Password: `SecureSeleniumPass123!`

#### Step-by-Step Procedure

| Step | Action | Input Data | Target Element |
| :---: | :--- | :--- | :--- |
| 1 | Navigate to the registration page | `http://localhost:5173/register` | Browser address bar |
| 2 | Wait for registration form elements | N/A | `input#name`, `input#email`, `input#password`, `input#confirmPassword` |
| 3 | Enter user details with duplicate email | Name: `"Existing User"`, Email: `selenium_tester@promptlab.local` | Input fields |
| 4 | Enter matching passwords | `ValidPass123!` | `input#password`, `input#confirmPassword` |
| 5 | Submit registration form | N/A | `button[type="submit"]` |
| 6 | Verify duplicate email rejection | N/A | `p[role="alert"]` / `.text-error` |
| 7 | Clear inputs and enter valid unique details | Name: `"New Selenium User"`, Email: `selenium_reg_<timestamp>@promptlab.test` | Input fields |
| 8 | Enter new secure password | `SecureSeleniumPass123!` | `input#password`, `input#confirmPassword` |
| 9 | Submit registration form | N/A | `button[type="submit"]` |
| 10 | Verify navigation to login page | N/A | URL check (`/login`) |
| 11 | Perform database cleanup | N/A | Database deletion of temporary test user |

#### Expected Result
1. On duplicate email submission: Registration is blocked with an error alert displaying `"An account with this email already exists."`. The browser remains on `/register`.
2. On unique details submission: The account is created in PostgreSQL and the browser navigates to `/login`.
3. Database cleanup fixture ensures the generated test user is deleted immediately after test completion.

#### Actual Observed Result
1. When submitting `selenium_tester@promptlab.local`, the server responded with HTTP 400 and the UI displayed: `"An account with this email already exists."`. URL remained `http://localhost:5173/register`. Screenshot captured: `tests/screenshots/st005_duplicate_email.png`.
2. When submitting unique credentials, registration completed successfully and navigated to `http://localhost:5173/login`. Screenshot captured: `tests/screenshots/st005_registration_success.png`.
3. The temporary user was immediately purged from the database in the teardown fixture, preventing test pollution.

- **Status:** **PASS**

---

## 6. Execution Summary Report

```text
============================= test session starts =============================
platform win32 -- Python 3.13.7, pytest-9.1.1, pluggy-1.7.0 -- backend\venv\Scripts\python.exe
rootdir: C:\Users\ACER\OneDrive\Desktop\Amaljyothi\MINI-MAIN_PROJECT\Prompt Lab
configfile: pytest.ini
collected 5 items

tests/system/test_auth_selenium.py::test_st_001_login PASSED             [ 20%]
tests/system/test_auth_selenium.py::test_st_002_prompt_library PASSED    [ 40%]
tests/system/test_auth_selenium.py::test_st_003_execution_sandbox PASSED [ 60%]
tests/system/test_auth_selenium.py::test_st_004_response_comparison PASSED [ 80%]
tests/system/test_auth_selenium.py::test_st_005_registration PASSED      [100%]

======================== 5 passed in 73.04s (0:01:13) =========================
```

| Test ID | Test Case Name | Target Module | Duration | Result | Evidence Screenshots |
| :---: | :--- | :---: | :---: | :---: | :--- |
| **ST-001** | User Login | `/login` | ~9.2s | **PASS** | `st001_invalid_credentials.png`<br>`st001_login_success.png` |
| **ST-002** | Prompt Library | `/dashboard/prompts` | ~11.5s | **PASS** | `st002_prompt_library.png` |
| **ST-003** | Execution Sandbox | `/dashboard/prompts/:id`<br>`/dashboard/executions` | ~25.4s | **PASS** | `st003_sandbox_execution.png`<br>`st003_execution_history.png` |
| **ST-004** | Response Comparison | `/dashboard/comparisons` | ~10.8s | **PASS** | `st004_response_comparison.png` |
| **ST-005** | User Registration | `/register` | ~9.1s | **PASS** | `st005_duplicate_email.png`<br>`st005_registration_success.png` |
