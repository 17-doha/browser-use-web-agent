# main.py

import asyncio
import os
from datetime import datetime
from dotenv import load_dotenv
from PIL import ImageGrab, Image
import imageio
import pygetwindow as gw
import threading
import time
from fpdf import FPDF  # For PDF generation
from pydantic import BaseModel, Field
from typing import List

from browser_use import Agent, BrowserSession, Controller
from browser_use.llm import ChatGoogle

load_dotenv()

class Step(BaseModel):
    action: str = Field(description="The action taken in this step")
    description: str = Field(description="Description of what happened in this step")

class TestResult(BaseModel):
    steps: List[Step] = Field(description="List of steps taken by the agent")
    final_result: str = Field(description="The final result of the test")
    status: str = Field(description="Status: success or fail")

def ensure_dirs():
    os.makedirs("static/screenshots", exist_ok=True)
    os.makedirs("static/gifs", exist_ok=True)
    os.makedirs("static/pdfs", exist_ok=True)  # New directory for PDFs

def capture_chrome_window_loop(screenshot_dir, stop_flag):
    frame = 0
    while not stop_flag[0]:
        try:
            chrome_windows = [w for w in gw.getWindowsWithTitle("Chrome") if not w.isMinimized]
            if chrome_windows:
                win = chrome_windows[0]
                if win.width == 0 or win.height == 0:
                    continue
                bbox = (win.left, win.top, win.right, win.bottom)
                image = ImageGrab.grab(bbox)
                path = os.path.join(screenshot_dir, f"frame_{frame}.png")
                image.save(path)
                print(f"[+] Captured screenshot: {path}")
                frame += 1
            else:
                print("[!] No unminimized Chrome window found.")
        except Exception as e:
            print(f"[ERROR] Failed to capture screenshot: {e}")
        time.sleep(1)

def generate_gif_from_images(image_paths, output_path):
    images = []
    for img in image_paths:
        if os.path.exists(img):
            try:
                images.append(Image.open(img).convert("RGB"))
            except Exception as e:
                print(f"[ERROR] Failed to open image {img}: {e}")

    if len(images) < 2:
        print("[!] Not enough images to create a GIF. Skipping GIF generation.")
        return

    # Resize all images to the size of the first image to ensure same shape
    base_width, base_height = images[0].size
    resized_images = []
    for img in images:
        if img.size != (base_width, base_height):
            img = img.resize((base_width, base_height), Image.LANCZOS)
        resized_images.append(img)

    try:
        imageio.mimsave(output_path, resized_images, fps=1)
        print(f"[✔] GIF generated: {output_path}")
    except ValueError as e:
        print(f"[ERROR] Failed to generate GIF: {e}")

def generate_pdf_from_result(structured_result, pdf_path):
    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("Arial", size=12)

    pdf.cell(200, 10, txt="Test Case Report", ln=True, align='C')

    # Add steps from structured result
    pdf.cell(200, 10, txt="Steps:", ln=True)
    for idx, step in enumerate(structured_result.steps):
        step_data = f"Step {idx+1}: Action - {step.action}, Description - {step.description}"
        pdf.multi_cell(0, 10, step_data)

    # Add final result and status
    pdf.cell(200, 10, txt="Final Result:", ln=True)
    pdf.multi_cell(0, 10, structured_result.final_result)
    pdf.cell(200, 10, txt=f"Status: {structured_result.status}", ln=True)

    pdf.output(pdf_path)
    print(f"[✔] PDF generated: {pdf_path}")

async def run_agent_task(prompt: str):
    ensure_dirs()

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    screenshot_dir = os.path.join("static", "screenshots", f"run_{timestamp}")
    os.makedirs(screenshot_dir, exist_ok=True)
    gif_path = f"static/gifs/test_{timestamp}.gif"
    pdf_path = f"static/pdfs/test_{timestamp}.pdf"

    stop_flag = [False]
    capture_thread = threading.Thread(target=capture_chrome_window_loop, args=(screenshot_dir, stop_flag))
    capture_thread.start()

    try:
        # Custom controller for structured output
        controller = Controller(output_model=TestResult)

        agent = Agent(
            task=prompt,
            llm=ChatGoogle(
                model="gemini-2.0-flash",
                api_key=os.getenv("GOOGLE_API_KEY")
            ),
            controller=controller,
            max_steps=100
        )
        history = await agent.run()  # Assuming this returns AgentHistoryList

        # Parse structured result
        final_output = history.final_result()
        if final_output:
            structured_result = TestResult.model_validate_json(final_output)
            status = structured_result.status  # Assuming agent sets this
        else:
            structured_result = TestResult(steps=[], final_result="No result", status="fail")
            status = "fail"

        # Generate PDF using structured result
        generate_pdf_from_result(structured_result, pdf_path)

    finally:
        stop_flag[0] = True
        capture_thread.join()

    # Generate GIF (existing logic)
    screenshot_files = sorted([
        os.path.join(screenshot_dir, f) for f in os.listdir(screenshot_dir) if f.endswith(".png")
    ])
    if len(screenshot_files) >= 2:
        generate_gif_from_images(screenshot_files, gif_path)

    return {
        "text": structured_result.final_result,
        "gif_path": gif_path if os.path.exists(gif_path) else None,
        "pdf_path": pdf_path if os.path.exists(pdf_path) else None,
        "status": status
    }

def run_prompt(prompt: str):
    return asyncio.run(run_agent_task(prompt))
