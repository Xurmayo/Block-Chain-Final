/*************************************************
 * Open-Source Funding DApp — app.js
 * STEP 3: Withdraw support added
 *************************************************/

let provider;
let signer;
let contract;
let role = "";
let campaignsCache = [];
let countdownTimer = null;

/* ========== CONFIG ========== */

const CONTRACT_ADDRESS = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";

const ABI = [
  "function campaignCount() view returns(uint256)",
  "function campaigns(uint256) view returns(address,string,uint256,uint256,uint256,uint8)",
  "function submitCampaign(string,uint256,uint256)",
  "function approveCampaign(uint256)",
  "function rejectCampaign(uint256)",
  "function contribute(uint256) payable",
  "function refund(uint256)",
  "function withdraw(uint256)" // ✅ ADDED
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

/* ========== DOM HELPER ========== */

function el(id) {
  return document.getElementById(id);
}

/* ========== LOGIN ========== */

async function login(selectedRole) {
  role = selectedRole;

  provider = new ethers.BrowserProvider(window.ethereum);
  await provider.send("eth_requestAccounts", []);
  signer = await provider.getSigner();

  contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);

  el("wallet").innerText =
    (await signer.getAddress()).slice(0, 6) + "...";

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
  const balance = await provider.getBalance(await signer.getAddress());
  el("balance").innerText =
    ethers.formatEther(balance).slice(0, 8) + " ETH";
}

/* ========== CREATOR ========== */

async function submitCampaign() {
  if (!el("title").value || !el("goal").value || !el("duration").value) {
    alert("Fill all fields");
    return;
  }

  await contract.submitCampaign(
    el("title").value,
    ethers.parseEther(el("goal").value),
    el("duration").value
  );

  el("title").value = "";
  el("goal").value = "";
  el("duration").value = "";

  await loadCampaigns();
}

/* ========== WITHDRAW (CREATOR ONLY) ========== */

async function withdraw() {
  const id = prompt("Enter Campaign ID to withdraw");

  if (!id) {
    alert("Campaign ID required");
    return;
  }

  await contract.withdraw(id);
  await loadCampaigns();
}

/* ========== MODERATOR ========== */

async function approveCampaign() {
  if (!el("moderatorCampaignId").value) {
    alert("Campaign ID required");
    return;
  }

  await contract.approveCampaign(el("moderatorCampaignId").value);
  el("moderatorCampaignId").value = "";
  await loadCampaigns();
}

async function rejectCampaign() {
  if (!el("moderatorCampaignId").value) {
    alert("Campaign ID required");
    return;
  }

  await contract.rejectCampaign(el("moderatorCampaignId").value);
  el("moderatorCampaignId").value = "";
  await loadCampaigns();
}

/* ========== CONTRIBUTOR ========== */

async function contribute() {
  if (!el("contributeCampaignId").value || !el("contributeAmount").value) {
    alert("Fill all fields");
    return;
  }

  await contract.contribute(el("contributeCampaignId").value, {
    value: ethers.parseEther(el("contributeAmount").value)
  });

  el("contributeAmount").value = "";
  await loadCampaigns();
}

async function refund() {
  if (!el("contributeCampaignId").value) {
    alert("Campaign ID required");
    return;
  }

  await contract.refund(el("contributeCampaignId").value);
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
