export default async (req, res) => {
  const chainId = req.query.chainId;
  const RPC_ENDPOINTS = {
    1: process.env.INFURA_MAINNET_RPC,
    8453: 'https://mainnet.base.org',
    10: 'https://mainnet.optimism.io',
    42161: 'https://arb1.arbitrum.io/rpc',
    11155111: process.env.SEPOLIA_RPC_URL,
  };
  res.status(200).json({ rpcUrl: RPC_ENDPOINTS[chainId] || '' });
};