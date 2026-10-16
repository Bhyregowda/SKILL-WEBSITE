// ===================================================
// Smart Seed Quality Identification System
// Plain JavaScript - no libraries, no backend
// ===================================================

// ---------- Get elements from the page ----------
const form = document.getElementById("seedForm");
const errorBox = document.getElementById("errorBox");
const resetBtn = document.getElementById("resetBtn");
const downloadBtn = document.getElementById("downloadBtn");

const resultEmpty = document.getElementById("resultEmpty");
const resultContent = document.getElementById("resultContent");
const resultFor = document.getElementById("resultFor");
const scoreValue = document.getElementById("scoreValue");
const resultBadge = document.getElementById("resultBadge");
const progressFill = document.getElementById("progressFill");
const germValue = document.getElementById("germValue");
const resultMessage = document.getElementById("resultMessage");
const warningsWrap = document.getElementById("warningsWrap");
const warningsList = document.getElementById("warningsList");
const breakdownBody = document.getElementById("breakdownBody");
const suggestionsList = document.getElementById("suggestionsList");

// Footer year
document.getElementById("year").textContent = new Date().getFullYear();

// This variable keeps the latest result so the Download button can use it
let lastResult = null;

// ---------- Rules (easy to change) ----------

// Safe moisture range (in %) for each crop: [lowest, highest]
const moistureRanges = {
  Wheat: [10, 12],
  Rice: [12, 14],
  Maize: [11, 13],
  Cotton: [8, 10],
  Tomato: [5, 7],
  Other: [8, 13]
};

// Marks for dropdown choices
const appearanceMarks = {
  "Healthy": 10,
  "Slightly damaged": 6,
  "Damaged": 2,
  "Discolored or fungus": 0
};

const sizeMarks = {
  "Uniform": 10,
  "Mixed sizes": 6,
  "Very small or light": 2
};

const packagingMarks = {
  "Sealed and labeled": 5,
  "Opened": 3,
  "No label": 2,
  "Damaged packet": 1
};

// ---------- Small helper functions ----------

// Today's date as text like "2026-10-16" (local time) so it can be compared with the date inputs
function getTodayString() {
  const d = new Date();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return d.getFullYear() + "-" + month + "-" + day;
}

// Round to 1 decimal place
function round1(number) {
  return Math.round(number * 10) / 10;
}

// Read the value of a form field by its id
function val(id) {
  return document.getElementById(id).value.trim();
}

// Moisture marks (out of 15) depending on how far the value is from the safe range
function getMoistureMarks(moisture, crop) {
  const range = moistureRanges[crop];
  const low = range[0];
  const high = range[1];

  let distance = 0;
  if (moisture < low) distance = low - moisture;
  if (moisture > high) distance = moisture - high;

  if (distance === 0) return 15;  // inside the safe range
  if (distance <= 1) return 12;   // slightly outside
  if (distance <= 2) return 8;
  if (distance <= 4) return 4;
  return 0;                       // far outside
}

