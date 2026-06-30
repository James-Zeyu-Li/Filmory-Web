from playwright.sync_api import Page, expect
from pages.base_page import BasePage
import time

class GearPage(BasePage):
    def __init__(self, page: Page):
        super().__init__(page)
        self.sidebar_gear_link = self.page.locator("span", has_text="器材库")
        self.add_camera_btn = self.page.get_by_role("button", name="添加相机")
        
        # Camera Modal Locators
        self.camera_name_input = self.page.locator("label").filter(has_text="相机名称").locator("..").locator("input")
        self.camera_type_select = self.page.locator("label").filter(has_text="相机类型").locator("..").locator("select")
        self.camera_format_select = self.page.locator("label").filter(has_text="画幅格式").locator("..").locator("select")
        self.save_btn = self.page.get_by_role("button", name="添加", exact=True)

    def go_to_gear(self):
        self.sidebar_gear_link.click()
        self.wait_for_dom()
        
    def add_camera(self, name: str, cam_type: str = "film", cam_format: str = "135"):
        self.add_camera_btn.click()
        # Wait for modal animation
        time.sleep(0.5)
        
        self.camera_name_input.fill(name)
        self.camera_type_select.select_option(cam_type)
        if cam_format:
            self.camera_format_select.select_option(cam_format)
            
        self.save_btn.click()
        # Wait for modal to close and state to update
        time.sleep(1)

    def verify_camera_exists(self, name: str):
        # We assert that a h3 element with the camera name is visible in the list
        camera_element = self.page.locator("h3", has_text=name)
        expect(camera_element).to_be_visible()
