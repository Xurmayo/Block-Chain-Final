/*************************************************
 * Open-Source Funding DApp — app.js
 * Stable version
 * - Explicit DOM access (no implicit globals)
 * - Role-based UI
 * - Live ETH balance (on new blocks)
 * - Live countdown (client-side)
 * - Input validation (no BigNumberish errors)
 *************************************************/

let provider;
let signer;
let contract;
let role = "";
let campaignsCache = [];
let countdownTimer = null;

/* ========== CONFIG ========== */

// 🔴 CHANGE THIS to your deployed Crowdfunding contract
const CONTRACT_ADDRESS = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";

const ABI = [
  "function campaignCount() view returns(uint256)",
  "function campaigns(uint256) view returns(address,string,uint256,uint256,uint256,uint8)",
  "function submitCampaign(string,uint256,uint256)",
  "function approveCampaign(uint256)",
  "function rejectCampaign(uint256)",
  "function contribute(uint256) payable",
  "function refund(uint256)"
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

/* ========== DOM HELPERS ========== */

function el(id) {
  return document.getElementById(id);
}

/* ========== LOGIN / ROLE SELECTION ========== */

async function login(selectedRole) {
  role = selectedRole;

  if (!window.ethereum) {
    alert("MetaMask is required");
    return;
  }

  provider = new ethers.BrowserProvider(window.ethereum);
  await provider.send("eth_requestAccounts", []);
  signer = await provider.getSigner();

  contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);

  // Header info
  el("wallet").innerText =
    (await signer.getAddress()).slice(0, 6) + "...";

  await updateBalance();

  // Auto-update balance on every block
  provider.on("block", updateBalance);

  // Hide login
  el("login").classList.add("hidden");

  // Show correct role UI
  el("creatorUI").classList.toggle("hidden", role !== "creator");
  el("moderatorUI").classList.toggle("hidden", role !== "moderator");
  el("contributorUI").classList.toggle("hidden", role !== "contributor");

  await loadCampaigns();
  startCountdown();
}

/* ========== BALANCE ========== */

async function updateBalance() {
  if (!signer || !provider) return;

  const balance = await provider.getBalance(await signer.getAddress());
  el("balance").innerText =
    ethers.formatEther(balance).slice(0, 8) + " ETH";
}

/* ========== CREATOR ========== */

async function submitCampaign() {
  const title = el("title").value.trim();
  const goal = el("goal").value.trim();
  const duration = el("duration").value.trim();

  if (!title || !goal || !duration) {
    alert("Fill all fields");
    return;
  }

  await contract.submitCampaign(
    title,
    ethers.parseEther(goal),
    duration
  );

  clearCreatorInputs();
  await loadCampaigns();
}

function clearCreatorInputs() {
  el("title").value = "";
  el("goal").value = "";
  el("duration").value = "";
}

/* ========== MODERATOR ========== */

async function approveCampaign() {
  const id = el("moderatorCampaignId").value.trim();
  if (!id) {
    alert("Campaign ID required");
    return;
  }

  await contract.approveCampaign(id);
  el("moderatorCampaignId").value = "";
  await loadCampaigns();
}

async function rejectCampaign() {
  const id = el("moderatorCampaignId").value.trim();
  if (!id) {
    alert("Campaign ID required");
    return;
  }

  await contract.rejectCampaign(id);
  el("moderatorCampaignId").value = "";
  await loadCampaigns();
}

/* ========== CONTRIBUTOR ========== */

async function contribute() {
  const id = el("contributeCampaignId").value.trim();
  const amount = el("contributeAmount").value.trim();

  if (!id || !amount) {
    alert("Fill all fields");
    return;
  }

  await contract.contribute(id, {
    value: ethers.parseEther(amount)
  });

  el("contributeAmount").value = "";
  await loadCampaigns();
}

async function refund() {
  const id = el("contributeCampaignId").value.trim();
  if (!id) {
    alert("Campaign ID required");
    return;
  }

  await contract.refund(id);
  await loadCampaigns();
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
    const goal = Number(ethers.formatEther(c[2]));
    const raised = Number(ethers.formatEther(c[4]));
    const percent = goal > 0 ? Math.min((raised / goal) * 100, 100) : 0;
    const timeLeft = Math.max(Number(c[3]) - now, 0);

    const state = STATES[c[5]].toLowerCase();

    const card = document.createElement("div");
    card.className = "card";

    card.innerHTML = `
      <h4>${c[1]}</h4>
      <span class="badge ${state}">${STATES[c[5]]}</span>
      <p>${raised} / ${goal} ETH</p>

      <div class="progress">
        <div class="progress-bar" style="width:${percent}%"></div>
      </div>

      <p>⏱ <span id="time-${i}">${timeLeft}</span> sec</p>
    `;

    container.appendChild(card);
  });
}

/* ========== LIVE COUNTDOWN (CLIENT SIDE) ========== */

function startCountdown() {
  if (countdownTimer) clearInterval(countdownTimer);

  countdownTimer = setInterval(() => {
    const now = Math.floor(Date.now() / 1000);

    campaignsCache.forEach((c, i) => {
      const elTime = document.getElementById(`time-${i}`);
      if (elTime) {
        elTime.innerText = Math.max(Number(c[3]) - now, 0);
      }
    });
  }, 1000);
}
