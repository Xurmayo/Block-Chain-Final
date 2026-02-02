/*************************************************
 * Open-Source Funding DApp — app.js
 * FINAL FIX:
 * - Auto finalize after deadline
 * - Auto refresh campaign data
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

/* ========== AUTO FINALIZE LOGIC ========== */

async function tryFinalizeCampaign(id, campaign) {
  const now = Math.floor(Date.now() / 1000);

  if (
    campaign[5] === 2 &&        // Active
    now >= Number(campaign[3])  // Deadline passed
  ) {
    try {
      await contract.finalize(id);
    } catch (e) {
      // ignore if already finalized by someone else
    }
  }
}

/* ========== CAMPAIGNS ========== */

async function loadCampaigns() {
  campaignsCache = [];
  el("campaigns").innerHTML = "";

  const count = await contract.campaignCount();
  for (let i = 0; i < count; i++) {
    const campaign = await contract.campaigns(i);
    campaignsCache.push(campaign);

    // 🔥 AUTO FINALIZE
    await tryFinalizeCampaign(i, campaign);
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
    const stateName = STATES[c[5]];
    const stateClass = stateName.toLowerCase();

    const percent = goal > 0 ? Math.min((raised / goal) * 100, 100) : 0;
    const timeLeft = Math.max(deadline - now, 0);

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

    const canWithdraw =
      role === "creator" &&
      creator === userAddress.toLowerCase() &&
      stateName === "Successful";

    container.innerHTML += `
      <div class="card">
        <h4>${title}</h4>
        <span class="badge ${stateClass}">${stateName}</span>
        <p>${raised} / ${goal} ETH</p>

        <div class="progress">
          <div class="progress-bar" style="width:${percent}%"></div>
        </div>

        <p>⏱ <span id="time-${i}">${timeLeft}</span> sec</p>

        ${
          canWithdraw
            ? `<button onclick="withdrawFromCard(${i})">Withdraw</button>`
            : ""
        }
      </div>
    `;
  });
}

/* ========== AUTO REFRESH ========== */

function startAutoRefresh() {
  if (refreshTimer) clearInterval(refreshTimer);

  refreshTimer = setInterval(() => {
    loadCampaigns();
  }, 5000); // every 5 seconds
}

/* ========== COUNTDOWN ========== */

function startCountdown() {
  if (countdownTimer) clearInterval(countdownTimer);

  countdownTimer = setInterval(() => {
    const now = Math.floor(Date.now() / 1000);
    campaignsCache.forEach((c, i) => {
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
