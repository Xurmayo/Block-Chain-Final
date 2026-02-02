let provider, signer, crowdfunding;
let userRole = "";
let campaignsCache = [];

const CROWDFUNDING_ADDRESS = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";

const ABI = [
  "function campaignCount() view returns (uint256)",
  "function campaigns(uint256) view returns (address,string,uint256,uint256,uint256,uint8)",
  "function createCampaign(string,uint256,uint256)",
  "function contribute(uint256) payable",
  "function finalizeCampaign(uint256)",
  "function withdrawFunds(uint256)",
  "function refund(uint256)"
];

const STATES = ["Active", "Successful", "Failed", "Withdrawn"];

/* ---------- LOGIN ---------- */

async function login(role) {
  userRole = role;

  provider = new ethers.BrowserProvider(window.ethereum);
  await provider.send("eth_requestAccounts", []);
  signer = await provider.getSigner();

  crowdfunding = new ethers.Contract(CROWDFUNDING_ADDRESS, ABI, signer);

  document.getElementById("login").classList.add("hidden");
  document.getElementById("app").classList.remove("hidden");

  document.getElementById("role").innerText = role;
  document.getElementById("account").innerText = await signer.getAddress();

  if (role === "creator")
    document.getElementById("creatorUI").classList.remove("hidden");
  else
    document.getElementById("contributorUI").classList.remove("hidden");

  await updateBalance();
  await loadCampaigns();

  // ✅ AUTO BALANCE UPDATE
  provider.on("block", updateBalance);

  startCountdown();
}

/* ---------- BALANCE ---------- */

async function updateBalance() {
  const balance = await provider.getBalance(await signer.getAddress());
  document.getElementById("ethBalance").innerText =
    ethers.formatEther(balance);
}

/* ---------- CAMPAIGNS ---------- */

async function loadCampaigns() {
  campaignsCache = [];
  const count = await crowdfunding.campaignCount();
  for (let i = 0; i < count; i++) {
    campaignsCache.push(await crowdfunding.campaigns(i));
  }
  renderCampaigns();
}

function renderCampaigns() {
  const div = document.getElementById("campaigns");
  div.innerHTML = "";

  const now = Math.floor(Date.now() / 1000);

  campaignsCache.forEach((c, i) => {
    const goal = Number(ethers.formatEther(c[2]));
    const raised = Number(ethers.formatEther(c[4]));
    const percent = Math.min((raised / goal) * 100, 100);
    const timeLeft = Math.max(Number(c[3]) - now, 0);

    div.innerHTML += `
      <div class="card">
        <b>ID:</b> ${i}<br>
        <b>${c[1]}</b><br>
        Goal: ${goal} ETH | Raised: ${raised} ETH<br>
        <div class="progress">
          <div class="progress-bar" style="width:${percent}%"></div>
        </div>
        State: ${STATES[c[5]]}<br>
        ⏱ <span id="t-${i}">${timeLeft}</span> sec
      </div>
    `;
  });
}

/* ---------- COUNTDOWN ---------- */

function startCountdown() {
  setInterval(() => {
    const now = Math.floor(Date.now() / 1000);
    campaignsCache.forEach((c, i) => {
      const el = document.getElementById(`t-${i}`);
      if (el) el.innerText = Math.max(Number(c[3]) - now, 0);
    });
  }, 1000);
}

/* ---------- CONTRACT ACTIONS ---------- */

async function createCampaign() {
  const tx = await crowdfunding.createCampaign(
    title.value,
    ethers.parseEther(goal.value),
    duration.value
  );
  await tx.wait();
  loadCampaigns();
}

async function contribute() {
  const tx = await crowdfunding.contribute(campaignId.value, {
    value: ethers.parseEther(amount.value)
  });
  await tx.wait();
  loadCampaigns();
}

async function finalize() {
  const tx = await crowdfunding.finalizeCampaign(campaignId.value);
  await tx.wait();
  loadCampaigns();
}

async function withdraw() {
  const tx = await crowdfunding.withdrawFunds(campaignId.value);
  await tx.wait();
  loadCampaigns();
}

async function refund() {
  const tx = await crowdfunding.refund(campaignId.value);
  await tx.wait();
  loadCampaigns();
}
