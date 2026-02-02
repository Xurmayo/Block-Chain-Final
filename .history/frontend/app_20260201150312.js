let provider, signer, crowdfunding;
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

/* ---------- CONNECT ---------- */

async function connectWallet() {
  provider = new ethers.BrowserProvider(window.ethereum);
  signer = await provider.getSigner();

  document.getElementById("account").innerText = await signer.getAddress();
  await updateBalance();

  crowdfunding = new ethers.Contract(CROWDFUNDING_ADDRESS, ABI, signer);

  await loadCampaigns();
  startCountdown();
  setInterval(updateBalance, 10000); // ETH balance every 10s
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
  const container = document.getElementById("campaigns");
  container.innerHTML = "";

  const now = Math.floor(Date.now() / 1000);

  campaignsCache.forEach((c, i) => {
    const goal = Number(ethers.formatEther(c[2]));
    const raised = Number(ethers.formatEther(c[4]));
    const percent = Math.min((raised / goal) * 100, 100);

    const timeLeft = Math.max(Number(c[3]) - now, 0);

    const div = document.createElement("div");
    div.className = "card";
    div.innerHTML = `
      <b>ID:</b> ${i}<br>
      <b>${c[1]}</b><br>
      <span class="small">Goal: ${goal} ETH | Raised: ${raised} ETH</span><br>
      <div class="progress">
        <div class="progress-bar" style="width:${percent}%"></div>
      </div>
      <span class="small">State: ${STATES[c[5]]}</span><br>
      <span class="small">⏱ <span id="time-${i}">${timeLeft}</span> sec left</span>
    `;
    container.appendChild(div);
  });
}

/* ---------- COUNTDOWN (SMOOTH) ---------- */

function startCountdown() {
  setInterval(() => {
    const now = Math.floor(Date.now() / 1000);
    campaignsCache.forEach((c, i) => {
      const el = document.getElementById(`time-${i}`);
      if (el) {
        el.innerText = Math.max(Number(c[3]) - now, 0);
      }
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
