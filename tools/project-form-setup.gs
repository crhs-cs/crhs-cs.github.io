/**
 * Cedar Ridge CS Club: project submission form setup.
 *
 * Builds the Google Form that feeds the Projects page, its response spreadsheet, an "Approved"
 * checkbox column, and a "Public" tab that contains only approved projects (the only tab that
 * gets published to the website).
 *
 * How to use:
 *   1. Go to https://script.google.com, signed in to the account that should own the form.
 *      Click "New project", delete the starter code, and paste this whole file in.
 *   2. Choose createProjectForm in the function menu at the top and click Run. Approve the
 *      permissions it asks for (it's your own script; on the "Google hasn't verified this app"
 *      screen, click Advanced, then "Go to ... (unsafe)").
 *   3. Open the form's edit link from the log, and add one more question at the end:
 *      "Screenshot", type File upload, only Image files, 1 file, 10 MB max. (Scripts can't create
 *      file upload questions, so this one is manual.)
 *   4. Back here, choose finishSetup and click Run.
 *   5. Follow the last steps printed in the log: publish the Public tab as CSV and send the links.
 *   6. Choose installAutoShare and click Run, so uploaded screenshots can show on the site.
 *      (shareUploadsNow fixes any screenshots that were uploaded before this was on.)
 */

const FORM_TITLE = 'Cedar Ridge CS Club: Add Your Project';
const SHEET_TITLE = 'CRHS CS Club project submissions';
const TAGS = ['Python', 'JavaScript', 'Java', 'C++', 'Web', 'Game', 'App', 'AI / ML', 'Hardware', 'Algorithms', 'Data'];

function createProjectForm() {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('FORM_ID')) {
    Logger.log('A form was already created by this script: ' + FormApp.openById(props.getProperty('FORM_ID')).getEditUrl());
    Logger.log('To start over, delete that form and spreadsheet, then run resetSetup() before running this again.');
    return;
  }

  const form = FormApp.create(FORM_TITLE);
  form.setDescription(
    'Presented a project at a CS Club meeting? Add it to the club website.\n' +
    'An officer reviews each submission before it shows up on the Projects page. ' +
    'Everything you enter here appears publicly on the site, so use first names only.'
  );
  form.setCollectEmail(false);
  form.setAllowResponseEdits(false);
  form.setLimitOneResponsePerUser(false);
  form.setShowLinkToRespondAgain(true);
  form.setProgressBar(false);
  form.setConfirmationMessage('Thanks! An officer will review your project, and it will show up on the Projects page once approved.');

  const urlCheck = FormApp.createTextValidation()
    .setHelpText('Paste a full link starting with https://')
    .requireTextIsUrl()
    .build();
  const shortCheck = FormApp.createTextValidation()
    .setHelpText('Keep it to one short line (120 characters or less).')
    .requireTextLengthLessThanOrEqualTo(120)
    .build();

  form.addTextItem()
    .setTitle('Project name')
    .setRequired(true);
  form.addTextItem()
    .setTitle('Presented by')
    .setHelpText('First names, or first name and last initial (the site is public). Separate teammates with commas.')
    .setRequired(true);
  form.addDateItem()
    .setTitle('Date presented')
    .setHelpText('The meeting where you presented it.')
    .setRequired(true);
  form.addTextItem()
    .setTitle('One-line summary')
    .setHelpText('Shown on the project card, e.g. "A Discord bot that pings a channel before assignments are due."')
    .setValidation(shortCheck)
    .setRequired(true);
  form.addParagraphTextItem()
    .setTitle('Describe your project')
    .setHelpText('A few sentences for your project\'s page: what it does, how it works, and what was hardest.');
  form.addCheckboxItem()
    .setTitle('Tags')
    .setHelpText('Pick a few. Used to filter projects on the site.')
    .setChoiceValues(TAGS)
    .showOtherOption(true);
  form.addTextItem()
    .setTitle('Code link (GitHub)')
    .setValidation(urlCheck);
  form.addTextItem()
    .setTitle('Live demo link')
    .setHelpText('A version people can try, if there is one.')
    .setValidation(urlCheck);
  form.addTextItem()
    .setTitle('Slides link')
    .setHelpText('For Google Slides, set sharing to "Anyone with the link can view" first.')
    .setValidation(urlCheck);

  const ss = SpreadsheetApp.create(SHEET_TITLE);
  form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());

  props.setProperty('FORM_ID', form.getId());
  props.setProperty('SHEET_ID', ss.getId());

  Logger.log('Form created.');
  Logger.log('1) Open the form editor: ' + form.getEditUrl());
  Logger.log('2) Add a last question: "Screenshot", type File upload, allow only Image, max 1 file, max 10 MB.');
  Logger.log('3) Come back here and run finishSetup.');
}

