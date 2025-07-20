# main.py

import asyncio
import os
from datetime import datetime
from dotenv import load_dotenv
from PIL import Image
import imageio
import mss
import time
from browser_use import Agent
from browser_use.llm import ChatGoogle

load_dotenv()


def ensure_dirs():
    os.makedirs("static/screenshots", exist_ok=True)
    os.makedirs("static/gifs", exist_ok=True)


def generate_gif_from_images(image_paths, output_path):
    images = [Image.open(img).convert("RGB") for img in image_paths if os.path.exists(img)]
    if images:
        imageio.mimsave(output_path, images, fps=1)


async def run_agent_task(prompt: str):
    ensure_dirs()

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    screenshot_dir = os.path.join("static/screenshots", f"run_{timestamp}")
    os.makedirs(screenshot_dir, exist_ok=True)
    gif_path = f"static/gifs/test_{timestamp}.gif"
    screenshots = []

    # ✅ Use mutable list as flag across threads
    stop_capture_flag = [False]

    def capture_loop():
        frame = 0
        with mss.mss() as sct:
            while not stop_capture_flag[0]:
                output = os.path.join(screenshot_dir, f"frame_{frame}.png")
                sct.shot(output=output)
                screenshots.append(output)
                frame += 1
                time.sleep(1)  # 1 frame per second

    # Start screenshot thread
    import threading
    thread = threading.Thread(target=capture_loop)
    thread.start()

    # Run the agent
    agent = Agent(
        task=prompt,
        llm=ChatGoogle(
            model="gemini-2.0-flash",
            api_key=os.getenv("GOOGLE_API_KEY")
        ),
        max_steps=100
    )

    try:
        result = await agent.run()
    finally:
        # ✅ Stop recording after agent finishes (even if there's an error)
        stop_capture_flag[0] = True
        thread.join()

    # Try to extract result text
    result_text = "Test Completed"
    if hasattr(result, "all_model_outputs"):
        for output in reversed(result.all_model_outputs):
            if isinstance(output, dict) and "done" in output:
                result_text = output["done"].get("text", result_text)
                break

    # Generate GIF from captured screenshots
    generate_gif_from_images(screenshots, gif_path)

    return {
        "text": result_text,
        "gif_path": gif_path if os.path.exists(gif_path) else None
    }


def run_prompt(prompt: str):
    return asyncio.run(run_agent_task(prompt))
