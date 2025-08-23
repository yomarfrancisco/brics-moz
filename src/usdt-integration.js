// src/usdt-integration.js
import { ethers } from 'ethers';
import { JsonRpcProvider } from 'ethers';

// USDT Contract Addresses for different chains
const CONTRACT_ADDRESSES = {
  1: '0xdac17f958d2ee523a2206206994597c13d831ec7',   // Ethereum Mainnet
  8453: '0x3FaED7E00BFB7fA8646F0473D1Cc7e4EC4057DE0',  // Base Chain (aligned with backend) 
  10: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58',   // Optimism
  42161: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', // Arbitrum
  11155111: '0x638F9132EA2737Fa15b200627516FCe77bE6CE53', // Sepolia MockUSDT
};

// Deposit contract deployed address
export const DEPOSIT_CONTRACT_ADDRESSES = {
  // Ethereum Mainnet
  1: '0x4B28eB3b355065e4B1F55715e6600e0e377aAf3D',
  // Base Chain 
  8453: '0x4B28eB3b355065e4B1F55715e6600e0e377aAf3D', 
  // Optimism
  10: '0x4B28eB3b355065e4B1F55715e6600e0e377aAf3D',
  // Arbitrum
  42161: '0x4B28eB3b355065e4B1F55715e6600e0e377aAf3D',
  // Ethereum Sepolia testnet
  11155111: '0x4B28eB3b355065e4B1F55715e6600e0e377aAf3D',
};


const decimalsCache = {
  1: 6,    // Ethereum USDT 
  8453: 6,  // Base USDT 
  11155111: 6 // Sepolia USDT
};

// Add RPC endpoints for different chains
const RPC_ENDPOINTS = {
  1: 'https://eth-mainnet.g.alchemy.com/v2/FlBOuTS3mAuXwKlI5pIitlyVpSYwgtC8',
  8453: 'https://mainnet.base.org',
  10: 'https://mainnet.optimism.io',
  42161: 'https://arb1.arbitrum.io/rpc',
  11155111: 'https://eth-sepolia.g.alchemy.com/v2/FlBOuTS3mAuXwKlI5pIitlyVpSYwgtC8',
};

// Log RPC configuration for debugging
console.log("[RPC Config] Available endpoints:", RPC_ENDPOINTS);


// Add a new object for treasury addresses on different chains
export const TREASURY_ADDRESSES = {
  1: '0xe4f1c79c47fa2de285cd8fb6f6476495bd08538f',    // Ethereum Mainnet
  8453: '0x3FaED7E00BFB7fA8646F0473D1Cc7e4EC4057DE0', // Base
  10: '0x3FaED7E00BFB7fA8646F0473D1Cc7e4EC4057DE0',   // Optimism
  42161: '0x3FaED7E00BFB7fA8646F0473D1Cc7e4EC4057DE0', // Arbitrum
  11155111: '0xe4f1C79c47FA2dE285Cd8Fb6F6476495BD08538f', // Sepolia treasury
};

// Add local storage keys for deposit tracking
const USER_DEPOSITS_KEY = 'usdt_user_deposits';
const DEPOSIT_HISTORY_KEY = 'usdt_deposit_history';

// get provider for a specific chain
export const getChainProvider = async (chainId) => {
  const response = await fetch(`/api/proxy-rpc?chainId=${chainId}`);
  const { rpcUrl } = await response.json();
  if (!rpcUrl) throw new Error(`No RPC endpoint for chain ${chainId}`);
  console.log(`[RPC Provider] Using endpoint for chain ${chainId}:`, rpcUrl);
  return new JsonRpcProvider(rpcUrl);
};


export const getTreasuryAddressForChain = (chainId) => {
  return TREASURY_ADDRESSES[chainId] || TREASURY_ADDRESSES[1]; // Default to Ethereum
};


export const API_BASE_URL = window.location.hostname === 'localhost'
  ? 'http://localhost:4000'
  : 'https://buybrics.vercel.app';

console.log('API_BASE_URL:', API_BASE_URL);

