/**
 * GJIMT Academic Excellence Scholarship Portal
 * Google Apps Script backend.
 *
 * Setup:
 * 1) Set SPREADSHEET_ID below.
 * 2) Set ADMIN_USERNAME and ADMIN_PASSWORD in configureAdmin() and run it once.
 * 3) Run setupSheets() once and authorize.
 * 4) Deploy as Web App: Execute as Me; access Anyone.
 */

const SPREADSHEET_ID = "1DKae1iXln6SUhDhwBb2FnO_jDZnyO-nqmnZujtzoFtc";
const SHEET_NAME = "Scholarship Registrations";
const SESSION_SECONDS = 21600; // 6 hours
const REGISTRATION_DEADLINE = "31 December 2026";

const HEADERS = [
  "Timestamp", "Voucher No", "Candidate Name", "Father Name", "Mother Name",
  "School Name", "School Address", "Selected Class", "Marks Obtained",
  "Maximum Marks", "Percentage", "Scholarship Percentage", "Student Mobile",
  "Father Mobile", "Email", "Class 12 Board Roll Number", "Eligible Courses",
  "Registration Status"
];

function doGet() {
  setupSheets();
  return HtmlService.createTemplateFromFile("Index")
    .evaluate()
    .setTitle("GJIMT Academic Excellence Scholarship")
    .addMetaTag("viewport", "width=device-width, initial-scale=1");
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function setupSheets() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) sh = ss.insertSheet(SHEET_NAME);
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, HEADERS.length)
      .setFontWeight("bold").setBackground("#b82f38").setFontColor("#ffffff");
    sh.autoResizeColumns(1, HEADERS.length);
  }
  return "Sheet ready: " + SHEET_NAME;
}

/**
 * Run once after replacing the two values.
 * Use a strong password and do not share it with students.
 */
function configureAdmin() {
  const ADMIN_USERNAME = "CHANGE_THIS_ADMIN_USERNAME";
  const ADMIN_PASSWORD = "CHANGE_THIS_TO_A_STRONG_PASSWORD";
  if (ADMIN_USERNAME.indexOf("CHANGE_THIS") === 0 ||
      ADMIN_PASSWORD.indexOf("CHANGE_THIS") === 0 ||
      ADMIN_PASSWORD.length < 12) {
    throw new Error("Edit configureAdmin(): use your own admin username and a password of at least 12 characters.");
  }
  const props = PropertiesService.getScriptProperties();
  props.setProperty("ADMIN_USERNAME", ADMIN_USERNAME);
  props.setProperty("ADMIN_PASSWORD_HASH", sha256_(ADMIN_PASSWORD));
  return "Admin credentials saved securely in Script Properties.";
}

function submitRegistration(data) {
  validateRegistration_(data);
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const sh = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
    if (!sh) throw new Error("Registration sheet is not configured. Run setupSheets().");

    // Prevent accidental duplicate submissions using student mobile + class.
    const last = sh.getLastRow();
    if (last > 1) {
      const existing = sh.getRange(2, 13, last - 1, 1).getDisplayValues().flat();
      const classes = sh.getRange(2, 8, last - 1, 1).getDisplayValues().flat();
      const mobile = String(data.studentMobile).replace(/\D/g, "").slice(-10);
      for (let i = 0; i < existing.length; i++) {
        if (String(existing[i]).replace(/\D/g, "").slice(-10) === mobile &&
            classes[i] === String(data.selectedClass)) {
          throw new Error("A registration already exists for this student mobile number and class. Please contact GJIMT if you need help.");
        }
      }
    }

    const percentage = Math.round((Number(data.marksObtained) / 800) * 10000) / 100;
    const scholarship = scholarshipFor_(percentage);
    const voucher = createVoucher_();
    const courses = "BBA | BCA | BCom (Hons)";
    const status = scholarship > 0 ? "Eligible - provisional" : "Not eligible";
    const row = [
      new Date(), voucher, clean_(data.candidateName), clean_(data.fatherName),
      clean_(data.motherName), clean_(data.schoolName), clean_(data.schoolAddress),
      String(data.selectedClass), Number(data.marksObtained), 800, percentage,
      scholarship, normalizePhone_(data.studentMobile), normalizePhone_(data.fatherMobile),
      clean_(data.email).toLowerCase(), clean_(data.boardRollNumber || ""),
      courses, status
    ];
    sh.appendRow(row);

    const result = {
      success: true, voucherNo: voucher, percentage: percentage,
      scholarship: scholarship, status: status, candidateName: clean_(data.candidateName),
      selectedClass: String(data.selectedClass), courses: courses,
      deadline: REGISTRATION_DEADLINE
    };

    // Notifications are best-effort. A provider failure must not undo registration.
    try { sendConfirmationEmail_(result, data.email); } catch (emailErr) {
      console.error("Email notification failed: " + emailErr);
    }
    try { sendWhatsAppTemplate_(result, normalizePhone_(data.studentMobile)); } catch (waErr) {
      console.error("Student WhatsApp failed: " + waErr);
    }
    try { sendWhatsAppTemplate_(result, normalizePhone_(data.fatherMobile)); } catch (waErr2) {
      console.error("Parent WhatsApp failed: " + waErr2);
    }
    return result;
  } finally {
    lock.releaseLock();
  }
}

