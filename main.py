import asyncio
import os
from datetime import datetime
from dotenv import load_dotenv
from PIL import Image
import imageio
from browser_use import Agent, BrowserSession, Controller
from browser_use.llm import ChatGoogle
from playwright.async_api import async_playwright
from fpdf import FPDF
from pydantic import BaseModel, Field
from typing import List

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
    os.makedirs("static/pdfs", exist_ok=True)

def generate_gif_from_images(image_paths, output_path):
    images = [Image.open(img).convert("RGB") for img in image_paths if os.path.exists(img)]
    if len(images) >= 2:
        imageio.mimsave(output_path, images, fps=1)
        print(f"[✔] GIF generated: {output_path} (size: {os.path.getsize(output_path)} bytes)")  # Debug: confirm size
    else:
        print("[!] Not enough images to create a GIF.")

def generate_pdf_from_result(structured_result, pdf_path):
    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("Arial", size=12)

    pdf.cell(200, 10, txt="Test Case Report", ln=True, align='C')

    pdf.cell(200, 10, txt="Steps:", ln=True)
    for idx, step in enumerate(structured_result.steps):
        step_data = f"Step {idx+1}: Action - {step.action}, Description - {step.description}"
        pdf.multi_cell(0, 10, step_data)

    pdf.cell(200, 10, txt="Final Result:", ln=True)
    pdf.multi_cell(0, 10, structured_result.final_result)
    pdf.cell(200, 10, txt=f"Status: {structured_result.status}", ln=True)

    pdf.output(pdf_path)
    print(f"[✔] PDF generated: {pdf_path} (size: {os.path.getsize(pdf_path)} bytes)")  # Debug: confirm size

async def run_agent_task(prompt: str):
    ensure_dirs()

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    screenshot_dir = os.path.join("static/screenshots", f"run_{timestamp}")
    os.makedirs(screenshot_dir, exist_ok=True)
    gif_path = f"static/gifs/test_{timestamp}.gif"
    pdf_path = f"static/pdfs/test_{timestamp}.pdf"
    screenshots = []

    stop_capture_flag = [False]

    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(headless=False)
        context = await browser.new_context()
        page = await context.new_page()
        browser_session = BrowserSession(page=page)

        async def capture_loop():
            frame = 0
            while not stop_capture_flag[0]:
                try:
                    screenshot_path = os.path.join(screenshot_dir, f"frame_{frame}.png")
                    await page.screenshot(path=screenshot_path)
                    screenshots.append(screenshot_path)
                    print(f"[+] Captured screenshot: {screenshot_path}")
                    frame += 1
                except Exception as e:
                    print(f"[ERROR] Failed to capture screenshot: {e}")
                await asyncio.sleep(1)

        capture_task = asyncio.create_task(capture_loop())

        controller = Controller(output_model=TestResult)

        agent = Agent(
            task=prompt,
            llm=ChatGoogle(model="gemini-2.0-flash", api_key=os.getenv("GOOGLE_API_KEY")),
            browser_session=browser_session,
            controller=controller,
            max_steps=100
        )

        try:
            history = await agent.run()
            final_output = history.final_result()
            if final_output:
                structured_result = TestResult.model_validate_json(final_output)
                status = structured_result.status
            else:
                structured_result = TestResult(steps=[], final_result="No result", status="fail")
                status = "fail"

            generate_pdf_from_result(structured_result, pdf_path)

        finally:
            stop_capture_flag[0] = True
            await capture_task
            await browser.close()

    generate_gif_from_images(screenshots, gif_path)

    # Debug: Check if files exist
    print(f"[DEBUG] GIF exists: {os.path.exists(gif_path)}")
    print(f"[DEBUG] PDF exists: {os.path.exists(pdf_path)}")

    return {
        "text": structured_result.final_result,
        "gif_path": gif_path if os.path.exists(gif_path) else None,
        "pdf_path": pdf_path if os.path.exists(pdf_path) else None,
        "status": status
    }

def run_prompt(prompt: str):
    return asyncio.run(run_agent_task(prompt))
