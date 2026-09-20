import unittest
import os

from playwright.sync_api import sync_playwright


BASE_URL = os.environ.get("TEST_BASE_URL", "http://127.0.0.1:3000")


class JourneyBrowserTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.playwright = sync_playwright().start()
        cls.browser = cls.playwright.chromium.launch()
        cls.page = cls.browser.new_page(viewport={"width": 1280, "height": 720})
        cls.page.goto(BASE_URL, wait_until="networkidle", timeout=60_000)
        if cls.page.get_by_role("button", name="Skip intro").is_visible():
            cls.page.get_by_role("button", name="Skip intro").click()
        cls.page.wait_for_selector("#content", state="visible", timeout=10_000)
        cls.page.wait_for_timeout(1_000)

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.playwright.stop()

    def assert_target_reached(self, target):
        expected_top = 0 if target == "#ping" else 72
        self.page.wait_for_function(
            "value => Math.abs(document.querySelector(value.target).getBoundingClientRect().top - value.expectedTop) < 24",
            arg={"target": target, "expectedTop": expected_top},
            timeout=5_000,
        )

    def test_primary_navigation_reaches_sections(self):
        nav = self.page.get_by_role("navigation", name="Primary navigation")
        for label, target in (("Journey", "#ping"), ("Intelligence", "#predict"), ("PRIE", "#prie"), ("Results", "#trust")):
            nav.get_by_role("link", name=label, exact=True).click()
            self.assert_target_reached(target)

    def test_chapter_rail_reaches_each_section(self):
        rail = self.page.get_by_role("navigation", name="Journey chapters")
        for label, target in (("Ping", "#ping"), ("Signal gap", "#signal-gap"), ("Predict", "#predict"), ("PRIE", "#prie"), ("Ride", "#ride"), ("Trust", "#trust")):
            rail.locator(f'a[href="{target}"]').click()
            self.assert_target_reached(target)

    def test_motion_reel_cards_are_links_to_matching_sections(self):
        expected = ["#ping", "#trust", "#signal-gap", "#predict", "#ride"]
        links = self.page.locator('.journey-reel-group:not([aria-hidden="true"]) a')
        self.assertEqual(links.count(), len(expected))
        self.assertEqual([links.nth(index).get_attribute("href") for index in range(links.count())], expected)
        for index, target in enumerate(expected):
            links.nth(index).dispatch_event("click")
            self.assert_target_reached(target)

    def test_moving_glyphs_are_not_inside_a_clipping_mask(self):
        self.assertEqual(self.page.locator(".kinetic-word").first.evaluate("el => getComputedStyle(el).overflow"), "visible")
        self.assertGreaterEqual(self.page.locator(".kinetic-copy").first.evaluate("el => parseFloat(getComputedStyle(el).paddingLeft)"), 16)

    def test_mobile_menu_navigates_and_closes(self):
        mobile = self.browser.new_page(viewport={"width": 390, "height": 844})
        try:
            mobile.goto(BASE_URL, wait_until="networkidle", timeout=60_000)
            if mobile.get_by_role("button", name="Skip intro").is_visible():
                mobile.get_by_role("button", name="Skip intro").click()
            mobile.wait_for_selector("#content", state="visible", timeout=10_000)
            mobile.get_by_role("button", name="Open navigation").click()
            mobile.get_by_role("navigation", name="Mobile navigation").get_by_role("link", name="Intelligence", exact=True).click()
            mobile.wait_for_function(
                "() => Math.abs(document.querySelector('#predict').getBoundingClientRect().top - 72) < 24",
                timeout=5_000,
            )
            self.assertFalse(mobile.get_by_role("navigation", name="Mobile navigation").is_visible())
            self.assertLessEqual(mobile.evaluate("document.documentElement.scrollWidth"), 390)
        finally:
            mobile.close()

    def test_custom_logo_completes_before_the_site_without_requesting_video(self):
        page = self.browser.new_page(viewport={"width": 390, "height": 844})
        media_requests = []
        page.on('request', lambda request: media_requests.append(request.url) if '.mp4' in request.url else None)
        try:
            page.goto(BASE_URL, wait_until="domcontentloaded")
            self.assertEqual(page.locator('video').count(), 0)
            page.wait_for_selector('[data-logo-phase="resolved"]', timeout=8_000)
            self.assertFalse(page.locator("#content").is_visible())
            self.assertGreater(float(page.locator('.intro-brand-image').evaluate("e => getComputedStyle(e).opacity")), .99)
            bounds = page.locator('.intro-brand-image').bounding_box()
            self.assertGreaterEqual(bounds['x'], 0)
            self.assertLessEqual(bounds['x'] + bounds['width'], 390)
            page.wait_for_selector("#content", state="visible", timeout=10_000)
            self.assertEqual(page.locator(".journey-loader").count(), 0)
            self.assertEqual(media_requests, [])
            self.assertNotEqual(page.evaluate("document.body.style.overflow"), "hidden")
        finally:
            page.close()

    def test_characters_animate_then_fully_resolve_on_desktop_and_mobile(self):
        for width in [320, 390, 1280]:
            page = self.browser.new_page(viewport={"width": width, "height": 844})
            try:
                page.goto(BASE_URL, wait_until="domcontentloaded")
                page.get_by_role('button', name='Skip intro').click()
                page.wait_for_selector('[data-hero-copy] [data-text-phase="revealing"]')
                changing = page.locator('[data-hero-copy] [data-kinetic-char]').evaluate_all("els => els.some(e => Number(getComputedStyle(e).opacity) < .95)")
                self.assertTrue(changing, f"Text must visibly animate at {width}px")
                page.wait_for_selector('[data-hero-copy] [data-text-phase="complete"]')
                for target in ['#hero-title', '#signal-title', '#predict-title', '#prie-title', '#ride-title', '#trust-title']:
                    heading = page.locator(target)
                    # GSAP scrub animations intentionally keep headings moving,
                    # so Playwright's stability-based scroll helper can wait
                    # forever. Native scrolling verifies the rendered result
                    # without requiring the animation to become motionless.
                    heading.evaluate("element => element.scrollIntoView({block: 'center'})")
                    page.wait_for_function("selector => document.querySelector(selector)?.dataset.textPhase === 'complete'", arg=target)
                    bounds = heading.evaluate("e => {const h=e.getBoundingClientRect(); return [...e.querySelectorAll('[data-kinetic-char]')].map(c=>{const r=c.getBoundingClientRect();return {left:r.left,right:r.right,opacity:Number(getComputedStyle(c).opacity),hLeft:h.left,hRight:h.right}})}")
                    self.assertTrue(all(row['opacity'] > .99 for row in bounds), target)
                    self.assertTrue(all(row['left'] >= row['hLeft'] - 1 and row['right'] <= row['hRight'] + 1 for row in bounds), f"Clipped letters in {target} at {width}px")
            finally:
                page.close()

    def test_headings_fit_mobile_tablet_and_desktop(self):
        for width, height in [(320, 740), (390, 844), (768, 1024), (1280, 720), (1280, 800), (1920, 1080)]:
            page = self.browser.new_page(viewport={"width": width, "height": height}, reduced_motion="reduce")
            try:
                page.goto(BASE_URL, wait_until="domcontentloaded")
                page.wait_for_selector("#content", state="visible", timeout=10_000)
                if width >= 768:
                    copy = page.locator('.journey-hero-copy').bounding_box()
                    self.assertGreaterEqual(copy['y'], 72, f"Hero hidden behind header at {width}px")
                    stage = page.locator('.journey-hero-stage').bounding_box()
                    self.assertLessEqual(copy['y'] + copy['height'], stage['y'] + stage['height'], f"Hero clipped at {width}px")
                overflow = page.locator('h1,h2').evaluate_all("els => els.filter(e => e.scrollWidth > e.clientWidth + 2).map(e => e.getAttribute('aria-label'))")
                self.assertEqual(overflow, [], f"Heading overflow at {width}px: {overflow}")
                self.assertLessEqual(page.evaluate("document.documentElement.scrollWidth"), width)
            finally:
                page.close()

    def test_failed_logo_asset_cannot_trap_the_user(self):
        page = self.browser.new_page()
        try:
            page.route('**/*trickee_logo*', lambda route: route.abort())
            page.goto(BASE_URL, wait_until='domcontentloaded')
            page.wait_for_selector('#content', state='visible', timeout=16_000)
            self.assertNotEqual(page.evaluate('document.body.style.overflow'), 'hidden')
        finally:
            page.close()


if __name__ == "__main__":
    unittest.main(verbosity=2)
