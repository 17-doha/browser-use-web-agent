from gradio_client import Client, handle_file

def run_prompt(prompt: str):
    client = Client("http://127.0.0.1:7788/")
    result = client.predict(
        "", "", handle_file("mcp_server.json"), "", "google", "gemini-2.0-flash", 0.6, True, 16000,
        "", "AIzaSyCZKi467qi-lBbJ9iimvt_g1CExQPoViH0", "google", "gemini-2.0-flash", 0.6, False, 16000, "", "", 100, 10, 128000, "auto",
        "chrome.exe", "chrome-user-data", False, True, False, False, 1280, 1100, "", "", "", "", 
        "./tmp/agent_history", "./tmp/downloads", [], prompt, None, None, None, None,
        "<div>Browser View</div>", handle_file("history.json"), handle_file("placeholder.png"),
        api_name="/submit_wrapper"
    )
    return result