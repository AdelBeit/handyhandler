# HandyHandler

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
