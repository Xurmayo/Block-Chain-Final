/*************************************************
 * Open-Source Funding DApp — FIXED app.js
 * - NO auto-finalize
 * - Countdown only for Active campaigns
 * - No delayed rendering
 *************************************************/

let provider;
let signer;
let contract;
let role = "";
let userAddress = "";
let campaignsCache = [];
let countdownTimer = null;
let refreshTimer = null;

/* ========== CONFIG ========== */

const CONTRACT_ADDRESS = "PASTE_YOUR_CROWDFUNDING_ADDRESS_HERE";

const ABI = [
  "function campaignCount() view returns(uint256)",
  "function campaigns(uint256) view returns(address,string,uint256,uint256,uint256,uint8)",
  "function submitCampaign(string,uint256,uint256)",
  "function approveCampaign(uint256)",
  "function rejectCampaign(uint256)",
  "function contribute(uint256) payable",
  "function refund(uint256)",
  "function withdraw(uint256)",
  "function finalize(uint256)"
];

const STATES = [
  "Submitted",
  "Approved",
  "Active",
  "Successful",
  "Failed",
  "Withdrawn",
  "Rejected"
];

/* ========== HELPERS ========== */

function el(id) {
  return document.getElementById(id);
}

/* ========== LOGIN ========== */

async function login(selectedRole) {
  role = selectedRole;

  provider = new ethers.BrowserProvider(window.ethereum);
  await provider.send("eth_requestAccounts", []);
  signer = await provider.getSigner();
  userAddress = await signer.getAddress();

  contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);

  el("wallet").innerText = userAddress.slice(0, 6) + "...";

  await updateBalance();
  provider.on("block", updateBalance);

  el("login").classList.add("hidden");
  el("creatorUI").classList.toggle("hidden", role !== "creator");
  el("moderatorUI").classList.toggle("hidden", role !== "moderator");
  el("contributorUI").classList.toggle("hidden", role !== "contributor");

  await loadCampaigns();
  startCountdown();
  startAutoRefresh();
}

/* ========== BALANCE ========== */

async function updateBalance() {
  const balance = await provider.getBalance(userAddress);
  el("balance").innerText =
    ethers.formatEther(balance).slice(0, 8) + " ETH";
}

/* ========== CAMPAIGNS ========== */

async function loadCampaigns() {
  campaignsCache = [];
  el("campaigns").innerHTML = "";

  const count = await contract.campaignCount();
  for (let i = 0; i < count; i++) {
    campaignsCache.push(await contract.campaigns(i));
  }

  renderCampaigns();
}

function renderCampaigns() {
  const container = el("campaigns");
  container.innerHTML = "";

  const now = Math.floor(Date.now() / 1000);

  campaignsCache.forEach((c, i) => {
    const creator = c[0].toLowerCase();
    const title = c[1];
    const goal = Number(ethers.formatEther(c[2]));
    const deadline = Number(c[3]);
    const raised = Number(ethers.formatEther(c[4]));
    const stateIndex = c[5];
    const stateName = STATES[stateIndex];
    const stateClass = stateName.toLowerCase();

    const percent = goal > 0 ? Math.min((raised / goal) * 100, 100) : 0;

    /* ---------- MODERATOR VIEW ---------- */
    if (role === "moderator" && stateName === "Submitted") {
      container.innerHTML += `
        <div class="card">
          <h4>${title}</h4>
          <span class="badge submitted">Submitted</span>
          <p>Goal: ${goal} ETH</p>
          <button onclick="approveFromCard(${i})">Approve</button>
          <button onclick="rejectFromCard(${i})" class="secondary">Reject</button>
        </div>
      `;
      return;
    }

    if (role === "moderator") return;

    /* ---------- COUNTDOWN LOGIC ---------- */
    let timerHtml = `<p>⏳ Pending approval</p>`;

    if (stateName === "Active") {
      const timeLeft = Math.max(deadline - now, 0);
      timerHtml = `<p>⏱ <span id="time-${i}">${timeLeft}</span> sec</p>`;
    }

    const canWithdraw =
      role === "creator" &&
      creator === userAddress.toLowerCase() &&
      stateName === "Successful";

    const canFinalize =
      stateName === "Active" &&
      Math.floor(Date.now() / 1000) >= deadline;

    container.innerHTML += `
      <div class="card">
        <h4>${title}</h4>
        <span class="badge ${stateClass}">${stateName}</span>

        <p>${raised} / ${goal} ETH</p>

        <div class="progress">
          <div class="progress-bar" style="width:${percent}%"></div>
        </div>

        ${timerHtml}

        ${
          canFinalize
            ? `<button onclick="finalizeCampaign(${i})">Finalize</button>`
            : ""
        }

        ${
          canWithdraw
            ? `<button onclick="withdrawFromCard(${i})">Withdraw</button>`
            : ""
        }
      </div>
    `;
  });
}

/* ========== AUTO REFRESH (READ-ONLY) ========== */

function startAutoRefresh() {
  if (refreshTimer) clearInterval(refreshTimer);

  refreshTimer = setInterval(() => {
    loadCampaigns();
  }, 4000); // read-only refresh
}

/* ========== COUNTDOWN (ACTIVE ONLY) ========== */

function startCountdown() {
  if (countdownTimer) clearInterval(countdownTimer);

  countdownTimer = setInterval(() => {
    const now = Math.floor(Date.now() / 1000);
    campaignsCache.forEach((c, i) => {
      if (STATES[c[5]] !== "Active") return;

      const t = document.getElementById(`time-${i}`);
      if (t) t.innerText = Math.max(Number(c[3]) - now, 0);
    });
  }, 1000);
}

/* ========== ACTIONS ========== */

async function submitCampaign() {
  await contract.submitCampaign(
    el("title").value,
    ethers.parseEther(el("goal").value),
    el("duration").value
  );
  await loadCampaigns();
}

async function approveFromCard(id) {
  await contract.approveCampaign(id);
  await loadCampaigns();
}

async function rejectFromCard(id) {
  await contract.rejectCampaign(id);
  await loadCampaigns();
}

async function contribute() {
  await contract.contribute(el("contributeCampaignId").value, {
    value: ethers.parseEther(el("contributeAmount").value)
  });
  await loadCampaigns();
}

async function refund() {
  await contract.refund(el("contributeCampaignId").value);
  await loadCampaigns();
}

async function withdrawFromCard(id) {
  await contract.withdraw(id);
  await loadCampaigns();
}

async function finalizeCampaign(id) {
  await contract.finalize(id);
  await loadCampaigns();
}