// ---------- Validation ----------
function validateForm() {
  const errors = []; // each item: { id, message }

  // Required fields
  const required = [
    ["farmerName", "Farmer name"],
    ["cropName", "Crop name"],
    ["sellerName", "Seed brand or seller name"],
    ["purchaseDate", "Purchase date"],
    ["expiryDate", "Expiry date"],
    ["seedsTested", "Number of seeds tested"],
    ["seedsGerminated", "Number of seeds germinated"],
    ["purity", "Purity percentage"],
    ["moisture", "Moisture percentage"],
    ["appearance", "Seed appearance"],
    ["sizeWeight", "Seed size and weight"],
    ["packaging", "Packaging condition"]
  ];

  required.forEach(function (item) {
    if (val(item[0]) === "") {
      errors.push({ id: item[0], message: item[1] + " is required." });
    }
  });

  // Only check the numbers if they were filled in
  const tested = Number(val("seedsTested"));
  const germinated = Number(val("seedsGerminated"));
  const purity = Number(val("purity"));
  const moisture = Number(val("moisture"));

  if (val("seedsTested") !== "" && (!Number.isInteger(tested) || tested < 1)) {
    errors.push({ id: "seedsTested", message: "Number of seeds tested must be a whole number of 1 or more." });
  }

  if (val("seedsGerminated") !== "" && (!Number.isInteger(germinated) || germinated < 0)) {
    errors.push({ id: "seedsGerminated", message: "Number of seeds germinated must be a whole number of 0 or more." });
  }

  // Germinated seeds cannot be more than tested seeds
  if (
    val("seedsTested") !== "" && val("seedsGerminated") !== "" &&
    Number.isInteger(tested) && Number.isInteger(germinated) &&
    germinated > tested
  ) {
    errors.push({
      id: "seedsGerminated",
      message: "Seeds germinated (" + germinated + ") cannot be more than seeds tested (" + tested + ")."
    });
  }

  if (val("purity") !== "" && (purity < 0 || purity > 100)) {
    errors.push({ id: "purity", message: "Purity percentage must be between 0 and 100." });
  }

  if (val("moisture") !== "" && (moisture < 0 || moisture > 100)) {
    errors.push({ id: "moisture", message: "Moisture percentage must be between 0 and 100." });
  }

  // Expiry date should not be before purchase date
  if (val("purchaseDate") !== "" && val("expiryDate") !== "" && val("expiryDate") < val("purchaseDate")) {
    errors.push({ id: "expiryDate", message: "Expiry date cannot be earlier than the purchase date." });
  }

  return errors;
}

function showErrors(errors) {
  // Clear old red borders
  clearErrors();

  let html = "<strong>Please fix the following:</strong><ul>";
  errors.forEach(function (err) {
    html += "<li>" + err.message + "</li>";
    document.getElementById(err.id).classList.add("invalid");
  });
  html += "</ul>";

  errorBox.innerHTML = html;
  errorBox.hidden = false;
  errorBox.scrollIntoView({ behavior: "smooth", block: "center" });
}

function clearErrors() {
  errorBox.hidden = true;
  errorBox.innerHTML = "";
  form.querySelectorAll(".invalid").forEach(function (el) {
    el.classList.remove("invalid");
  });
}

