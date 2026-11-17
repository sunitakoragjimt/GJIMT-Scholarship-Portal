
"use strict";

// ==========================================
// GJIMT SCHOLARSHIP PORTAL
// ==========================================

const SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbxY9MNYD1JJdgiiTVRT_s5Ato4ckX-pVejYp_nyFI58VNmdLcy3SN_S63RWLnPlOP5Zeg/exec";

let adminToken = null;
let cachedStudents = [];
let confirmedStudents = [];

const STORAGE_KEY = "gjimtScholarshipConfirmedStudents";

// DEMO LOGIN ONLY.
// Do not use client-side credentials for a public admin dashboard.
const DEMO_ADMIN_USER = "admin";
const DEMO_ADMIN_PASSWORD = "GJIMT@2027!Demo";

// ==========================================
// COMMON FUNCTIONS
// ==========================================

function getStudents() {
  try {
    return JSON.parse(
      localStorage.getItem(STORAGE_KEY) || "[]"
    );
  } catch (error) {
    return [];
  }
}

function saveStudents(rows) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(rows)
  );
}

function showView(id) {
  document.querySelectorAll(".view").forEach(view => {
    view.classList.remove("active");
  });

  const selected = document.getElementById(id);

  if (selected) {
    selected.classList.add("active");
  }

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

function setText(id, value) {
  const element = document.getElementById(id);

  if (element) {
    element.textContent = value;
  }
}

function esc(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]
  );
}

// ==========================================
// SCHOLARSHIP CALCULATION
// ==========================================

function scholarshipFor(percentage) {
  if (percentage >= 95) return 100;
  if (percentage >= 90) return 50;
  if (percentage >= 80) return 30;
  if (percentage >= 70) return 20;

  return 0;
}

function updateScholarshipPreview() {
  const input = document.getElementById("marksObtained");

  if (!input) return;

  const raw = input.value;

  const marks = raw === "" ? 0 : Number(raw);

  const percentage =
    Math.max(0, Math.min(800, marks)) / 800 * 100;

  const scholarship = scholarshipFor(percentage);

  setText(
    "percentageValue",
    percentage.toFixed(2) + "%"
  );

  setText(
    "scholarshipValue",
    raw === ""
      ? "—"
      : scholarship
        ? scholarship + "%"
        : "Not eligible"
  );

  setText(
    "scholarshipHint",
    raw === ""
      ? "Enter marks to check your slab"
      : scholarship
        ? "Provisional merit slab"
        : "Minimum eligibility is 70%"
  );
}

// ==========================================
// STUDENT REGISTRATION
// ==========================================

