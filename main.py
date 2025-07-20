# main.py

import asyncio
import os
from datetime import datetime
from dotenv import load_dotenv
from PIL import Image
import imageio
import threading
import time

from browser_use import Agent, BrowserSession
from browser_use.llm import ChatGoogle
from playwright.async_api import async_playwright

load_dotenv()

def ensure_dirs():
    os.makedirs("static/screenshots", exist_ok=True)
    os.makedirs("static/gifs", exist_ok=True)

def generate_gif_from_images(image_paths, output_path):
    images = [Image.open(img).convert("RGB") for img in image_paths if os.path.exists(img)]
    if len(images) >= 2:
        imageio.mimsave(output_path, images, fps=1)
        print(f"[✔] GIF generated: {output_path}")
    else:
        print("[!] Not enough images to create a GIF.")

async def run_agent_task(prompt: str):
    ensure_dirs()

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    screenshot_dir = os.path.join("static/screenshots", f"run_{timestamp}")
    os.makedirs(screenshot_dir, exist_ok=True)
    gif_path = f"static/gifs/test_{timestamp}.gif"

    screenshots = []
    stop_flag = [False]

    async def capture_loop(page):
        frame = 0
        while not stop_flag[0]:
            try:
                screenshot_path = os.path.join(screenshot_dir, f"frame_{frame}.png")
                await page.screenshot(path=screenshot_path)
                screenshots.append(screenshot_path)
                print(f"[+] Captured screenshot: {screenshot_path}")
                frame += 1
            except Exception as e:
                print(f"[ERROR] Failed to capture screenshot: {e}")
            await asyncio.sleep(10) 

    # Launch Playwright and create browser objects
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(headless=False)  # Non-headless for visible actions
        context = await browser.new_context()
        page = await context.new_page()

        # Create BrowserSession with the existing Playwright page
        browser_session = BrowserSession(page=page)

        # Start capture in a background task
        capture_task = asyncio.create_task(capture_loop(page))

        # Run the Agent
        try:
            agent = Agent(
                task=prompt,
                llm=ChatGoogle(
                    model="gemini-2.0-flash",
                    api_key=os.getenv("GOOGLE_API_KEY")
                ),
                browser_session=browser_session,
                max_steps=100
            )
            result = await agent.run()
        finally:
            stop_flag[0] = True
            await capture_task  # Wait for capture to finish
            await browser.close()

    # Extract result text
    result_text = "Test completed successfully."
    if hasattr(result, "all_model_outputs") and isinstance(result.all_model_outputs, list):
        for output in reversed(result.all_model_outputs):
            if isinstance(output, dict) and "done" in output:
                result_text = output["done"].get("text", result_text)
                break

    # Generate GIF
    generate_gif_from_images(screenshots, gif_path)

    return {
        "text": result_text,
        "gif_path": gif_path if os.path.exists(gif_path) else None
    }

def run_prompt(prompt: str):
    return asyncio.run(run_agent_task(prompt))
