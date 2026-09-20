"""Failure injection for the alert controls; use a local isolated test session."""
import json, os, unittest
from pathlib import Path
from playwright.sync_api import sync_playwright

class AlertsBrowserTest(unittest.TestCase):
    def test_failure_is_visible_and_retry_can_resolve_without_duplicate_requests(self):
        sessions = json.loads(Path(os.environ['AUDIT_SESSIONS']).read_text())
        with sync_playwright() as p:
            browser = p.chromium.launch()
            context = browser.new_context(service_workers='block', reduced_motion='reduce')
            context.add_init_script('localStorage.setItem("trickee:access-token",'+json.dumps(sessions['admin']['access_token'])+');')
            page = context.new_page()
            page.route('**/api/backend/alerts', lambda route: route.fulfill(status=200, content_type='application/json', body=json.dumps({'success': True, 'data': [{'id':'audit-alert','alert_type':'low_soc_parked','message':'Audit battery alert','is_resolved':False,'soc_at_alert':10}]})))
            calls=[]
            def resolve(route):
                calls.append(route)
                if len(calls)==1: route.fulfill(status=503, content_type='application/json', body='{"detail":"Audit resolution unavailable"}')
            page.route('**/api/backend/alerts/audit-alert/resolve', resolve)
            page.goto(os.environ.get('TEST_BASE_URL','http://127.0.0.1:3001')+'/alerts',wait_until='domcontentloaded',timeout=60000)
            button=page.get_by_role('button',name='Mark as Resolved',exact=True)
            button.click()
            page.get_by_text('Audit resolution unavailable',exact=True).wait_for(timeout=6000)
            self.assertFalse(button.is_disabled())
            button.click()
            page.wait_for_timeout(200)
            self.assertTrue(button.is_disabled())
            button.evaluate('e=>e.click()')
            self.assertEqual(len(calls),2)
            calls[-1].fulfill(status=200,content_type='application/json',body='{"success":true,"data":{}}')
            button.wait_for(state='hidden')
            page.get_by_text('Audit resolution unavailable',exact=True).wait_for(state='hidden')
            browser.close()

if __name__ == '__main__': unittest.main(verbosity=2)
