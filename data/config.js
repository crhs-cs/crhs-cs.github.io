// Site settings.
//
// projectsFormURL: the link people open to submit a project (the form's "Send" link).
//
// projectsSheetCSV: the "Publish to web" CSV link for the PUBLIC tab of the project submissions
// sheet (the tab that only contains approved projects).
// It looks like: https://docs.google.com/spreadsheets/d/e/XXXX/pub?gid=1234&single=true&output=csv
//
// presentationsSheetCSV: the "Publish to web" CSV link for the Presentations tab, which
// tools/presentations-sync.gs fills from the club's presentations Drive folder.

window.CLUB_CONFIG = {
  projectsFormURL: "https://docs.google.com/forms/d/e/1FAIpQLSeYWFKv4fownpd0feaRmSdA1E4eXp_GuZY53vGzUy1gqB5A5A/viewform",
  presentationsSheetCSV: "",
  projectsSheetCSV: "https://docs.google.com/spreadsheets/d/e/2PACX-1vQe-wfoE6_QH3BMG-SXqC4LHV_8ImaC8UI96XwMbl7sc9Q7MRzUAbjiDzxuq3ymSTqNr1ezwieuS5mW/pub?gid=0&single=true&output=csv",
};