// ---------- Main calculation ----------
function calculateQuality() {
  const crop = val("cropName");
  const tested = Number(val("seedsTested"));
  const germinated = Number(val("seedsGerminated"));
  const purity = Number(val("purity"));
  const moisture = Number(val("moisture"));
  const appearance = val("appearance");
  const sizeWeight = val("sizeWeight");
  const packaging = val("packaging");

  // 1. Germination percentage
  const germination = (germinated / tested) * 100;

  // 2. Is the seed expired?
  const expired = val("expiryDate") < getTodayString();

  // 3. Marks for each part
  const germMarks = round1(germination * 0.35);   // up to 35
  const purityMarks = round1(purity * 0.25);      // up to 25
  const moistureMarks = getMoistureMarks(moisture, crop); // up to 15
  const appearanceScore = appearanceMarks[appearance];    // up to 10
  const sizeScore = sizeMarks[sizeWeight];                // up to 10
  const packagingScore = packagingMarks[packaging];       // up to 5

  const total = Math.round(
    germMarks + purityMarks + moistureMarks + appearanceScore + sizeScore + packagingScore
  );

  // 4. Decide the result level
  let level;   // "high", "medium" or "poor"
  let label;
  if (expired) {
    level = "poor";
    label = "Poor Quality / Not Recommended";
  } else if (total >= 80) {
    level = "high";
    label = "High Quality Seed \u2014 Recommended for sowing";
  } else if (total >= 60) {
    level = "medium";
    label = "Medium Quality Seed \u2014 Use with caution";
  } else {
    level = "poor";
    label = "Poor Quality Seed \u2014 Not recommended";
  }

  // 5. Warnings (specific problems found)
  const warnings = [];
  const range = moistureRanges[crop];

  if (expired) warnings.push("These seeds have passed their expiry date.");
  if (germination < 70) warnings.push("Germination is low (" + round1(germination) + "%). Many seeds may not sprout.");
  if (purity < 90) warnings.push("Purity is below 90%. The lot may contain weed seeds, dirt or broken seed.");
  if (moisture < range[0] || moisture > range[1]) {
    warnings.push("Moisture (" + moisture + "%) is outside the safe range of " + range[0] + "% to " + range[1] + "% for " + crop.toLowerCase() + " seed.");
  }
  if (appearance === "Discolored or fungus") warnings.push("Discolored or fungus-affected seed can spread disease to the field.");
  if (appearance === "Damaged") warnings.push("Damaged seeds often fail to sprout or give weak plants.");
  if (sizeWeight === "Very small or light") warnings.push("Very small or light seeds are often weak or immature.");
  if (packaging === "No label") warnings.push("No label means the seed source cannot be verified. It may be fake or mixed.");
  if (packaging === "Damaged packet") warnings.push("A damaged packet may have let in moisture, insects or other seed.");

  // 6. Message for the farmer
  let message;
  if (expired) {
    message = "These seeds are expired and should not be used for sowing. Ask the dealer for fresh, certified seed.";
  } else if (level === "high") {
    message = "Good news! This seed lot looks healthy and is recommended for sowing.";
  } else if (level === "medium") {
    message = "This seed lot is average. You can use it, but be careful: do a small germination test first and sow a little extra seed to cover weak ones.";
  } else {
    message = "This seed lot is likely to give weak or patchy crops. It is better not to sow it. Please change the seed or get it tested at a seed testing lab.";
  }

  // 7. Suggestions: specific ones first, then the general ones
  const suggestions = [];
  if (expired) suggestions.push("Do not sow expired seeds. Return them to the seller or buy a fresh lot.");
  if (germination < 70 && !expired) suggestions.push("Repeat the germination test with another sample to confirm the result.");
  if (moisture > range[1]) suggestions.push("Dry the seed in shade and store it in an airtight container.");

  suggestions.push("Buy certified seeds from a trusted dealer.");
  suggestions.push("Check the expiry date and seed label.");
  suggestions.push("Avoid discolored, broken, fungus-affected, or insect-damaged seeds.");
  suggestions.push("Store seeds in a cool, dry place.");
  suggestions.push("Perform a simple germination test before large-scale sowing.");

  return {
    farmer: val("farmerName"),
    crop: crop,
    seller: val("sellerName"),
    purchaseDate: val("purchaseDate"),
    expiryDate: val("expiryDate"),
    tested: tested,
    germinated: germinated,
    purity: purity,
    moisture: moisture,
    appearance: appearance,
    sizeWeight: sizeWeight,
    packaging: packaging,
    germination: round1(germination),
    expired: expired,
    total: total,
    level: level,
    label: label,
    message: message,
    warnings: warnings,
    suggestions: suggestions,
    breakdown: [
      ["Germination", germMarks, 35],
      ["Purity", purityMarks, 25],
      ["Moisture suitability", moistureMarks, 15],
      ["Seed appearance", appearanceScore, 10],
      ["Seed size and weight", sizeScore, 10],
      ["Packaging condition", packagingScore, 5]
    ]
  };
}