async function submitStudentForm(event) {
  event.preventDefault();

  const form = event.currentTarget;

  const msg = document.getElementById("formMessage");
  const btn = document.getElementById("submitBtn");

  if (!form.reportValidity()) return;

  const data = Object.fromEntries(
    new FormData(form).entries()
  );

  // Use the main marks field, not Class 12 expected marks.
  const mainMarks = document.getElementById("marksObtained");

  data.marksObtained = mainMarks.value;

  data.consent =
    form.elements.consent.checked ? "true" : "false";

  const marks = Number(data.marksObtained);

  // Mobile validation
  if (
    !/^[6-9]\d{9}$/.test(data.studentMobile) ||
    !/^[6-9]\d{9}$/.test(data.fatherMobile)
  ) {
    msg.textContent =
      "Enter valid 10-digit Indian mobile numbers.";

    return;
  }

  // PIN code validation
  if (!/^\d{6}$/.test(data.pinCode)) {
    msg.textContent =
      "Enter a valid 6-digit PIN code.";

    return;
  }

  // Marks validation
  if (
    data.marksObtained === "" ||
    !Number.isInteger(marks) ||
    marks < 0 ||
    marks > 800
  ) {
    msg.textContent =
      "Marks must be between 0 and 800.";

    return;
  }

  if (!form.elements.consent.checked) {
    msg.textContent =
      "Please accept the consent declaration.";

    return;
  }

  const percentage = marks / 800 * 100;
  const scholarship = scholarshipFor(percentage);

  // Match Code.gs parameter names
  data.parentMobile = data.fatherMobile;
  data.class12BoardRollNumber = data.boardRollNumber || "";

  data.calculatedPercentage = percentage.toFixed(2);
  data.percentage = percentage.toFixed(2);
  data.estimatedScholarship = String(scholarship);
  data.scholarship = String(scholarship);

  // Existing Code.gs may expect this field.
  data.fullAddress =
    data.currentAddress || data.permanentAddress || "";

  btn.disabled = true;
  btn.textContent = "Saving to Google Sheets...";
  msg.textContent = "";

  try {
    const response = await fetch(SCRIPT_URL, {
      method: "POST",
      body: new URLSearchParams(data),
      redirect: "follow"
    });

    if (!response.ok) {
      throw new Error(
        "Server returned HTTP " + response.status
      );
    }

    const result = await response.json();

    // Supports either {success:true} or {ok:true}
    if (result.success !== true && result.ok !== true) {
      throw new Error(
        result.message ||
        result.error ||
        "Google Sheets did not confirm the registration."
      );
    }

    const voucherNo =
      result.registrationId ||
      result.voucherNo ||
      result.voucher ||
      "";

    if (!voucherNo) {
      throw new Error(
        "Registration response did not include a voucher ID. " +
        "Check the Google Sheet before trying again."
      );
    }

    const registration = {
      ...data,
      marksObtained: marks,
      percentage,
      scholarship,
      voucherNo,
      timestamp: new Date().toLocaleString("en-IN"),
      status:
        scholarship > 0
          ? "Eligible - provisional"
          : "Not eligible"
    };

    // Local cache is only for the demo dashboard.
    // Google Sheets is the intended primary storage.
    const rows = getStudents();

    if (!rows.some(row => row.voucherNo === voucherNo)) {
      rows.push(registration);
      saveStudents(rows);
    }

    setText("successName", data.candidateName);
    setText("successVoucher", voucherNo);
    setText("successClass", data.selectedClass);

    setText(
      "successPercentage",
      percentage.toFixed(2) + "%"
    );

    setText(
      "successScholarship",
      scholarship
        ? scholarship + "% SCHOLARSHIP"
        : "NOT ELIGIBLE"
    );

    form.reset();
    updateScholarshipPreview();

    msg.textContent = "";

    showView("successView");

  } catch (error) {
    console.error(
      "Google Sheets registration error:",
      error
    );

    msg.textContent =
      "Registration could not be confirmed. " +
      "Please check Google Sheets before retrying. " +
      error.message;

  } finally {
    btn.disabled = false;

    btn.innerHTML =
      'Submit Registration <span>→</span>';
  }
}

// ==========================================
// ADMIN LOGIN - LOCAL DEMO ONLY
// ==========================================

function submitAdminLogin(event) {
  event.preventDefault();

  const username =
    document.getElementById("adminUsername").value;

  const password =
    document.getElementById("adminPassword").value;

  const msg = document.getElementById("loginMessage");

  const valid =
    username === DEMO_ADMIN_USER &&
    password === DEMO_ADMIN_PASSWORD;

  if (valid) {
    adminToken = "local-demo";

    msg.textContent = "";

    showView("adminView");

    loadDashboard();
    loadStudents();

  } else {
    msg.textContent =
      "Incorrect demo username or password.";
  }
}

// ==========================================
// ADMIN DASHBOARD
// ==========================================

function loadDashboard() {
  // This is a local cache, not a full Google Sheets query.
  const rows = getStudents();

  const stats = {
    total: rows.length,
    eligible: 0,
    notEligible: 0,
    scholarship100: 0,
    scholarship50: 0,
    scholarship30: 0,
    scholarship20: 0,
    class9: 0,
    class10: 0,
    class11: 0
  };

  rows.forEach(row => {
    const scholarship = Number(row.scholarship) || 0;

    if (scholarship > 0) {
      stats.eligible++;
    } else {
      stats.notEligible++;
    }

    if (scholarship === 100) stats.scholarship100++;
    if (scholarship === 50) stats.scholarship50++;
    if (scholarship === 30) stats.scholarship30++;
    if (scholarship === 20) stats.scholarship20++;

    if (String(row.selectedClass) === "9") stats.class9++;
    if (String(row.selectedClass) === "10") stats.class10++;
    if (String(row.selectedClass) === "11") stats.class11++;
  });

  const ids = {
    total: "statTotal",
    eligible: "statEligible",
    notEligible: "statNot",
    scholarship100: "stat100",
    scholarship50: "stat50",
    scholarship30: "stat30",
    scholarship20: "stat20",
    class9: "class9",
    class10: "class10",
    class11: "class11"
  };

  Object.keys(ids).forEach(key => {
    setText(ids[key], stats[key]);
  });
}

