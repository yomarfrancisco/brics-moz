// src/utils/contract-debug.js
// This utility helps with debugging Ethereum contract interactions

/**
 * Formats and logs contract errors in a structured way
 * @param {Error} error - The error object from a contract interaction
 * @param {string} operation - Description of the operation that failed
 */
export const logContractError = (error, operation) => {
    console.error(`⚠️ Contract Error (${operation}):`);
    
    // Handle various error types
    if (error.reason) {
      console.error(`Reason: ${error.reason}`);
    }
    
    if (error.code) {
      console.error(`Code: ${error.code}`);
    }
    
    if (error.method) {
      console.error(`Method: ${error.method}`);
    }
    
    if (error.transaction) {
      console.error('Transaction Details:', {
        from: error.transaction.from,
        to: error.transaction.to,
        data: error.transaction.data?.substring(0, 66) + '...' // Truncate data
      });
    }
    
    if (error.error) {
      console.error('Inner Error:', error.error);
    }
    
    console.error('Full Error:', error);
  };
  
  /**
   * Logs contract function calls for debugging
   * @param {string} functionName - Name of the contract function being called
   * @param {Array} args - Arguments passed to the function
   */
  export const logContractCall = (functionName, args) => {
    console.log(`📞 Calling Contract: ${functionName}`);
    console.log('Arguments:', args);
  };
  
  /**
   * Monitors provider status and logs changes
   * @param {Object} provider - The Ethereum provider
   */
 

export const monitorProviderStatus = (provider) => {
    if (!provider) {
      console.warn('No provider to monitor');
      return;
    }
    
    // Check provider chainId
    const getChainInfo = async () => {
      try {
        const network = await provider.getNetwork();
        const chainId = network.chainId;
        console.log(`Connected to chain ID: ${chainId}`);
        
        // Get some basic info about the provider
        const blockNumber = await provider.getBlockNumber();
        console.log(`Current block number: ${blockNumber}`);
        
        return { chainId, blockNumber };
      } catch (error) {
        console.error('Error getting chain info:', error);
        return null;
      }
    };
    

    // Initial provider info
    getChainInfo().then(info => {
      if (info) {
        console.log('Provider initialized and working properly');
      } else {
        console.warn('Provider may not be working correctly');
      }
    });
    
    // In ethers.js v6, we need to use the provider's provider object 
    // and attach listeners differently
    try {
      // For MetaMask's window.ethereum, we need to use its own event system
      if (window.ethereum) {
        window.ethereum.on('chainChanged', (chainId) => {
          console.log('Chain changed:', chainId);
          // Force page reload on chain change as recommended by MetaMask
          window.location.reload();
        });
        
        window.ethereum.on('accountsChanged', (accounts) => {
          console.log('Accounts changed:', accounts);
        });
      }
    } catch (error) {
      console.warn('Provider event listener setup failed:', error.message);
    }
  };
  
  /**
   * Tests a provider by attempting basic interactions
   * @param {Object} provider - The Ethereum provider to test
   * @returns {Promise<boolean>} True if the provider is working correctly
   */

export const testProvider = async (provider) => {
  if (!provider) {
    console.error('No provider to test');
    return false;
  }
  
  try {
    console.log('Testing provider...');
    
    // Basic test: Get network
    console.log('Checking network connection...');
    const network = await provider.getNetwork();
    console.log('Network:', network);
    
    // Basic test: Get block number
    console.log('Checking block access...');
    const blockNumber = await provider.getBlockNumber();
    console.log('Current block:', blockNumber);
    
    // Check fee data with error handling
    console.log('Checking fee data...');
    try {
      // Use a more compatible approach for getting fee data
      const gasPrice = await provider.getGasPrice().catch(() => null);
      if (gasPrice) {
        console.log('Gas Price:', gasPrice.toString());
      }
      
      // Try getting fee data (might not work on all chains/providers)
      try {
        const feeData = await provider.getFeeData();
        console.log('Fee data available');
      } catch (feeError) {
        console.log('Standard fee data not available, using fallbacks');
      }
    } catch (e) {
      console.log('Fee data checks failed, but this is not critical');
    }
    
    console.log('Provider tests passed ✅');
    return true;
  } catch (error) {
    console.error('Provider test failed ❌:', error);
    return false;
  }
};