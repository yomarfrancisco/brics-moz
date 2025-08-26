import { ethers } from 'ethers';
import { CHAIN_CONFIG } from './usdt-contract.js';

// BRICS Token ABI - minimal functions we need
const BRICS_ABI = [
    'function mint(address to, uint256 amount) external',
    'function burn(address from, uint256 amount) external',
    'function balanceOf(address account) view returns (uint256)',
    'function totalSupply() view returns (uint256)',
    'function decimals() view returns (uint8)',
    'function treasuryAddress() view returns (address)',
    'function owner() view returns (address)'
];

// Contract addresses by chain
const BRICS_CONTRACT_ADDRESSES = {
    1: process.env.BRICS_TOKEN_ADDRESS || '0x5b87c9EeD39A05Cc72995e5e38C69D88A01AD39e', // Ethereum Mainnet - using latest attempt
    8453: process.env.BRICS_TOKEN_ADDRESS_BASE || '', // Base
    10: process.env.BRICS_TOKEN_ADDRESS_OPTIMISM || '', // Optimism
};

/**
 * Get BRICS contract instance for a specific chain
 */
function getBRICSContract(chainId) {
    const config = CHAIN_CONFIG[chainId];
    if (!config) {
        throw new Error(`Unsupported chain ID: ${chainId}`);
    }

    const contractAddress = BRICS_CONTRACT_ADDRESSES[chainId];
    if (!contractAddress) {
        throw new Error(`BRICS contract not deployed on chain ${chainId}`);
    }

    const provider = new ethers.JsonRpcProvider(config.rpcUrl);
    const signer = new ethers.Wallet(config.privateKey, provider);
    
    return new ethers.Contract(contractAddress, BRICS_ABI, signer);
}

/**
 * Mint BRICS tokens to a user address
 */
async function mintBRICSTokens(userAddress, amount, chainId) {
    try {
        console.log(`🪙 Minting ${amount} BRICS tokens to ${userAddress} on chain ${chainId}`);
        
        const contract = getBRICSContract(chainId);
        const amountInWei = ethers.parseUnits(amount.toString(), 6); // BRICS has 6 decimals
        
        const tx = await contract.mint(userAddress, amountInWei);
        const receipt = await tx.wait();
        
        console.log(`✅ BRICS minted successfully: ${amount} to ${userAddress}`);
        console.log(`   Transaction: ${receipt.hash}`);
        
        return {
            success: true,
            transactionHash: receipt.hash,
            amount: amount,
            userAddress: userAddress,
            chainId: chainId
        };
    } catch (error) {
        console.error(`❌ BRICS mint failed: ${error.message}`);
        throw error;
    }
}

/**
 * Burn BRICS tokens from a user address
 */
async function burnBRICSTokens(userAddress, amount, chainId) {
    try {
        console.log(`🔥 Burning ${amount} BRICS tokens from ${userAddress} on chain ${chainId}`);
        
        const contract = getBRICSContract(chainId);
        const amountInWei = ethers.parseUnits(amount.toString(), 6); // BRICS has 6 decimals
        
        const tx = await contract.burn(userAddress, amountInWei);
        const receipt = await tx.wait();
        
        console.log(`✅ BRICS burned successfully: ${amount} from ${userAddress}`);
        console.log(`   Transaction: ${receipt.hash}`);
        
        return {
            success: true,
            transactionHash: receipt.hash,
            amount: amount,
            userAddress: userAddress,
            chainId: chainId
        };
    } catch (error) {
        console.error(`❌ BRICS burn failed: ${error.message}`);
        throw error;
    }
}

/**
 * Get BRICS balance for a user address
 */
async function getBRICSBalance(userAddress, chainId) {
    try {
        const contract = getBRICSContract(chainId);
        const balance = await contract.balanceOf(userAddress);
        return parseFloat(ethers.formatUnits(balance, 6)); // BRICS has 6 decimals
    } catch (error) {
        console.error(`❌ Failed to get BRICS balance: ${error.message}`);
        return 0;
    }
}

/**
 * Verify BRICS contract configuration
 */
async function verifyBRICSContract(chainId) {
    try {
        const contract = getBRICSContract(chainId);
        
        // Test basic contract functions
        const totalSupply = await contract.totalSupply();
        const decimals = await contract.decimals();
        const treasuryAddress = await contract.treasuryAddress();
        const owner = await contract.owner();
        
        console.log(`✅ BRICS contract verified on chain ${chainId}:`);
        console.log(`   Total Supply: ${ethers.formatUnits(totalSupply, 6)} BRICS`);
        console.log(`   Decimals: ${decimals}`);
        console.log(`   Treasury: ${treasuryAddress}`);
        console.log(`   Owner: ${owner}`);
        
        return {
            success: true,
            totalSupply: parseFloat(ethers.formatUnits(totalSupply, 6)),
            decimals: decimals,
            treasuryAddress: treasuryAddress,
            owner: owner
        };
    } catch (error) {
        console.error(`❌ BRICS contract verification failed: ${error.message}`);
        return {
            success: false,
            error: error.message
        };
    }
}

export {
    getBRICSContract,
    mintBRICSTokens,
    burnBRICSTokens,
    getBRICSBalance,
    verifyBRICSContract,
    BRICS_CONTRACT_ADDRESSES
};
