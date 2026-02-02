let provider, signer, contract, role;
let cache = [];

const ADDRESS = "PASTE_YOUR_CROWDFUNDING_ADDRESS";

const ABI = [
  "function campaignCount() view returns(uint256)",
  "function campaigns(uint256) view returns(address,string,uint256,uint256,uint256,uint8)",
  "function submitCampaign(string,uint256,uint256)",
  "function approveCampaign(uint256)",
  "function rejectCampaign(uint256)",
  "function contribute(uint256) payable",
  "function refund(uint256)"
];

const STATES = ["Submitted", "Approved", "Active", "Successful", "Failed", "Withdrawn", "Rejected"];

async function login(r) {
  role = r;
  provider = new ethers.BrowserProvider(window.ethereum);
  await provider.send("eth_requestAccounts", []);
  signer = await provider.getSigner();
  contract = new ethers.Contract(ADDRESS, ABI, signer);

  wallet.innerText = (await signer.getAddress()).slice(0,6) + "...";
  updateBalance();
  provider.on("block", updateBalance);

  login.classList.add("hidden");
  creatorUI.classList.toggle("hidden", role !== "creator");
  moderatorUI.classList.toggle("hidden", role !== "moderator");
  contributorUI.classList.toggle("hidden", role !== "contributor");

  loadCampaigns();
  startCountdown();
}

async function updateBalance() {
  balance.innerText = ethers.formatEther(
    await provider.getBalance(await signer.getAddress())
  ).slice(0,6) + " ETH";
}

async function submitCampaign() {
  if (!title.value || !goal.value || !duration.value) return alert("Fill all fields");
  await contract.submitCampaign(
    title.value,
    ethers.parseEther(goal.value),
    duration.value
  );
  loadCampaigns();
}

async function approve() {
  if (!modId.value) return alert("Campaign ID required");
  await contract.approveCampaign(modId.value);
  loadCampaigns();
}

async function reject() {
  if (!modId.value) return alert("Campaign ID required");
  await contract.rejectCampaign(modId.value);
  loadCampaigns();
}

async function contribute() {
  if (!cid.value || !amt.value) return alert("Fill fields");
  await contract.contribute(cid.value, {
    value: ethers.parseEther(amt.value)
  });
  loadCampaigns();
}

async function refund() {
  if (!cid.value) return alert("Campaign ID required");
  await contract.refund(cid.value);
  loadCampaigns();
}

async function loadCampaigns() {
  cache = [];
  campaigns.innerHTML = "";
  const count = await contract.campaignCount();

  for (let i = 0; i < count; i++) {
    cache.push(await contract.campaigns(i));
  }
  render();
}

function render() {
  campaigns.innerHTML = "";
  const now = Math.floor(Date.now() / 1000);

  cache.forEach((c, i) => {
    const goal = Number(ethers.formatEther(c[2]));
    const raised = Number(ethers.formatEther(c[4]));
    const pct = Math.min((raised / goal) * 100, 100);
    const timeLeft = Math.max(c[3] - now, 0);

    const badge =
      c[5] == 2 ? "active" :
      c[5] == 3 ? "success" :
      c[5] == 4 ? "failed" :
      "pending";

    campaigns.innerHTML += `
      <div class="card">
        <h4>${c[1]}</h4>
        <span class="badge ${badge}">${STATES[c[5]]}</span>
        <p>${raised} / ${goal} ETH</p>
        <div class="progress">
          <div class="progress-bar" style="width:${pct}%"></div>
        </div>
        <p>⏱ <span id="t-${i}">${timeLeft}</span> sec</p>
      </div>
    `;
  });
}

function startCountdown() {
  setInterval(() => {
    const now = Math.floor(Date.now() / 1000);
    cache.forEach((c, i) => {
      const el = document.getElementById(`t-${i}`);
      if (el) el.innerText = Math.max(c[3] - now, 0);
    });
  }, 1000);
}
