const ADDRESS = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";

const ABI = [
  "function campaignCount() view returns(uint256)",
  "function campaigns(uint256) view returns(address,string,uint256,uint256,uint256,uint8)",
  "function submitCampaign(string,uint256,uint256)",
  "function approveCampaign(uint256)",
  "function rejectCampaign(uint256)",
  "function contribute(uint256) payable",
  "function withdraw(uint256)",
  "function refund(uint256)"
];

let provider, signer, contract, role;

async function login(r) {
  role = r;
  provider = new ethers.BrowserProvider(window.ethereum);
  await provider.send("eth_requestAccounts", []);
  signer = await provider.getSigner();
  contract = new ethers.Contract(ADDRESS, ABI, signer);

  document.getElementById("login").classList.add("hidden");
  document.getElementById("creatorUI").classList.toggle("hidden", role !== "creator");

  loadCampaigns();
}

async function submitCampaign() {
  await contract.submitCampaign(
    title.value,
    ethers.parseEther(goal.value),
    duration.value
  );
  loadCampaigns();
}

async function loadCampaigns() {
  const c = document.getElementById("campaigns");
  c.innerHTML = "";

  const count = await contract.campaignCount();
  for (let i = 0; i < count; i++) {
    const cam = await contract.campaigns(i);
    c.innerHTML += `
      <div class="card">
        <b>${cam[1]}</b><br>
        Raised: ${ethers.formatEther(cam[4])} ETH<br>
        State: ${cam[5]}
      </div>`;
  }
}