// USDT Contract ABI (Simplified version with only the functions we need)
export const USDT_ABI = [
  {
    "constant": true,
    "inputs": [{"name": "_owner", "type": "address"}],
    "name": "balanceOf",
    "outputs": [{"name": "balance", "type": "uint256"}],
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [],
    "name": "decimals",
    "outputs": [{"name": "", "type": "uint8"}],
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [],
    "name": "name",
    "outputs": [{"name": "", "type": "string"}],
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [],
    "name": "symbol",
    "outputs": [{"name": "", "type": "string"}],
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [
      {"name": "_owner", "type": "address"},
      {"name": "_spender", "type": "address"}
    ],
    "name": "allowance",
    "outputs": [{"name": "remaining", "type": "uint256"}],
    "type": "function"
  },
  {
    "constant": false,
    "inputs": [
      {"name": "_spender", "type": "address"},
      {"name": "_value", "type": "uint256"}
    ],
    "name": "approve",
    "outputs": [{"name": "success", "type": "bool"}],
    "type": "function"
  },
  {
    "constant": false,
    "inputs": [
      {"name": "_to", "type": "address"},
      {"name": "_value", "type": "uint256"}
    ],
    "name": "transfer",
    "outputs": [{"name": "success", "type": "bool"}],
    "type": "function"
  },
  {
    "constant": false,
    "inputs": [
      {"name": "_from", "type": "address"},
      {"name": "_to", "type": "address"},
      {"name": "_value", "type": "uint256"}
    ],
    "name": "transferFrom",
    "outputs": [{"name": "success", "type": "bool"}],
    "type": "function"
  },
  {
    "anonymous": false,
    "inputs": [
      {"indexed": true, "name": "from", "type": "address"},
      {"indexed": true, "name": "to", "type": "address"},
      {"indexed": false, "name": "value", "type": "uint256"}
    ],
    "name": "Transfer",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {"indexed": true, "name": "owner", "type": "address"},
      {"indexed": true, "name": "spender", "type": "address"},
      {"indexed": false, "name": "value", "type": "uint256"}
    ],
    "name": "Approval",
    "type": "event"
  }
];

