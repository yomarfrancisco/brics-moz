import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import image from './assets/image.png';
import dataRoomIcon from './assets/data-room-icon.png';
import closeIcon from './assets/close-icon.svg';
import docsChevronIcon from './assets/docs-chevron-icon.svg';
import genericAvatar from './assets/generic-avatar.svg';
import missionChevronIcon from './assets/mission-icon.svg';
import arrowBackward from './assets/arrow-backward.svg';
import copyIcon from './assets/copy-icon.svg';
import currencyIconUsdt from './assets/currency-icon-usdt.svg';


// Import USDT integration utilities
import {
  TREASURY_ADDRESSES,
  getUserUSDTBalance,
  getTreasuryUSDTBalance,
  checkUSDTAllowance,
  approveUSDT,
  depositUSDT,
  requestWithdrawal,
  getUserDepositedAmount,
  saveUserDepositedAmount,
  getUSDTAddress,        
  getUSDTContract,
  USDT_ABI,
  API_BASE_URL,
  getMultiChainUSDTBalance,
  getTotalUSDTBalance,
  getChainProvider,
  getTreasuryAddressForChain,
  getChainName as getChainNameFromIntegration,
  DEPOSIT_CONTRACT_ADDRESSES,
  DEPOSIT_CONTRACT_ABI,
  transferUSDT,
} from './usdt-integration';

import { 
  logContractError, 
  monitorProviderStatus, 
  testProvider 
} from './utils/contract-debug';



const BASE_CHAIN_ID = 1; // Mainnet
const BASE_HEX_CHAIN_ID = '0x1'; // Mainnet hex


//const BASE_CHAIN_ID = 11155111; // Change default to Sepolia for testing
//const BASE_HEX_CHAIN_ID = '0xaa36a7'; // Sepolia hex

const getChainName = (chainId) => {
  const chainNames = {
    1: 'Ethereum',
    8453: 'Base',
    10: 'Optimism',
    42161: 'Arbitrum',
    11155111: 'Sepolia'
  };
  return chainNames[chainId] || `Chain ${chainId}`;
};

const switchToChain = async (chainId) => {
  if (!window.ethereum) return false;

  try {
    const hexChainId = `0x${chainId.toString(16)}`;

    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: hexChainId }],
    });
    return true;
  } catch (switchError) {
    if (switchError.code === 4902) {
      try {
        const chainParams = {
          1: {
            chainId: '0x1',
            chainName: 'Ethereum Mainnet',
            nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
            rpcUrls: ['https://eth.llamarpc.com'],
            blockExplorerUrls: ['https://etherscan.io/'],
          },
          8453: {
            chainId: '0x2105',
            chainName: 'Base',
            nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
            rpcUrls: ['https://mainnet.base.org'],
            blockExplorerUrls: ['https://basescan.org/'],
          },
          10: {
            chainId: '0xa',
            chainName: 'Optimism',
            nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
            rpcUrls: ['https://mainnet.optimism.io'],
            blockExplorerUrls: ['https://optimistic.etherscan.io/'],
          },
          42161: {
            chainId: '0xa4b1',
            chainName: 'Arbitrum One',
            nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
            rpcUrls: ['https://arb1.arbitrum.io/rpc'],
            blockExplorerUrls: ['https://arbiscan.io/'],
          },
          11155111: {
            chainId: '0xaa36a7',
            chainName: 'Sepolia',
            nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
            rpcUrls: ['https://rpc.sepolia.org'],
            blockExplorerUrls: ['https://sepolia.etherscan.io/'],
          },
        };

        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [chainParams[chainId]],
        });
        return true;
      } catch (addError) {
        console.error(`Error adding ${getChainName(chainId)} network:`, addError);
        return false;
      }
    }
    console.error(`Error switching to ${getChainName(chainId)} network:`, switchError);
    return false;
  }
};



const getMultiChainUSDTBalanceLocal = async (userAddress) => {
  if (!userAddress) return {};

  const balances = {};
  const chainIds = [1, 8453, 10, 42161];
  const rpcEndpoints = {
    1: process.env.ALCHEMY_MAINNET_RPC || 'https://mainnet.infura.io/v3/423dc5401ea74f279b1b90f58f2bee71' || 'https://rpc.ankr.com/eth',
    8453: 'https://mainnet.base.org',
    10: 'https://mainnet.optimism.io',
    42161: 'https://arb1.arbitrum.io/rpc',
  };
  const networkConfigs = {
    1: { chainId: 1, name: 'Ethereum' },
    8453: { chainId: 8453, name: 'Base' },
    10: { chainId: 10, name: 'Optimism' },
    42161: { chainId: 42161, name: 'Arbitrum' },
  };

  await Promise.all(
    chainIds.map(async (chainId) => {
      const retryDelay = (attempt) => new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const rpcUrl = rpcEndpoints[chainId];
          if (!rpcUrl) {
            console.warn(`No RPC URL defined for chain ${chainId}`);
            balances[chainId] = 0;
            break;
          }

          const provider = new ethers.JsonRpcProvider(rpcUrl, networkConfigs[chainId]);
          const network = await provider.getNetwork();
          console.log(`Connected to chain ${chainId} (${getChainName(chainId)}), RPC: ${rpcUrl}, Detected network: ${network.name}`);

          const contractAddresses = {
            1: '0xdac17f958d2ee523a2206206994597c13d831ec7',
            8453: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2',
            10: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58',
            42161: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
          };

          const usdtAddress = contractAddresses[chainId];
          if (!usdtAddress) {
            console.warn(`No USDT address for chain ${chainId}`);
            balances[chainId] = 0;
            break;
          }

          const contract = new ethers.Contract(usdtAddress, USDT_ABI, provider);
          const decimals = await contract.decimals();
          const balance = await contract.balanceOf(userAddress);
          balances[chainId] = parseFloat(ethers.formatUnits(balance, decimals));
          console.log(`Balance on chain ${chainId} (${getChainName(chainId)}): ${balances[chainId]} USDT`);
          break; // Success, exit retry loop
        } catch (error) {
          if (attempt === 2) {
            console.error(`Failed after retries for chain ${chainId}:`, error.message);
            balances[chainId] = 0;
          } else {
            await retryDelay(attempt + 1);
          }
        }
      }
    })
  );

  return balances;
};


const findHighestBalanceChain = (balances) => {
  if (!balances || Object.keys(balances).length === 0) return 1; // Default to Ethereum if no balances
  
  let maxChain = 1; // Default to Ethereum
  let maxBalance = 0;
  
  Object.entries(balances).forEach(([chainId, balance]) => {
    if (balance > maxBalance) {
      maxBalance = balance;
      maxChain = Number(chainId);
    }
  });
  
  return maxChain;
};

