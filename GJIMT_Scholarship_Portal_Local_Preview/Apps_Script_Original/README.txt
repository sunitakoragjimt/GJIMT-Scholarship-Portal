GJIMT SCHOLARSHIP PORTAL — SETUP GUIDE
======================================

CONTENTS
- Code.gs       Google Apps Script backend
- Index.html    Main page and page structure
- Styles.html   Red + Light Grey responsive CSS
- Client.html   Browser-side JavaScript

IMPORTANT
The supplied spreadsheet ID is already configured in Code.gs:
1DKae1iXln6SUhDhwBb2FnO_jDZnyO-nqmnZujtzoFtc

A. CREATE THE APPS SCRIPT PROJECT
1. Open https://script.google.com/ while signed in to the Google account that can edit the spreadsheet.
2. Click New project.
3. Rename it: GJIMT Scholarship Portal.
4. Rename the default Code.gs and paste the supplied Code.gs.
5. Click + beside Files > HTML. Create files named exactly:
   Index, Styles, Client
   (Apps Script will display them as Index.html, Styles.html, Client.html)
6. Paste each matching file's contents from this package.
7. In Code.gs, verify SPREADSHEET_ID.
8. Save the project.

B. CONFIGURE ADMIN LOGIN
1. In Code.gs, find function configureAdmin().
2. Replace CHANGE_THIS_ADMIN_USERNAME with your admin username.
3. Replace CHANGE_THIS_TO_A_STRONG_PASSWORD with a unique password of at least 12 characters.
4. Save.
5. In the function dropdown, select configureAdmin and click Run.
6. Approve the requested permissions.
7. Do not share the admin password with students.

C. CREATE THE SHEET TAB
1. Select setupSheets in the function dropdown.
2. Click Run and approve permissions.
3. The script creates a tab named "Scholarship Registrations" in the supplied spreadsheet.
4. Existing tabs are not deleted.

D. DEPLOY THE WEBSITE
1. Click Deploy > New deployment.
2. Select type: Web app.
3. Execute as: Me.
4. Who has access: Anyone (needed for public student registration).
5. Click Deploy and authorize.
6. Copy the Web App URL and open it in a private/incognito window to test.
7. Keep the Apps Script project private. Only share the deployed web app URL.

E. SCHOLARSHIP LOGIC
Marks are entered out of 800. Percentage = marks / 800 * 100.
- 95% and above: 100%
- 90% to below 95%: 50%
- 80% to below 90%: 30%
- 70% to below 80%: 20%
- Below 70%: Not eligible

The same slabs apply to whichever selected class (9, 10 or 11), per the user's instruction.
This is provisional eligibility; verify school/board records and final admission terms before awarding a concession.

F. EMAIL
Registration confirmation emails use Google Apps Script MailApp and are sent from the Google account that owns the script. The account may require authorization or have sending quotas.

G. WHATSAPP
WhatsApp sending is intentionally inactive until the institution configures Meta WhatsApp Business Cloud API.
1. Create/verify a WhatsApp Business Platform account and phone number.
2. Create and get approval for a WhatsApp message template with exactly THREE body placeholders:
   {{1}} candidate name
   {{2}} voucher number
   {{3}} scholarship percentage
3. In Apps Script > Project Settings > Script Properties, add:
   WA_ACCESS_TOKEN       = your permanent/system-user access token
   WA_PHONE_NUMBER_ID    = your WhatsApp Cloud API phone number ID
   WA_TEMPLATE_NAME      = exact approved template name
   WA_TEMPLATE_LANGUAGE = en (or the approved template language code)
4. Do not paste tokens into HTML or share them with students.
5. Test with opted-in recipient numbers first. WhatsApp may require approved templates for business-initiated messages.
The app attempts student and parent WhatsApp notifications after saving. If WhatsApp is not configured, registration still saves and email still sends.

H. TEST BEFORE PUBLIC LAUNCH
- Test student registration with dummy details first.
- Test 0, 559, 560, 639, 640, 719, 720, 759 and 760 marks to check slab boundaries.
- Confirm a row is written to the spreadsheet.
- Test admin login and CSV export.
- Test invalid mobile/email and duplicate student mobile + class.
- Test email delivery and WhatsApp only after configuring those services.
- Review privacy notice, consent, data retention and access permissions with the institution before public launch.

NOTES / LIMITATIONS
- This starter app stores student data in the linked Google Sheet.
- Admin authentication uses a hashed password in Apps Script Script Properties and a short-lived server-side cache session.
- Do not use a shared or easily guessed password.
- The voucher is provisional, not proof of final admission or a legally binding fee concession.
- The form currently calculates percentage from marks out of 800 for every selected class, as requested. Confirm that 800 is the correct maximum marks for each class before launch.
- The form collects a Class 12 board roll number as an optional field because it may not yet be available to students in Classes 9–11.
