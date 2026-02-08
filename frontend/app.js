"use strict";

let provider, signer, contract;
let tokenContract;
let role = "";
let userAddress = "";
let campaignsCache = [];
let contractModerator = "";

// update this after deploy
const CONTRACT_ADDRESS = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";
const ABI = [
  "function campaignCount() view returns(uint256)",
  "function campaigns(uint256) view returns(address,string,string,uint256,uint256,uint256,uint8)",
  "function submitCampaign(string,string,uint256,uint256)",
  "function approveCampaign(uint256)",
  "function rejectCampaign(uint256)",
  "function contribute(uint256) payable",
  "function refund(uint256)",
  "function withdraw(uint256)",
  "function finalize(uint256)",
  "function moderator() view returns(address)",
  "function rewardToken() view returns(address)",
  "function getCampaignContributors(uint256) view returns(address[])",
  "function contributions(uint256,address) view returns(uint256)",
];

const STATES = [
  "Submitted",
  "Approved",
  "Active",
  "Successful",
  "Did not succeed",
  "Withdrawn",
  "Rejected",
];

const TOKEN_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function burn(address from, uint256 amount) external",
];

// update this after deploy too
const NFT_CONTRACT_ADDRESS = "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9";
const NFT_ABI = [
  "function mint(address to, string uri) external returns (uint256)",
  "function balanceOf(address owner) view returns (uint256)",
  "function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)",
  "function tokenURI(uint256 tokenId) view returns (string)",
];

const ALLOWED_CHAIN_IDS = ["31337", "11155111", "17000"];
const CHAIN_NAMES = { 31337: "Local", 11155111: "Sepolia", 17000: "Holesky" };

const NFT_CHOICES = [
  {
    name: "Gold Badge",
    uri: "ipfs://bafybeigdyrzt4kqk6ovrj2kz2xtnixl2v3k6v4d7m4ax3nctz7psq4t5su/gold.json",
    img: "https://cdn-icons-png.flaticon.com/512/2583/2583344.png",
  },
  {
    name: "Silver Badge",
    uri: "ipfs://bafybeigdyrzt4kqk6ovrj2kz2xtnixl2v3k6v4d7m4ax3nctz7psq4t5su/silver.json",
    img: "https://cdn-icons-png.flaticon.com/512/2583/2583319.png",
  },
  {
    name: "Bronze Badge",
    uri: "ipfs://bafybeigdyrzt4kqk6ovrj2kz2xtnixl2v3k6v4d7m4ax3nctz7psq4t5su/bronze.json",
    img: "https://cdn-icons-png.flaticon.com/512/2583/2583434.png",
  },
];

const DEFAULT_BADGE_IMG =
  "https://cdn-icons-png.flaticon.com/512/2583/2583344.png";

let selectedNFTChoice = null;
let nftContract;
let selectedNFT = null;

function el(id) {
  return document.getElementById(id);
}

function setText(elId, text) {
  const node = el(elId);
  if (node) node.textContent = text;
}

function escapeHtml(s) {
  const str = String(s);
  const map = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };
  return str.replace(/[&<>"']/g, function (c) {
    return map[c];
  });
}

function setAvatarFromBlockies(address) {
  const container = el("avatar");
  if (!container) return;
  container.textContent = "";
  try {
    const icon = blockies
      .create({ seed: (address || "").toLowerCase(), size: 8, scale: 4 })
      .toDataURL();
    const img = document.createElement("img");
    img.setAttribute("src", icon);
    img.setAttribute("alt", "Avatar");
    container.appendChild(img);
  } catch (e) {
    console.warn("Blockies failed", e);
  }
}

function setAvatarFromUrl(url) {
  const container = el("avatar");
  if (!container) return;
  container.textContent = "";
  const img = document.createElement("img");
  img.setAttribute("src", url);
  img.setAttribute("alt", "Avatar");
  container.appendChild(img);
}