// ---------- Show the result on the page ----------
function showResult(r) {
  resultEmpty.hidden = true;
  resultContent.hidden = false;

  resultFor.textContent = r.crop + " seed from " + r.seller + " \u2022 Farmer: " + r.farmer;
  scoreValue.textContent = r.total;
  germValue.textContent = r.germination + "%";
  resultMessage.textContent = r.message;

  // Badge
  resultBadge.textContent = r.label;
  resultBadge.className = "badge " + r.level;

  // Progress bar (start from 0 so the bar animates)
  progressFill.className = "progress-fill " + r.level;
  progressFill.style.width = "0%";
  progressFill.parentElement.setAttribute("aria-valuenow", r.total);
  setTimeout(function () {
    progressFill.style.width = r.total + "%";
  }, 30);

  // Warnings
  warningsList.innerHTML = "";
  r.warnings.forEach(function (text) {
    const li = document.createElement("li");
    li.textContent = text;
    warningsList.appendChild(li);
  });
  warningsWrap.hidden = r.warnings.length === 0;

  // Breakdown table
  breakdownBody.innerHTML = "";
  r.breakdown.forEach(function (row) {
    const tr = document.createElement("tr");
    const name = document.createElement("td");
    const marks = document.createElement("td");
    name.textContent = row[0];
    marks.textContent = row[1] + " / " + row[2];
    tr.appendChild(name);
    tr.appendChild(marks);
    breakdownBody.appendChild(tr);
  });

  // Suggestions
  suggestionsList.innerHTML = "";
  r.suggestions.forEach(function (text) {
    const li = document.createElement("li");
    li.textContent = text;
    suggestionsList.appendChild(li);
  });

  // On small screens, scroll down to the result
  document.getElementById("resultCard").scrollIntoView({ behavior: "smooth", block: "start" });
}

// ---------- Events ----------

// When the form is submitted (button click or Enter key)
form.addEventListener("submit", function (event) {
  event.preventDefault(); // stop the page from reloading

  const errors = validateForm();
  if (errors.length > 0) {
    showErrors(errors);
    return;
  }

  clearErrors();
  lastResult = calculateQuality();
  showResult(lastResult);
});

// Reset button: clear the errors and the result too
resetBtn.addEventListener("click", function () {
  clearErrors();
  resultContent.hidden = true;
  resultEmpty.hidden = false;
  progressFill.style.width = "0%";
  lastResult = null;
});

// Remove the red border when the user edits a field
form.addEventListener("input", function (event) {
  event.target.classList.remove("invalid");
});

// Download Result button: build a text file and download it
downloadBtn.addEventListener("click", function () {
  if (!lastResult) return;
  const r = lastResult;

  const lines = [];
  lines.push("SMART SEED QUALITY IDENTIFICATION SYSTEM");
  lines.push("Seed Quality Result");
  lines.push("Date of check: " + getTodayString());
  lines.push("========================================");
  lines.push("");
  lines.push("Farmer name      : " + r.farmer);
  lines.push("Crop             : " + r.crop);
  lines.push("Brand / seller   : " + r.seller);
  lines.push("Purchase date    : " + r.purchaseDate);
  lines.push("Expiry date      : " + r.expiryDate + (r.expired ? " (EXPIRED)" : ""));
  lines.push("");
  lines.push("Seeds tested     : " + r.tested);
  lines.push("Seeds germinated : " + r.germinated);
  lines.push("Germination      : " + r.germination + "%");
  lines.push("Purity           : " + r.purity + "%");
  lines.push("Moisture         : " + r.moisture + "%");
  lines.push("Appearance       : " + r.appearance);
  lines.push("Size and weight  : " + r.sizeWeight);
  lines.push("Packaging        : " + r.packaging);
  lines.push("");
  lines.push("QUALITY SCORE    : " + r.total + " / 100");
  lines.push("RESULT           : " + r.label);
  lines.push("");
  lines.push("Marks breakdown:");
  r.breakdown.forEach(function (row) {
    lines.push("  - " + row[0] + ": " + row[1] + " / " + row[2]);
  });
  lines.push("");
  lines.push("Message: " + r.message);

  if (r.warnings.length > 0) {
    lines.push("");
    lines.push("Things to watch:");
    r.warnings.forEach(function (w) { lines.push("  - " + w); });
  }

  lines.push("");
  lines.push("Suggestions:");
  r.suggestions.forEach(function (s) { lines.push("  - " + s); });

  lines.push("");
  lines.push("Note: This result is a guide only (college demonstration project).");

  const blob = new Blob([lines.join("\r\n")], { type: "text/plain" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "seed-quality-result.txt";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
});
