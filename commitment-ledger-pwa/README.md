# Commitment Ledger: put it on your iPhone

This folder is the complete app. It's plain HTML, CSS and JavaScript, so there's nothing to install or build. You upload the folder to a free host, open the link on your iPhone, and add it to your Home Screen.

```
commitment-ledger-pwa/
├── index.html             the page, plus the iPhone app tags
├── styles.css             the look
├── app.js                 everything the app does
├── manifest.webmanifest   name, icon and full-screen mode
├── sw.js                  lets the app open with no internet
└── icons/                 Home Screen icons
```

---

## Step 1: Put it online (pick one host)

### Option A: Netlify Drop (easiest, about 3 minutes, no coding)

1. On your Mac, open **https://app.netlify.com/drop** in a browser.
2. Sign up for a free account. Email or GitHub sign-in both work.
3. Drag the whole **`commitment-ledger-pwa`** folder onto the page.
4. Wait a few seconds. Netlify shows a link such as `https://silly-name-12345.netlify.app`. That link is your app.
5. Optional: give it a nicer name under **Site configuration → Change site name**, for example `my-ledger.netlify.app`. **Do this before you start using the app on your phone** (see the warning in Step 3).

### Option B: GitHub Pages (free; good if you want version history)

1. Create a free account at **https://github.com** and click **New repository**. Name it, for example, `ledger`, choose **Public**, and click **Create**.
2. On the new repository page, click **uploading an existing file**. Drag in **the contents** of `commitment-ledger-pwa` (the files and the `icons` folder, not the outer folder). Click **Commit changes**.
3. Go to **Settings → Pages**. Under *Build and deployment*, choose **Deploy from a branch**, branch **main**, folder **/ (root)**, and click **Save**.
4. After about a minute the app is live at `https://YOUR-USERNAME.github.io/ledger/`.

### Option C: Vercel

Sign in at **https://vercel.com** with GitHub, click **Add New → Project**, import the GitHub repository from Option B, leave every setting at its default, and click **Deploy**.

All three hosts serve the app over HTTPS, which the iPhone needs for offline mode and Home Screen install.

---

## Step 2: Install it on your iPhone

1. On the iPhone, open your app link in **Safari**. It has to be Safari, not Chrome or the in-app browser of another app.
2. Tap the **Share** button (the square with an arrow pointing up).
3. Scroll down and tap **Add to Home Screen**. The name "Ledger" is filled in. Tap **Add**.
4. Open **Ledger** from your Home Screen. It opens full screen, with no Safari address bar, like a regular app.
5. Once it has been opened online one time, it also works with no connection.

---

## Step 3: Keep your data safe

- **Where your data lives:** only on your iPhone, inside the Home Screen app. Nothing goes to a server. No account is needed.
- **Back up weekly:** go to **Settings → Export data (JSON)**. On iPhone a share sheet opens; choose **Save to Files**, then pick iCloud Drive. The morning briefing reminds you when your last backup is more than 7 days old.
- **Restore:** go to **Settings → Import data (JSON)** and choose a backup file. The app shows what the backup contains and asks for confirmation before it replaces anything.
- ⚠️ **Safari and the Home Screen app keep separate data.** Use the Home Screen app every day. If you tried the app in Safari first, export there and import in the Home Screen app.
- ⚠️ **Keep the same web address.** Your data belongs to the exact address, such as `my-ledger.netlify.app`. If you rename the site or move hosts, export first and import at the new address.
- Deleting the Home Screen icon deletes its data. Export first.
- Clearing Safari's history and website data can also erase it. That's another reason to export regularly.

---

## Reminders and summaries

Web apps on iPhone can't schedule notifications on their own, so the ledger checks in whenever you open it:

| When you open the app | What appears |
|---|---|
| First time each day, before evening, before you've locked in | **Morning briefing**: how yesterday went, the first task you planned for today, deadlines in the next 7 days with the pace you need, stale projects, a nudge when passion-driven work has had no time, and a backup reminder |
| In the evening (18:00 by default) if the day isn't closed | **Evening summary**: today's numbers so far, what's still open, and a button to close the day |
| When you tap **Close the day** | **Day summary**: commitments kept, time, words, milestones, what got in the way, and your streak |

You can change the evening start time or turn either pop-up off under **Settings → Daily check-ins**.

**To get nudged to open it:** in the iPhone **Reminders** app, create a reminder such as "Ledger: commit to today," tap the **ⓘ** button, and set **Date**, **Time** 9:00 and **Repeat: Weekdays**. Make a second one at 18:00 for "Ledger: close the day." When it fires, tap the Ledger icon.

---

## Updating the app later

1. Edit the files.
2. Open `sw.js` and change `VERSION = 'ledger-v1'` to `'ledger-v2'` (and so on). This tells iPhones there's a new version.
3. Upload again:
   - **Netlify:** open your site → **Deploys** → drag the folder onto the page.
   - **GitHub:** upload the changed files again.
4. On the iPhone, close and reopen the app. It may take two opens for the update to show.

Your data isn't affected by updates, as long as the address stays the same.

---

## Try it on your Mac first (optional)

In Terminal, go into this folder and run:

```bash
python3 -m http.server 5173
```

Then open http://localhost:5173. Data saved there stays in that Mac browser only.