// ==========================================
// STUDENT TABLE
// ==========================================

function loadStudents() {
  if (!adminToken) return;

  const search =
    document.getElementById("searchStudents")
      .value.toLowerCase();

  const selectedClass =
    document.getElementById("filterClass").value;

  const selectedSlab =
    document.getElementById("filterSlab").value;

  cachedStudents = getStudents()
    .slice()
    .reverse()
    .filter(row => {
      const searchable = [
        row.candidateName,
        row.fatherName,
        row.schoolName,
        row.studentMobile,
        row.voucherNo,
        row.email
      ].join(" ").toLowerCase();

      const matchesSearch =
        !search || searchable.includes(search);

      const matchesClass =
        selectedClass === "all" ||
        String(row.selectedClass) === selectedClass;

      const matchesSlab =
        selectedSlab === "all" ||
        String(row.scholarship) === selectedSlab;

      return (
        matchesSearch &&
        matchesClass &&
        matchesSlab
      );
    });

  const tbody =
    document.getElementById("studentTableBody");

  if (!cachedStudents.length) {
    tbody.innerHTML =
      '<tr><td colspan="8" class="empty-cell">' +
      'No matching student registrations found.' +
      '</td></tr>';

    setText("studentCount", "0 registrations shown");
    return;
  }

  tbody.innerHTML = cachedStudents.map(row => {
    const scholarship = Number(row.scholarship) || 0;

    return `
      <tr>
        <td>
          ${esc(row.candidateName)}
          <br>
          <small>${esc(row.schoolName)}</small>
        </td>
        <td>Class ${esc(row.selectedClass)}</td>
        <td>${Number(row.marksObtained)} / 800</td>
        <td>${Number(row.percentage).toFixed(2)}%</td>
        <td>
          <span class="slab-pill ${scholarship ? "" : "none"}">
            ${scholarship ? scholarship + "%" : "Not eligible"}
          </span>
        </td>
        <td>${esc(row.studentMobile)}</td>
        <td>${esc(row.voucherNo)}</td>
        <td>${esc(row.timestamp)}</td>
      </tr>
    `;
  }).join("");

  setText(
    "studentCount",
    cachedStudents.length + " registration(s) shown"
  );
}

// ==========================================
// CSV EXPORT
// ==========================================

function exportCsv() {
  if (!adminToken) {
    alert("Please log in first.");
    return;
  }

  if (!cachedStudents.length) {
    alert("No records to export.");
    return;
  }

  const columns = [
    "candidateName",
    "fatherName",
    "motherName",
    "studentMobile",
    "fatherMobile",
    "email",
    "currentAddress",
    "permanentAddress",
    "pinCode",
    "state",
    "schoolName",
    "schoolAddress",
    "boardRollNumber",
    "selectedClass",
    "marksObtained",
    "percentage",
    "scholarship",
    "stream",
    "subjectName",
    "expectedClass12Marks",
    "voucherNo",
    "timestamp",
    "status"
  ];

  const csvEscape = value => {
    let text = String(value ?? "");

    // Prevent spreadsheet formula execution.
    if (/^[\s]*[=+\-@]/.test(text)) {
      text = "'" + text;
    }

    return '"' + text.replace(/"/g, '""') + '"';
  };

  const lines = [
    columns.map(csvEscape).join(","),
    ...cachedStudents.map(row =>
      columns.map(key => csvEscape(row[key])).join(",")
    )
  ];

  const blob = new Blob(
    ["\uFEFF" + lines.join("\r\n")],
    { type: "text/csv;charset=utf-8" }
  );

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = "GJIMT_Scholarship_Registrations.csv";

  document.body.appendChild(link);
  link.click();
  link.remove();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ==========================================
// LOGOUT
// ==========================================

function logoutAdmin() {
  adminToken = null;
  cachedStudents = [];

  document.getElementById("adminLoginForm").reset();

  setText("loginMessage", "");

  showView("welcomeView");
}

// ==========================================
// ERROR HANDLING
// ==========================================

function showAdminError(error) {
  console.error(error);

  alert(
    error?.message ||
    "Could not load admin data."
  );
}

// ==========================================
// INITIALIZATION
// ==========================================

document.addEventListener("DOMContentLoaded", () => {
  updateScholarshipPreview();
});
