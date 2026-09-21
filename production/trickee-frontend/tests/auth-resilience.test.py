import os
import unittest

from playwright.sync_api import sync_playwright


BASE_URL = os.environ.get("TEST_BASE_URL", "http://127.0.0.1:3001").rstrip("/")
GOOGLE_SCRIPT = "https://accounts.google.com/gsi/client"
GOOGLE_STUB = """
window.google = {accounts: {id: {
  initialize(options) { window.__googleCredentialCallback = options.callback; },
  renderButton(parent) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'Continue with Google';
    button.addEventListener('click', () => {
      window.__googleCredentialCallback({credential: 'test-id-token'});
      window.__googleCredentialCallback({credential: 'test-id-token'});
    });
    parent.appendChild(button);
  }
}}};
"""


class AuthResilienceTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.playwright = sync_playwright().start()
        cls.browser = cls.playwright.chromium.launch()

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.playwright.stop()

    def test_google_script_failure_offers_a_working_retry(self):
        page = self.browser.new_page()
        attempts = 0

        def serve_google(route):
            nonlocal attempts
            attempts += 1
            if attempts == 1:
                route.abort()
            else:
                route.fulfill(status=200, content_type="text/javascript", body=GOOGLE_STUB)

        page.route(GOOGLE_SCRIPT, serve_google)
        try:
            page.goto(f"{BASE_URL}/login", wait_until="networkidle", timeout=60_000)
            retry = page.get_by_role("button", name="Retry Google sign-in")
            retry.wait_for(state="visible")
            retry.click()
            page.get_by_role("button", name="Continue with Google").wait_for(state="visible")
            self.assertEqual(attempts, 2)
        finally:
            page.close()

    def test_duplicate_google_callbacks_submit_only_once(self):
        page = self.browser.new_page()
        login_requests = 0

        page.route(
            GOOGLE_SCRIPT,
            lambda route: route.fulfill(
                status=200, content_type="text/javascript", body=GOOGLE_STUB
            ),
        )

        def reject_login(route):
            nonlocal login_requests
            login_requests += 1
            route.fulfill(
                status=503,
                content_type="application/json",
                body='{"detail":"Sign-in temporarily unavailable"}',
            )

        page.route("**/api/backend/auth/google-login", reject_login)
        try:
            page.goto(f"{BASE_URL}/login", wait_until="networkidle", timeout=60_000)
            page.get_by_role("button", name="Continue with Google").click()
            page.get_by_text("Sign-in temporarily unavailable").wait_for(state="visible")
            self.assertEqual(login_requests, 1)
        finally:
            page.close()

    def test_driver_vehicle_options_can_be_retried_after_failure(self):
        page = self.browser.new_page()
        attempts = 0

        def serve_options(route):
            nonlocal attempts
            attempts += 1
            if attempts == 1:
                route.fulfill(
                    status=503,
                    content_type="application/json",
                    body='{"detail":"Vehicle list temporarily unavailable"}',
                )
            else:
                route.fulfill(
                    status=200,
                    content_type="application/json",
                    body=(
                        '{"success":true,"data":{"vehicles":['
                        '{"id":"vehicle-1","vehicle_code":"TRK-101",'
                        '"fleet_name":"North Fleet"}]}}'
                    ),
                )

        page.route("**/api/backend/auth/signup-options", serve_options)
        try:
            page.goto(f"{BASE_URL}/signup", wait_until="networkidle", timeout=60_000)
            page.get_by_label("Access type").select_option("driver")
            retry = page.get_by_role("button", name="Retry vehicle list")
            retry.wait_for(state="visible")
            retry.click()
            page.get_by_label("Vehicle").select_option("vehicle-1")
            self.assertEqual(page.get_by_label("Vehicle").input_value(), "vehicle-1")
            self.assertEqual(attempts, 2)
        finally:
            page.close()

    def test_workspace_refresh_failure_preserves_session_and_offers_retry(self):
        page = self.browser.new_page()
        workspace_requests = 0

        page.route(
            GOOGLE_SCRIPT,
            lambda route: route.fulfill(
                status=200, content_type="text/javascript", body=GOOGLE_STUB
            ),
        )
        page.route(
            "**/api/backend/auth/google-login",
            lambda route: route.fulfill(
                status=200,
                content_type="application/json",
                body=(
                    '{"success":true,"data":{"access_token":"access-token",'
                    '"refresh_token":"refresh-token","token_type":"bearer",'
                    '"expires_in_seconds":3600}}'
                ),
            ),
        )

        def reject_workspace(route):
            nonlocal workspace_requests
            workspace_requests += 1
            route.fulfill(
                status=503,
                content_type="application/json",
                body='{"detail":"Workspace temporarily unavailable"}',
            )

        page.route("**/api/backend/auth/me", reject_workspace)
        try:
            page.goto(f"{BASE_URL}/login", wait_until="networkidle", timeout=60_000)
            page.get_by_role("button", name="Continue with Google").click()
            retry = page.get_by_role("button", name="Retry workspace")
            retry.wait_for(state="visible")
            self.assertEqual(
                page.evaluate("localStorage.getItem('trickee:access-token')"),
                "access-token",
            )
            self.assertEqual(page.get_by_role("dialog").count(), 0)
            retry.click()
            page.wait_for_function(
                "() => document.body.innerText.includes('Workspace is still unavailable')"
            )
            self.assertEqual(workspace_requests, 2)
        finally:
            page.close()

    def test_unmounted_login_does_not_write_a_late_session(self):
        page = self.browser.new_page()
        pending_logins = []

        page.route(
            GOOGLE_SCRIPT,
            lambda route: route.fulfill(
                status=200, content_type="text/javascript", body=GOOGLE_STUB
            ),
        )
        page.route(
            "**/api/backend/auth/google-login",
            lambda route: pending_logins.append(route),
        )
        try:
            page.goto(f"{BASE_URL}/login", wait_until="networkidle", timeout=60_000)
            page.get_by_role("button", name="Continue with Google").click()
            page.wait_for_timeout(200)
            self.assertEqual(len(pending_logins), 1)

            page.get_by_role("link", name="Request an account").click()
            page.wait_for_url(f"{BASE_URL}/signup")
            pending_logins[0].fulfill(
                status=200,
                content_type="application/json",
                body=(
                    '{"success":true,"data":{"access_token":"late-access",'
                    '"refresh_token":"late-refresh","token_type":"bearer",'
                    '"expires_in_seconds":3600}}'
                ),
            )
            page.wait_for_timeout(300)
            self.assertIsNone(
                page.evaluate("localStorage.getItem('trickee:access-token')")
            )
        finally:
            page.close()


if __name__ == "__main__":
    unittest.main(verbosity=2)
