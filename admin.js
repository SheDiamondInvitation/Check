// ======= Approved Admins =======
const approvedAdmins = {
  "faith": { password: "1234", name: "Faith Admin" },
  "damian": { password: "abcd", name: "Damian" },
  "ada": { password: "pass", name: "Ada" }
};

let currentAdminName = "";
let githubToken = "";
let tokenTimeout = null;

// ======= Pages =======
const loginPage = document.getElementById("loginPage");
const tokenPage = document.getElementById("tokenPage");
const adminPanel = document.getElementById("adminPanel");

// ======= Repo Details =======
const repoOwner = "SheDiamondInvitation";
const repoName = "Check";
const filePath = "list.json";

// ======= Login Step =======
function loginAdmin() {
  const user = document.getElementById("username").value.trim().toLowerCase();
  const pass = document.getElementById("password").value.trim();

  if (approvedAdmins[user] && approvedAdmins[user].password === pass) {
    currentAdminName = approvedAdmins[user].name;
    loginPage.classList.add("hidden");
    tokenPage.classList.remove("hidden");

    // Check if a valid token exists in localStorage
    const storedToken = localStorage.getItem("githubToken");
    if (storedToken) {
      githubToken = storedToken;
      verifyToken(true); // auto-verify without entering token
    }
  } else {
    alert("❌ Invalid username or password");
  }
}

// ======= Back Button =======
function goBack() {
  tokenPage.classList.add("hidden");
  loginPage.classList.remove("hidden");
}

// ======= Logout =======
function logoutAdmin() {
  githubToken = "";
  localStorage.removeItem("githubToken");
  clearTimeout(tokenTimeout);
  adminPanel.classList.add("hidden");
  loginPage.classList.remove("hidden");
  alert("✅ Logged out successfully.");
}

// ======= Token Verification =======
async function verifyToken(auto = false) {
  if (!auto) githubToken = document.getElementById("githubToken").value.trim();
  if (!githubToken) {
    alert("Enter GitHub token");
    return;
  }

  try {
    // Test GET request to validate token
    const apiUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${filePath}`;
    const res = await fetch(apiUrl, {
      headers: { Authorization: `token ${githubToken}` }
    });

    if (!res.ok) throw new Error(`GitHub API error: ${res.status} ${res.statusText}`);

    // Save token to localStorage and auto-clear in 2 hours
    localStorage.setItem("githubToken", githubToken);
    clearTimeout(tokenTimeout);
    tokenTimeout = setTimeout(() => {
      logoutAdmin();
      alert("⚠️ GitHub token cleared automatically after 2 hours.");
    }, 2 * 60 * 60 * 1000);

    tokenPage.classList.add("hidden");
    adminPanel.classList.remove("hidden");
    document.getElementById("welcomeText").innerText = `Welcome, ${currentAdminName}`;
  } catch (err) {
    console.error(err);
    alert("❌ Invalid GitHub token or repository access denied");
  }
}

// ======= Fetch Current List =======
async function fetchList() {
  const apiUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${filePath}?timestamp=${Date.now()}`;
  const res = await fetch(apiUrl, {
    headers: { Authorization: `token ${githubToken}` }
  });

  if (!res.ok) throw new Error(`GitHub API error: ${res.status} ${res.statusText}`);

  const file = await res.json();
  if (!file.content) throw new Error("File content missing");

  const content = JSON.parse(atob(file.content));
  return { data: content, sha: file.sha };
}

// ======= Save Updated List =======
async function saveList(newData, sha, commitMessage = "Update list.json via Admin Panel") {
  const content = btoa(JSON.stringify(newData, null, 2));
  const apiUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${filePath}`;

  const res = await fetch(apiUrl, {
    method: "PUT",
    headers: {
      Authorization: `token ${githubToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ message: commitMessage, content, sha })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`GitHub save error: ${res.status} - ${errText}`);
  }
}

// ======= Add Single Entry =======
async function addSingle() {
  try {
    const phone = document.getElementById("singlePhone").value.trim();
    const name = document.getElementById("singleName").value.trim();
    const reservation = document.getElementById("singleReservation").value.trim();
    const adminNumber = document.getElementById("singleAdminNumber").value.trim();

    if (!/^\d{11}$/.test(phone)) return alert("Enter valid 11-digit phone number");
    if (!name || !reservation || !adminNumber) return alert("Fill all fields correctly");

    let { data, sha } = await fetchList();

    if (data[phone] && data[phone].reservation !== reservation) {
      return alert(`This number already exists with Reservation code "${data[phone].reservation}".\nCan't override reservation code.`);
    }

    data[phone] = { name, reservation, adminNumber };
    await saveList(data, sha, `Added ${name} (${phone})`);

    alert("✅ Name Added Successfully");
    document.getElementById("singlePhone").value = "";
    document.getElementById("singleName").value = "";
    document.getElementById("singleReservation").value = "";
    document.getElementById("singleAdminNumber").value = "";
  } catch (err) {
    console.error(err);
    alert(`❌ Error: ${err.message}`);
  }
}

// ======= Add Batch Entries =======
async function addBatch() {
  try {
    const batchText = document.getElementById("batchInput").value.trim();
    const reservation = document.getElementById("batchReservation").value.trim();
    const adminNumber = document.getElementById("batchAdminNumber").value.trim();

    if (!batchText || !reservation || !adminNumber) return alert("Fill all batch fields correctly");

    let { data, sha } = await fetchList();
    const lines = batchText.split("\n");
    let changes = 0;
    let skipped = [];

    for (let line of lines) {
      const [phone, name] = line.split(",").map(v => v.trim());
      if (!/^\d{11}$/.test(phone) || !name) {
        skipped.push(`Invalid: "${line}"`);
        continue;
      }

      if (data[phone] && data[phone].reservation !== reservation) {
        skipped.push(`Skipped ${phone} (${name}) — Existing reservation "${data[phone].reservation}"`);
        continue;
      }

      data[phone] = { name, reservation, adminNumber };
      changes++;
    }

    if (changes > 0) {
      await saveList(data, sha, `Batch update: ${changes} new entries`);
      alert(`✅ Names Added Successfully\nAdded: ${changes}\nSkipped: ${skipped.length ? skipped.join("\n") : "0"}`);
      document.getElementById("batchInput").value = "";
      document.getElementById("batchReservation").value = "";
      document.getElementById("batchAdminNumber").value = "";
    } else {
      alert(`ℹ️ No new entries were added.\nSkipped: ${skipped.join("\n")}`);
    }
  } catch (err) {
    console.error(err);
    alert(`❌ Error: ${err.message}`);
  }
}