export const DEPOSIT_CONTRACT_ABI = [
  {
    "inputs": [
      { "internalType": "address", "name": "_treasury", "type": "address" },
      { "internalType": "address", "name": "_usdtToken", "type": "address" }
    ],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "address", "name": "user", "type": "address" },
      { "indexed": false, "internalType": "uint256", "name": "amount", "type": "uint256" }
    ],
    "name": "Deposit",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "address", "name": "user", "type": "address" },
      { "indexed": false, "internalType": "uint256", "name": "amount", "type": "uint256" },
      { "indexed": true, "internalType": "address", "name": "treasury", "type": "address" }
    ],
    "name": "Withdrawal",
    "type": "event"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "amount", "type": "uint256" }
    ],
    "name": "deposit",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "owner",
    "outputs": [
      { "internalType": "address", "name": "", "type": "address" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "treasury",
    "outputs": [
      { "internalType": "address", "name": "", "type": "address" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "usdtToken",
    "outputs": [
      { "internalType": "contract IERC20", "name": "", "type": "address" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "amount", "type": "uint256" }
    ],
    "name": "withdraw",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
];

// Get the correct USDT address based on chain
const chainIdCache = {};

export const getUSDTAddress = async (provider) => {
  try {
    // Use a cache key based on provider type or network
    const cacheKey = provider?.constructor?.name || 'default';
    if (chainIdCache[cacheKey]) {
      const chainId = chainIdCache[cacheKey];
      const usdtAddress = CONTRACT_ADDRESSES[chainId] || CONTRACT_ADDRESSES[1];
      return usdtAddress;
    }

    const network = await provider.getNetwork();
    const chainId = Number(network.chainId);
    chainIdCache[cacheKey] = chainId;

    const usdtAddress = CONTRACT_ADDRESSES[chainId] || CONTRACT_ADDRESSES[1];
    return usdtAddress;
  } catch (error) {
    console.error("Error getting chain ID:", error);
    return CONTRACT_ADDRESSES[1]; // Default to Ethereum
  }
};

export const getTokenDecimals = async (provider) => {
  try {
    const network = await provider.getNetwork();
    const chainId = Number(network.chainId);
    
    // If we have cached decimals for this chain, use them
    if (decimalsCache[chainId]) {
      return decimalsCache[chainId];
    }
    
    // Try to get decimals from contract
    const contract = await getUSDTContract(provider);
    try {
      const decimals = await contract.decimals();
      decimalsCache[chainId] = Number(decimals);
      return Number(decimals);
    } catch (error) {
      console.error("Error getting decimals:", error);
      // Default to 6 for USDT as fallback
      return 6;
    }
  } catch (error) {
    console.error("Error in getTokenDecimals:", error);
    return 6; // Default fallback
  }
};

// Helper function to format USDT amounts (USDT has 6 decimals)
export const formatUSDTAmount = async (amount, provider) => {
  const decimals = await getTokenDecimals(provider);
  return parseFloat(ethers.formatUnits(amount, decimals));
};

// Helper function to parse USDT amount from user input to contract format
export const parseUSDTAmount = async (amount, provider) => {
  const decimals = await getTokenDecimals(provider);
  return ethers.parseUnits(amount.toString(), decimals); // Returns a BigInt in Ethers v6
};

// Get USDT contract instance
export const getUSDTContract = async (ethProvider, chainId) => {
  try {
    let resolvedChainId = chainId;
    if (!resolvedChainId) {
      const network = await ethProvider.getNetwork();
      resolvedChainId = Number(network.chainId);
    }

    const usdtAddress = CONTRACT_ADDRESSES[resolvedChainId] || CONTRACT_ADDRESSES[1];
    console.log(`[Contract] USDT address for chain ${resolvedChainId}:`, usdtAddress);
    if (!usdtAddress) {
      throw new Error(`No USDT contract address for chain ${resolvedChainId}`);
    }

    let providerOrSigner = ethProvider;
    if (ethProvider.getSigner) {
      try {
        providerOrSigner = await ethProvider.getSigner();
        const signerAddress = await providerOrSigner.getAddress();
        console.log(`Using signer for chain ${resolvedChainId}, address: ${signerAddress}`);
      } catch (error) {
        console.warn(`Failed to get signer for chain ${resolvedChainId}: ${error.message}`);
        // For read-only operations, allow falling back to the provider
        providerOrSigner = ethProvider;
        console.log(`Falling back to provider for chain ${resolvedChainId}`);
      }
    }

    // If the providerOrSigner cannot sign, log a warning but proceed (for read-only operations)
    if (typeof providerOrSigner.getAddress !== 'function') {
      console.warn(`Provider for chain ${resolvedChainId} does not support signing`);
    }

    const contract = new ethers.Contract(usdtAddress, USDT_ABI, providerOrSigner);
    // Verify the contract instance has the expected methods
    if (typeof contract.transfer !== 'function' || typeof contract.approve !== 'function') {
      throw new Error('Contract instance is invalid: missing required methods (transfer/approve)');
    }

    console.log(`Created USDT contract instance at ${usdtAddress} for chain ${resolvedChainId}`);
    return contract;
  } catch (error) {
    console.error(`Error creating USDT contract for chain ${chainId || 'unknown'}:`, error);
    throw new Error(`Failed to create USDT contract instance: ${error.message}`);
  }
};

// Get user's USDT balance
export const getUserUSDTBalance = async (provider, address) => {
  try {
    console.log("Getting USDT balance for", address);
    const contract = await getUSDTContract(provider);
    
    try {
      const balance = await contract.balanceOf(address);
      return await formatUSDTAmount(balance, provider);
    } catch (error) {
      console.error("Error in balanceOf call:", error);
      
      // If we get a decode error, the contract might be different than expected
      // For now, return 0 as a safe default
      return 0;
    }
  } catch (error) {
    console.error("Error getting USDT balance:", error);
    return 0;
  }
};

export const getMultiChainUSDTBalance = async (userAddress) => {
  if (!userAddress) return {};
  
  const balances = {};
  const chainIds = Object.keys(CONTRACT_ADDRESSES).map(id => Number(id));
  
  // Fetch balances for each chain in parallel
  await Promise.all(chainIds.map(async (chainId) => {
    try {
      const provider = getChainProvider(chainId);
      const usdtAddress = CONTRACT_ADDRESSES[chainId];
      
      // Skip if no contract address for this chain
      if (!usdtAddress) return;
      
      const contract = new ethers.Contract(usdtAddress, USDT_ABI, provider);
      try {
        const balance = await contract.balanceOf(userAddress);
        const decimals = decimalsCache[chainId] || 6;
        balances[chainId] = parseFloat(ethers.formatUnits(balance, decimals));
      } catch (error) {
        console.error(`Error fetching balance on chain ${chainId}:`, error);
        balances[chainId] = 0;
      }
    } catch (error) {
      console.error(`Error connecting to chain ${chainId}:`, error);
      balances[chainId] = 0;
    }
  }));
  
  return balances;
};

export const getTotalUSDTBalance = async (userAddress) => {
  const balances = await getMultiChainUSDTBalance(userAddress);
  return Object.values(balances).reduce((total, balance) => total + balance, 0);
};

export const getUSDTContractForChain = (chainId, signerOrProvider) => {
  const usdtAddress = CONTRACT_ADDRESSES[chainId];
  if (!usdtAddress) throw new Error(`No USDT contract for chain ${chainId}`);
  return new ethers.Contract(usdtAddress, USDT_ABI, signerOrProvider);
};

// Get treasury USDT balance
export const getTreasuryUSDTBalance = async (provider) => {
  try {
    const network = await provider.getNetwork();
    const chainId = Number(network.chainId);
    const treasuryAddress = getTreasuryAddressForChain(chainId);
    console.log(`Fetching treasury balance for ${treasuryAddress} on chain ${chainId}`);
    
    const usdtAddress = await getUSDTAddress(provider);
    console.log(`Using contract: ${usdtAddress}`);
    
    if (!usdtAddress) {
      throw new Error('No USDT contract address available');
    }
    
    const contract = new ethers.Contract(usdtAddress, USDT_ABI, provider);
    
    try {
      const balance = await contract.balanceOf(treasuryAddress);
      const formattedBalance = await formatUSDTAmount(balance, provider);
      console.log(`Raw balance: ${balance.toString()}, Formatted: ${formattedBalance} USDT`);
      return formattedBalance;
    } catch (error) {
      console.error("Error in treasury balanceOf call:", error);
      return 0;
    }
  } catch (error) {
    console.error("Error getting treasury USDT balance:", error);
    return 0;
  }
};

// Check if user has approved USDT spending
export const checkUSDTAllowance = async (provider, userAddress, chainId, spenderAddress = DEPOSIT_CONTRACT_ADDRESSES[chainId]) => {
  try {
    const contract = await getUSDTContract(provider, chainId);
    const depositContractAddress = spenderAddress || DEPOSIT_CONTRACT_ADDRESSES[chainId];
    if (!depositContractAddress) {
      throw new Error(`No DepositContract address for chain ${chainId}`);
    }

    const allowance = await contract.allowance(userAddress, depositContractAddress);
    return await formatUSDTAmount(allowance, provider);
  } catch (error) {
    console.error("Error checking USDT allowance:", error);
    return 0;
  }
};

// Approve USDT spending
export const approveUSDT = async (signer, amount, spender, chainId) => {
  try {
    const contract = await getUSDTContract(signer, chainId);
    const currentAllowance = await contract.allowance(await signer.getAddress(), spender);
    if (ethers.parseUnits(currentAllowance.toString(), 6) >= ethers.parseUnits(amount.toString(), 6)) {
      return { hash: null, success: true }; // No need to approve
    }

    // Reset allowance to 0 if non-zero
    if (currentAllowance > 0) {
      const resetTx = await contract.approve(spender, 0);
      await resetTx.wait();
      console.log('Allowance reset confirmed:', resetTx.hash);
    }

    const approveAmount = ethers.parseUnits(amount.toString(), 6).toString();
    const gasEstimate = await contract.estimateGas.approve(spender, approveAmount).catch(() => ethers.parseUnits('50000', 'wei')); // Fallback to 50,000 gas
    const tx = await contract.approve(spender, approveAmount, { gasLimit: gasEstimate });
    const receipt = await tx.wait();
    console.log('Approval transaction confirmed:', tx.hash);
    return { hash: tx.hash, success: true };
  } catch (error) {
    console.error('Error approving USDT:', error.message);
    throw error;
  }
};





// Save user's deposited amount
export const saveUserDepositedAmount = async (userAddress, amount, txHash, chainId) => {
  try {
    const normalizedAddress = userAddress.toLowerCase();
    const response = await fetch(`${API_BASE_URL}/api/deposits`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userAddress: normalizedAddress, amount, txHash, chainId }),
    });
    const data = await response.json();
    if (!data.success) {
      const error = new Error(`Failed to save deposit: ${data.error || 'Unknown error'} ${data.details ? JSON.stringify(data.details) : ''}`);
      error.response = { status: response.status, data };
      throw error;
    }
    return data;
  } catch (error) {
    console.error("Error saving deposit:", error);
    throw error;
  }
};

