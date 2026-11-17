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
  url: 'https://limfxc.vercel.app',
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

const walletDebug = new URLSearchParams(location.search).has('walletdebug');
let walletDebugPanel;
if (walletDebug) {
  walletDebugPanel = document.createElement('pre');
  walletDebugPanel.id = 'limfx-wallet-debug';
  walletDebugPanel.style.cssText = 'position:fixed;z-index:2147483647;left:8px;right:8px;bottom:8px;max-height:35vh;overflow:auto;background:#090711;color:#d8c8ff;border:1px solid #a98cff;padding:10px;border-radius:9px;font:11px monospace;white-space:pre-wrap';
  walletDebugPanel.textContent = 'LIMFXAI WALLET DEBUG\nInitialized; waiting for AppKit events...';
  if (document.body) document.body.append(walletDebugPanel); else document.addEventListener('DOMContentLoaded', () => document.body.append(walletDebugPanel));
}
const walletDebugLog = (label, detail = '') => {
  console.info('[LIMFXAI][WALLET]', label, detail);
  if (walletDebugPanel) {
    walletDebugPanel.textContent += '\n' + label + (detail ? ': ' + detail : '');
    walletDebugPanel.textContent = walletDebugPanel.textContent.split('\n').slice(-14).join('\n');
  }
};
appKit.subscribeEvents(event => {
  const message = event?.data?.message || event?.data?.error?.message || event?.properties?.message || event?.error?.message || '';
  walletDebugLog(event?.type || 'APPKIT_EVENT', String(message).slice(0, 180));
});
window.addEventListener('unhandledrejection', event => walletDebugLog('UNHANDLED_REJECTION', event.reason?.message || String(event.reason).slice(0, 180)));
window.addEventListener('error', event => walletDebugLog('WINDOW_ERROR', event.message));

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
