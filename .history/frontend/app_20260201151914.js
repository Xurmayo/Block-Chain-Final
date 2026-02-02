let provider, signer, contract, role;

const ADDRESS = "PASTE_CROWDFUNDING_ADDRESS_HERE";

const ABI = [
  "function campaignCount() view returns(uint256)",
  "function campaigns(uint256) view returns(address,string,uint256,uint256,uint256,uint8)",
  "function submitCampaign(string,uint256,uint256)",
  "function approveCampaign(uint256)",
  "function rejectCampaign(uint256)",
  "function contribute(uint256) payable",
  "function finalize(uint256)",
  "function withdraw(uint256)",
  "function refund(uint256)"
];

async function login(r) {
  role = r;

  provider = new ethers.BrowserProvider(window.ethereum);
  await provider.send("eth_requestAccounts", []);
  signer = await provider.getSigner();

  contract = new ethers.Contract(ADDRESS, ABI, signer);

  document.getElementById("login").style.display = "none";
  document.getElementById("app").style.display = "block";
  document.getElementById("role").innerText = role;
  document.getElementById("account").innerText = await signer.getAddress();

  updateBalance();
  provider.on("block", updateBalance);

  toggleUI();
  loadCampaigns();
}

function toggleUI() {
  creatorUI.style.display = role === "creator" ? "block" : "none";
  moderatorUI.style.display = role === "moderator" ? "block" : "none";
  contributorUI.style.display = role === "contributor" ? "block" : "none";
}

async function updateBalance() {
  balance.innerText = ethers.formatEther(
    await provider.getBalance(await signer.getAddress())
  );
}

async function submit() {
  if (!title.value || !goal.value || !duration.value) return alert("Fill all");
  await contract.submitCampaign(
    title.value,
    ethers.parseEther(goal.value),
    duration.value
  );
  loadCampaigns();
}

async function approve() {
  if (!modId.value) return alert("Enter ID");
  await contract.approveCampaign(modId.value);
  loadCampaigns();
}

async function reject() {
  if (!modId.value) return alert("Enter ID");
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
  if (!cid.value) return alert("Enter ID");
  await contract.refund(cid.value);
  loadCampaigns();
}

async function loadCampaigns() {
  campaigns.innerHTML = "";
  const count = await contract.campaignCount();

  for (let i = 0; i < count; i++) {
    const c = await contract.campaigns(i);
    campaigns.innerHTML += `
      <div>
        <b>ID:</b> ${i} |
        <b>${c[1]}</b> |
        State: ${c[5]}
      </div>
    `;
  }
}
