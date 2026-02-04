let provider, signer, contract;
let tokenContract;
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
  "function finalize(uint256)",
  "function moderator() view returns(address)",
  "function rewardToken() view returns(address)"
];

// Keep state names in sync with the contract enum
const STATES = [
  "Submitted",   // 0
  "Approved",    // 1
  "Active",      // 2
  "Successful",  // 3
  "Did not succeed",  // 4
  "Withdrawn",   // 5
  "Rejected"     // 6
];

const TOKEN_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function burn(address from, uint256 amount) external"
];

const NFT_CONTRACT_ADDRESS = "YOUR_DEPLOYED_NFT_CONTRACT_ADDRESS";
const NFT_ABI = [
  "function mint(address to, string uri) external returns (uint256)",
  "function balanceOf(address owner) view returns (uint256)",
  "function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)",
  "function tokenURI(uint256 tokenId) view returns (string)"
];

// Example NFT URIs (replace with your actual metadata/image URLs)
const NFT_CHOICES = [
  { name: "Gold Badge", uri: "https://your-nft-metadata-url.com/gold.json", img: "https://your-nft-image-url.com/gold.png" },
  { name: "Silver Badge", uri: "https://your-nft-metadata-url.com/silver.json", img: "https://your-nft-image-url.com/silver.png" },
  { name: "Bronze Badge", uri: "https://your-nft-metadata-url.com/bronze.json", img: "https://your-nft-image-url.com/bronze.png" }
];

let selectedNFTChoice = null;
let nftContract;
let selectedNFT = null;
let userNFTs = []; // Store user's NFTs for badge display

function el(id){ return document.getElementById(id); }

/* LOGIN */

async function login(r) {
  role = r;

  provider = new ethers.BrowserProvider(window.ethereum);
  await provider.send("eth_requestAccounts", []);

  // Fix: Accept BigInt for chainId
  const network = await provider.getNetwork();
  console.log("MetaMask chainId:", network.chainId, typeof network.chainId);
  if(network.chainId.toString() !== "31337"){
    alert("Please switch your wallet to local Hardhat network (chainId 31337).");
    return;
  }

  signer = await provider.getSigner();
  userAddress = await signer.getAddress();

  contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);

  try {
    contractModerator = await contract.moderator();
  } catch (err) {
    console.warn("Could not read moderator from contract:", err);
    contractModerator = "(unknown)";
  }

  // try to get token address and create token contract for balance reads
  try {
    const tokenAddr = await contract.rewardToken();
    tokenContract = new ethers.Contract(tokenAddr, TOKEN_ABI, provider);
  } catch (err) {
    console.warn("Could not read rewardToken from contract:", err);
    tokenContract = null;
  }

  el("wallet").innerText = userAddress.slice(0,6) + "…";
  // Generate blockies icon
  const icon = blockies.create({ seed: userAddress.toLowerCase(), size: 8, scale: 4 }).toDataURL();
  el("avatar").innerHTML = `<img src="${icon}" style="border-radius:50%;vertical-align:middle;width:32px;height:32px;">`;

  updateBalance();
  provider.on("block", updateBalance);

  el("login").classList.add("hidden");
  el("creatorUI").classList.toggle("hidden", role !== "creator");
  el("moderatorUI").classList.toggle("hidden", role !== "moderator");
  el("contributorUI").classList.toggle("hidden", role !== "contributor");

  nftContract = new ethers.Contract(NFT_CONTRACT_ADDRESS, NFT_ABI, signer);
  el("nftSection").classList.remove("hidden");
  await loadNFTs(); // Await so badge can be shown before campaigns

  // Always reload campaigns for the new role/account
  await loadCampaigns(true);

  // Show badge in header if user has one
  showUserBadge();
}

// Show NFT choices modal
window.showNFTChoices = function() {
  selectedNFTChoice = null;
  renderNFTChoices();
  el("nftChoicesModal").classList.remove("hidden");
  el("confirmNFTBtn").disabled = true;
};

// Hide NFT choices modal
window.hideNFTChoices = function() {
  el("nftChoicesModal").classList.add("hidden");
};

// Render NFT choices with icons and selection
function renderNFTChoices() {
  let html = `<span class="nft-choices-label">Choose your NFT badge:</span>`;
  NFT_CHOICES.forEach((choice, idx) => {
    html += `<img src="${choice.img}" alt="${choice.name}" title="${choice.name}" 
      class="${selectedNFTChoice===idx?'selected':''}" 
      onclick="window.selectNFTChoice(${idx})">`;
  });
  el("nftChoices").innerHTML = html;
}

// Select NFT choice
window.selectNFTChoice = function(idx) {
  selectedNFTChoice = idx;
  renderNFTChoices();
  el("confirmNFTBtn").disabled = false;
};

