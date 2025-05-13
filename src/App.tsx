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

// Unlimited allowance
const UNLIMITED_ALLOWANCE = 'unlimited';

// Address validation regex
const isValidAddress = (address: string | null): address is string => {
  return !!address && /^0x[a-fA-F0-9]{40}$/.test(address);
};

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
  const [chainBalances, setChainBalances] = useState<{
    total: { balance: { eth: string; usdt: string; usdc: string }; balanceInFiat: number };
    tokens: { eth: string; usdt: string; usdc: string };
    breakup: Array<{ chainId: number; balance: string; tokens: { [asset: string]: string } }>;
  } | null>(null);
  const [showAllowancePopup, setShowAllowancePopup] = useState(false);
  const [allowances, setAllowances] = useState<{ [chainId: number]: string }>(
    supportedChainsId.reduce((acc, chain) => ({
      ...acc,
      [chain.chainId]: UNLIMITED_ALLOWANCE,
    }), {})
  );
  const [hasWalletProvider, setHasWalletProvider] = useState<boolean>(false);
  const [dropdownOpen, setDropdownOpen] = useState<{ [token: string]: boolean }>({
    eth: false,
    usdt: false,
    usdc: false,
  });

  // Check for wallet provider on mount
  useEffect(() => {
    if (window.ethereum) {
      setHasWalletProvider(true);
    } else {
      setError('No wallet provider detected. Please install MetaMask or another wallet.');
    }
  }, []);

  // Initialize CA SDK
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

      ca.setOnIntentHook((response: { status: 'created' | 'processed' | 'completed' | 'error'; data: { intentId?: string; transactionHash?: string; message?: string } }) => {
        const { status, data } = response;
        if (status === 'created') {
          setIntentStatus(`Intent created: ${data.intentId || 'Pending'}`);
        } else if (status === 'processed') {
          setIntentStatus(`Intent processing: ${data.intentId || 'In progress'}`);
        } else if (status === 'completed') {
          setIntentStatus(`Intent completed: ${data.transactionHash || 'Confirmed'}`);
        } else if (status === 'error') {
          setIntentStatus(`Intent failed: ${data.message || 'Unknown error'}`);
        }
        console.log('Intent hook:', response);
      });
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

  // Fetch unified balance
  useEffect(() => {
    async function fetchUnifiedBalance() {
      if (isInitialized && isConnected && isValidAddress(address)) {
        try {
          const balances = await ca.getUnifiedBalances();
          if (balances && typeof balances.balanceInFiat === 'number') {
            setUnifiedBalance(`$${balances.balanceInFiat.toFixed(2)} USD`);
          } else {
            console.warn('getUnifiedBalances returned invalid response:', balances);
            setUnifiedBalance('$0.00 USD');
          }
          setError(null);
        } catch (err) {
          setError('Failed to fetch total unified balance');
          console.error('getUnifiedBalances error:', err);
        }
      }
    }
    fetchUnifiedBalance();
  }, [isInitialized, isConnected, address]);

  // Handle wallet connection
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
    setChainBalances(null);
    setShowBalancePopup(false);
    setShowAllowancePopup(false);
    setAllowances(supportedChainsId.reduce((acc, chain) => ({
      ...acc,
      [chain.chainId]: UNLIMITED_ALLOWANCE,
    }), {}));
    setIsInitialized(false);
    setError(null);
    setDropdownOpen({ eth: false, usdt: false, usdc: false });
  };

  // Handle show balance
  const handleShowBalance = async () => {
    if (!isInitialized) {
      setError('CA SDK not initialized');
      return;
    }
    if (!isConnected || !isValidAddress(address)) {
      setError('Please connect a valid wallet');
      return;
    }
    try {
      const totalBalances = await ca.getUnifiedBalances();
      const ethBalance = await ca.getUnifiedBalance("eth");
      const usdtBalance = await ca.getUnifiedBalance("usdt");
      const usdcBalance = await ca.getUnifiedBalance("usdc");

      if (
        totalBalances &&
        typeof totalBalances.balance === 'object' &&
        'eth' in totalBalances.balance &&
        'usdt' in totalBalances.balance &&
        'usdc' in totalBalances.balance &&
        typeof totalBalances.balanceInFiat === 'number' &&
        Array.isArray(totalBalances.breakup) &&
        typeof ethBalance === 'string' &&
        typeof usdtBalance === 'string' &&
        typeof usdcBalance === 'string'
      ) {
        setChainBalances({
          total: {
            balance: totalBalances.balance,
            balanceInFiat: totalBalances.balanceInFiat,
          },
          tokens: {
            eth: ethBalance,
            usdt: usdtBalance,
            usdc: usdcBalance,
          },
          breakup: totalBalances.breakup,
        });
        setShowBalancePopup(true);
      } else {
        console.warn('Invalid balance responses:', { totalBalances, ethBalance, usdtBalance, usdcBalance });
        setChainBalances({
          total: { balance: { eth: '0', usdt: '0', usdc: '0' }, balanceInFiat: 0 },
          tokens: { eth: '0', usdt: '0', usdc: '0' },
          breakup: [],
        });
      }
      setError(null);
    } catch (err) {
      setError('Failed to fetch balances');
      console.error('Balance fetch error:', err);
    }
  };

  // Format balance based on asset
  const formatBalance = (asset: string, balance: string): string => {
    const value = Number(balance);
    if (asset.toLowerCase() === 'eth') {
      return (value / 1e18).toFixed(4); // ETH: 18 decimals
    } else if (asset.toLowerCase() === 'usdc' || asset.toLowerCase() === 'usdt') {
      return (value / 1e6).toFixed(2); // USDC/USDT: 6 decimals
    }
    return value.toFixed(4); // Fallback
  };

  // Toggle dropdown visibility
  const toggleDropdown = (token: string) => {
    setDropdownOpen((prev) => ({
      ...prev,
      [token]: !prev[token],
    }));
  };

  // Close balance popup
  const closeBalancePopup = () => {
    setShowBalancePopup(false);
    setChainBalances(null);
    setDropdownOpen({ eth: false, usdt: false, usdc: false });
  };

  // Handle allowance popup
  const handleSetAllowance = () => {
    if (!isInitialized) {
      setError('CA SDK not initialized');
      return;
    }
    if (!isConnected || !isValidAddress(address)) {
      setError('Please connect a valid wallet');
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

  // Handle allowance submission
  const submitAllowances = async () => {
    if (!isInitialized) {
      setError('CA SDK not initialized');
      return;
    }
    if (!isConnected || !isValidAddress(address)) {
      setError('Please connect a valid wallet');
      return;
    }
    try {
      for (const chain of supportedChainsId) {
        const amountInGwei = allowances[chain.chainId];
        if (!amountInGwei || (amountInGwei !== UNLIMITED_ALLOWANCE && isNaN(Number(amountInGwei)))) continue;
        // FIX: Corrected syntax for optional chaining
        const tokenAddress = listTokenContracts[chain.chainId]?.USDC;
        if (!tokenAddress) {
          console.warn(`No USDC address for chain ${chain.chainId}`);
          continue;
        }
        const amountInUSDC = amountInGwei === UNLIMITED_ALLOWANCE
          ? '115792089237316195423570985008687907853269984665640564039457584007913129639935'
          : (BigInt(amountInGwei) * BigInt(1000)).toString();
        await ca.allowance({
          tokenAddress,
          spender: '0x0000000000000000000000000000000000000001', // Dummy spender
          amount: amountInUSDC,
          chainId: chain.chainId,
        });
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

  // Handle transfer
  const handleTransfer = async () => {
    if (!isInitialized) {
      setError('CA SDK not initialized');
      return;
    }
    if (!isConnected || !isValidAddress(address)) {
      setError('Please connect a valid wallet');
      return;
    }
    try {
      const tokenAddress = listTokenContracts[1]?.USDC;
      if (!tokenAddress) {
        throw new Error('USDC address not found for chain 1');
      }
      const recipient = '0x0000000000000000000000000000000000000002'; // Dummy recipient
      const amount = '500000'; // 0.5 USDC (6 decimals)
      await ca.transfer({
        tokenAddress,
        to: recipient,
        amount,
        chainId: 1,
      });
      setError(null);
    } catch (err) {
      setError('Failed to execute transfer');
      console.error(err);
    }
  };

  // Handle bridge
  const handleBridge = async () => {
    if (!isInitialized) {
      setError('CA SDK not initialized');
      return;
    }
    if (!isConnected || !isValidAddress(address)) {
      setError('Please connect a valid wallet');
      return;
    }
    try {
      const tokenAddress = listTokenContracts[1]?.USDC;
      if (!tokenAddress) {
        throw new Error('USDC address not found for chain 1');
      }
      const amount = '500000'; // 0.5 USDC (6 decimals)
      await ca.bridge({
        tokenAddress,
        amount,
        fromChainId: 1,
        toChainId: 137,
      });
      setError(null);
    } catch (err) {
      setError('Failed to execute bridge');
      console.error(err);
    }
  };

  // Handle request
  const handleRequest = async () => {
    if (!isInitialized) {
      setError('CA SDK not initialized');
      return;
    }
    if (!isConnected || !isValidAddress(address)) {
      setError('Please connect a valid wallet');
      return;
    }
    try {
      await ca.request({
        method: 'eth_sendTransaction',
        params: [{
          from: address,
          to: '0x0000000000000000000000000000000000000002', // Dummy recipient
          value: '10000000000000000', // 0.01 ETH in wei
          chainId: 1,
        }],
      });
      setError(null);
    } catch (err) {
      setError('Failed to execute request');
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
        ) : !isConnected || !isValidAddress(address) ? (
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
            <p>Total Unified Balance: {unifiedBalance || 'Loading...'}</p>
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
            <button className="app-button" onClick={handleBridge}>
              Bridge USDC
            </button>
            <button className="app-button" onClick={handleRequest}>
              Request ETH Transfer
            </button>
            <button className="app-button" onClick={handleShowBalance}>
              Show Balances
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

      {showBalancePopup && chainBalances && (
        <>
          <div className="balance-popup-overlay" onClick={closeBalancePopup}></div>
          <div className="balance-popup">
            <h2>Total Balances</h2>
            <p>
              Total Unified Balance: ${chainBalances.total.balanceInFiat.toFixed(2)} USD
            </p>
            <p>
              Token Breakdown:{' '}
              {formatBalance('eth', chainBalances.total.balance.eth)} ETH +{' '}
              {formatBalance('usdt', chainBalances.total.balance.usdt)} USDT +{' '}
              {formatBalance('usdc', chainBalances.total.balance.usdc)} USDC
            </p>
            <ul>
              <li>
                ETH: {formatBalance('eth', chainBalances.tokens.eth)} ETH
                <button
                  className="app-button"
                  style={{ marginLeft: '10px', padding: '5px 10px' }}
                  onClick={() => toggleDropdown('eth')}
                >
                  {dropdownOpen.eth ? 'Hide Chains' : 'Show Chains'}
                </button>
                {dropdownOpen.eth && (
                  <ul style={{ marginTop: '5px', paddingLeft: '20px' }}>
                    {chainBalances.breakup
                      .filter((chain) => Number(chain.balance) > 0)
                      .map((chain) => (
                        <li key={chain.chainId}>
                          {chainNames[chain.chainId] || `Chain ${chain.chainId}`}: {formatBalance('eth', chain.balance)} ETH
                        </li>
                      ))}
                  </ul>
                )}
              </li>
              <li>
                USDT: {formatBalance('usdt', chainBalances.tokens.usdt)} USDT
                <button
                  className="app-button"
                  style={{ marginLeft: '10px', padding: '5px 10px' }}
                  onClick={() => toggleDropdown('usdt')}
                >
                  {dropdownOpen.usdt ? 'Hide Chains' : 'Show Chains'}
                </button>
                {dropdownOpen.usdt && (
                  <ul style={{ marginTop: '5px', paddingLeft: '20px' }}>
                    {chainBalances.breakup
                      .filter((chain) => chain.tokens.usdt && Number(chain.tokens.usdt) > 0)
                      .map((chain) => (
                        <li key={chain.chainId}>
                          {chainNames[chain.chainId] || `Chain ${chain.chainId}`}: {formatBalance('usdt', chain.tokens.usdt)} USDT
                        </li>
                      ))}
                  </ul>
                )}
              </li>
              <li>
                USDC: {formatBalance('usdc', chainBalances.tokens.usdc)} USDC
                <button
                  className="app-button"
                  style={{ marginLeft: '10px', padding: '5px 10px' }}
                  onClick={() => toggleDropdown('usdc')}
                >
                  {dropdownOpen.usdc ? 'Hide Chains' : 'Show Chains'}
                </button>
                {dropdownOpen.usdc && (
                  <ul style={{ marginTop: '5px', paddingLeft: '20px' }}>
                    {chainBalances.breakup
                      .filter((chain) => chain.tokens.usdc && Number(chain.tokens.usdc) > 0)
                      .map((chain) => (
                        <li key={chain.chainId}>
                          {chainNames[chain.chainId] || `Chain ${chain.chainId}`}: {formatBalance('usdc', chain.tokens.usdc)} USDC
                        </li>
                      ))}
                  </ul>
                )}
              </li>
            </ul>
            <button className="close-button" onClick={closeBalancePopup}>
              Close
            </button>
          </div>
        </>
      )}

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