// Helper function to render SVG components
const SvgIcon = ({ src, alt, className }) => {
  // Check if the src exists and is a string (regular import)
  if (src && typeof src === 'string') {
    return <img src={src} alt={alt || 'Icon'} className={className} />;
  }
  
  // Check if the src exists and is a React component (SVG imported as React component)
  if (src && typeof src === 'function') {
    const IconComponent = src;
    return <IconComponent className={className} />;
  }
  
  // Fallback to a simple SVG placeholder if source doesn't exist
  return (
    <svg 
      className={className}
      viewBox="0 0 24 24" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="4" y="4" width="16" height="16" rx="8" stroke="currentColor" strokeWidth="2" />
      <path d="M9 12H15" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
};


// Function to check if user is on Base network
const isBaseNetwork = async (provider) => {
  try {
    const network = await provider.getNetwork();
    return Number(network.chainId) === BASE_CHAIN_ID;
  } catch (error) {
    console.error("Error checking network:", error);
    return false;
  }
};


// Function to switch to Base network
const switchToBaseNetwork = async () => {
  if (!window.ethereum) return false;
  
  try {
    // Request switch to Base
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: BASE_HEX_CHAIN_ID }],
    });
    return true;
  } catch (switchError) {
    // This error code indicates the chain hasn't been added to MetaMask
    if (switchError.code === 4902) {
      try {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: BASE_HEX_CHAIN_ID,
            chainName: 'Base',
            nativeCurrency: {
              name: 'ETH',
              symbol: 'ETH',
              decimals: 18
            },
            rpcUrls: ['https://mainnet.base.org'],
            blockExplorerUrls: ['https://basescan.org/']
          }],
        });
        return true;
      } catch (addError) {
        console.error('Error adding Base network:', addError);
        return false;
      }
    }
    console.error('Error switching to Base network:', switchError);
    return false;
  }
};

const verifyBaseUSDT = async (provider) => {
  try {
    // Check if connected to Base
    const onBase = await isBaseNetwork(provider);
    if (!onBase) {
      console.log("Not on Base network, skipping USDT verification");
      return false;
    }
    
    // Try to get USDT contract
    const usdtAddress = await getUSDTAddress(provider);
    
    // Check if contract exists at the address
    const code = await provider.getCode(usdtAddress);
    if (code === '0x' || code === '0x0') {
      console.error("No contract found at USDT address on Base");
      setError("USDT contract not found on Base. Please check your connection.");
      return false;
    }
    
    // Try to get symbol - if this works, contract exists
    try {
      const contract = await getUSDTContract(provider);
      const symbol = await contract.symbol();
      console.log(`USDT contract verified on Base. Symbol: ${symbol}`);
      return true;
    } catch (error) {
      console.error("Could not verify USDT contract on Base:", error);
      setError("Could not verify USDT on Base. Please try again.");
      return false;
    }
  } catch (error) {
    console.error("Error verifying Base USDT:", error);
    return false;
  }
};


// BRICS Integration Function
const initializeBRICSIntegration = () => {
  console.log('BRICS integration initialized');
};