// Confirm trade: burn CTKN and mint NFT
window.confirmNFTTrade = async function() {
  if(selectedNFTChoice === null) {
    alert("Please select an NFT badge first.");
    return;
  }
  try {
    // Check CTKN balance
    const tb = await tokenContract.balanceOf(userAddress);
    const burnAmount = ethers.parseEther("10");
    if (tb < burnAmount) {
      alert("You need at least 10 CTKN to trade for an NFT badge.");
      return;
    }
    // Burn 10 CTKN
    await tokenContract.connect(signer).burn(userAddress, burnAmount);
    // Mint NFT
    const uri = NFT_CHOICES[selectedNFTChoice].uri;
    await nftContract.mint(userAddress, uri);
    hideNFTChoices();
    loadNFTs();
    updateBalance();
  } catch (err) {
    alert("Trade for NFT failed: " + (err && err.message ? err.message : err));
    console.error(err);
  }
};

/* BALANCE */

async function updateBalance(){
  const b = await provider.getBalance(userAddress);
  el("balance").innerText = ethers.formatEther(b).slice(0,8) + " ETH";

  // update ERC20 token balance if available
  if(tokenContract){
    try {
      const tb = await tokenContract.balanceOf(userAddress);
      // token has 18 decimals in this repo
      el("tokenBalance").innerText = ethers.formatEther(tb).slice(0,8) + " CTKN";
    } catch (err) {
      console.warn("Failed to fetch token balance:", err);
    }
  }
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
    el("title").value = "";
    el("goal").value = "";
    el("duration").value = "";
    await loadCampaigns(true);
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
    await loadCampaigns(true);
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
    await loadCampaigns(true);
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

let campaignsLoading = false;
let lastCampaignCount = 0;

async function loadCampaigns(forceRender = false){
  if (campaignsLoading) return;
  campaignsLoading = true;
  let newCampaigns = [];
  let count = 0;
  try {
    count = Number(await contract.campaignCount());
    lastCampaignCount = count;
  } catch (e) {
    console.error("Error fetching campaignCount:", e);
    // Do not update campaignsCache if error
    campaignsLoading = false;
    return;
  }

  try {
    for(let i=0;i<count;i++){
      const campaignData = await contract.campaigns(i);
      newCampaigns.push({
        id: i,
        creator: campaignData[0],
        title: campaignData[1],
        goal: campaignData[2].toString(),
        deadline: campaignData[3].toString(),
        raised: campaignData[4].toString(),
        state: Number(campaignData[5])
      });
    }
  } catch (err) {
    console.error("Error fetching campaigns:", err);
    // Do not update campaignsCache if error
    campaignsLoading = false;
    return;
  }

  // Only update cache and render if the new campaigns are different
  if (
    forceRender ||
    campaignsCache.length !== newCampaigns.length ||
    JSON.stringify(newCampaigns) !== JSON.stringify(campaignsCache)
  ) {
    campaignsCache = newCampaigns;
    render();
  }
  campaignsLoading = false;
}

function render(){
  const now = Math.floor(Date.now()/1000);
  el("campaigns").innerHTML = "";

  if (!campaignsCache || campaignsCache.length === 0) {
    el("campaigns").innerHTML = "<div style='color:#888;padding:24px;'>No campaigns found.</div>";
    return;
  }

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
        <span class="badge ${state.toLowerCase().replace(/ /g, '-')}">${state}</span>
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

/* NFT FUNCTIONS */

async function tradeForNFT() {
  // Burn 10 CTKN, then mint NFT (you need a backend or contract function to coordinate this securely)
  // For demo: just call mint (in production, require proof of burn)
  const uri = "https://your-nft-metadata-url.com/badge.json"; // Replace with your metadata
  await nftContract.mint(userAddress, uri);
  loadNFTs();
}

async function loadNFTs() {
  userNFTs = [];
  const count = await nftContract.balanceOf(userAddress);
  let html = "";
  for(let i=0; i<count; i++) {
    const tokenId = await nftContract.tokenOfOwnerByIndex(userAddress, i);
    const uri = await nftContract.tokenURI(tokenId);
    userNFTs.push({ tokenId, uri });
    html += `<img src="${uri}" width="64" height="64" onclick="selectNFT(${tokenId},'${uri}')"> `;
  }
  el("nftList").innerHTML = html;
  showUserBadge();
}

// Show user's NFT badge in header (if any), else show blockies
function showUserBadge() {
  let badgeHtml = "";
  if (userNFTs.length > 0) {
    // Show first NFT as badge by default
    badgeHtml = `<img src="${userNFTs[0].uri}" style="border-radius:50%;vertical-align:middle;width:32px;height:32px;border:2px solid #22c55e;margin-right:6px;" title="Your NFT Badge">`;
  } else {
    // Show blockies if no NFT
    badgeHtml = `<img src="${blockies.create({ seed: userAddress.toLowerCase(), size: 8, scale: 4 }).toDataURL()}" style="border-radius:50%;vertical-align:middle;width:32px;height:32px;">`;
  }
  el("avatar").innerHTML = badgeHtml;
}

window.selectNFT = function(tokenId, uri) {
  selectedNFT = { tokenId, uri };
  el("setNFTBtn").style.display = "inline-block";
  // Optionally: set as badge when selected
  showUserBadge();
};

window.setNFTAsAvatar = function() {
  if(selectedNFT) {
    // Set selected NFT as badge in header
    el("avatar").innerHTML = `<img src="${selectedNFT.uri}" style="border-radius:50%;vertical-align:middle;width:32px;height:32px;border:2px solid #22c55e;margin-right:6px;" title="Your NFT Badge">`;
  }
};
