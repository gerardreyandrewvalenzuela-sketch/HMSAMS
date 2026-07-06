# HMSAMS
## Hospitality Management Society Attendance Management System

A QR-code-based attendance tracking system for events.  
Frontend hosted on **GitHub Pages** | Backend on **Google Apps Script** | Data in **Google Sheets**

---

## How It Works

1. Officers generate permanent QR codes for each student (once)
2. Students present their QR code at events
3. Officers scan with their phone's native camera — no app needed
4. Attendance (Time In, Late, Time Out) is recorded instantly in Google Sheets
5. Live feed shows who has checked in during an active event

---

## Setup Instructions

### STEP 1 — Set Up Google Apps Script

1. Go to [script.google.com](https://script.google.com) and click **New Project**
2. Name it `HMSAMS Backend`
3. Delete the default `Code.gs` content
4. Create the following files and paste the contents from `appsscript/` folder:

   | Create file named | Paste from |
   |---|---|
   | `Code.gs` | `appsscript/Code.gs` |
   | `config.gs` | `appsscript/config.gs` |
   | `db.gs` | `appsscript/db.gs` |
   | `students.gs` | `appsscript/students.gs` |
   | `events.gs` | `appsscript/events.gs` |
   | `attendance.gs` | `appsscript/attendance.gs` |

   > To add a new file: click the **+** next to Files → Script

5. Click **Save** (floppy disk icon or Ctrl+S)

---

### STEP 2 — Initialize the Google Sheet

1. In Apps Script, open `Code.gs`
2. From the function dropdown (top toolbar), select `initializeSheets`
3. Click **Run**
4. Grant permissions when prompted (click **Allow**)
5. Open your Google Sheet — you should see 3 new tabs: `Students`, `Events`, `Attendance`

---

### STEP 3 — Deploy as Web App

1. In Apps Script, click **Deploy → New deployment**
2. Click the gear icon ⚙️ next to **Type** and select **Web app**
3. Fill in:
   - Description: `HMSAMS v1`
   - Execute as: **Me**
   - Who has access: **Anyone**
4. Click **Deploy**
5. **Copy the Web App URL** — it looks like:
   ```
   https://script.google.com/macros/s/XXXXXXXXXXXXXXXXXX/exec
   ```

---

### STEP 4 — Add the Web App URL to the Frontend

1. Open `assets/js/api.js`
2. Find this line near the top:
   ```js
   var API_URL = 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec';
   ```
3. Replace `YOUR_DEPLOYMENT_ID` with your actual deployment ID from Step 3

---

### STEP 5 — Push to GitHub and Enable GitHub Pages

1. Create a repository named `HMSAMS` on your GitHub account
2. Push all files:
   ```bash
   cd HMSAMS
   git init
   git add .
   git commit -m "Initial HMSAMS setup"
   git branch -M main
   git remote add origin https://github.com/gerardreyandrewvalenzuela-sketch/HMSAMS.git
   git push -u origin main
   ```
3. Go to your repository on GitHub
4. Click **Settings → Pages**
5. Under **Source**, select `main` branch and `/ (root)` folder
6. Click **Save**
7. Your site will be live at:
   ```
   https://gerardreyandrewvalenzuela-sketch.github.io/HMSAMS/
   ```

> GitHub Pages may take 1–2 minutes to go live after first deploy.

---

### STEP 6 — Set Up Auto No-Timeout Trigger (Optional but Recommended)

This automatically marks students who didn't scan out as "No Timeout" when the event deadline passes.

1. In Apps Script, click **Triggers** (clock icon on the left sidebar)
2. Click **+ Add Trigger**
3. Settings:
   - Function: `autoMarkNoTimeout`
   - Event source: **Time-driven**
   - Type: **Minutes timer**
   - Interval: **Every 5 minutes**
4. Click **Save**

---

## Pages

| Page | URL | Description |
|---|---|---|
| Dashboard | `/dashboard.html` | Stats overview, active event |
| Scanner | `/scan.html` | QR scan results + live feed |
| Events | `/events.html` | Create/manage events |
| Students | `/students.html` | Add/edit/remove students |
| QR Codes | `/qr.html` | Generate & print student QRs |

---

## Scan Logic

| Scan # | Condition | Result |
|---|---|---|
| 1st scan | Within registration window | **Time In** |
| 1st scan | After registration close | **Late** |
| 2nd scan | Any time | **Time Out** |
| 3rd scan+ | Any time | **Duplicate — blocked** |

Auto **No Timeout** is applied at the event's timeout deadline for anyone with no Time Out.

---

## QR Code Format

Each student's QR code encodes a URL:
```
https://gerardreyandrewvalenzuela-sketch.github.io/HMSAMS/scan.html?id=STUDENT_NO&name=Full+Name
```

When scanned with any phone camera, it opens the scanner page and records attendance automatically.

---

## PIN

Default PIN: `HMsociety2026`

To change the PIN, edit `config.gs` in Apps Script and redeploy.

---

## Google Sheets Structure

### Students Sheet
| Student No | Last Name | First Name | Middle Name | Year Level | Block | Status |

### Events Sheet
| Event ID | Event Name | Date | Reg Open | Reg Close | Timeout Deadline | Status |

### Attendance Sheet
| Log ID | Event ID | Event Name | Student No | Full Name | Time In | Time Out | Attendance Status | Scan Count |

---

## Troubleshooting

**QR scan does nothing / page shows error**
- Make sure an event is set to **Active** in the Events page
- Check that the Web App URL in `api.js` is correct

**"Invalid PIN" error**
- PIN is case-sensitive. Default is `HMsociety2026`

**Changes not saving**
- If you edit `config.gs` or any `.gs` file, you must **redeploy** the Web App (Deploy → Manage deployments → New version)

**Sheet not found error**
- Run `initializeSheets` from Apps Script again (Step 2)

---

## Tech Stack

- **Frontend:** HTML5, CSS3, Vanilla JavaScript
- **Hosting:** GitHub Pages (free)
- **Backend:** Google Apps Script (Web App)
- **Database:** Google Sheets
- **QR Library:** [qrcodejs](https://github.com/davidshimjs/qrcodejs)
- **Icons:** [Font Awesome 6](https://fontawesome.com)