function App() {
  const [account, setAccount] = useState(null);
  const [error, setError] = useState(null);
  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [balance, setBalance] = useState(0);  // Changed initial value to 0
  const [profit, setProfit] = useState(0);    // Changed initial value to 0
  const [showDepositFlow, setShowDepositFlow] = useState(false);
  const [showWithdrawFlow, setShowWithdrawFlow] = useState(false);
  const [showSnackbar, setShowSnackbar] = useState(false);
  const [errorType, setErrorType] = useState(null);
  const [isEmbedded, setIsEmbedded] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [showCopyTooltip, setShowCopyTooltip] = useState(false);
  const [copiedText, setCopiedText] = useState('');
  const [ensAvatar, setEnsAvatar] = useState(null);
  const [ensName, setEnsName] = useState(null);
  const [exceedsMax, setExceedsMax] = useState(false);
  const [showBuyFlow, setShowBuyFlow] = useState(false);
  const [openAccordion, setOpenAccordion] = useState(null);
  const [openSubmenu, setOpenSubmenu] = useState(null);
  //state variables for USDT integration
  const [treasuryBalance, setTreasuryBalance] = useState(0);
  const [allowance, setAllowance] = useState(0);
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [depositedAmount, setDepositedAmount] = useState(0);
  const [contractVerified, setContractVerified] = useState(true); // Default to true to avoid initial warning
  const [chainBalances, setChainBalances] = useState({});
  const [selectedChain, setSelectedChain] = useState(BASE_CHAIN_ID); // Default to Base
  const [isFetchingBalances, setIsFetchingBalances] = useState(false);
  const [deposits, setDeposits] = useState([]);
  
  const debugBalance = async (provider, address) => {
    const contract = new ethers.Contract(
      '0xdac17f958d2ee523a2206206994597c13d831ec7',
      USDT_ABI,
      provider
    );
    const rawBalance = await contract.balanceOf(address);
    const decimals = await contract.decimals();
    const balance = ethers.formatUnits(rawBalance, decimals);
    console.log(`Debug balance for ${address}: ${balance} USDT (raw: ${rawBalance.toString()}, decimals: ${decimals})`);
    return balance;
  };

  // Handle account changes
  const handleAccountsChanged = async (accounts) => {
    if (accounts.length > 0) {
      setAccount(accounts[0]);
      setError(null);
      const signer = await provider.getSigner();
      setSigner(signer);
      fetchEnsData(accounts[0]);
      fetchBalances(provider, accounts[0]);
      const onBaseNetwork = await isBaseNetwork(provider);
      if (!onBaseNetwork) {
        setError('For the best experience, please connect to Base network');
      } else {
        setError(null);
        verifyBaseUSDT(provider).then(verified => {
          if (!verified) console.warn("USDT verification failed on Base");
        });
      }
    } else {
      setAccount(null);
      setProvider(null);
      setSigner(null);
      setBalance(0);
      setTreasuryBalance(0);
      setError('Wallet disconnected externally.');
      setEnsAvatar(null);
      setEnsName(null);
    }
  };

  useEffect(() => {
  if (account && provider) {
    fetchBalances(provider, account);
    const fetchDeposits = async () => {
      const API_URL = `${API_BASE_URL}/api/deposits/${account.toLowerCase()}`;
      const response = await fetch(API_URL);
      const data = await response.json();
      if (data.success) {
        setDeposits(data.deposits.filter(d => d.chainId === selectedChain));
      }
    };
    fetchDeposits();
  }
}, [account, provider, selectedChain]);

  // BRICS Integration useEffect
  useEffect(() => {
    initializeBRICSIntegration();
    
    const params = new URLSearchParams(window.location.search);
    const action = params.get('action');
    const amount = params.get('amount');
    const user = params.get('user');
    const hash = params.get('hash');

    console.log('BRICS Integration - URL Parameters:', { action, amount, user, hash });

    if (action === 'connect_wallet' && amount && user && hash) {
      const secret = 'nxceebao7frdn1jnv7pss3ss42hs3or5';
      const expectedHash = window.CryptoJS.HmacSHA256(user, secret).toString(window.CryptoJS.enc.Hex);

      console.log('BRICS Integration - Hash comparison:', { 
        providedHash: hash, 
        expectedHash: expectedHash,
        isValid: hash === expectedHash 
      });

      if (hash === expectedHash) {
        console.log(`Launching MetaMask with ${amount} USDT`);
        setDepositAmount(amount);
        
        // Auto-connect wallet and execute deposit
        setTimeout(async () => {
          if (account && provider) {
            console.log('BRICS Integration - Executing deposit');
            await handleDeposit();
          } else {
            console.log('BRICS Integration - Wallet not connected, attempting to connect');
            // Use the same mobile redirect logic as connectWallet
            const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|mobile/i.test(navigator.userAgent);
            const isMetaMaskBrowser = /MetaMaskMobile/.test(navigator.userAgent);
            
            console.log('BRICS Integration - Mobile detection:', { 
              isMobileDevice, 
              isMetaMaskBrowser, 
              isEmbedded,
              userAgent: navigator.userAgent 
            });
            
            if (isMobileDevice && !isMetaMaskBrowser && !isEmbedded) {
              console.log('BRICS Integration - Mobile device detected, redirecting to MetaMask app');
              localStorage.setItem('walletConnectionAttempt', 'true');
              const vercelAppUrl = 'https://buy.brics.ninja';
              const metamaskUrl = `https://metamask.app.link/dapp/${vercelAppUrl.replace(/^https?:\/\//, '')}`;
              console.log('BRICS Integration - Opening MetaMask app URL:', metamaskUrl);
              
              // Try multiple redirect methods for better mobile compatibility
              try {
                // Method 1: Direct window.open
                window.open(metamaskUrl, '_blank');
                
                // Method 2: Set location after a delay (fallback)
                setTimeout(() => {
                  window.location.href = metamaskUrl;
                }, 1000);
                
                // Method 3: Create and click a link (another fallback)
                setTimeout(() => {
                  const link = document.createElement('a');
                  link.href = metamaskUrl;
                  link.target = '_blank';
                  link.click();
                }, 2000);
                
              } catch (error) {
                console.log('BRICS Integration - Redirect failed, trying location.href');
                window.location.href = metamaskUrl;
              }
              
              // Show user-friendly message
              setSnackbarMessage('Opening MetaMask app... Please complete your investment there.');
              setShowSnackbar(true);
              setTimeout(() => setShowSnackbar(false), 5000);
              
              return;
            } else {
              console.log('BRICS Integration - Not mobile or already in MetaMask, using connectWallet');
              await connectWallet();
            }
          }
        }, 2000);
      } else {
        console.warn("Invalid HMAC – not proceeding.");
      }
    }
  }, [account, provider]); // Added dependencies to re-run when wallet connects
  
  useEffect(() => {
  const initWallet = async () => {
    setIsEmbedded(window !== window.parent);
    const isRedirectedFromMetaMask = localStorage.getItem('walletConnectionAttempt') === 'true';
    const isMetaMaskBrowser = /MetaMaskMobile/.test(navigator.userAgent);
    console.log("Initializing wallet connection...");

    if ((isRedirectedFromMetaMask || isMetaMaskBrowser) && window.ethereum) {
      localStorage.removeItem('walletConnectionAttempt');
      await autoConnectWallet();
    }

    if (window.ethereum) {
      console.log("Found valid window.ethereum provider");
      const ethProvider = new ethers.BrowserProvider(window.ethereum);
      setProvider(ethProvider);

      // Test provider capabilities
      testProvider(ethProvider).then(isWorking => {
        console.log(isWorking ? "Provider is fully functional" : "Provider has limited functionality - some features may not work");
      });

      // Monitor provider status
      monitorProviderStatus(ethProvider);

      window.ethereum.on('accountsChanged', handleAccountsChanged);

      window.ethereum.on('chainChanged', async () => {
        const onBase = await isBaseNetwork(ethProvider);
        if (!onBase) {
          setError('For the best experience, please connect to Base network');
        } else {
          setError(null);
          verifyBaseUSDT(ethProvider).then(verified => {
            if (!verified) console.warn("USDT verification failed on Base");
          });
        }
        if (account) fetchBalances(ethProvider, account);
      });

      // Initial account check
      const accounts = await ethProvider.listAccounts();
      if (accounts.length > 0) {
        handleAccountsChanged(accounts.map(acc => acc.address));
      }
    } else {
      console.log("No browser wallet provider found");
    }
  };

  initWallet().catch(err => console.error("Wallet initialization error:", err));

  return () => {
    if (window.ethereum?.removeListener) {
      window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
      window.ethereum.removeListener('chainChanged', () => {});
    }
  };
}, []); // Empty dependency array to run once on mount

  // Updated getUserDepositedAmount function
  const getUserDepositedAmount = async (userAddress) => {
    try {
      console.log('Fetching deposits for:', userAddress);
      const API_URL = `${API_BASE_URL}/api/deposits/${userAddress.toLowerCase()}`;
      console.log('API URL:', API_URL);
  
      const response = await fetch(API_URL);
      const data = await response.json();
      console.log('getUserDepositedAmount response:', data);
  
      if (data.success) {
        // Return the appropriate total based on chain
        const depositedAmount = selectedChain === 11155111 ? data.totalMockUsdtDeposited : data.totalUsdtDeposited;
        console.log(`Deposited amount for chain ${selectedChain}: ${depositedAmount}`);
        return depositedAmount || 0;
      } else {
        throw new Error('Failed to fetch deposited amount');
      }
    } catch (error) {
      console.error('Error fetching deposited amount:', error);
      return 0;
    }
  };

// Updated fetchBalances function
const fetchBalances = async (ethProvider, userAddress) => {
  try {
    setIsFetchingBalances(true);
    console.log(`Fetching balances for address: ${userAddress}`);

    const multiChainBalances = await getMultiChainUSDTBalanceLocal(userAddress).catch((err) => {
      console.error('Error fetching multi-chain balances:', err);
      return {};
    });

    setChainBalances(multiChainBalances);
    const highestBalanceChain = findHighestBalanceChain(multiChainBalances);
    setSelectedChain(highestBalanceChain);
    const currentChainBalance = multiChainBalances[highestBalanceChain] || 0;
    setBalance(currentChainBalance);

    const API_URL = `${API_BASE_URL}/api/deposits/${userAddress.toLowerCase()}`;
    const response = await fetch(API_URL);
    const data = await response.json();

    if (data.success) {
      // Use currentBalance for deposited amount to reflect yield updates
      const deposits = data.deposits || [];
      const totalDeposited = deposits
        .filter(d => d.chainId === highestBalanceChain)
        .reduce((sum, deposit) => sum + (deposit.currentBalance || deposit.amount), 0);
      setDepositedAmount(totalDeposited || 0);

      const totalAccumulatedYield = deposits
        .filter(d => d.chainId === highestBalanceChain)
        .reduce((sum, deposit) => sum + (deposit.accumulatedYield || 0), 0);
      setProfit(totalAccumulatedYield);

      setDeposits(deposits.filter(d => d.chainId === highestBalanceChain));
    } else {
      setDepositedAmount(0);
      setProfit(0);
      setDeposits([]);
    }

    const treasuryBal = await getTreasuryUSDTBalance(ethProvider).catch(() => 0);
    setTreasuryBalance(treasuryBal);

    const treasuryAddress = getTreasuryAddressForChain(highestBalanceChain);
    const userAllowance = await checkUSDTAllowance(ethProvider, userAddress, highestBalanceChain, treasuryAddress).catch(() => 0);
    setAllowance(userAllowance);
  } catch (err) {
    console.error('Error in fetchBalances:', err);
  } finally {
    setIsFetchingBalances(false);
  }
};


  const autoConnectWallet = async () => {
    if (!window.ethereum) return;
    try {
      setIsConnecting(true);
      console.log("Attempting auto-connect with wallet");
      
      const ethProvider = new ethers.BrowserProvider(window.ethereum);
      setProvider(ethProvider);
      
      // Test provider functionality
      const providerWorking = await testProvider(ethProvider);
      if (!providerWorking) {
        console.warn("Auto-connect provider has limited functionality");
      }
      
      // Monitor provider status
      monitorProviderStatus(ethProvider);
      
      const accounts = await ethProvider.listAccounts();
      if (accounts.length > 0) {
        setAccount(accounts[0].address);
        
        // Set signer
        const ethSigner = await ethProvider.getSigner();
        setSigner(ethSigner);
        
        // Check if user is on Base network
        const onBaseNetwork = await isBaseNetwork(ethProvider);
        if (!onBaseNetwork) {
          // Show notification to switch networks
          setShowSnackbar(true);
          setSnackbarMessage('Switching to Base network for lower fees...');
          
          // Attempt to switch networks
          const switched = await switchToBaseNetwork();
          
          if (!switched) {
            setShowSnackbar(false);
            setError('Please connect to Base network for the best experience');
            // Continue anyway, but with a warning
          } else {
            setShowSnackbar(false);
            setSnackbarMessage('Successfully connected to Base network');
            setTimeout(() => setShowSnackbar(false), 3000);
            
            // Get fresh provider and signer after network switch
            const updatedProvider = new ethers.BrowserProvider(window.ethereum);
            setProvider(updatedProvider);
            const updatedSigner = await updatedProvider.getSigner();
            setSigner(updatedSigner);
          }
        }
        
        // Fetch ENS data when auto-connecting
        fetchEnsData(accounts[0].address);
        
        // Fetch real balances
        fetchBalances(ethProvider, accounts[0].address);
        
        console.log("Auto-connect successful:", accounts[0].address);
      } else {
        console.log("Auto-connect found no accounts");
      }
    } catch (err) {
      logContractError(err, "auto-connect");
    } finally {
      setIsConnecting(false);
    }
  };

  const fetchEnsData = async (address) => {
    if (!address || !provider) return;
    
    try {
      // Check if the address has an ENS name
      const ensName = await provider.lookupAddress(address);
      if (ensName) {
        setEnsName(ensName);
        
        try {
          // Get the resolver
          const resolver = await provider.getResolver(ensName);
          if (resolver) {
            // Get the avatar text record
            const avatar = await resolver.getText("avatar");
            if (avatar) {
              setEnsAvatar(avatar);
              console.log("Found ENS avatar:", avatar);
            }
          }
        } catch (avatarError) {
          console.error("Error fetching ENS avatar:", avatarError);
        }
      }
    } catch (error) {
      console.error("Error fetching ENS data:", error);
    }
  };

  
  const connectWallet = async () => {
    setError(null);
    const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|mobile/i.test(navigator.userAgent);
    const isMetaMaskBrowser = /MetaMaskMobile/.test(navigator.userAgent);
    
    console.log('Connect Wallet - Device Info:', { 
      isMobileDevice, 
      isMetaMaskBrowser, 
      isEmbedded,
      userAgent: navigator.userAgent 
    });
    
    if (isMobileDevice && !isMetaMaskBrowser && !isEmbedded) {
      console.log('Mobile device detected - redirecting to MetaMask app');
      localStorage.setItem('walletConnectionAttempt', 'true');
      const vercelAppUrl = 'https://buy.brics.ninja';
      const metamaskUrl = `https://metamask.app.link/dapp/${vercelAppUrl.replace(/^https?:\/\//, '')}`;
      console.log('Opening MetaMask app URL:', metamaskUrl);
      
      // Try multiple redirect methods for better mobile compatibility
      try {
        // Method 1: Direct window.open
        window.open(metamaskUrl, '_blank');
        
        // Method 2: Set location after a delay (fallback)
        setTimeout(() => {
          window.location.href = metamaskUrl;
        }, 1000);
        
        // Method 3: Create and click a link (another fallback)
        setTimeout(() => {
          const link = document.createElement('a');
          link.href = metamaskUrl;
          link.target = '_blank';
          link.click();
        }, 2000);
        
      } catch (error) {
        console.log('Redirect failed, trying location.href');
        window.location.href = metamaskUrl;
      }
      
      // Show user-friendly message
      setSnackbarMessage('Opening MetaMask app... Please complete your investment there.');
      setShowSnackbar(true);
      setTimeout(() => setShowSnackbar(false), 5000);
      
      return;
    }
    
    try {
      setIsConnecting(true);
      console.log("Attempting manual wallet connection");
      
      let ethProvider, walletName = '';
      if (window.ethereum) {
        walletName = 'MetaMask';
        ethProvider = new ethers.BrowserProvider(window.ethereum);
        setProvider(ethProvider);
        
              // Request account access (simplified approach)
      try {
        await ethProvider.send('eth_requestAccounts', []);
      } catch (error) {
        console.warn("eth_requestAccounts failed, trying alternative method:", error);
        // Fallback: try to get accounts directly
        const accounts = await ethProvider.listAccounts();
        if (accounts.length === 0) {
          throw new Error('No accounts found. Please connect your wallet.');
        }
      }
        
        // Check if user is on Base network
        const onBaseNetwork = await isBaseNetwork(ethProvider);
        if (!onBaseNetwork) {
          // Show notification to switch networks
          setShowSnackbar(true);
          setSnackbarMessage('Please switch to Base network for lower gas fees...');
          
          // Attempt to switch networks
          const switched = await switchToBaseNetwork();
          setShowSnackbar(false);
          
          if (!switched) {
            setError('Please connect to Base network for the best experience');
            // Continue anyway, but with a warning
          }
        }
      } else if (window.ethereum && window.ethereum.isCoinbaseWallet) {
        walletName = 'Coinbase Wallet';
        ethProvider = new ethers.BrowserProvider(window.ethereum);
        setProvider(ethProvider);
        
        // Monitor provider status
        monitorProviderStatus(ethProvider);
        
        await ethProvider.send('eth_requestAccounts', []);
        
        // Check if user is on Base network
        const onBaseNetwork = await isBaseNetwork(ethProvider);
        if (!onBaseNetwork) {
          setError('For the best experience, please connect to Base network');
        }
      } else if (window.ethereum && window.ethereum.isTrust) {
        walletName = 'Trust Wallet';
        ethProvider = new ethers.BrowserProvider(window.ethereum);
        setProvider(ethProvider);
        
        // Monitor provider status
        monitorProviderStatus(ethProvider);
        
        await ethProvider.send('eth_requestAccounts', []);
        
        // Check if user is on Base network
        const onBaseNetwork = await isBaseNetwork(ethProvider);
        if (!onBaseNetwork) {
          setError('For the best experience, please connect to Base network');
        }
      } else {
        if (isMobileDevice) {
          console.log('Mobile device - no wallet detected, redirecting to MetaMask app');
          const vercelAppUrl = 'https://buy.brics.ninja';
          const metamaskUrl = `https://metamask.app.link/dapp/${vercelAppUrl.replace(/^https?:\/\//, '')}`;
          console.log('Opening MetaMask app URL:', metamaskUrl);
          window.open(metamaskUrl, '_blank');
          return;
        } else {
          console.log('Desktop - no wallet detected');
          throw new Error('Please install MetaMask, Coinbase Wallet, Trust Wallet, or another Ethereum wallet.');
        }
      }
      
      const ethSigner = await ethProvider.getSigner();
      setSigner(ethSigner);
      
      const address = await ethSigner.getAddress();
      setAccount(address);
      
      console.log(`Connected to wallet (${walletName}):`, address);
      
      // Fetch ENS data when connecting
      fetchEnsData(address);
      
      // Fetch real balances
      fetchBalances(ethProvider, address);
      
    } catch (err) {
      logContractError(err, "connect wallet");
      setError(err.message || 'Failed to connect wallet. Please try again.');
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnectWallet = () => {
    if (window.ethereum) {
      window.ethereum.removeAllListeners('accountsChanged');
      window.ethereum.removeAllListeners('chainChanged');
      setShowSnackbar(true);
      setSnackbarMessage('Wallet disconnected');
      setTimeout(() => setShowSnackbar(false), 3000);
      if (window.ethereum.request) {
        window.ethereum.request({ method: 'wallet_requestPermissions', params: [{ eth_accounts: {} }] })
          .then(() => {
            setAccount(null);
            setProvider(null);
            setSigner(null);
          })
          .catch((err) => {
            console.error('Disconnect error:', err);
            setAccount(null);
            setProvider(null);
            setSigner(null);
          });
      } else {
        setAccount(null);
        setProvider(null);
        setSigner(null);
      }
    }
    setError(null);
    setDepositAmount('');
    setWithdrawAmount('');
    setBalance(0);
    setDepositedAmount(0); // Clear deposited amount
    setTreasuryBalance(0);
    setProfit(0);
    setAllowance(0);
  };

  const handleDepositClick = () => setShowDepositFlow(true);
  
  const handleWithdrawClick = () => {
    if (depositedAmount > 0) {
      setShowWithdrawFlow(true);
    } else {
      setError('No funds deposited to withdraw.');
    }
  };

const handleBackClick = () => {
  setShowDepositFlow(false);
  setShowWithdrawFlow(false);
  setShowBuyFlow(false);
  setDepositAmount('');
  setWithdrawAmount('');
  setError(null);
  setErrorType(null);
  // Refresh balances when returning to main screen
  if (provider && account) {
    fetchBalances(provider, account);
  }
};

const handleDeposit = async () => {
  if (!account || !provider) {
    setError('Please connect your wallet first.');
    return;
  }

  const amount = parseFloat(depositAmount);
  if (!depositAmount || isNaN(amount) || amount <= 0) {
    setError('Please enter a valid deposit amount.');
    setErrorType('invalid');
    return;
  }

  const selectedChainBalance = chainBalances[selectedChain] || 0;
  if (amount > selectedChainBalance) {
    setError(`Deposit amount exceeds your USDT balance (${selectedChainBalance} USDT).`);
    setErrorType('exceed');
    return;
  }

  try {
    setIsProcessing(true);
    setError(null);

    // Verify wallet connection
    const accounts = await window.ethereum.request({ method: 'eth_accounts' });
    if (!accounts || accounts.length === 0 || accounts[0].toLowerCase() !== account.toLowerCase()) {
      throw new Error('Wallet disconnected or account changed. Please reconnect your wallet.');
    }

    const network = await provider.getNetwork();
    const currentChainId = Number(network.chainId);
    if (currentChainId !== selectedChain) {
      const success = await switchToChain(selectedChain);
      if (!success) {
        setError(`Please switch to ${getChainName(selectedChain)} to complete this deposit.`);
        setIsProcessing(false);
        return;
      }
    }

    // Reinitialize provider and signer to ensure freshness
    const freshProvider = new ethers.BrowserProvider(window.ethereum);
    setProvider(freshProvider);
    let freshSigner;
    try {
      freshSigner = await freshProvider.getSigner();
      setSigner(freshSigner);
    } catch (error) {
      throw new Error('Failed to initialize signer. Please reconnect your wallet.');
    }

    // Verify signer matches the connected account
    const signerAddress = await freshSigner.getAddress();
    if (signerAddress.toLowerCase() !== account.toLowerCase()) {
      throw new Error('Signer address does not match connected account.');
    }

    const treasuryAddress = getTreasuryAddressForChain(selectedChain);
    setShowSnackbar(true);
    setSnackbarMessage('Processing USDT deposit to treasury...');
    const depositTx = await transferUSDT(freshSigner, amount.toString(), treasuryAddress, selectedChain, 2);
    console.log('Deposit transaction to treasury:', depositTx.hash);

    const depositPayload = {
      userAddress: account,
      amount: parseFloat(amount),
      txHash: depositTx.hash,
      chainId: selectedChain,
    };

    const depositResponse = await fetch(`${API_BASE_URL}/api/deposits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(depositPayload),
    });

    const depositData = await depositResponse.json();
    if (!depositData.success) throw new Error('Failed to record deposit in backend');

    setShowSnackbar(true);
    setSnackbarMessage('Deposit successful! Data synced to Google Sheets.');
    setTimeout(() => setShowSnackbar(false), 3000);

    await fetchBalances(freshProvider, account);
    setShowDepositFlow(false);
    setDepositAmount('');
    setErrorType(null);
  } catch (err) {
    console.error('Deposit error:', err);
    setError(err.message || 'Failed to process deposit. Please try again.');
    setShowSnackbar(false);
  } finally {
    setIsProcessing(false);
  }
};

const handleMaxClick = (type) => {
  if (type === 'deposit') {
    // Use the selected chain's balance for max
    const maxAmount = chainBalances[selectedChain] || 0;
    setDepositAmount(maxAmount.toString());
  } else if (type === 'withdraw') {
    setWithdrawAmount(depositedAmount.toString());
  }
  setError(null);
  setErrorType(null);
  setExceedsMax(false);
};

  const handleBuyClick = () => {
    // Redirect to MetaMask Portfolio to buy USDT
    window.open('https://portfolio.metamask.io/', '_blank');
    console.log("Redirecting to MetaMask Portfolio to buy USDT");
  };
  

const handleWithdraw = async () => {
  if (!account || !signer) {
    setError('Please connect your wallet first.');
    setErrorType('wallet');
    return;
  }

  const amount = parseFloat(withdrawAmount);
  if (!withdrawAmount || isNaN(amount) || amount <= 0) {
    setError('Please enter a valid withdrawal amount.');
    setErrorType('invalid');
    return;
  }

  if (amount > depositedAmount) {
    setError('Withdrawal amount exceeds your deposited balance.');
    setErrorType('exceed');
    return;
  }

  try {
    setIsProcessing(true);
    setError(null);
    setShowSnackbar(true);
    setSnackbarMessage('Processing withdrawal...');

    const network = await provider.getNetwork();
    const currentChainId = Number(network.chainId);
    console.log(`Current chain ID: ${currentChainId}, Selected chain ID: ${selectedChain}`);
    if (currentChainId !== selectedChain) {
      setShowSnackbar(true);
      setSnackbarMessage(`Switching to ${getChainName(selectedChain)} to complete withdrawal...`);
      const success = await switchToChain(selectedChain);
      if (!success) {
        setError(`Please switch to ${getChainName(selectedChain)} to complete this withdrawal.`);
        setShowSnackbar(false);
        setIsProcessing(false);
        return;
      }

      const updatedProvider = new ethers.BrowserProvider(window.ethereum);
      setProvider(updatedProvider);
      const updatedSigner = await updatedProvider.getSigner();
      setSigner(updatedSigner);
      setShowSnackbar(false);
    }

    // Initialize USDT contract for withdrawal
    const contract = await getUSDTContract(signer, selectedChain);
    console.log(`Initialized USDT contract at ${contract.address} for chain ${selectedChain}`);

    setShowSnackbar(true);
    setSnackbarMessage('Processing withdrawal...');

    // Parse amount for USDT (6 decimals)
    const parsedAmount = ethers.parseUnits(amount.toString(), 6);
    console.log(`Parsed withdrawal amount: ${amount} USDT (${parsedAmount} wei)`);

    // Estimate gas and set gas settings
    const gasSettings = {};
    try {
      const feeData = await provider.getFeeData();
      if (feeData.maxPriorityFeePerGas && feeData.maxFeePerGas) {
        gasSettings.maxFeePerGas = feeData.maxFeePerGas || ethers.parseUnits('2', 'gwei');
        gasSettings.maxPriorityFeePerGas = feeData.maxPriorityFeePerGas || ethers.parseUnits('0.1', 'gwei');
      } else {
        gasSettings.gasPrice = ethers.parseUnits('2', 'gwei');
      }
    } catch (error) {
      console.warn('Using legacy gas settings:', error.message);
      gasSettings.gasPrice = ethers.parseUnits('2', 'gwei');
    }
    console.log('Gas settings:', gasSettings);

    // Since we're not using the deposit contract, simulate a withdrawal by recording it
    const txHash = `0x${Math.random().toString(16).substr(2, 64)}`; // Placeholder txHash
    console.log(`Simulated withdrawal transaction hash: ${txHash}`);

    // Record withdrawal in backend
    const withdrawalPayload = {
      userAddress: account,
      amount: amount,
      txHash: txHash,
      chainId: selectedChain,
    };
    console.log('Sending withdrawal payload to backend:', withdrawalPayload);

    const response = await fetch(`${API_BASE_URL}/api/withdraw`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(withdrawalPayload),
});

const result = await response.json();
if (!result.success) {
  throw new Error(result.error || 'Failed to record withdrawal in backend');
}
console.log('Backend withdrawal response:', result);

setSnackbarMessage(`Withdrawal of ${amount} USDT submitted! Data synced to Google Sheets.`);

await fetchBalances(provider, account);

    const depositedResponse = await getUserDepositedAmount(account);
    const backendDeposited = selectedChain === 1 ? depositedResponse : 0;
    setDepositedAmount(backendDeposited);

    setShowSnackbar(false);
    setShowWithdrawFlow(false);
    setWithdrawAmount('');
    setErrorType(null);
  } catch (err) {
    console.error('Withdrawal error:', err);
    setError(err.message || 'Failed to process withdrawal. Please try again.');
    setErrorType('general');
    setShowSnackbar(false);
  } finally {
    setIsProcessing(false);
  }
};


// Updated renderAboutSection function with accordion functionality
const renderAboutSection = () => {
  // Define the accordion items and their submenu options
  const accordionItems = [
    {
      key: 'mission',
      text: 'Misson',
      icon: missionChevronIcon,
      submenu: [
        { text: 'What is BRICS?', link: 'https://ygors-personal-organization.gitbook.io/short-deck/', disabled: false }, 
        { text: 'Short Memo', link: 'https://ygors-personal-organization.gitbook.io/usdbrics-short-memo/', disabled: false },
        { text: 'Rationale', link: 'https://ygors-personal-organization.gitbook.io/bank-rationale/', disabled: false },
      ]
    },
    {
      key: 'docs',
      text: 'Docs',
      icon: image,
      submenu: [
        { text: 'Long Memo', link: 'https://ygors-personal-organization.gitbook.io/untitled/', disabled: false },
        { text: 'AI + Copula', link: 'https://docsend.com/view/s/q6vmidxjqhkqg3t3', disabled: false },
        { text: 'GitHub', link: 'https://github.com/yomarfrancisco', disabled: false }
      ]
    },
    {
      key: 'data',
      text: 'Data room',
      icon: dataRoomIcon,
      submenu: [
        { text: 'Regulatory license', link: 'https://docsend.com/view/pf2vc4y66d5xthix', disabled: false },
        { text: 'Mark-to-market', link: 'https://docsend.com/view/mhpy2xuri3r759fe', disabled: false },
        { text: 'Reserve Bank filing', link: 'https://docsend.com/view/6v5kverd9wj8qcvz', disabled: false },
        { text: 'Sovereign Facility', link: 'https://docsend.com/view/qeezj257xwm9eqxj', disabled: false }
      ]
    },
    {
      key: 'contact',
      text: 'Contact us',
      icon: closeIcon,
      submenu: [
        { text: 'Telegram', link: null, disabled: true },
        { text: 'Twitter', link: null, disabled: true },
        { text: 'ygor@brics.ninja', link: 'mailto:ygor@brics.ninja', disabled: false }
      ]
    }
  ];

  const handleAccordionClick = (key) => {
    if (openAccordion === key) {
      // Close the accordion if it's already open
      setOpenAccordion(null);
      setOpenSubmenu(null);
    } else {
      // Open the clicked accordion and close any others
      setOpenAccordion(key);
      setOpenSubmenu(null);
    }
  };

  const handleSubmenuClick = (e, link) => {
    e.stopPropagation(); // Prevent the accordion from toggling
    if (link) {
      window.open(link, '_blank');
    }
  };

  return (
    <div className="about-section">
      <div className="about-title">About BRICS</div>
      <div className="about-items">
        {accordionItems.map((item) => (
          <div key={item.key} className="accordion-wrapper">
            <div 
              className={`about-item ${openAccordion === item.key ? 'active' : ''}`}
              onClick={() => handleAccordionClick(item.key)}
            >
              <div className="about-item-content">
                <div className="about-item-icon" style={{ display: 'none' }}>
                  <SvgIcon src={item.icon} alt={item.text} className="about-item-svg" />
                </div>
                <div className="about-item-text">{item.text}</div>
              </div>
              
              <SvgIcon 
                src={docsChevronIcon} 
                alt="Chevron" 
                className={`chevron-icon ${openAccordion === item.key ? 'chevron-up' : 'chevron-down'}`} 
              />
            </div>
            
            {openAccordion === item.key && (
              <div className="submenu">
                {item.submenu.map((subItem, index) => (
                  <div 
                    key={index}
                    className={`submenu-item ${subItem.disabled ? 'disabled' : ''}`}
                    onClick={(e) => !subItem.disabled && handleSubmenuClick(e, subItem.link)}
                  >
                    {subItem.text}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

const handleCopy = (text) => {
  if (!text) return;
  
  try {
    // Use clipboard API if available
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
    } else {
      // Fallback method
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    }
    
    // Show tooltip
    setCopiedText(text);
    setShowCopyTooltip(true);
    
    // Hide tooltip after 2 seconds
    setTimeout(() => {
      setShowCopyTooltip(false);
      setCopiedText('');
    }, 2000);
    
  } catch (err) {
    console.error('Copy failed:', err);
    setError('Failed to copy to clipboard');
  }
};

  const renderWalletUnconnected = () => (
    <>
      <div className="content-container">
        <div className="card">
          <div className="avatar-container">
            {/* Inserts SVG imported asset */}
            <div className="generic-avatar">
              <img 
                src={genericAvatar} 
                alt="Generic avatar" 
                className="generic-avatar-icon"
              />
            </div>
          </div>
          <p className="wallet-info-text">
            Connect your wallet to make a deposit
          </p>
          <button 
            className="btn btn-primary"
            onClick={connectWallet}
            disabled={isConnecting}
          >
            {isConnecting ? 'Connecting...' : 'Connect wallet'}
          </button>
        </div>
        
        {renderAboutSection()}
      </div>
    </>
  );

  const formatAddress = (addr, truncate = true) => {
    if (!addr) return '';
    return truncate ? `${addr.slice(0, 3)}...${addr.slice(-3)}` : addr;
  };

  const renderWalletConnected = () => {
  const handleYieldGoalToggle = async (depositId, currentValue) => {
    const response = await fetch(`${API_BASE_URL}/api/deposits/${depositId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ yieldGoalMet: !currentValue }),
    });
    if (response.ok) fetchBalances(provider, account);
  };

  if (isFetchingBalances) {
    return (
      <div className="content-container">
        <div className="card balance-card">
          <div className="balance-label">Loading balances...</div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="top-header">
        <div className="wallet-address-pill" onClick={disconnectWallet}>
          {ensAvatar ? <img src={ensAvatar} alt="ENS Avatar" className="wallet-icon-img" /> : <div className="wallet-icon"></div>}
          <div className="wallet-address">{ensName || formatAddress(account, true)}</div>
        </div>
        {provider && <div className="network-indicator"><div className="network-dot"></div><span className="network-name">{getChainName(selectedChain)}</span></div>}
      </div>

      <div className="content-container">
        <div className="card balance-card">
          <div className="balance-label">USDT balance</div>
          <div className="balance-container">
            <div className="balance-amount">${depositedAmount.toFixed(2)}</div>
            <div className="profit-info">
              <span>Profit </span>
              {profit !== 0 ? (
                <span className={profit >= 0 ? "profit-positive" : "profit-negative"}>
                  {profit >= 0 ? "▲" : "▼"} ${Math.abs(profit).toFixed(2)} ({depositedAmount > 0 ? ((profit / depositedAmount) * 100).toFixed(1) : 0}%)
                </span>
              ) : <span>- ${profit.toFixed(2)} (0%)</span>}
            </div>
          </div>
          <div className="action-buttons">
            <button className="btn btn-primary" onClick={handleDepositClick} disabled={isProcessing}>Deposit</button>
            <button className="btn btn-secondary" onClick={handleWithdrawClick} disabled={depositedAmount <= 0 || isProcessing}>Withdraw</button>
          </div>
        </div>

        {renderAboutSection()}
      </div>
    </>
  );
};
  
  
  const renderDepositFlow = () => (
  <>
    <div className="top-header form-header">
      <button className="back-button" onClick={handleBackClick} disabled={isProcessing}>
        <SvgIcon src={arrowBackward} alt="Back" className="back-icon" />
      </button>
      <div className="form-title">Deposit</div>
      {provider && (
        <div className="network-indicator deposit-network-indicator">
          <div className="network-dot"></div>
          <span className="network-name">{getChainName(selectedChain)}</span>
        </div>
      )}
    </div>

    <div className="content-container">
      <div className="form-container">
        <div className="form-card">
          <div className="form-group">
            <div className="form-label">Amount</div>
            <div className="input-field">
              <input
                type="number"
                className="amount-input"
                value={depositAmount}
                onChange={(e) => {
                  const newAmount = e.target.value;
                  setDepositAmount(newAmount);
                  const selectedChainBalance = chainBalances[selectedChain] || 0;
                  setExceedsMax(parseFloat(newAmount) > selectedChainBalance);
                  setError(null);
                  setErrorType(null);
                }}
                placeholder="0"
                disabled={isProcessing}
              />
              <div className="currency-badge">
                <div className="currency-icon">
                  <img src={currencyIconUsdt} alt="USDT" className="currency-icon-img" />
                </div>
                <div className="currency-label">USDT</div>
              </div>
            </div>
            <div className="max-container">
              <div className={`max-value ${exceedsMax ? 'max-value-exceeded' : ''}`}>
                {(chainBalances[selectedChain] || 0).toFixed(2)}
              </div>
              {exceedsMax ? (
                <button className="buy-button" onClick={handleBuyClick} disabled={isProcessing}>Buy</button>
              ) : (
                <button className="max-button" onClick={() => handleMaxClick('deposit')} disabled={isProcessing}>Max</button>
              )}
            </div>
          </div>

          <div className="form-group">
            <div className="form-label">Send to BRICS Treasury</div>
            <div className="address-container">
              <div className="address-display address-display-simplified">
                <span className="address-text">{getTreasuryAddressForChain(selectedChain)}</span>
                <SvgIcon src={copyIcon} alt="Copy" className="copy-icon" onClick={() => handleCopy(getTreasuryAddressForChain(selectedChain))} />
              </div>
              {showCopyTooltip && copiedText === getTreasuryAddressForChain(selectedChain) && (
                <div className="copy-tooltip">Copied!</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}
    </div>

    <div className="bottom-button-container">
      <button
        className="confirm-btn"
        onClick={handleDeposit}
        disabled={!depositAmount || parseFloat(depositAmount) <= 0 || parseFloat(depositAmount) > (chainBalances[selectedChain] || 0) || isProcessing}
      >
        <span>{isProcessing ? 'Processing...' : 'Confirm deposit'}</span>
        {!isProcessing && <span>→</span>}
      </button>
    </div>
  </>
);

  
  const renderWithdrawFlow = () => (
    <>
      <div className="top-header form-header">
        <button className="back-button" onClick={handleBackClick} disabled={isProcessing}>
          <SvgIcon src={arrowBackward} alt="Back" className="back-icon" />
        </button>
        <div className="form-title">Withdraw</div>
      </div>
        
      <div className="content-container">
        <div className="form-container">
          <div className="form-card">
            <div className="form-group">
              <div className="form-label">Amount</div>
              <div className="input-field">
                <div className="currency-badge">
                  <img src={currencyIconUsdt} alt="USDT" className="currency-icon" />
                  <div className="currency-label">USDT</div>
                </div>
                <input
                  type="number"
                  className="amount-input"
                  value={withdrawAmount}
                  onChange={(e) => {
                    const newAmount = e.target.value;
                    setWithdrawAmount(newAmount);
                    setExceedsMax(parseFloat(newAmount) > depositedAmount);
                    setError(null);
                    setErrorType(null);
                  }}
                  placeholder="0"
                  disabled={isProcessing}
                />
              </div>
              <div className="max-container">
                <div className={`max-value ${exceedsMax ? 'max-value-exceeded' : ''}`}>
                  {depositedAmount.toFixed(2)}
                </div>
                <button 
                  className="max-button" 
                  onClick={() => handleMaxClick('withdraw')}
                  disabled={isProcessing}
                >
                  Max
                </button>
              </div>
            </div>
            
            <div className="form-group">
              <div className="form-label">My wallet address</div>
              <div className="address-container">
                <div className="address-display address-display-simplified">
                  <span className="address-text">
                    {ensName || formatAddress(account, false)}
                  </span>
                  <SvgIcon 
                    src={copyIcon} 
                    alt="Copy" 
                    className="copy-icon" 
                    onClick={() => handleCopy(account)}
                  />
                </div>
                {showCopyTooltip && copiedText === account && 
                  <div className="copy-tooltip">Copied!</div>
                }
              </div>
            </div>
          </div>
        </div>
        
        {error && <div className="error-message">{error}</div>}
      </div>
        
      <div className="bottom-button-container">
        <button
          className="confirm-btn"
          onClick={handleWithdraw}
          disabled={!withdrawAmount || 
                   parseFloat(withdrawAmount) <= 0 || 
                   parseFloat(withdrawAmount) > depositedAmount ||
                   isProcessing}
        >
          <span>{isProcessing ? 'Processing...' : 'Confirm withdrawal'}</span>
          {!isProcessing && <span>→</span>}
        </button>
      </div>
    </>
  );

  const renderBuyFlow = () => (
    <>
      <div className="top-header form-header">
        <button className="back-button" onClick={() => {
          setShowBuyFlow(false);
          setShowDepositFlow(true);
        }}>
          <SvgIcon src={arrowBackward} alt="Back" className="back-icon" />
        </button>
        <div className="form-title">Buy USDT</div>
      </div>
        
      <div className="content-container">
        <div className="form-container">
          <div className="form-card">
            <div className="form-group">
              <div className="form-label">Amount to buy</div>
              <div className="input-field">
                <div className="currency-badge">
                  <img src={currencyIconUsdt} alt="USDT" className="currency-icon" />
                  <div className="currency-label">USDT</div>
                </div>
                <input
                  type="number"
                  className="amount-input"
                  value={depositAmount}
                  onChange={(e) => {
                    setDepositAmount(e.target.value);
                  }}
                  placeholder="0"
                />
              </div>
            </div>
            
            {/* Payment method selection would go here */}
            <div className="form-group">
              <div className="form-label">Payment Method</div>
              <div className="payment-methods">
                {/* Payment method options */}
                <div className="payment-method selected">
                  <div className="payment-method-icon">💳</div>
                  <div className="payment-method-name">Credit Card</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
        
      <div className="bottom-button-container">
        <button
          className="confirm-btn"
          onClick={() => {
            // Handle the purchase
            console.log(`Purchased ${depositAmount} USDT`);
            // Go back to deposit flow
            setShowBuyFlow(false);
            setShowDepositFlow(true);
          }}
          disabled={!depositAmount || parseFloat(depositAmount) <= 0}
        >
          <span>Purchase USDT</span>
          <span>→</span>
        </button>
      </div>
    </>
  );
 
  return (
    <div className="min-h-screen">
      <div className="app-container">
        {!account && !showDepositFlow && !showWithdrawFlow && !showBuyFlow && renderWalletUnconnected()}
        {account && !showDepositFlow && !showWithdrawFlow && !showBuyFlow && renderWalletConnected()}
        {showDepositFlow && !showBuyFlow && renderDepositFlow()}
        {showWithdrawFlow && renderWithdrawFlow()}
        {showBuyFlow && renderBuyFlow()}
        
        {/* Show snackbar notifications */}
        {showSnackbar && (
          <div className="snackbar">
            {snackbarMessage}
          </div>
        )}
      </div>
    </div>
  );
}
export default App;