function validateRegistration_(d) {
  if (!d || typeof d !== "object") throw new Error("Please complete the registration form.");
  const required = ["candidateName", "fatherName", "motherName", "schoolName",
    "schoolAddress", "selectedClass", "marksObtained", "studentMobile",
    "fatherMobile", "email", "consent"];
  required.forEach(k => { if (d[k] === undefined || String(d[k]).trim() === "") throw new Error("Please complete all required fields."); });
  ["candidateName", "fatherName", "motherName"].forEach(k => {
    if (!/^[\p{L}][\p{L}\s.'-]{1,79}$/u.test(String(d[k]).trim())) throw new Error("Please enter a valid name (letters only) in all name fields.");
  });
  if (!["9", "10", "11"].includes(String(d.selectedClass))) throw new Error("Please select Class 9, 10 or 11.");
  const marks = Number(d.marksObtained);
  if (!Number.isFinite(marks) || marks < 0 || marks > 800) throw new Error("Marks must be between 0 and 800.");
  if (!/^[6-9]\d{9}$/.test(String(d.studentMobile).replace(/\D/g, "").slice(-10))) throw new Error("Enter a valid 10-digit Indian student mobile number.");
  if (!/^[6-9]\d{9}$/.test(String(d.fatherMobile).replace(/\D/g, "").slice(-10))) throw new Error("Enter a valid 10-digit Indian parent mobile number.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(d.email).trim())) throw new Error("Enter a valid email address.");
  if (d.consent !== true && String(d.consent) !== "true") throw new Error("Please confirm consent before submitting.");
}

function scholarshipFor_(pct) {
  if (pct >= 95) return 100;
  if (pct >= 90) return 50;
  if (pct >= 80) return 30;
  if (pct >= 70) return 20;
  return 0;
}

function createVoucher_() {
  const code = Utilities.getUuid().replace(/-/g, "").substring(0, 8).toUpperCase();
  return "GJAE/2027/" + code;
}

function clean_(value) {
  return String(value == null ? "" : value).trim().replace(/[<>]/g, "");
}

function normalizePhone_(value) {
  return String(value || "").replace(/\D/g, "").slice(-10);
}

function sha256_(value) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, value, Utilities.Charset.UTF_8);
  return bytes.map(b => ("0" + ((b + 256) % 256).toString(16)).slice(-2)).join("");
}

function adminLogin(username, password) {
  const props = PropertiesService.getScriptProperties();
  const savedUser = props.getProperty("ADMIN_USERNAME");
  const savedHash = props.getProperty("ADMIN_PASSWORD_HASH");
  if (!savedUser || !savedHash) throw new Error("Admin is not configured. The website administrator must run configureAdmin() first.");
  if (String(username) !== savedUser || sha256_(String(password || "")) !== savedHash) {
    throw new Error("Incorrect admin username or password.");
  }
  const token = Utilities.getUuid() + Utilities.getUuid();
  CacheService.getScriptCache().put("admin_" + token, "valid", SESSION_SECONDS);
  return { success: true, token: token };
}

function requireAdmin_(token) {
  if (!token || CacheService.getScriptCache().get("admin_" + token) !== "valid") {
    throw new Error("Your admin session has expired. Please log in again.");
  }
}

function adminLogout(token) {
  if (token) CacheService.getScriptCache().remove("admin_" + token);
  return { success: true };
}

function adminGetDashboard(token) {
  requireAdmin_(token);
  const rows = getRegistrationRows_();
  const stats = {
    total: rows.length, eligible: 0, notEligible: 0,
    scholarship100: 0, scholarship50: 0, scholarship30: 0, scholarship20: 0,
    class9: 0, class10: 0, class11: 0
  };
  rows.forEach(r => {
    const pct = Number(r[10]) || 0;
    const slab = Number(r[11]) || scholarshipFor_(pct);
    if (slab > 0) stats.eligible++; else stats.notEligible++;
    if (slab === 100) stats.scholarship100++;
    if (slab === 50) stats.scholarship50++;
    if (slab === 30) stats.scholarship30++;
    if (slab === 20) stats.scholarship20++;
    if (String(r[7]) === "9") stats.class9++;
    if (String(r[7]) === "10") stats.class10++;
    if (String(r[7]) === "11") stats.class11++;
  });
  return { stats: stats, recent: rows.slice(-8).reverse().map(toStudentObject_) };
}

function adminGetStudents(token, filters) {
  requireAdmin_(token);
  let rows = getRegistrationRows_().map(toStudentObject_).reverse();
  filters = filters || {};
  if (filters.search) {
    const q = String(filters.search).toLowerCase();
    rows = rows.filter(r => [r.candidateName, r.fatherName, r.schoolName, r.studentMobile, r.voucherNo, r.email]
      .some(v => String(v || "").toLowerCase().includes(q)));
  }
  if (filters.slab && filters.slab !== "all") rows = rows.filter(r => String(r.scholarship) === String(filters.slab));
  if (filters.selectedClass && filters.selectedClass !== "all") rows = rows.filter(r => String(r.selectedClass) === String(filters.selectedClass));
  return rows;
}

function getRegistrationRows_() {
  const sh = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
  if (!sh || sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, HEADERS.length).getValues();
}

function toStudentObject_(r) {
  return {
    timestamp: r[0] instanceof Date ? Utilities.formatDate(r[0], Session.getScriptTimeZone(), "dd MMM yyyy, hh:mm a") : String(r[0]),
    voucherNo: String(r[1]), candidateName: String(r[2]), fatherName: String(r[3]),
    motherName: String(r[4]), schoolName: String(r[5]), schoolAddress: String(r[6]),
    selectedClass: String(r[7]), marksObtained: Number(r[8]), percentage: Number(r[10]),
    scholarship: Number(r[11]), studentMobile: String(r[12]), fatherMobile: String(r[13]),
    email: String(r[14]), boardRollNumber: String(r[15]), courses: String(r[16]), status: String(r[17])
  };
}

function sendConfirmationEmail_(result, email) {
  if (!email) return;
  const subject = "GJIMT Scholarship Registration – " + result.voucherNo;
  const body = "Dear " + result.candidateName + ",\n\nThank you for registering with GJIMT Academic Excellence Scholarship.\n\n" +
    "Voucher No: " + result.voucherNo + "\nClass selected: " + result.selectedClass + "\nPercentage: " + result.percentage + "%\n" +
    "Provisional scholarship: " + result.scholarship + "%\nEligible courses: " + result.courses + "\n" +
    "Registration deadline: " + result.deadline + "\n\nScholarship is provisional and subject to verification of the relevant board results and admission conditions.\n\nGJIMT";
  MailApp.sendEmail(email, subject, body);
}

function sendWhatsAppTemplate_(result, phone) {
  const props = PropertiesService.getScriptProperties();
  const accessToken = props.getProperty("WA_ACCESS_TOKEN");
  const phoneNumberId = props.getProperty("WA_PHONE_NUMBER_ID");
  const templateName = props.getProperty("WA_TEMPLATE_NAME");
  const language = props.getProperty("WA_TEMPLATE_LANGUAGE") || "en";
  if (!accessToken || !phoneNumberId || !templateName) return; // WhatsApp not configured yet.
  const payload = {
    messaging_product: "whatsapp",
    to: "91" + phone,
    type: "template",
    template: {
      name: templateName,
      language: { code: language },
      components: [{
        type: "body",
        parameters: [
          { type: "text", text: result.candidateName },
          { type: "text", text: result.voucherNo },
          { type: "text", text: String(result.scholarship) + "%" }
        ]
      }]
    }
  };
  const response = UrlFetchApp.fetch("https://graph.facebook.com/v21.0/" + phoneNumberId + "/messages", {
    method: "post",
    contentType: "application/json",
    headers: { Authorization: "Bearer " + accessToken },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
  const code = response.getResponseCode();
  if (code < 200 || code >= 300) throw new Error("WhatsApp API error " + code + ": " + response.getContentText());
}

/** Optional helper: set WhatsApp values in Script Properties before using this feature. */
function whatsappSetupInstructions() {
  return "In Apps Script > Project Settings > Script Properties, add WA_ACCESS_TOKEN, WA_PHONE_NUMBER_ID, WA_TEMPLATE_NAME, and optionally WA_TEMPLATE_LANGUAGE. The approved WhatsApp template must contain exactly three body placeholders: candidate name, voucher number, scholarship percentage.";
}
