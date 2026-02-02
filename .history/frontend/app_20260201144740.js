let provider;
let signer;
let crowdfunding;

const CROWDFUNDING_ADDRESS = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";

const ABI = [
  "function createCampaign(string,uint256,uint256)",
  "function contribute(uint256) payable",
  "function finalizeCampaign(uint256)",
  "function withdrawFunds(uint256)",
  "function refund(uint256)"
];

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
}

async function createCampaign() {
  const title = document.getElementById("title").value;
  const goal = ethers.parseEther(document.getElementById("goal").value);
  const duration = document.getElementById("duration").value;

  const tx = await crowdfunding.createCampaign(title, goal, duration);
  await tx.wait();
  alert("Campaign created");
}

async function contribute() {
  const id = document.getElementById("campaignId").value;
  const amount = ethers.parseEther(document.getElementById("amount").value);

  const tx = await crowdfunding.contribute(id, { value: amount });
  await tx.wait();
  alert("Contribution sent");
}

async function finalize() {
  const id = document.getElementById("campaignId").value;
  const tx = await crowdfunding.finalizeCampaign(id);
  await tx.wait();
  alert("Campaign finalized");
}

async function withdraw() {
  const id = document.getElementById("campaignId").value;
  const tx = await crowdfunding.withdrawFunds(id);
  await tx.wait();
  alert("Funds withdrawn");
}

async function refund() {
  const id = document.getElementById("campaignId").value;
  const tx = await crowdfunding.refund(id);
  await tx.wait();
  alert("Refund complete");
}
