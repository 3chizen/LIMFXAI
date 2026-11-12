import { createAppKit } from '@reown/appkit';
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';
import { mainnet, bsc, base, arbitrum } from '@reown/appkit/networks';

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

    const connectorId =
      appKit.getWalletProviderType() === 'WALLET_CONNECT'
        ? 'walletConnect'
        : undefined;

    const result = await wagmiAdapter.signMessage({
      message,
      address,
      provider,
      caipNetworkId,
      connectorId
    });

    return result.signature;
  }
};

console.info('[LIMFXAI] Reown AppKit initialized');