// Add a deposit to the user's history
export const addDepositToHistory = (userAddress, amount, txHash, chainId = 1) => {
  try {
    if (!userAddress) return;
    
    // Format the user address to a consistent format for storage key
    const formattedAddress = userAddress.toLowerCase();
    
    // Get existing history data
    const historyData = localStorage.getItem(DEPOSIT_HISTORY_KEY);
    const history = historyData ? JSON.parse(historyData) : {};
    
    // Initialize user's history if it doesn't exist
    if (!history[formattedAddress]) {
      history[formattedAddress] = [];
    }
    
    // Add the new deposit to the user's history with chain info
    history[formattedAddress].push({
      amount,
      txHash,
      chainId,
      chainName: getChainName(chainId), // Add helper function for this
      timestamp: Date.now()
    });
    
    // Save back to local storage
    localStorage.setItem(DEPOSIT_HISTORY_KEY, JSON.stringify(history));
  } catch (error) {
    console.error("Error adding deposit to history:", error);
  }
};


// Transfer USDT to treasury (deposit) and track it
export const depositUSDT = async (signer, amount, chainId) => {
  try {
    const parsedAmount = await parseUSDTAmount(amount, provider);
    if (parsedAmount <= 0) {
      throw new Error('Invalid deposit amount');
    }

    const depositContractAddress = DEPOSIT_CONTRACT_ADDRESSES[chainId];
    if (!depositContractAddress) {
      throw new Error(`No DepositContract address for chain ${chainId}`);
    }

    const contract = new ethers.Contract(depositContractAddress, DEPOSIT_CONTRACT_ABI, signer);
    console.log(`DepositContract instance created at ${depositContractAddress} for chain ${chainId}`);

    const gasSettings = {};
    try {
      const feeData = await signer.provider.getFeeData();
      // Check if maxPriorityFeePerGas is supported
      if (feeData.maxPriorityFeePerGas && feeData.maxFeePerGas) {
        gasSettings.maxFeePerGas = feeData.maxFeePerGas || ethers.parseUnits('50', 'gwei');
        gasSettings.maxPriorityFeePerGas = feeData.maxPriorityFeePerGas || ethers.parseUnits('2', 'gwei');
      } else {
        throw new Error('EIP-1559 not supported, falling back to legacy gas');
      }
    } catch (error) {
      console.warn('Using legacy gas settings:', error.message);
      gasSettings.gasPrice = ethers.parseUnits('50', 'gwei'); // Legacy gas price fallback
    }

    console.log(`Depositing ${amount} USDT to DepositContract ${depositContractAddress} on chain ${chainId}`);
    const tx = await contract.deposit(parsedAmount, gasSettings);
    const receipt = await tx.wait();

    console.log(`Deposit transaction confirmed: ${tx.hash}`);
    return tx;
  } catch (error) {
    console.error(`Error depositing USDT on chain ${chainId}:`, error);
    throw error;
  }
};

