const approvedAdmins = {
  "faith": { password: "4708", name: "Faith B." },
  "happiness": { password: "1513", name: "Mrs. Madu" },
  "damian": { password: "abcd", name: "Damian" },
  "ada": { password: "pass", name: "Ada" }
};

let currentAdminName = "";
let githubToken = "";
let tokenTimeout = null;

const loginPage = document.getElementById("loginPage");
const tokenPage = document.getElementById("tokenPage");
const adminPanel = document.getElementById("adminPanel");

const repoOwner = "SheDiamondInvitation";
const repoName = "Check";
const filePath = "list.json";

function loginAdmin() {
  const user = document.getElementById("username").value.trim().toLowerCase();
  const pass = document.getElementById("password").value.trim();

  if (approvedAdmins[user] && approvedAdmins[user].password === pass) {
    currentAdminName = approvedAdmins[user].name;
    loginPage.classList.add("hidden");
    tokenPage.classList.remove("hidden");
    const storedToken = localStorage.getItem("githubToken");
    if (storedToken) { githubToken = storedToken; verifyToken(true); }
  } else {
    alert("❌ Invalid username or password");
  }
}

function goBack() {
  tokenPage.classList.add("hidden");
  loginPage.classList.remove("hidden");
}

function logoutAdmin() {
  githubToken = "";
  localStorage.removeItem("githubToken");
  clearTimeout(tokenTimeout);
  adminPanel.classList.add("hidden");
  loginPage.classList.remove("hidden");
  alert("✅ Logged out successfully.");
}

async function verifyToken(auto = false) {
  if (!auto) githubToken = document.getElementById("githubToken").value.trim();
  if (!githubToken) { alert("Enter GitHub token"); return; }

  try {
    const apiUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${filePath}`;
    const res = await fetch(apiUrl, { headers: { Authorization: `token ${githubToken}` } });
    if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);

    localStorage.setItem("githubToken", githubToken);
    clearTimeout(tokenTimeout);
    tokenTimeout = setTimeout(() => { logoutAdmin(); alert("⚠️ GitHub token cleared after 2 hours."); }, 2 * 60 * 60 * 1000);

    tokenPage.classList.add("hidden");
    adminPanel.classList.remove("hidden");
    document.getElementById("welcomeText").innerText = `Welcome, ${currentAdminName}`;
  } catch (err) { alert("❌ Invalid GitHub token or repository access denied"); }
}

async function fetchList() {
  const apiUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${filePath}?timestamp=${Date.now()}`;
  const res = await fetch(apiUrl, { headers: { Authorization: `token ${githubToken}` } });
  if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
  const file = await res.json();
  const content = JSON.parse(atob(file.content));
  return { data: content, sha: file.sha };
}

async function saveList(newData, sha, commitMessage = "Update list.json via Admin Panel") {
  const content = btoa(JSON.stringify(newData, null, 2));
  const apiUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${filePath}`;
  const res = await fetch(apiUrl, {
    method: "PUT",
    headers: { Authorization: `token ${githubToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ message: commitMessage, content, sha })
  });
  if (!res.ok) { const errText = await res.text(); throw new Error(`GitHub save error: ${res.status} - ${errText}`); }
}

async function addSingle() {
  try {
    const phone = document.getElementById("singlePhone").value.trim();
    const name = document.getElementById("singleName").value.trim();
    const reservation = document.getElementById("singleReservation").value.trim();
    const adminLink = document.getElementById("singleAdminLink").value.trim();

    if (!/^\d{11}$/.test(phone)) return alert("Enter valid 11-digit phone number");
    if (!name || !reservation || !/^https?:\/\//.test(adminLink)) return alert("Fill all fields correctly with a valid WhatsApp link");

    let { data, sha } = await fetchList();

    if (data[phone] && data[phone].reservation !== reservation) return alert(`This number already exists with reservation "${data[phone].reservation}"`);

    data[phone] = { name, reservation, adminNumber: adminLink };
    await saveList(data, sha, `Added ${name} (${phone})`);
    alert("✅ Name Added Successfully");

    document.getElementById("singlePhone").value = "";
    document.getElementById("singleName").value = "";
    document.getElementById("singleReservation").value = "";
    document.getElementById("singleAdminLink").value = "";
  } catch (err) { alert(`❌ Error: ${err.message}`); }
}

async function addBatch() {
  try {
    const batchText = document.getElementById("batchInput").value.trim();
    const reservation = document.getElementById("batchReservation").value.trim();
    const adminLink = document.getElementById("batchAdminLink").value.trim();

    if (!batchText || !reservation || !/^https?:\/\//.test(adminLink)) return alert("Fill all batch fields correctly with valid WhatsApp link");

    let { data, sha } = await fetchList();
    const lines = batchText.split("\n");
    let changes = 0, skipped = [];

    for (let line of lines) {
      const [phone, name] = line.split(",").map(v => v.trim());
      if (!/^\d{11}$/.test(phone) || !name) { skipped.push(`Invalid: "${line}"`); continue; }
      if (data[phone] && data[phone].reservation !== reservation) { skipped.push(`Skipped ${phone} — Existing reservation "${data[phone].reservation}"`); continue; }
      data[phone] = { name, reservation, adminNumber: adminLink };
      changes++;
    }

    if (changes > 0) {
      await saveList(data, sha, `Batch update: ${changes} new entries`);
      alert(`✅ Names Added Successfully\nAdded: ${changes}\nSkipped: ${skipped.length ? skipped.join("\n") : "0"}`);
      document.getElementById("batchInput").value = "";
      document.getElementById("batchReservation").value = "";
      document.getElementById("batchAdminLink").value = "";
    } else alert(`ℹ️ No new entries added.\nSkipped: ${skipped.join("\n")}`);
  } catch (err) { alert(`❌ Error: ${err.message}`); }
}
