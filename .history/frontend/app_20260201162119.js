let provider, signer, contract;
let role = "";
let userAddress = "";
let campaignsCache = [];

const CONTRACT_ADDRESS = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";

const ABI = [
  "function campaignCount() view returns(uint256)",
  "function campaigns(uint256) view returns(address,string,uint256,uint256,uint256,uint8)",
  "function submitCampaign(string,uint256,uint256)",
  "function approveCampaign(uint256)",
  "function rejectCampaign(uint256)",
  "function contribute(uint256) payable",
  "function refund(uint256)",
  "function withdraw(uint256)",
  "function finalize(uint256)"
];

// Keep state names in sync with the contract enum
const STATES = [
  "Submitted",   // 0
  "Approved",    // 1
  "Active",      // 2
  "Successful",  // 3
  "Failed",      // 4
  "Withdrawn",   // 5
  "Rejected"     // 6
];

function el(id){ return document.getElementById(id); }

/* LOGIN */

async function login(r) {
  role = r;

  provider = new ethers.BrowserProvider(window.ethereum);
  await provider.send("eth_requestAccounts", []);
  signer = await provider.getSigner();
  userAddress = await signer.getAddress();

  contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);

  el("wallet").innerText = userAddress.slice(0,6) + "…";
  updateBalance();
  provider.on("block", updateBalance);

  el("login").classList.add("hidden");
  el("creatorUI").classList.toggle("hidden", role !== "creator");
  el("moderatorUI").classList.toggle("hidden", role !== "moderator");
  el("contributorUI").classList.toggle("hidden", role !== "contributor");

  loadCampaigns();
  setInterval(loadCampaigns, 4000);
}

/* BALANCE */

async function updateBalance(){
  const b = await provider.getBalance(userAddress);
  el("balance").innerText = ethers.formatEther(b).slice(0,8) + " ETH";
}

/* CREATOR */

async function submitCampaign(){
  await contract.submitCampaign(
    el("title").value,
    ethers.parseEther(el("goal").value),
    el("duration").value
  );
  loadCampaigns();
}

/* CONTRIBUTOR */

async function contribute(){
  await contract.contribute(
    el("contributeCampaignId").value,
    { value: ethers.parseEther(el("contributeAmount").value) }
  );
  loadCampaigns();
}

async function refund(){
  await contract.refund(el("contributeCampaignId").value);
  loadCampaigns();
}

/* MODERATOR */

async function approveCampaignFromCard(id){
  await contract.approveCampaign(id);
  loadCampaigns();
}

async function rejectCampaignFromCard(id){
  await contract.rejectCampaign(id);
  loadCampaigns();
}

/* COMMON ACTIONS */

async function withdrawFromCard(id){
  await contract.withdraw(id);
  loadCampaigns();
}

async function finalizeFromCard(id){
  await contract.finalize(id);
  loadCampaigns();
}

/* CAMPAIGNS */

async function loadCampaigns(){
  campaignsCache = [];
  const count = await contract.campaignCount();

  for(let i=0;i<count;i++){
    campaignsCache.push(await contract.campaigns(i));
  }
  render();
}

function render(){
  const now = Math.floor(Date.now()/1000);
  el("campaigns").innerHTML = "";

  campaignsCache.forEach((c,i)=>{
    const creator = c[0];
    const title = c[1];
    const goal = Number(ethers.formatEther(c[2]));
    const deadline = Number(c[3]);
    const raised = Number(ethers.formatEther(c[4]));
    const stateIndex = Number(c[5]);
    const state = STATES[stateIndex] || "Unknown";
    const pct = goal ? Math.min((raised/goal)*100,100) : 0;

    let status = "";
    if(stateIndex === 0){
      status = `<p>⏳ Pending approval</p>`;
    }
    if(stateIndex === 2){
      status = `<p>⏱ ${Math.max(deadline - now, 0)} sec</p>`;
    }

    let actions = "";

    // MODERATOR
    if(role === "moderator" && stateIndex === 0){
      actions += `
        <button onclick="approveCampaignFromCard(${i})">Approve</button>
        <button onclick="rejectCampaignFromCard(${i})" class="secondary">Reject</button>
      `;
    }

    // CREATOR
    if(
      role === "creator" &&
      stateIndex === 3 &&
      creator.toLowerCase() === userAddress.toLowerCase()
    ){
      actions += `<button onclick="withdrawFromCard(${i})">Withdraw</button>`;
    }

    // FINALIZE
    if(stateIndex === 2 && now >= deadline){
      actions += `<button onclick="finalizeFromCard(${i})">Finalize</button>`;
    }

    el("campaigns").innerHTML += `
      <div class="card">
        <h4>${title}</h4>
        <span class="badge ${state.toLowerCase()}">${state}</span>
        <p>${raised} / ${goal} ETH</p>
        <div class="progress">
          <div class="progress-bar" style="width:${pct}%"></div>
        </div>
        ${status}
        ${actions}
      </div>
    `;
  });
}