async function login(r) {
  role = r;

  if (!window.ethereum) {
    alert("Please install MetaMask.");
    return;
  }

  provider = new ethers.BrowserProvider(window.ethereum);
  await provider.send("eth_requestAccounts", []);

  const network = await provider.getNetwork();
  const chainIdStr = network.chainId.toString();
  if (!ALLOWED_CHAIN_IDS.includes(chainIdStr)) {
    alert(
      "Please switch to a supported network: Local (31337), Sepolia (11155111), or Holesky (17000).",
    );
    return;
  }

  signer = await provider.getSigner();
  userAddress = await signer.getAddress();

  contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);

  try {
    contractModerator = await contract.moderator();
  } catch (err) {
    console.warn("Could not read moderator", err);
    contractModerator = "";
  }

  try {
    const tokenAddr = await contract.rewardToken();
    tokenContract = new ethers.Contract(tokenAddr, TOKEN_ABI, provider);
  } catch (err) {
    console.warn("Could not read rewardToken", err);
    tokenContract = null;
  }

  setText("wallet", userAddress.slice(0, 6) + "\u2026");
  setAvatarFromBlockies(userAddress);

  updateBalance();
  provider.on("block", updateBalance);

  el("login").classList.add("hidden");
  el("creatorUI").classList.toggle("hidden", role !== "creator");
  el("moderatorUI").classList.toggle("hidden", role !== "moderator");
  el("contributorUI").classList.toggle("hidden", role !== "contributor");

  if (
    !NFT_CONTRACT_ADDRESS ||
    NFT_CONTRACT_ADDRESS === "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
  ) {
    alert(
      "NFT contract address is not set. Update NFT_CONTRACT_ADDRESS in app.js after deployment.",
    );
    return;
  }

  nftContract = new ethers.Contract(NFT_CONTRACT_ADDRESS, NFT_ABI, signer);
  el("nftSection").classList.remove("hidden");
  loadNFTs();

  await loadCampaigns(true);
}

function bindLoginButtons() {
  el("login").addEventListener("click", function (e) {
    const roleBtn = e.target.closest("[data-role]");
    if (roleBtn) login(roleBtn.getAttribute("data-role"));
  });
}

async function updateBalance() {
  if (!provider || !userAddress) return;
  try {
    const b = await provider.getBalance(userAddress);
    setText("balance", ethers.formatEther(b).slice(0, 10) + " ETH");
  } catch (err) {
    setText("balance", "0 ETH");
  }
  if (tokenContract) {
    try {
      const tb = await tokenContract.balanceOf(userAddress);
      setText("tokenBalance", ethers.formatEther(tb).slice(0, 10) + " CTKN");
    } catch (err) {
      setText("tokenBalance", "0 CTKN");
    }
  }
}

async function submitCampaign() {
  const title = (el("title") && el("title").value) || "";
  const description = (el("description") && el("description").value) || "";
  const goalStr = (el("goal") && el("goal").value) || "";
  const durationStr = (el("duration") && el("duration").value) || "";
  if (!title.trim()) {
    alert("Please enter a title.");
    return;
  }
  const goal = parseFloat(goalStr);
  const duration = parseInt(durationStr, 10);
  if (isNaN(goal) || goal <= 0) {
    alert("Please enter a valid goal (ETH).");
    return;
  }
  if (isNaN(duration) || duration <= 0) {
    alert("Please enter a valid duration (seconds).");
    return;
  }
  try {
    const tx = await contract.submitCampaign(
      title.trim(),
      description.trim(),
      ethers.parseEther(goalStr),
      duration,
    );
    await tx.wait();
    if (el("title")) el("title").value = "";
    if (el("description")) el("description").value = "";
    if (el("goal")) el("goal").value = "";
    if (el("duration")) el("duration").value = "";
    await loadCampaigns(true);
  } catch (err) {
    alert("Submit failed: " + (err && err.message ? err.message : String(err)));
    console.error(err);
  }
}

async function contribute(campaignId, amount) {
  const amt = parseFloat(amount);
  if (isNaN(amt) || amt <= 0) {
    alert("Please enter a valid ETH amount.");
    return;
  }
  try {
    const tx = await contract.contribute(parseInt(campaignId, 10), {
      value: ethers.parseEther(String(amt)),
    });
    await tx.wait();
    const amountEl = el("amount_" + campaignId);
    if (amountEl) amountEl.value = "";
    await loadCampaigns(true);
  } catch (err) {
    alert(
      "Contribute failed: " + (err && err.message ? err.message : String(err)),
    );
    console.error(err);
  }
}

