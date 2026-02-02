let provider;
let signer;
let crowdfunding;

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

/* ---------------- CONNECT WALLET ---------------- */

async function connectWallet() {
  if (!window.ethereum) {
    alert("MetaMask not installed");
    return;
  }

  provider = new ethers.BrowserProvider(window.ethereum);
  signer = await provider.getSigner();

  const address = await signer.getAddress();
  document.getElementById("account").innerText = address;

  const balance = await provider.getBalance(address);
  document.getElementById("ethBalance").innerText =
    ethers.formatEther(balance);

  crowdfunding = new ethers.Contract(
    CROWDFUNDING_ADDRESS,
    ABI,
    signer
  );

  loadCampaigns();
  setInterval(loadCampaigns, 1000); // LIVE UPDATE
}

/* ---------------- CREATE CAMPAIGN ---------------- */

async function createCampaign() {
  const title = document.getElementById("title").value;
  const goal = ethers.parseEther(document.getElementById("goal").value);
  const duration = document.getElementById("duration").value;

  const tx = await crowdfunding.createCampaign(title, goal, duration);
  await tx.wait();

  alert("Campaign created");
  loadCampaigns();
}

/* ---------------- CONTRIBUTE ---------------- */

async function contribute() {
  const id = document.getElementById("campaignId").value;
  const amount = ethers.parseEther(document.getElementById("amount").value);

  const tx = await crowdfunding.contribute(id, { value: amount });
  await tx.wait();

  alert("Contribution successful");
  loadCampaigns();
}

/* ---------------- FINALIZE ---------------- */

async function finalize() {
  const id = document.getElementById("campaignId").value;
  const tx = await crowdfunding.finalizeCampaign(id);
  await tx.wait();

  alert("Campaign finalized");
  loadCampaigns();
}

/* ---------------- WITHDRAW ---------------- */

async function withdraw() {
  const id = document.getElementById("campaignId").value;
  const tx = await crowdfunding.withdrawFunds(id);
  await tx.wait();

  alert("Funds withdrawn");
  loadCampaigns();
}

/* ---------------- REFUND ---------------- */

async function refund() {
  const id = document.getElementById("campaignId").value;
  const tx = await crowdfunding.refund(id);
  await tx.wait();

  alert("Refund completed");
  loadCampaigns();
}

/* ---------------- LOAD ALL CAMPAIGNS ---------------- */

async function loadCampaigns() {
  if (!crowdfunding) return;

  const container = document.getElementById("campaigns");
  container.innerHTML = "";

  const count = await crowdfunding.campaignCount();
  const now = Math.floor(Date.now() / 1000);

  for (let i = 0; i < count; i++) {
    const c = await crowdfunding.campaigns(i);

    const creator = c[0];
    const title = c[1];
    const goal = ethers.formatEther(c[2]);
    const deadline = Number(c[3]);
    const raised = ethers.formatEther(c[4]);
    const state = STATES[c[5]];

    let timeLeft = deadline - now;
    let timeText = timeLeft > 0 ? `${timeLeft} sec left` : "Ended";

    const div = document.createElement("div");
    div.className = "campaign";
    div.innerHTML = `
      <b>ID:</b> ${i}<br>
      <b>Title:</b> ${title}<br>
      <b>Creator:</b> ${creator}<br>
      <b>Goal:</b> ${goal} ETH<br>
      <b>Raised:</b> ${raised} ETH<br>
      <b>State:</b> ${state}<br>
      <b>Time:</b> ⏱ ${timeText}
    `;

    container.appendChild(div);
  }
}
