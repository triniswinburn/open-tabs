# Open tabs

A conversation game for remote teams: every question opens one more tab. About 45 minutes, played from each person's own laptop.

Live site: https://triniswinburn.github.io/open-tabs/

Flow: lobby, topic vote, warm-up (this or that), deep dive (cards and sparks), hot or not (rate statements from 1 to 5), closing (thank-you notes), summary.

The content (themes, warm-up pairs, deep dive cards and hot or not statements) lives in `content.json`. The game loads it when it opens. `index.html` also keeps a copy as a fallback, used only if `content.json` can't be loaded or is invalid. Each theme has `pairs` (warm-up, 5), `deep` (deep dive cards, 12) and `hot` (hot or not statements, 6, of which 5 are used). Keep the theme `id` values unchanged.

It's a single static file (`index.html`), so it runs on GitHub Pages. Real-time sync uses Firebase Realtime Database through its REST API (no SDK, no build step).

## Try it now (demo mode)

Open `index.html` in two tabs of the same browser. Host in one, join with the code in the other. Demo mode only syncs between tabs of one browser.

## Go live (about 5 minutes, one time)

1. Go to https://console.firebase.google.com and create a project (you can skip Analytics).
2. Build, Realtime Database, Create database. Pick a region close to most of the team.
3. Open the Rules tab and paste this, then publish:

   ```json
   {
     "rules": {
       "rooms": {
         "$room": {
           ".read": "$room.matches(/^[BCDFGHJKLMNPQRSTVWXZ]{4}$/)",
           ".write": "$room.matches(/^[BCDFGHJKLMNPQRSTVWXZ]{4}$/) && (!newData.exists() || !data.exists() || now < data.child('created').val() + 86400000)",
           "players": { "$pid": { "name": { ".validate": "newData.isString() && newData.val().length <= 20" } } },
           "notes": { "$n": { "text": { ".validate": "newData.isString() && newData.val().length <= 140" } } },
           "deep": { "follow": { "text": { ".validate": "newData.isString() && newData.val().length <= 160" } } }
         }
       }
     }
   }
   ```

   What these rules do: only valid 4-letter room codes can be read or written, and nobody can list all rooms. A room stops accepting changes 24 hours after it was created (it can still be deleted). Names and notes have length limits. Anyone who knows a room code can still read and write that room, so share codes only with your team.
4. Copy the database URL (looks like `https://your-project-default-rtdb.firebaseio.com`).
5. In `index.html`, set `const FIREBASE_URL = "your url here";` (already done for this project).

## Publish on GitHub Pages

1. Create a repo and push `index.html` and this README. Everything else (including the favicon) is inside `index.html`.
2. Settings, Pages, Deploy from a branch, `main`, `/ (root)`.
3. Share the Pages URL (here: https://triniswinburn.github.io/open-tabs/).

## Running a session

1. The host opens the site, picks the number of players (up to 18) and creates a room.
2. Everyone else opens the invite link (or enters the 4-letter code).
3. The host moves the group forward. Everyone votes, picks and writes from their own screen.
4. In the deep dive, each card has one person with the turn. Only that person sees the buttons. The host has a separate "Host controls" row to skip ahead.

## Monthly content refresh

A GitHub Action (`.github/workflows/update-content.yml`) runs on the 1st of every month. It asks Claude for fresh cards, statements and pairs, replaces the oldest items in `content.json` and opens a pull request. Nothing goes live until you review and merge it.

One-time setup:

1. Add your Anthropic API key as a repository secret named `ANTHROPIC_API_KEY` (Settings, Secrets and variables, Actions).
2. Turn on Settings, Actions, General, Workflow permissions, "Allow GitHub Actions to create and approve pull requests".

Good to know:

- To run it now, go to the Actions tab, pick "Monthly content refresh" and choose Run workflow.
- Time-sensitive themes (AI at work, Tech we love, Hot takes) change more each month than the rest. Edit the `PLAN` table in `scripts/update-content.mjs` to change how many items rotate.
- The script checks length, tone rules and duplicates. If a theme's new items fail the checks, that theme is skipped.
- The script asks Claude to use web search for current trends. If web search isn't available for your account, it retries without it and relies on the model's own knowledge.
- To test without calling the API: `node scripts/update-content.mjs --mock response.json`.
- If the API key expires, the Action fails and you will see the error in the Actions tab.

## Notes

- Timing: each stage shows a soft timer in the header (vote 5 min, warm-up 7, deep dive 15, hot or not 8, closing 5). It turns orange when the group goes over. Nothing moves on its own.
- Host away: if the host has been gone for 2 minutes, anyone in the room sees "Take over as host".
- Late joiners: new people can join at any point until the host finishes the session. They land on whatever step the group is on. After the session ends, only people already in the room can rejoin.
- Deleting data: when the session ends, the host can choose "Delete room data". Rooms created from a browser are also deleted by that browser after 24 hours, the next time the site is opened there. Rooms that are never cleaned up can be removed from the Firebase console.
- Data stored: first names, animal choice, votes, picks, follow-ups and notes.
- Test the network beforehand if people join from a corporate network: it needs access to `*.firebaseio.com` and `fonts.googleapis.com`.
- Refreshing the page rejoins the room. Joining again with the same name also restores your seat.