async function contributeFromUI() {
  const campaignId =
    (el("contributeCampaignId") && el("contributeCampaignId").value) || "";
  const amount = (el("contributeAmount") && el("contributeAmount").value) || "";
  if (!campaignId.trim() || !amount) {
    alert("Please enter campaign ID and ETH amount.");
    return;
  }
  const amt = parseFloat(amount);
  if (isNaN(amt) || amt <= 0) {
    alert("Please enter a valid ETH amount.");
    return;
  }
  try {
    const tx = await contract.contribute(parseInt(campaignId, 10), {
      value: ethers.parseEther(amount),
    });
    await tx.wait();
    if (el("contributeCampaignId")) el("contributeCampaignId").value = "";
    if (el("contributeAmount")) el("contributeAmount").value = "";
    await loadCampaigns(true);
  } catch (err) {
    alert(
      "Contribute failed: " + (err && err.message ? err.message : String(err)),
    );
    console.error(err);
  }
}

async function refund() {
  const campaignId =
    (el("contributeCampaignId") && el("contributeCampaignId").value) || "";
  if (!campaignId.trim()) {
    alert("Enter the campaign ID to refund from.");
    return;
  }
  try {
    const tx = await contract.refund(parseInt(campaignId, 10));
    await tx.wait();
    await loadCampaigns(true);
  } catch (err) {
    alert("Refund failed: " + (err && err.message ? err.message : String(err)));
    console.error(err);
  }
}

async function approveCampaignFromCard(id) {
  try {
    const tx = await contract.approveCampaign(id);
    await tx.wait();
    await loadCampaigns(true);
  } catch (err) {
    alert(
      "Approve failed: " + (err && err.message ? err.message : String(err)),
    );
    console.error(err);
  }
}

async function rejectCampaignFromCard(id) {
  try {
    const tx = await contract.rejectCampaign(id);
    await tx.wait();
    await loadCampaigns(true);
  } catch (err) {
    alert("Reject failed: " + (err && err.message ? err.message : String(err)));
    console.error(err);
  }
}

async function withdrawFromCard(id) {
  try {
    const tx = await contract.withdraw(id);
    await tx.wait();
    await loadCampaigns(true);
  } catch (err) {
    alert(
      "Withdraw failed: " + (err && err.message ? err.message : String(err)),
    );
    console.error(err);
  }
}

async function finalizeFromCard(id) {
  try {
    const tx = await contract.finalize(id);
    await tx.wait();
    await loadCampaigns(true);
  } catch (err) {
    alert(
      "Finalize failed: " + (err && err.message ? err.message : String(err)),
    );
    console.error(err);
  }
}

async function showContributors(campaignId) {
  try {
    const contributors = await contract.getCampaignContributors(campaignId);
    if (contributors.length === 0) {
      alert("No contributors yet.");
      return;
    }
    let message = "Contributors:\n\n";
    for (const addr of contributors) {
      const amount = await contract.contributions(campaignId, addr);
      message += addr + " \u2192 " + ethers.formatEther(amount) + " ETH\n";
    }
    alert(message);
  } catch (err) {
    console.error(err);
    alert("Failed to load contributors.");
  }
}

let campaignsLoading = false;

async function loadCampaigns(forceRender) {
  if (campaignsLoading || !contract) return;
  campaignsLoading = true;
  let newCampaigns = [];
  let count = 0;
  try {
    count = Number(await contract.campaignCount());
  } catch (e) {
    console.error("Error fetching campaignCount", e);
    campaignsLoading = false;
    return;
  }
  try {
    for (let i = 0; i < count; i++) {
      const campaignData = await contract.campaigns(i);
      newCampaigns.push({
        id: i,
        creator: campaignData[0],
        title: campaignData[1],
        description: campaignData[2],
        goal: campaignData[3].toString(),
        deadline: campaignData[4].toString(),
        raised: campaignData[5].toString(),
        state: Number(campaignData[6]),
      });
    }
  } catch (err) {
    console.error("Error fetching campaigns", err);
    campaignsLoading = false;
    return;
  }
  if (
    forceRender ||
    campaignsCache.length !== newCampaigns.length ||
    JSON.stringify(newCampaigns) !== JSON.stringify(campaignsCache)
  ) {
    campaignsCache = newCampaigns;
    renderCampaigns();
  }
  campaignsLoading = false;
}