export const transferUSDT = async (signer, amount, to, chainId, maxAttempts = 3) => {
  try {
    if (!signer || typeof signer.getAddress !== 'function') {
      throw new Error('Invalid signer provided');
    }

    const signerAddress = await signer.getAddress();
    console.log(`Initiating transfer with signer: ${signerAddress}, chain: ${chainId}`);
    console.log("[Token] Checking allowance and balance for address:", signerAddress);

    const contract = await getUSDTContract(signer, chainId);
    if (!contract || typeof contract.transfer !== 'function') {
      throw new Error('Invalid USDT contract instance');
    }

    const parsedAmount = ethers.parseUnits(amount.toString(), 6).toString();
    let gasSettings = {};
    try {
      const feeData = await signer.provider.getFeeData();
      if (feeData.maxPriorityFeePerGas && feeData.maxFeePerGas) {
        gasSettings.maxFeePerGas = feeData.maxFeePerGas || ethers.parseUnits('50', 'gwei');
        gasSettings.maxPriorityFeePerGas = feeData.maxPriorityFeePerGas || ethers.parseUnits('2', 'gwei');
      } else {
        throw new Error('EIP-1559 not supported, falling back to legacy gas');
      }
    } catch (error) {
      console.warn('Using legacy gas settings:', error.message);
      gasSettings.gasPrice = ethers.parseUnits('0.5', 'gwei'); // Start with a low gas price
    }

    let gasLimit;
    try {
      gasLimit = await contract.estimateGas.transfer(to, parsedAmount);
      // Add a small buffer to the estimated gas limit (10%)
      gasLimit = gasLimit * 110n / 100n;
    } catch (error) {
      console.warn(`Gas estimation failed: ${error.message}, using default gas limit`);
      gasLimit = ethers.parseUnits('65000', 'wei'); // Typical USDT transfer gas usage
    }

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        if (gasSettings.gasPrice) {
          gasSettings.gasPrice = ethers.parseUnits((0.5 + 0.2 * attempt).toString(), 'gwei');
        } else {
          gasSettings.maxPriorityFeePerGas = ethers.parseUnits((2 + 0.5 * attempt).toString(), 'gwei');
          gasSettings.maxFeePerGas = ethers.parseUnits((50 + 10 * attempt).toString(), 'gwei');
        }

        const tx = await contract.transfer(to, parsedAmount, { gasLimit, ...gasSettings });
        console.log(`Transfer transaction sent (attempt ${attempt}):`, tx.hash);
        const receipt = await tx.wait();
        console.log('Transfer transaction confirmed:', tx.hash);
        return tx;
      } catch (error) {
        console.log(`Transfer attempt ${attempt} failed, increasing gas price. Error:`, error.message);
        if (error.code === 'ACTION_REJECTED' && attempt < maxAttempts) {
          continue;
        }
        throw error;
      }
    }
    throw new Error(`Failed to transfer USDT after ${maxAttempts} attempts`);
  } catch (error) {
    console.error('Error transferring USDT:', error.message);
    throw error;
  }
};

