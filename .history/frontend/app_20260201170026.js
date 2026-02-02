let provider, signer, contract;
let role = "";
let userAddress = "";
let campaignsCache = [];
let contractModerator = "";

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

  try {
    contractModerator = await contract.moderator();
  } catch (err) {
    console.warn("Could not read moderator from contract:", err);
    contractModerator = "(unknown)";
  }

  el("wallet").innerText = userAddress.slice(0,6) + "…";
  updateBalance();
  provider.on("block", updateBalance);

  el("login").classList.add("hidden");
  el("creatorUI").classList.toggle("hidden", role !== "creator");
  el("moderatorUI").classList.toggle("hidden", role !== "moderator");
  el("contributorUI").classList.toggle("hidden", role !== "contributor");

  loadCampaigns();
  setInterval(loadCampaigns, 4000);
  // Update the UI every second from cached data so countdowns are smooth
  setInterval(updateCountdowns, 1000);
}

/* BALANCE */

async function updateBalance(){
  const b = await provider.getBalance(userAddress);
  el("balance").innerText = ethers.formatEther(b).slice(0,8) + " ETH";
}

/* CREATOR */

async function submitCampaign(){
  try {
    const tx = await contract.submitCampaign(
      el("title").value,
      ethers.parseEther(el("goal").value),
      el("duration").value
    );
    await tx.wait();
    loadCampaigns(true);
  } catch (err) {
    alert("Submit failed: " + (err && err.message ? err.message : err));
    console.error(err);
  }
}

/* CONTRIBUTOR */

async function contribute(campaignId, amount){
  try {
    if(!amount || isNaN(amount) || parseFloat(amount) <= 0){
      alert("Please enter a valid ETH amount");
      return;
    }
    const tx = await contract.contribute(
      parseInt(campaignId),
      { value: ethers.parseEther(amount.toString()) }
    );
    await tx.wait();
    el("amount_" + campaignId).value = "";
    loadCampaigns(true);
  } catch (err) {
    alert("Contribute failed: " + (err && err.message ? err.message : err));
    console.error(err);
  }
}

async function contributeFromUI(){
  try {
    const campaignId = el("contributeCampaignId").value;
    const amount = el("contributeAmount").value;
    if(!campaignId || !amount || isNaN(amount) || parseFloat(amount) <= 0){
      alert("Please enter valid campaign ID and ETH amount");
      return;
    }
    const tx = await contract.contribute(
      parseInt(campaignId),
      { value: ethers.parseEther(amount.toString()) }
    );
    await tx.wait();
    el("contributeCampaignId").value = "";
    el("contributeAmount").value = "";
    loadCampaigns(true);
  } catch (err) {
    alert("Contribute failed: " + (err && err.message ? err.message : err));
    console.error(err);
  }
}

async function refund(){
  try {
    const tx = await contract.refund(el("contributeCampaignId").value);
    await tx.wait();
    loadCampaigns(true);
  } catch (err) {
    alert("Refund failed: " + (err && err.message ? err.message : err));
    console.error(err);
  }
}

/* MODERATOR */

async function approveCampaignFromCard(id){
  try {
    const tx = await contract.approveCampaign(id);
    await tx.wait();
    loadCampaigns(true);
  } catch (err) {
    alert("Approve failed: " + (err && err.message ? err.message : err));
    console.error(err);
  }
}

async function rejectCampaignFromCard(id){
  try {
    const tx = await contract.rejectCampaign(id);
    await tx.wait();
    loadCampaigns(true);
  } catch (err) {
    alert("Reject failed: " + (err && err.message ? err.message : err));
    console.error(err);
  }
}

/* COMMON ACTIONS */

async function withdrawFromCard(id){
  try {
    const tx = await contract.withdraw(id);
    await tx.wait();
    loadCampaigns(true);
  } catch (err) {
    alert("Withdraw failed: " + (err && err.message ? err.message : err));
    console.error(err);
  }
}

async function finalizeFromCard(id){
  try {
    const tx = await contract.finalize(id);
    await tx.wait();
    loadCampaigns(true);
  } catch (err) {
    alert("Finalize failed: " + (err && err.message ? err.message : err));
    console.error(err);
  }
}

/* CAMPAIGNS */

async function loadCampaigns(forceRender = false){
  const newCampaigns = [];
  const count = await contract.campaignCount();

  for(let i=0;i<count;i++){
    const campaignData = await contract.campaigns(i);
    newCampaigns.push({
      id: i,
      creator: campaignData[0],
      title: campaignData[1],
      goal: campaignData[2],
      deadline: campaignData[3],
      raised: campaignData[4],
      state: campaignData[5]
    });
  }
  
  // Always render if forced (after user actions), or render if first load or data changed
  if(forceRender || campaignsCache.length === 0 || JSON.stringify(newCampaigns) !== JSON.stringify(campaignsCache)){
    campaignsCache = newCampaigns;
    render();
  }
}

function render(){
  const now = Math.floor(Date.now()/1000);
  el("campaigns").innerHTML = "";

  campaignsCache.forEach((c)=>{
    const campaignId = c.id;
    const creator = c.creator;
    const title = c.title;
    const goal = Number(ethers.formatEther(c.goal));
    const deadline = Number(c.deadline);
    const raised = Number(ethers.formatEther(c.raised));
    const stateIndex = Number(c.state);
    const state = STATES[stateIndex] || "Unknown";
    const pct = goal ? Math.min((raised/goal)*100,100) : 0;

    let status = "";
    if(stateIndex === 0){
      status = `<p>⏳ Pending approval</p>`;
    } else if(stateIndex === 2){
      if(deadline === 0){
        status = `<p>⏳ Waiting for moderator to start</p>`;
      } else {
        status = `<p class="countdown" data-deadline="${deadline}">⏱ ${Math.max(deadline - now, 0)} sec</p>`;
      }
    }

    let actions = "";

    // MODERATOR
    if(role === "moderator" && stateIndex === 0){
      actions += `
        <button onclick="approveCampaignFromCard(${campaignId})">Approve</button>
        <button onclick="rejectCampaignFromCard(${campaignId})" class="secondary">Reject</button>
      `;
    }

    // CONTRIBUTOR
    if(role === "contributor" && stateIndex === 2 && deadline > 0 && now < deadline){
      actions += `
        <input type="number" id="amount_${campaignId}" placeholder="ETH" step="0.01" style="display:inline-block; width:60px; margin-right:6px;">
        <button onclick="contribute(${campaignId}, document.getElementById('amount_${campaignId}').value)">Contribute</button>
      `;
    }

    // CREATOR
    if(
      role === "creator" &&
      stateIndex === 3 &&
      creator.toLowerCase() === userAddress.toLowerCase()
    ){
      actions += `<button onclick="withdrawFromCard(${campaignId})">Withdraw</button>`;
    }

    // FINALIZE
    if(stateIndex === 2 && now >= deadline){
      actions += `<button onclick="finalizeFromCard(${campaignId})">Finalize</button>`;
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

function updateCountdowns(){
  const now = Math.floor(Date.now()/1000);
  document.querySelectorAll(".countdown").forEach((el)=>{
    const deadline = Number(el.dataset.deadline);
    el.innerText = `⏱ ${Math.max(deadline - now, 0)} sec`;
  });
}
