import { createAppKit } from '@reown/appkit';
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';
import { mainnet, bsc, base, arbitrum } from '@reown/appkit/networks';
import { VersionedTransaction } from '@solana/web3.js';

window.LIMFXAISolana = Object.freeze({
  deserializeTransaction: encoded => VersionedTransaction.deserialize(Uint8Array.from(atob(encoded), c => c.charCodeAt(0)))
});

const projectId = '5181eb936484e19eab8ff1179e2d123e';
const networks = [mainnet, bsc, base, arbitrum];

const metadata = {
  name: 'LIMFXAI',
  description: 'LIMFXAI Web3 Intelligence Dashboard',
  url: 'https://limfxai-agent-engine.500ccshikazukiru.workers.dev',
  icons: []
};

const wagmiAdapter = new WagmiAdapter({ projectId, networks });

const appKit = createAppKit({
  adapters: [wagmiAdapter],
  networks,
  metadata,
  projectId,
  features: {
    analytics: false,
    email: false,
    socials: []
  }
});

window.LIMFXAIWallet = {
  open: () => appKit.open(),
  disconnect: () => appKit.disconnect(),

  getAddress: () => appKit.getAddress(),
  getChainId: () => appKit.getChainId(),
  getCaipNetworkId: () => appKit.getCaipNetworkId(),
  getProvider: () => appKit.getWalletProvider(),
  getProviderType: () => appKit.getWalletProviderType(),

  subscribeAccount: callback =>
    appKit.subscribeAccount(callback),

  subscribeNetwork: callback =>
    appKit.subscribeNetwork(callback),

  signMessage: async (message, address, caipNetworkId) => {
    const provider = appKit.getWalletProvider();

    if (!provider) {
      throw new Error('Reown wallet provider unavailable');
    }

    caipNetworkId = typeof caipNetworkId === 'number' ? 'eip155:' + caipNetworkId : caipNetworkId;

    const connectorId =
      ['WALLET_CONNECT', 'WALLETCONNECT'].includes(appKit.getWalletProviderType())
        ? 'walletConnect'
        : undefined;

    try {
      const result = await wagmiAdapter.signMessage({
        message,
        address,
        provider,
        caipNetworkId,
        connectorId
      });
      return result.signature;
    } catch (error) {
      throw new Error("LIMFXAI diagnostic: " + JSON.stringify({
        providerType: appKit.getWalletProviderType(),
        connectorId,
        caipNetworkId,
        chainId: appKit.getChainId(),
        errorName: error?.name,
        errorMessage: error?.message,
        cause: error?.cause?.message
      }));
    }
  }
};

console.info('[LIMFXAI] Reown AppKit initialized');