function renderCampaigns() {
  const container = el("campaigns");
  if (!container) return;
  container.textContent = "";

  if (!campaignsCache || campaignsCache.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "No campaigns found.";
    container.appendChild(empty);
    return;
  }

  const now = Math.floor(Date.now() / 1000);

  campaignsCache.forEach(function (c) {
    const campaignId = c.id;
    const creator = c.creator;
    const title = c.title;
    const goal = Number(ethers.formatEther(c.goal));
    const deadline = Number(c.deadline);
    const raised = Number(ethers.formatEther(c.raised));
    const stateIndex = Number(c.state);

    // only moderators see rejected and withdrawn campaigns
    if (role !== "moderator" && (stateIndex === 5 || stateIndex === 6)) return;

    const state = STATES[stateIndex] || "Unknown";
    const stateClass = state.toLowerCase().replace(/\s+/g, "-");
    const pct = goal ? Math.min((raised / goal) * 100, 100) : 0;

    const card = document.createElement("div");
    card.className = "campaign-card";

    const titleEl = document.createElement("h4");
    titleEl.textContent = title;
    card.appendChild(titleEl);

    if (c.description && String(c.description).trim()) {
      const descEl = document.createElement("p");
      descEl.className = "campaign-description";
      descEl.textContent = c.description;
      card.appendChild(descEl);
    }

    const badge = document.createElement("span");
    badge.className = "badge " + stateClass;
    badge.textContent = state;
    card.appendChild(badge);

    const raisedP = document.createElement("p");
    raisedP.textContent = raised + " / " + goal + " ETH";
    card.appendChild(raisedP);

    const progressWrap = document.createElement("div");
    progressWrap.className = "progress";
    const progressBar = document.createElement("div");
    progressBar.className = "progress-bar";
    progressBar.style.width = pct + "%";
    progressWrap.appendChild(progressBar);
    card.appendChild(progressWrap);

    if (stateIndex === 0) {
      const status = document.createElement("p");
      status.className = "countdown";
      status.textContent = "Pending approval";
      card.appendChild(status);
    } else if (stateIndex === 2 && deadline > 0) {
      const status = document.createElement("p");
      status.className = "countdown";
      status.dataset.deadline = String(deadline);
      status.textContent = "Time left: " + Math.max(deadline - now, 0) + " sec";
      card.appendChild(status);
    }

    const actions = document.createElement("div");
    actions.className = "campaign-actions";

    if (role === "moderator" && stateIndex === 0) {
      const approveBtn = document.createElement("button");
      approveBtn.type = "button";
      approveBtn.textContent = "Approve";
      approveBtn.dataset.action = "approve";
      approveBtn.dataset.campaignId = String(campaignId);
      actions.appendChild(approveBtn);
      const rejectBtn = document.createElement("button");
      rejectBtn.type = "button";
      rejectBtn.className = "secondary";
      rejectBtn.textContent = "Reject";
      rejectBtn.dataset.action = "reject";
      rejectBtn.dataset.campaignId = String(campaignId);
      actions.appendChild(rejectBtn);
    }

    if (
      role === "contributor" &&
      stateIndex === 2 &&
      deadline > 0 &&
      now < deadline
    ) {
      const amountInput = document.createElement("input");
      amountInput.type = "number";
      amountInput.id = "amount_" + campaignId;
      amountInput.placeholder = "ETH";
      amountInput.step = "0.01";
      amountInput.setAttribute("aria-label", "ETH amount");
      actions.appendChild(amountInput);
      const contributeBtn = document.createElement("button");
      contributeBtn.type = "button";
      contributeBtn.textContent = "Contribute";
      contributeBtn.dataset.action = "contribute";
      contributeBtn.dataset.campaignId = String(campaignId);
      actions.appendChild(contributeBtn);
    }

    if (
      role === "creator" &&
      stateIndex === 3 &&
      creator.toLowerCase() === userAddress.toLowerCase()
    ) {
      const withdrawBtn = document.createElement("button");
      withdrawBtn.type = "button";
      withdrawBtn.textContent = "Withdraw";
      withdrawBtn.dataset.action = "withdraw";
      withdrawBtn.dataset.campaignId = String(campaignId);
      actions.appendChild(withdrawBtn);
    }

    if (stateIndex === 2 && now >= deadline) {
      const finalizeBtn = document.createElement("button");
      finalizeBtn.type = "button";
      finalizeBtn.textContent = "Finalize";
      finalizeBtn.dataset.action = "finalize";
      finalizeBtn.dataset.campaignId = String(campaignId);
      actions.appendChild(finalizeBtn);
    }

    const viewContribBtn = document.createElement("button");
    viewContribBtn.type = "button";
    viewContribBtn.className = "secondary";
    viewContribBtn.textContent = "View Contributors";
    viewContribBtn.dataset.action = "contributors";
    viewContribBtn.dataset.campaignId = String(campaignId);
    actions.appendChild(viewContribBtn);

    card.appendChild(actions);
    container.appendChild(card);
  });
}