function finishSetup() {
  const props = PropertiesService.getScriptProperties();
  const formId = props.getProperty('FORM_ID'), sheetId = props.getProperty('SHEET_ID');
  if (!formId || !sheetId) { Logger.log('Run createProjectForm first.'); return; }
  const form = FormApp.openById(formId);
  const ss = SpreadsheetApp.openById(sheetId);
  SpreadsheetApp.flush();

  // The tab the form writes responses into.
  const responses = ss.getSheets().filter(s => s.getFormUrl())[0];
  if (!responses) { Logger.log('Could not find the form responses tab yet. Wait a minute and run finishSetup again.'); return; }

  const hasUpload = form.getItems().some(i => i.getType() === FormApp.ItemType.FILE_UPLOAD);
  if (!hasUpload) Logger.log('Note: no Screenshot (file upload) question found. Projects will use generated covers until one is added; run finishSetup again after adding it.');

  // ---- Approved checkbox column, right after the form's columns ----
  let headers = responses.getRange(1, 1, 1, responses.getLastColumn()).getValues()[0].map(String);
  let approvedCol = headers.findIndex(h => /^approved$/i.test(h.trim())) + 1;
  if (!approvedCol) {
    approvedCol = headers.length + 1;
    responses.getRange(1, approvedCol).setValue('Approved').setFontWeight('bold');
    headers.push('Approved');
  }
  responses.getRange(2, approvedCol, 1999, 1).setDataValidation(SpreadsheetApp.newDataValidation().requireCheckbox().build());
  responses.setFrozenRows(1);

  // ---- Public tab: approved rows only, without the timestamp or the Approved column ----
  let pub = ss.getSheetByName('Public');
  if (!pub) {
    const blank = ss.getSheets().find(s => !s.getFormUrl() && s.getLastRow() === 0 && s.getName() !== responses.getName());
    pub = blank ? blank.setName('Public') : ss.insertSheet('Public');
  }
  const keep = [];
  headers.forEach((h, i) => { if (i > 0 && i + 1 !== approvedCol && h.trim()) keep.push(i + 1); });
  const lastColLetter = columnLetter(Math.max(approvedCol, headers.length));
  const src = "'" + responses.getName().replace(/'/g, "''") + "'!A:" + lastColLetter;
  const formula = '=QUERY({' + src + '}, "select ' + keep.map(c => 'Col' + c).join(', ') +
    ' where Col' + approvedCol + ' = true", 1)';
  pub.clear();
  pub.getRange('A1').setFormula(formula);
  // Dates as YYYY-MM-DD so the website reads them the same way in every locale.
  const dateOut = keep.findIndex(c => /date/i.test(headers[c - 1])) + 1;
  if (dateOut) pub.getRange(2, dateOut, 2000, 1).setNumberFormat('yyyy-mm-dd');
  pub.setFrozenRows(1);
  pub.getRange(1, 1, 1, keep.length).setFontWeight('bold');
  ss.setActiveSheet(responses);

  // ---- Let uploaded screenshots display on the site ----
  if (hasUpload) {
    const folders = DriveApp.getFoldersByName(form.getTitle() + ' (File responses)');
    if (folders.hasNext()) {
      folders.next().setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      Logger.log('Screenshot uploads folder is now viewable by link, so images can show on the site.');
    } else {
      Logger.log('Could not find the uploads folder yet (Google creates it when the upload question is added). ' +
        'In Drive, find "' + form.getTitle() + ' (File responses)" and share it as "Anyone with the link: Viewer".');
    }
  }

  Logger.log('Done. Spreadsheet: ' + ss.getUrl());
  Logger.log('To approve a project, tick its box in the Approved column.');
  Logger.log('Last steps:');
  Logger.log('  A) In the spreadsheet: File > Share > Publish to web. Pick the "Public" tab and "Comma-separated values (.csv)", click Publish, and copy the link.');
  Logger.log('  B) Send the club these two links for data/config.js:');
  Logger.log('     projectsFormURL:  ' + form.getPublishedUrl());
  Logger.log('     projectsSheetCSV: (the link from step A)');
}

// Makes every uploaded screenshot viewable by anyone with the link, so the website can show it.
// Uploaded files don't always pick up the folder's sharing, so this sets it on each file.
function shareUploadsNow() {
  const formId = PropertiesService.getScriptProperties().getProperty('FORM_ID');
  if (!formId) { Logger.log('Run createProjectForm first.'); return; }
  const form = FormApp.openById(formId);
  let shared = 0, failed = 0;
  form.getResponses().forEach(r => r.getItemResponses().forEach(ir => {
    if (ir.getItem().getType() !== FormApp.ItemType.FILE_UPLOAD) return;
    [].concat(ir.getResponse() || []).forEach(fileId => {
      try {
        const file = DriveApp.getFileById(fileId);
        if (file.getSharingAccess() !== DriveApp.Access.ANYONE_WITH_LINK) {
          file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        }
        shared++;
      } catch (err) { failed++; Logger.log('Could not share file ' + fileId + ': ' + err); }
    });
  }));
  Logger.log(shared + ' screenshot(s) are viewable by link' + (failed ? ', ' + failed + ' failed (see above).' : '.'));
}

// Run once: from now on, each new submission's screenshot is shared automatically.
function installAutoShare() {
  const formId = PropertiesService.getScriptProperties().getProperty('FORM_ID');
  if (!formId) { Logger.log('Run createProjectForm first.'); return; }
  const exists = ScriptApp.getProjectTriggers().some(t => t.getHandlerFunction() === 'onProjectSubmit');
  if (!exists) ScriptApp.newTrigger('onProjectSubmit').forForm(FormApp.openById(formId)).onFormSubmit().create();
  shareUploadsNow();
  Logger.log(exists ? 'Auto-sharing was already on.' : 'Auto-sharing is on: new screenshots will be shared as they come in.');
}

function onProjectSubmit(e) {
  shareUploadsNow();
}

// Clears what this script remembers, so createProjectForm can run again. Doesn't delete any files.
function resetSetup() {
  PropertiesService.getScriptProperties().deleteAllProperties();
  Logger.log('Reset. You can run createProjectForm again.');
}

function columnLetter(n) {
  let s = '';
  while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
  return s;
}
