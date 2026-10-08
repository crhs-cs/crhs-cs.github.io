/**
 * Cedar Ridge CS Club: presentations folder sync.
 *
 * Officers drop slides into one Google Drive folder; this script lists that folder into a
 * "Presentations" tab of the club spreadsheet, which the website reads. No code edits needed.
 *
 * Add this as a SECOND file in the same Apps Script project as project-form-setup.gs
 * (click + next to Files, choose Script, name it "presentations"). Every name in this file
 * starts with pres/PRES so it can't clash with the other file.
 *
 * One-time setup:
 *   1. Choose presSetup and click Run. It creates the "CRHS CS Club presentations" folder,
 *      the Presentations tab, and a trigger that syncs every 15 minutes.
 *   2. In the spreadsheet: File > Share > Publish to web, pick the "Presentations" tab and
 *      "Comma-separated values (.csv)", click Publish, and send that link to the club site.
 *
 * Adding a presentation:
 *   Put a Google Slides deck, PowerPoint or PDF in the folder, named like
 *       2026-10-14 Intro to Git (Rishi B.)
 *   Date first, then the title, then the presenter in parentheses. Date and presenter are optional;
 *   without a date, the file's creation date is used. Anything typed in the file's Drive
 *   "Description" (right-click > File information > Details) becomes the card's summary.
 *   It shows up on the site within about 20 minutes, or run presSyncNow to update right away.
 *
 * Decks owned by someone else (for example a school account) can be added as shortcuts, but
 * their thumbnails and links only work if their owner shares them as "Anyone with the link".
 * Making a copy into the folder (File > Make a copy) avoids that.
 */

const PRES_FOLDER_NAME = 'CRHS CS Club presentations';
const PRES_TAB = 'Presentations';
const PRES_TYPES = [MimeType.GOOGLE_SLIDES, MimeType.MICROSOFT_POWERPOINT, MimeType.MICROSOFT_POWERPOINT_LEGACY, MimeType.PDF];

function presSetup() {
  const props = PropertiesService.getScriptProperties();
  const sheetId = props.getProperty('SHEET_ID');
  if (!sheetId) { Logger.log('Run createProjectForm and finishSetup (in the other file) first, so there is a spreadsheet to use.'); return; }

  let folderId = props.getProperty('PRES_FOLDER_ID');
  let folder = null;
  if (folderId) { try { folder = DriveApp.getFolderById(folderId); } catch (e) { folder = null; } }
  if (!folder) {
    const found = DriveApp.getFoldersByName(PRES_FOLDER_NAME);
    folder = found.hasNext() ? found.next() : DriveApp.createFolder(PRES_FOLDER_NAME);
    props.setProperty('PRES_FOLDER_ID', folder.getId());
  }
  folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  const ss = SpreadsheetApp.openById(sheetId);
  if (!ss.getSheetByName(PRES_TAB)) ss.insertSheet(PRES_TAB);

  if (!ScriptApp.getProjectTriggers().some(t => t.getHandlerFunction() === 'presSyncNow')) {
    ScriptApp.newTrigger('presSyncNow').timeBased().everyMinutes(15).create();
  }
  presSyncNow();

  Logger.log('Presentations folder: ' + folder.getUrl());
  Logger.log('Add officers as editors of that folder so they can drop slides in.');
  Logger.log('Last step: in ' + ss.getUrl() + ' use File > Share > Publish to web, pick the "' + PRES_TAB +
    '" tab and "Comma-separated values (.csv)", click Publish, and send that link to the club site.');
}

function presSyncNow() {
  const props = PropertiesService.getScriptProperties();
  const folderId = props.getProperty('PRES_FOLDER_ID'), sheetId = props.getProperty('SHEET_ID');
  if (!folderId || !sheetId) { Logger.log('Run presSetup first.'); return; }
  const tz = Session.getScriptTimeZone();
  const rows = [];

  const visit = (folder, depth) => {
    const files = folder.getFiles();
    while (files.hasNext()) {
      const f = files.next();
      let id = f.getId(), type = f.getMimeType(), url = f.getUrl();
      if (type === MimeType.SHORTCUT) {
        id = f.getTargetId(); type = f.getTargetMimeType();
        url = type === MimeType.GOOGLE_SLIDES ? 'https://docs.google.com/presentation/d/' + id + '/edit' : 'https://drive.google.com/file/d/' + id + '/view';
      } else {
        // Files the club owns are made viewable by link so thumbnails and the slides open for everyone.
        try {
          if (f.getSharingAccess() !== DriveApp.Access.ANYONE_WITH_LINK) f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        } catch (e) { Logger.log('Could not share "' + f.getName() + '": ' + e); }
      }
      if (PRES_TYPES.indexOf(type) < 0) continue;
      if (type === MimeType.GOOGLE_SLIDES) url = 'https://docs.google.com/presentation/d/' + id + '/edit?usp=sharing';

      const info = presParseName(f.getName());
      const date = info.date || Utilities.formatDate(f.getDateCreated(), tz, 'yyyy-MM-dd');
      rows.push([info.title, info.presenter, date, (f.getDescription() || '').trim(), url, id]);
    }
    if (depth < 2) { const subs = folder.getFolders(); while (subs.hasNext()) visit(subs.next(), depth + 1); }   // e.g. one folder per year
  };
  visit(DriveApp.getFolderById(folderId), 0);

  rows.sort((a, b) => (a[2] < b[2] ? 1 : a[2] > b[2] ? -1 : 0));
  const sheet = SpreadsheetApp.openById(sheetId).getSheetByName(PRES_TAB);
  const header = ['Title', 'Presented by', 'Date', 'Summary', 'Slides link', 'File ID'];
  sheet.clearContents();
  sheet.getRange(1, 1, 1, header.length).setValues([header]).setFontWeight('bold');
  if (rows.length) {
    sheet.getRange(2, 3, rows.length, 1).setNumberFormat('@');   // keep dates as text: YYYY-MM-DD
    sheet.getRange(2, 1, rows.length, header.length).setValues(rows);
  }
  sheet.setFrozenRows(1);
  Logger.log('Synced ' + rows.length + ' presentation(s).');
}

// "2026-10-14 Intro to Git (Rishi B.)" -> date, title, presenter. Each part is optional.
function presParseName(name) {
  let s = String(name).replace(/\.(pptx?|pdf|key)$/i, '').trim();
  let date = '', presenter = '';
  const d = s.match(/^(\d{4})[-_.](\d{1,2})[-_.](\d{1,2})\s*[-–—:]?\s*/);
  if (d) {
    date = d[1] + '-' + ('0' + d[2]).slice(-2) + '-' + ('0' + d[3]).slice(-2);
    s = s.slice(d[0].length);
  }
  const p = s.match(/\s*\(([^()]+)\)\s*$/);
  if (p) { presenter = p[1].trim(); s = s.slice(0, p.index); }
  return { date: date, title: s.trim() || String(name), presenter: presenter };
}
