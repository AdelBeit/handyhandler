# HandyHandler

## Overview
Provider-agnostic tool that can submit maintenance requests on any property management portal on behalf of tenants. It is currently wired to Discord for client communication and TinyFish as the web agent provider. It is designed to swap agent/LLM providers and bot adapters easily, and to work with any portal.

## Demo Portal
For testing, use the custom portal repo at `https://github.com/AdelBeit/handyhandler-demo-portals`. The credentials are whatever you set in the demo portal’s `.env` when you run it locally.

## Quickstart
To use the project end-to-end, you need these running/available:
- TinyFish API service (remote) with a valid `TINYFISH_API_KEY` (and optional `TINYFISH_BASE_URL`).
- Discord bot listener (local): `node scripts/listen-discord.js`

### Setup
1. `npm install` (or `yarn install` if you prefer)
2. Create `.env` with:
   - `DISCORD_BOT_TOKEN`
   - `DISCORD_CHANNEL_ID`
   - `TINYFISH_API_KEY`
   - `TINYFISH_BASE_URL` (optional)
3. Start the listener: `node scripts/listen-discord.js`

## License
This project has **no license**. All rights are reserved. You may not use, copy, modify, or distribute this code without explicit permission from the copyright holder.
