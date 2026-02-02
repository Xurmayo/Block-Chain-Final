/*************************************************
 * Open-Source Funding DApp — FINAL app.js
 *************************************************/

let provider;
let signer;
let contract;
let role = "";
let userAddress = "";
let campaignsCache = [];
let countdownTimer = null;

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
  "function withdraw(uint256)"
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

  if (!window.ethereum) {
    alert("MetaMask is required");
    return;
  }

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
}

/* ========== BALANCE ========== */

async function updateBalance() {
  if (!provider || !userAddress) return;

  const balance = await provider.getBalance(userAddress);
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

  el("title").value = "";
  el("goal").value = "";
  el("duration").value = "";

  await loadCampaigns();
}

/* ========== MODERATOR (CARD ACTIONS) ========== */

async function approveFromCard(id) {
  await contract.approveCampaign(id);
  await loadCampaigns();
}

async function rejectFromCard(id) {
  await contract.rejectCampaign(id);
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

/* ========== WITHDRAW (CREATOR) ========== */

async function withdrawFromCard(id) {
  await contract.withdraw(id);
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
    const creator = c[0].toLowerCase();
    const title = c[1];
    const goal = Number(ethers.formatEther(c[2]));
    const deadline = Number(c[3]);
    const raised = Number(ethers.formatEther(c[4]));
    const stateIndex = c[5];
    const stateName = STATES[stateIndex];
    const stateClass = stateName.toLowerCase();

    const percent = goal > 0 ? Math.min((raised / goal) * 100, 100) : 0;
    const timeLeft = Math.max(deadline - now, 0);

    /* ---------- MODERATOR VIEW ---------- */
    if (role === "moderator" && stateName === "Submitted") {
      const card = document.createElement("div");
      card.className = "card";

      card.innerHTML = `
        <h4>${title}</h4>
        <span class="badge submitted">Submitted</span>
        <p>Goal: ${goal} ETH</p>
        <button onclick="approveFromCard(${i})">Approve</button>
        <button onclick="rejectFromCard(${i})" class="secondary">Reject</button>
      `;

      container.appendChild(card);
      return;
    }

    if (role === "moderator") return;

    const canWithdraw =
      role === "creator" &&
      creator === userAddress.toLowerCase() &&
      stateName === "Successful";

    const card = document.createElement("div");
    card.className = "card";

    card.innerHTML = `
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
    `;

    container.appendChild(card);
  });
}

/* ========== LIVE COUNTDOWN ========== */

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
