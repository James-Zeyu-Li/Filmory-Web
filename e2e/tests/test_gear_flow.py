import pytest
from playwright.sync_api import Page
from pages.login_page import LoginPage
from pages.gear_page import GearPage
import uuid

def test_add_camera_uuid_fix(page: Page):
    """
    此测试用例将通过真机自动点击验证：
    在重构了底层 UUID 和 userId 之后，从前端 UI 点击“添加相机”
    能否成功触发响应式更新并且不导致 Dexie 崩溃白屏。
    """
    login_page = LoginPage(page)
    gear_page = GearPage(page)
    
    # 1. 自动登录穿透
    login_page.login("admin@grainfolio.com", "password123")
    
    # 2. 导航至器材库
    gear_page.go_to_gear()
    
    # 3. 动态生成一个唯一测试名称以防冲突
    test_camera_name = f"Playwright-Leica-M6-{uuid.uuid4().hex[:6]}"
    
    # 4. 执行自动填写与保存
    gear_page.add_camera(name=test_camera_name, cam_type="film", cam_format="135")
    
    # 5. 断言验证：刚添加的相机必然出现在 UI 列表中！
    gear_page.verify_camera_exists(test_camera_name)
    
    # 如果走到这里没报错，说明重构完美成功，前端未锁死！
