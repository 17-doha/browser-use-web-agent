import asyncio
from fastmcp import Client

# ---




config = {
  "mcpServers": {
    "browsermcp": {
      "command": "npx",
      "args": ["@browsermcp/mcp@latest"]
    }
  }
}

async def main():
    async with Client(config) as client:

        tools_result = await client.list_tools()
        for tool in tools_result:
            print("tool:", tool.name)

        # we have to wait until browser is connected (manually) with browsermcp-server
        input("\nPress ENTER to continue (when tab is already connected to browsermcp-server)\n")

        print("--- browser_screenshot ---")
        results = await client.call_tool("browser_screenshot")
        #print(results)

        import base64
        data = results[0].data
        data = base64.b64decode(data.encode('ascii'))
        with open('screenshot.png', 'wb') as file_out:
            file_out.write(data)

        print("--- browser_navigate ---")
        results = await client.call_tool("browser_navigate", {"url": "https://youtube.com/"})
        #print(results)

        print(results[0].text)

if __name__ == "__main__":
    asyncio.run(main())