export const getChainName = (chainId) => {
  const chainNames = {
    1: 'Ethereum',
    8453: 'Base',
    10: 'Optimism',
    42161: 'Arbitrum',
    11155111: 'Sepolia',
  };
  return chainNames[chainId] || `Chain ${chainId}`;
};


// Now handled by a backend service
export const requestWithdrawal = async (userAddress, amount) => {
  try {
    const normalizedAddress = userAddress.toLowerCase();
    const response = await fetch(`${API_BASE_URL}/api/withdrawals`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userAddress: normalizedAddress, amount }),
    });
    const data = await response.json();
    if (!data.success) {
      throw new Error("Withdrawal request failed.");
    }
    return {
      success: true,
      txHash: data.txHash || "0x" + Math.random().toString(16).substr(2, 64),
      amount,
      recipient: normalizedAddress,
    };
  } catch (error) {
    console.error("Error requesting withdrawal:", error);
    throw error;
  }
};

// New function for on-chain redemption using /api/redeem endpoint
export const redeemUSDT = async (userAddress, amount, chainId, testMode = false) => {
  try {
    const normalizedAddress = userAddress.toLowerCase();
    console.log(`Redeeming ${amount} USDT for ${normalizedAddress} on chain ${chainId} (testMode: ${testMode})`);
    
    const response = await fetch(`${API_BASE_URL}/api/redeem`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userAddress: normalizedAddress,
        chainId: chainId,
        redeemAmount: amount,
        tokenType: "USDT",
        testMode: testMode
      }),
    });
    
    // Guard against non-JSON responses (HTML errors, 404s, etc.)
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      console.error('Non-JSON response received:', {
        status: response.status,
        statusText: response.statusText,
        contentType: contentType
      });
      throw new Error(`API returned non-JSON response (${response.status} ${response.statusText}). Please try again.`);
    }
    
    const data = await response.json();
    console.log('Redeem response:', data);
    
    if (!data.success) {
      throw new Error(data.error || "Redemption failed");
    }
    
    return {
      success: true,
      txHash: data.txHash,
      blockNumber: data.blockNumber,
      gasUsed: data.gasUsed,
      newBalance: data.newBalance,
      redeemedAmount: data.redeemedAmount,
      onChainSuccess: data.onChainSuccess,
      dryRun: data.dryRun,
      reserveBefore: data.reserveBefore,
      reserveAfter: data.reserveAfter,
      transferError: data.transferError
    };
  } catch (error) {
    console.error("Error redeeming USDT:", error);
    throw error;
  }
};

