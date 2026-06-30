from playwright.sync_api import Page
from pages.base_page import BasePage

class LoginPage(BasePage):
    def __init__(self, page: Page):
        super().__init__(page)
        # Selectors based on UI design
        self.email_input = self.page.locator("input[type='email']")
        self.password_input = self.page.locator("input[type='password']")
        self.login_button = self.page.get_by_role("button", name="登录")

    def login(self, email: str, password: str):
        self.navigate("http://localhost:5173")
        # Wait for the email input to be visible (signifying login page is loaded)
        self.email_input.wait_for(state="visible")
        self.email_input.fill(email)
        self.password_input.fill(password)
        self.login_button.click()
        # Wait for the URL to change or dashboard to load
        self.page.wait_for_load_state("networkidle")