function handleCampaignAction(e) {
  const btn = e.target.closest("button[data-action][data-campaign-id]");
  if (!btn) return;
  const action = btn.getAttribute("data-action");
  const id = parseInt(btn.getAttribute("data-campaign-id"), 10);
  if (action === "approve") approveCampaignFromCard(id);
  else if (action === "reject") rejectCampaignFromCard(id);
  else if (action === "contribute") {
    const amountEl = document.getElementById("amount_" + id);
    const amount = amountEl ? amountEl.value : "";
    contribute(id, amount);
  } else if (action === "withdraw") withdrawFromCard(id);
  else if (action === "finalize") finalizeFromCard(id);
  else if (action === "contributors") showContributors(id);
}

function renderNFTChoices() {
  const container = el("nftChoices");
  if (!container) return;
  container.textContent = "";
  NFT_CHOICES.forEach(function (choice, idx) {
    const img = document.createElement("img");
    img.className =
      "nft-choice" + (selectedNFTChoice === idx ? " selected" : "");
    img.setAttribute("src", choice.img);
    img.setAttribute("alt", choice.name);
    img.setAttribute("title", choice.name);
    img.dataset.idx = String(idx);
    img.addEventListener("click", function () {
      selectedNFTChoice = idx;
      renderNFTChoices();
      const confirmBtn = el("confirmNFTBtn");
      if (confirmBtn) confirmBtn.disabled = false;
    });
    container.appendChild(img);
  });
}

window.showNFTChoices = function () {
  selectedNFTChoice = null;
  renderNFTChoices();
  el("nftChoicesModal").classList.remove("hidden");
  const confirmBtn = el("confirmNFTBtn");
  if (confirmBtn) confirmBtn.disabled = true;
};

window.hideNFTChoices = function () {
  el("nftChoicesModal").classList.add("hidden");
};

window.confirmNFTTrade = async function () {
  if (selectedNFTChoice === null) {
    alert("Please select an NFT badge first.");
    return;
  }
  try {
    const tb = await tokenContract.balanceOf(userAddress);
    const burnAmount = ethers.parseEther("10");
    if (tb < burnAmount) {
      alert("You need at least 10 CTKN to trade for an NFT badge.");
      return;
    }
    const uri = NFT_CHOICES[selectedNFTChoice].uri;
    const mintTx = await nftContract.mint(userAddress, uri);
    await mintTx.wait();
    const burnTx = await tokenContract
      .connect(signer)
      .burn(userAddress, burnAmount);
    await burnTx.wait();
    hideNFTChoices();
    loadNFTs();
    updateBalance();
  } catch (err) {
    alert("Trade failed: " + (err && err.message ? err.message : String(err)));
    console.error(err);
  }
};

