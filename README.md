# Open tabs

A conversation game for remote teams: every question opens one more tab. About 45 minutes, played from each person's own laptop.

Live site: https://pages.git.autodesk.com/swinbut/open-tabs/

Flow: lobby, topic vote, warm-up (this or that), deep dive (cards and sparks), hot or not (rate tech statements from 1 to 5), closing (thank-you notes), summary.

To add or change the hot or not statements, edit the `HOT` list near the top of the script in `index.html`.

It's a single static file (`index.html`), so it runs on GitHub Pages (here, the Autodesk internal GitHub Pages). Real-time sync uses Firebase Realtime Database through its REST API (no SDK, no build step).

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
         "$room": { ".read": true, ".write": true }
       }
     }
   }
   ```

   Rooms can only be read by someone who knows the 4-letter code. Nobody can list all rooms.
4. Copy the database URL (looks like `https://your-project-default-rtdb.firebaseio.com`).
5. In `index.html`, set `const FIREBASE_URL = "your url here";` (already done for this project).

## Publish on GitHub Pages

1. Create a repo and push `index.html` and this README. Everything else (including the favicon) is inside `index.html`.
2. Settings, Pages, Deploy from a branch, `main`, `/ (root)`.
3. Share the Pages URL (here: `https://pages.git.autodesk.com/swinbut/open-tabs/`).

## Running a session

1. The host opens the site, picks the number of players (up to 18) and creates a room.
2. Everyone else opens the invite link (or enters the 4-letter code).
3. The host moves the group forward. Everyone votes, picks and writes from their own screen.

## Notes

- Data stored: first names, animal choice, votes, picks, follow-ups and notes. Rooms are small and can be deleted from the Firebase console whenever you like.
- Test the network beforehand if people join from a corporate network: it needs access to `*.firebaseio.com` and `fonts.googleapis.com`.
- Refreshing the page rejoins the room. Joining again with the same name also restores your seat.