// simplified contract verification removed fallback mechanisms and chain support
export const verifyUSDTContract = async (provider) => {
  try {
    if (!provider) {
      throw new Error("No provider available");
    }

    const contract = await getUSDTContract(provider);
    const decimals = await contract.decimals();
    return typeof decimals === 'number';
  } catch (error) {
    console.error("Contract verification failed:", error);
    return false;
  }
};

// Enhanced getUserDepositedAmount with detailed logging for balance debugging
export const getUserDepositedAmount = async (userAddress) => {
  try {
    const normalizedAddress = userAddress.toLowerCase();
    console.log(`[Balance] Fetching deposits for: ${normalizedAddress}`);
    
    const response = await fetch(`${API_BASE_URL}/api/deposits/${normalizedAddress}`);
    const data = await response.json();
    
    if (!data.success) {
      console.error('[Balance] Failed to fetch deposits:', data.error);
      return 0;
    }
    
    const deposits = data.deposits || [];
    const withdrawals = data.withdrawals || [];
    const totalDeposited = data.totalUsdtDeposited || 0;
    
    console.log('[Balance] Raw data from API:', {
      depositsCount: deposits.length,
      withdrawalsCount: withdrawals.length,
      totalDeposited: totalDeposited,
      deposits: deposits.map(d => ({
        amount: d.amount,
        currentBalance: d.currentBalance,
        chainId: d.chainId,
        txHash: d.txHash?.slice(0, 10) + '...'
      })),
      withdrawals: withdrawals.map(w => ({
        amount: w.amount,
        chainId: w.chainId,
        txHash: w.txHash?.slice(0, 10) + '...'
      }))
    });
    
    // FIXED: Calculate total based on actual deposit amounts, not inflated currentBalance
    const totalDepositedAmount = deposits.reduce((sum, deposit) => {
      const amount = parseFloat(deposit.amount) || 0;
      console.log(`[Balance] Deposit ${deposit._id}: amount=${amount}, currentBalance=${deposit.currentBalance} (ignored)`);
      return sum + amount;
    }, 0);
    
    // Calculate total withdrawn
    const totalWithdrawn = withdrawals.reduce((sum, withdrawal) => {
      const amount = parseFloat(withdrawal.amount) || 0;
      console.log(`[Balance] Withdrawal ${withdrawal._id}: amount=${amount}`);
      return sum + amount;
    }, 0);
    
    // Calculate net balance: total deposited - total withdrawn
    const netBalance = totalDepositedAmount - totalWithdrawn;
    
    console.log('[Balance] Calculated totals:', {
      totalDepositedAmount: totalDepositedAmount,
      totalWithdrawn: totalWithdrawn,
      netBalance: netBalance,
      apiTotalDeposited: totalDeposited // This should match our calculation
    });
    
    // Return the net balance (deposits - withdrawals)
    return Math.max(0, netBalance);
    
  } catch (error) {
    console.error('[Balance] Error fetching user deposits:', error);
    return 0;
  }
};

// Save user deposited amount (for local storage if needed)
// Note: Main implementation is at line 510 with API integration