function resolveNFTImageUrl(uri) {
  for (let i = 0; i < NFT_CHOICES.length; i++) {
    if (NFT_CHOICES[i].uri === uri) return NFT_CHOICES[i].img;
  }
  return null;
}

async function fetchMetadataImage(uri) {
  const gatewayUrl = uri.replace(
    /^ipfs:\/\//,
    "https://cloudflare-ipfs.com/ipfs/",
  );
  try {
    const res = await fetch(gatewayUrl);
    if (!res.ok) return null;
    const metadata = await res.json();
    const image = metadata.image || metadata.image_url;
    if (!image) return null;
    return image.replace(/^ipfs:\/\//, "https://cloudflare-ipfs.com/ipfs/");
  } catch (e) {
    return null;
  }
}

async function loadNFTs() {
  const listEl = el("nftList");
  if (!listEl || !nftContract) return;
  listEl.textContent = "";

  try {
    const count = await nftContract.balanceOf(userAddress);
    for (let i = 0; i < count; i++) {
      const tokenId = await nftContract.tokenOfOwnerByIndex(userAddress, i);
      const uri = await nftContract.tokenURI(tokenId);

      let imageUrl = resolveNFTImageUrl(uri);
      if (!imageUrl) imageUrl = await fetchMetadataImage(uri);
      if (!imageUrl) imageUrl = DEFAULT_BADGE_IMG;

      const img = document.createElement("img");
      img.setAttribute("src", imageUrl);
      img.setAttribute("alt", "Badge " + tokenId);
      img.dataset.tokenId = String(tokenId);
      img.addEventListener("click", function () {
        selectedNFT = { tokenId: tokenId.toString(), uri: imageUrl };
        const setBtn = el("setNFTBtn");
        if (setBtn) {
          setBtn.classList.remove("hidden");
          setBtn.style.display = "inline-block";
        }
      });
      listEl.appendChild(img);
    }
  } catch (err) {
    console.warn("loadNFTs failed", err);
  }
}

window.setNFTAsAvatar = function () {
  if (selectedNFT && selectedNFT.uri) setAvatarFromUrl(selectedNFT.uri);
};

function updateCountdowns() {
  const now = Math.floor(Date.now() / 1000);
  const nodes = document.querySelectorAll(".countdown[data-deadline]");
  let justEnded = false;
  nodes.forEach(function (node) {
    const deadline = parseInt(node.getAttribute("data-deadline"), 10);
    const left = Math.max(deadline - now, 0);
    if (left === 0 && node.textContent.indexOf("Ended") === -1)
      justEnded = true;
    node.textContent = left > 0 ? "Time left: " + left + " sec" : "Ended";
  });
  if (justEnded && typeof loadCampaigns === "function") loadCampaigns(true);
}

let countdownIntervalId = null;

function startCountdownTicker() {
  if (countdownIntervalId !== null) return;
  updateCountdowns();
  countdownIntervalId = setInterval(updateCountdowns, 1000);
}

function init() {
  bindLoginButtons();
  const campaignsEl = el("campaigns");
  if (campaignsEl) campaignsEl.addEventListener("click", handleCampaignAction);
  if (el("btnSubmitCampaign"))
    el("btnSubmitCampaign").addEventListener("click", submitCampaign);
  if (el("btnContribute"))
    el("btnContribute").addEventListener("click", contributeFromUI);
  if (el("btnRefund")) el("btnRefund").addEventListener("click", refund);
  if (el("btnTradeNFT"))
    el("btnTradeNFT").addEventListener("click", showNFTChoices);
  if (el("btnHideNFTModal"))
    el("btnHideNFTModal").addEventListener("click", hideNFTChoices);
  if (el("confirmNFTBtn"))
    el("confirmNFTBtn").addEventListener("click", confirmNFTTrade);
  if (el("setNFTBtn"))
    el("setNFTBtn").addEventListener("click", setNFTAsAvatar);
  startCountdownTicker();
}

init();
