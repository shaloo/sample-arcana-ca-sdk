import { useState, useEffect } from 'react';
import reactLogo from './assets/react.svg';
import viteLogo from '/vite.svg';
import './style.css';
import './App.css';
import { listTokenContracts, supportedChainsId } from './utils/chains';
import { CA } from '@arcana/ca-sdk';

// Initialize CA SDK
const ca = new CA();

// Chain ID to name mapping for display
const chainNames: { [chainId: number]: string } = {
  1: 'Ethereum',
  10: 'Optimism',
  42161: 'Arbitrum',
  43114: 'Avalanche',
  137: 'Polygon',
  534352: 'Scroll',
  59144: 'Linea',
  8453: 'Base',
};

// NEW: Unlimited allowance set to 'unlimited' string
const UNLIMITED_ALLOWANCE = 'unlimited';

function App() {
  const [count, setCount] = useState(0);
  const [address, setAddress] = useState<string | null>(null);
  const [unifiedBalance, setUnifiedBalance] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [allowanceStatus, setAllowanceStatus] = useState<string | null>(null);
  const [intentStatus, setIntentStatus] = useState<string | null>(null);
  const [showBalancePopup, setShowBalancePopup] = useState(false);
  const [chainBalances, setChainBalances] = useState<
    { chainId: number; balance: string; tokens: { [asset: string]: string } }[]
  >([]);
  const [selectedChainId, setSelectedChainId] = useState<number | null>(null);
  const [showAllowancePopup, setShowAllowancePopup] = useState(false);
  const [allowances, setAllowances] = useState<{ [chainId: number]: string }>(
    supportedChainsId.reduce((acc, chain) => ({
      ...acc,
      [chain.chainId]: UNLIMITED_ALLOWANCE,
    }), {})
  );
  const [hasWalletProvider, setHasWalletProvider] = useState<boolean>(false);

  // Check for wallet provider on mount
  useEffect(() => {
    if (window.ethereum) {
      setHasWalletProvider(true);
    } else {
      setError('No wallet provider detected. Please install MetaMask or another wallet.');
    }
  }, []);

  // NEW: Updated initializeCA to use supportedChainsId and 'coral' network
  const initializeCA = async () => {
    if (!window.ethereum) {
      setError('No wallet provider found. Please install MetaMask.');
      return;
    }
    try {
      ca.setEVMProvider(window.ethereum);
      await ca.init({
        chainIds: supportedChainsId.map(chain => chain.chainId),
        network: 'coral', // Use 'coral' for testnet
      });
      setIsInitialized(true);
      setError(null);
    } catch (err) {
      setError('Failed to initialize CA SDK');
      console.error(err);
    }
  };

  // Set up allowance and intent hooks
  useEffect(() => {
    if (isInitialized) {
      // Register allowance hook
      ca.setOnAllowanceHook((response: { status: string; data: any }) => {
        if (response.status === 'success') {
          setAllowanceStatus(`Allowance set successfully: ${response.data.transactionHash || 'Confirmed'}`);
        } else if (response.status === 'error') {
          setAllowanceStatus(`Allowance failed: ${response.data.message || 'Unknown error'}`);
        } else {
          setAllowanceStatus(`Allowance status: ${response.status}`);
        }
        console.log('Allowance hook:', response);
      });

      // Register intent hook for transfer operations
      ca.setOnIntentHook((response: { status: string; data: any }) => {
        if (response.status === 'created') {
          setIntentStatus(`Intent created: ${response.data.intentId || 'Pending'}`);
        } else if (response.status === 'processed') {
          setIntentStatus(`Intent processed: ${response.data.intentId || 'In progress'}`);
        } else if (response.status === 'completed') {
          setIntentStatus(`Intent completed: ${response.data.transactionHash || 'Confirmed'}`);
        } else if (response.status === 'error') {
          setIntentStatus(`Intent failed: ${response.data.message || 'Unknown error'}`);
        } else {
          setIntentStatus(`Intent status: ${response.status}`);
        }
        console.log('Intent hook:', response);
      });

      // No cleanup needed, as hooks persist for app lifecycle
    }
  }, [isInitialized]);

  // Check wallet connection and fetch account
  useEffect(() => {
    async function checkConnection() {
      if (isInitialized && window.ethereum) {
        try {
          const accounts = await window.ethereum.request({ method: 'eth_accounts' });
          if (accounts && accounts.length > 0) {
            setAddress(accounts[0]);
            setIsConnected(true);
          } else {
            setIsConnected(false);
            setAddress(null);
          }
        } catch (err) {
          setError('Failed to check wallet connection');
          console.error(err);
        }
      }
    }
    checkConnection();
  }, [isInitialized]);

  // Fetch unified balance for main UI
  useEffect(() => {
    async function fetchUnifiedBalance() {
      if (isInitialized && isConnected && address) {
        try {
          const balance = await ca.getUnifiedBalance(address);
          const balanceInEth = Number(balance.total) / 1e18;
          setUnifiedBalance(balanceInEth.toFixed(4));
          setError(null);
        } catch (err) {
          setError('Failed to fetch unified balance');
          console.error(err);
        }
      }
    }
    fetchUnifiedBalance();
  }, [isInitialized, isConnected, address]);

  // Handle wallet connection and initialize CA SDK
  const handleConnect = async () => {
    if (!hasWalletProvider || !window.ethereum) {
      setError('No wallet provider found. Please install MetaMask.');
      return;
    }
    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      if (accounts && accounts.length > 0) {
        setAddress(accounts[0]);
        setIsConnected(true);
        await initializeCA();
        setError(null);
      } else {
        setError('No accounts found');
      }
    } catch (err) {
      setError('Wallet connection failed');
      console.error(err);
    }
  };

  // Handle wallet disconnection
  const handleDisconnect = () => {
    setAddress(null);
    setIsConnected(false);
    setUnifiedBalance(null);
    setAllowanceStatus(null);
    setIntentStatus(null);
    setChainBalances([]);
    setSelectedChainId(null);
    setShowBalancePopup(false);
    setShowAllowancePopup(false);
    setAllowances(supportedChainsId.reduce((acc, chain) => ({
      ...acc,
      [chain.chainId]: UNLIMITED_ALLOWANCE,
    }), {}));
    setIsInitialized(false);
    setError(null);
  };

  // Handle show balance
  const handleShowBalance = async () => {
    if (!isInitialized) {
      setError('CA SDK not initialized');
      return;
    }
    if (!isConnected || !address) {
      setError('Please connect your wallet');
      return;
    }
    try {
      const balances = await ca.getUnifiedBalances(address);
      setChainBalances(balances);
      setSelectedChainId(balances[0]?.chainId || null);
      setShowBalancePopup(true);
      setError(null);
    } catch (err) {
      setError('Failed to fetch unified balances');
      console.error(err);
    }
  };

  // Format balance based on asset
  const formatBalance = (asset: string, balance: string): string => {
    const value = Number(balance);
    if (asset === 'ETH') {
      return (value / 1e18).toFixed(4); // ETH: 18 decimals
    } else if (asset === 'USDC' || asset === 'USDT') {
      return (value / 1e6).toFixed(2); // USDC/USDT: 6 decimals
    }
    return value.toFixed(4); // Fallback
  };

  // Close balance popup
  const closeBalancePopup = () => {
    setShowBalancePopup(false);
    setChainBalances([]);
    setSelectedChainId(null);
  };

  // Handle allowance popup
  const handleSetAllowance = () => {
    if (!isInitialized) {
      setError('CA SDK not initialized');
      return;
    }
    if (!isConnected || !address) {
      setError('Please connect your wallet');
      return;
    }
    setShowAllowancePopup(true);
    setError(null);
  };

  // Handle allowance input change
  const handleAllowanceChange = (chainId: number, value: string) => {
    setAllowances((prev) => ({
      ...prev,
      [chainId]: value,
    }));
  };

  // Set all allowances to unlimited
  const setAllUnlimited = () => {
    setAllowances(supportedChainsId.reduce((acc, chain) => ({
      ...acc,
      [chain.chainId]: UNLIMITED_ALLOWANCE,
    }), {}));
  };

  // Set all allowances to a specific amount
  const setAllAmount = () => {
    const amount = prompt('Enter allowance amount in gwei (non-zero):');
    if (amount && Number(amount) > 0) {
      setAllowances(supportedChainsId.reduce((acc, chain) => ({
        ...acc,
        [chain.chainId]: amount,
      }), {}));
    } else {
      alert('Please enter a valid non-zero amount');
    }
  };

  // Clear all allowances
  const clearAllAllowances = () => {
    setAllowances(supportedChainsId.reduce((acc, chain) => ({
      ...acc,
      [chain.chainId]: '0',
    }), {}));
  };

  // MODIFIED: Handle 'unlimited' in allowance submission
  const submitAllowances = async () => {
    if (!isInitialized) {
      setError('CA SDK not initialized');
      return;
    }
    if (!isConnected || !address) {
      setError('Please connect your wallet');
      return;
    }
    try {
      for (const chain of supportedChainsId) {
        const amountInGwei = allowances[chain.chainId];
        if (!amountInGwei || (amountInGwei !== UNLIMITED_ALLOWANCE && isNaN(Number(amountInGwei)))) continue;
        const tokenAddress = listTokenContracts[chain.chainId]?.USDC;
        if (!tokenAddress) {
          console.warn(`No USDC address for chain ${chain.chainId}`);
          continue;
        }
        const amountInUSDC = amountInGwei === UNLIMITED_ALLOWANCE
          ? '115792089237316195423570985008687907853269984665640564039457584007913129639935' // Max uint256
          : (BigInt(amountInGwei) * BigInt(1000)).toString();
        await ca.allowance({
          tokenAddress,
          spender: '0x0000000000000000000000000000000000000001', // Dummy spender
          amount: amountInUSDC,
          chainId: chain.chainId,
        });
        // Status updates handled by setOnAllowanceHook
      }
      setShowAllowancePopup(false);
      setError(null);
    } catch (err) {
      setError('Failed to set allowances');
      console.error(err);
    }
  };

  // Close allowance popup
  const closeAllowancePopup = () => {
    setShowAllowancePopup(false);
    setAllowances(supportedChainsId.reduce((acc, chain) => ({
      ...acc,
      [chain.chainId]: UNLIMITED_ALLOWANCE,
    }), {}));
  };

  // Handle transfer transaction
  const handleTransfer = async () => {
    if (!isInitialized) {
      setError('CA SDK not initialized');
      return;
    }
    if (!isConnected || !address) {
      setError('Please connect your wallet');
      return;
    }
    try {
      const tokenAddress = listTokenContracts[1].USDC; // USDC on Ethereum
      const recipient = '0x0000000000000000000000000000000000000002'; // Dummy recipient
      const amount = '500000'; // 0.5 USDC (6 decimals)
      await ca.transfer({
        tokenAddress,
        to: recipient,
        amount,
        chainId: 1,
      });
      // Status updates handled by setOnIntentHook
      setError(null);
    } catch (err) {
      setError('Failed to execute transfer');
      console.error(err);
    }
  };

  const TitleSection = () => (
    <h1>CA SDK Sample Integration App</h1>
  );

  const ViteReactSection = () => (
    <div className="app-card">
      <a href="https://vite.dev" target="_blank">
        <img src={viteLogo} className="logo" alt="Vite logo" />
      </a>
      <a href="https://react.dev" target="_blank">
        <img src={reactLogo} className="logo react" alt="React logo" />
      </a>
      <h1>Vite + React</h1>
      <div className="card">
        <button className="app-button" onClick={() => setCount((count) => count + 1)}>
          count is {count}
        </button>
        <p>
          Edit <code>src/App.tsx</code> and save to test HMR
        </p>
      </div>
      <p className="read-the-docs">
        Click on the Vite, React logos to learn more
      </p>
    </div>
  );

  const CASDKSection = () => (
    <div className="app-card">
      <h1>Arcana CA SDK + Vite + React</h1>
      <a href="https://arcana.network" target="_blank">
        <img src="https://avatars.githubusercontent.com/u/82495837" className="logo arcana" alt="Arcana logo" />
      </a>
      <div className="card">
        <p>Uses <a href="https://www.npmjs.com/package/@arcana/ca-sdk">`ca-sdk`</a> SDK</p>
        {!hasWalletProvider ? (
          <>
            <p className="wallet-message">No wallet provider detected. Please install MetaMask or another wallet.</p>
            <button className="app-button" disabled title="Please install a wallet like MetaMask">
              Connect Wallet
            </button>
          </>
        ) : !isConnected || !address ? (
          <>
            <p className="wallet-message">Wallet provider detected. Please connect your wallet.</p>
            <button className="app-button" onClick={handleConnect}>
              Connect Wallet
            </button>
          </>
        ) : !isInitialized ? (
          <p>Initializing CA SDK...</p>
        ) : (
          <>
            <p className="popup-address">
              Connected: <span className="address-text">{address}</span>
            </p>
            <p>Unified Balance: {unifiedBalance ? `${unifiedBalance} ETH` : 'Loading...'}</p>
            <p>Allowance Status: {allowanceStatus || 'No allowance set'}</p>
            <p>Intent Status: {intentStatus || 'No intent'}</p>
            <button className="app-button" onClick={handleDisconnect}>
              Disconnect
            </button>
            <button className="app-button" onClick={handleSetAllowance}>
              Set USDC Allowance
            </button>
            <button className="app-button" onClick={handleTransfer}>
              Transfer USDC
            </button>
            <button className="app-button" onClick={handleShowBalance}>
              Show Balance
            </button>
          </>
        )}
        {error && <p style={{ color: 'red' }}>{error}</p>}
      </div>
      <div className="card arcana-color">
        <p>Plug in CA SDK</p>
        <p className="read-the-docs">
          Click on the Arcana logo to learn more.
        </p>
        <p>
          <a href="https://docs.arcana.network">Developer Docs</a>
        </p>
      </div>

      {/* Balance popup */}
      {showBalancePopup && chainBalances.length > 0 && (
        <>
          <div className="balance-popup-overlay" onClick={closeBalancePopup}></div>
          <div className="balance-popup">
            <h2>Chain Balances</h2>
            <select
              value={selectedChainId ?? ''}
              onChange={(e) => setSelectedChainId(Number(e.target.value) || null)}
            >
              <option value="" disabled>Select a chain</option>
              {chainBalances.map((chain) => (
                <option key={chain.chainId} value={chain.chainId}>
                  {chainNames[chain.chainId] || `Chain ${chain.chainId}`}
                </option>
              ))}
            </select>
            {selectedChainId && (
              <ul>
                {(() => {
                  const chain = chainBalances.find((c) => c.chainId === selectedChainId);
                  if (!chain) return <li>No balances available</li>;
                  return (
                    <>
                      <li>ETH: {formatBalance('ETH', chain.balance)} ETH</li>
                      {Object.entries(chain.tokens || {}).map(([asset, balance]) => (
                        <li key={asset}>
                          {asset}: {formatBalance(asset, balance)} {asset}
                        </li>
                      ))}
                    </>
                  );
                })()}
              </ul>
            )}
            <button className="close-button" onClick={closeBalancePopup}>
              Close
            </button>
          </div>
        </>
      )}

      {/* Allowance popup */}
      {showAllowancePopup && (
        <>
          <div className="allowance-popup-overlay" onClick={closeAllowancePopup}></div>
          <div className="allowance-popup">
            <h2>Set USDC Allowances</h2>
            <ul>
              {supportedChainsId.map((chain) => (
                <li key={chain.chainId}>
                  <label>{chainNames[chain.chainId] || `Chain ${chain.chainId}`}</label>
                  <input
                    type="text"
                    value={allowances[chain.chainId]}
                    onChange={(e) => handleAllowanceChange(chain.chainId, e.target.value)}
                    placeholder="Amount in gwei or 'unlimited'"
                  />
                </li>
              ))}
            </ul>
            <div className="button-group">
              <button className="action-button" onClick={setAllUnlimited}>
                Set All Unlimited
              </button>
              <button className="action-button" onClick={setAllAmount}>
                Set All Amount
              </button>
              <button className="action-button" onClick={clearAllAllowances}>
                Clear All
              </button>
            </div>
            <div className="button-group">
              <button className="cancel-button" onClick={closeAllowancePopup}>
                Cancel
              </button>
              <button className="submit-button" onClick={submitAllowances}>
                Submit
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );

  return (
    <>
      <TitleSection />
      <div className="container">
        <ViteReactSection />
        <CASDKSection />
      </div>
    </>
  );
}

export default App;