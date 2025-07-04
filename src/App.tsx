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

// Add type for token balances
type TokenBalance = {
  symbol: string;
  icon?: string;
  balance: string;
  balanceInFiat: number;
  decimals: number;
  breakdown?: { chainId: number; balance: string; balanceInFiat?: number }[];
};

// Add a type guard for window.ethereum
function hasEthereum(windowObj: Window & typeof globalThis): windowObj is Window & typeof globalThis & { ethereum: unknown } {
  return 'ethereum' in windowObj;
}

// Add type for the getUnifiedBalances response
interface UnifiedBalancesResponse {
  ethBalance?: TokenBalance;
  usdcBalance?: TokenBalance;
  usdtBalance?: TokenBalance;
  totalBalances?: TokenBalance[];
  [key: string]: any;
}

function App() {
  const [count, setCount] = useState(0);
  const [address, setAddress] = useState<string | null>(null);
  const [unifiedBalance, setUnifiedBalance] = useState<{
    totalFiat: number;
    individualBalances: TokenBalance[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [allowanceStatus, setAllowanceStatus] = useState<string | null>(null);
  const [intentStatus, setIntentStatus] = useState<string | null>(null);
  const [showBalancePopup, setShowBalancePopup] = useState(false);
  const [chainBalances, setChainBalances] = useState<{
    totalFiat: number;
    tokens: TokenBalance[];
  } | null>(null);
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
    if (hasEthereum(window)) {
      setHasWalletProvider(true);
    } else {
      setError('No wallet provider detected. Please install MetaMask or another wallet.');
    }
  }, []);

  // Initialize CA SDK
  const initializeCA = async () => {
    if (!hasEthereum(window)) {
      setError('No wallet provider found. Please install MetaMask.');
      return;
    }
    try {
      ca.setEVMProvider((window as { ethereum?: any }).ethereum);
      await ca.init();
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
      ca.setOnAllowanceHook((response: unknown) => {
        const res = response as { status: string; data: unknown };
        if (res.status === 'success') {
          setAllowanceStatus(`Allowance set successfully: ${(res.data as Record<string, unknown>)?.transactionHash || 'Confirmed'}`);
        } else if (res.status === 'error') {
          setAllowanceStatus(`Allowance failed: ${(res.data as Record<string, unknown>)?.message || 'Unknown error'}`);
        } else {
          setAllowanceStatus(`Allowance status: ${res.status}`);
        }
        console.log('Allowance hook:', res);
      });

      ca.setOnIntentHook((response: unknown) => {
        const res = response as { status: 'created' | 'processed' | 'completed' | 'error'; data: unknown };
        const { status, data } = res;
        if (status === 'created') {
          setIntentStatus(`Intent created: ${(data as Record<string, unknown>)?.intentId || 'Pending'}`);
        } else if (status === 'processed') {
          setIntentStatus(`Intent processing: ${(data as Record<string, unknown>)?.intentId || 'In progress'}`);
        } else if (status === 'completed') {
          setIntentStatus(`Intent completed: ${(data as Record<string, unknown>)?.transactionHash || 'Confirmed'}`);
        } else if (status === 'error') {
          setIntentStatus(`Intent failed: ${(data as Record<string, unknown>)?.message || 'Unknown error'}`);
        }
        console.log('Intent hook:', res);
      });
    }
  }, [isInitialized]);

  // Check wallet connection and fetch account
  useEffect(() => {
    async function checkConnection() {
      if (isInitialized && hasEthereum(window)) {
        try {
          const accounts = await (window as { ethereum?: any }).ethereum.request({ method: 'eth_accounts' });
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
          const balances: UnifiedBalancesResponse = await ca.getUnifiedBalances();
          // Aggregate total fiat balance from totalBalances array
          let totalFiat = 0;
          let individualBalances: TokenBalance[] = [];
          if (Array.isArray(balances.totalBalances)) {
            totalFiat = (balances.totalBalances as TokenBalance[]).reduce((sum: number, token: TokenBalance) => {
              return sum + (typeof token.balanceInFiat === 'number' ? token.balanceInFiat : 0);
            }, 0);
            individualBalances = balances.totalBalances as TokenBalance[];
          } else {
            // Fallback: sum from known keys
            const keys = ['ethBalance', 'usdcBalance', 'usdtBalance'];
            individualBalances = keys.map((key) => balances[key] as TokenBalance).filter(Boolean);
            totalFiat = individualBalances.reduce((sum: number, token: TokenBalance) => {
              return sum + (typeof token.balanceInFiat === 'number' ? token.balanceInFiat : 0);
            }, 0);
          }
          setUnifiedBalance({
            totalFiat,
            individualBalances,
          });
          setError(null);
        } catch (err) {
          setUnifiedBalance(null);
          setError('Failed to fetch total unified balance');
          console.error('getUnifiedBalances error:', err);
        }
      }
    }
    fetchUnifiedBalance();
  }, [isInitialized, isConnected, address]);

  // Handle wallet connection
  const handleConnect = async () => {
    if (!hasWalletProvider || !hasEthereum(window)) {
      setError('No wallet provider found. Please install MetaMask.');
      return;
    }
    try {
      const accounts = await (window as { ethereum?: any }).ethereum.request({ method: 'eth_requestAccounts' });
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
      let balances: any = await ca.getUnifiedBalances();
      // If SDK ever returns an array, wrap it
      if (Array.isArray(balances)) {
        balances = { totalBalances: balances };
      }
      if (Array.isArray(balances.totalBalances)) {
        const totalFiat = balances.totalBalances.reduce(
          (sum: number, token: TokenBalance) => sum + (typeof token.balanceInFiat === 'number' ? token.balanceInFiat : 0),
          0
        );
        setChainBalances({
          totalFiat,
          tokens: balances.totalBalances,
        });
        setShowBalancePopup(true);
      } else {
        setChainBalances({
          totalFiat: 0,
          tokens: [],
        });
      }
      setError(null);
    } catch (err) {
      setError('Failed to fetch balances');
      console.error('Balance fetch error:', err);
    }
  };

  // Close balance popup
  const closeBalancePopup = () => {
    setShowBalancePopup(false);
    setChainBalances(null);
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

  // Comment out handleTransfer, handleBridge, handleRequest and their buttons in the UI
  // const handleTransfer = async () => {
  //   if (!isInitialized) {
  //     setError('CA SDK not initialized');
  //     return;
  //   }
  //   if (!isConnected || !isValidAddress(address)) {
  //     setError('Please connect a valid wallet');
  //     return;
  //   }
  //   try {
  //     const tokenAddress = listTokenContracts[1]?.USDC;
  //     if (!tokenAddress) {
  //       throw new Error('USDC address not found for chain 1');
  //     }
  //     const recipient = '0x0000000000000000000000000000000000000002'; // Dummy recipient
  //     const amount = '500000'; // 0.5 USDC (6 decimals)
  //     await ca.transfer({
  //       tokenAddress,
  //       to: recipient,
  //       amount,
  //       chainId: 1,
  //     });
  //     setError(null);
  //   } catch (err) {
  //     setError('Failed to execute transfer');
  //     console.error(err);
  //   }
  // };

  // const handleBridge = async () => {
  //   if (!isInitialized) {
  //     setError('CA SDK not initialized');
  //     return;
  //   }
  //   if (!isConnected || !isValidAddress(address)) {
  //     setError('Please connect a valid wallet');
  //     return;
  //   }
  //   try {
  //     const tokenAddress = listTokenContracts[1]?.USDC;
  //     if (!tokenAddress) {
  //       throw new Error('USDC address not found for chain 1');
  //     }
  //     const amount = '500000'; // 0.5 USDC (6 decimals)
  //     await ca.bridge({
  //       tokenAddress,
  //       amount,
  //       fromChainId: 1,
  //       toChainId: 137,
  //     });
  //     setError(null);
  //   } catch (err) {
  //     setError('Failed to execute bridge');
  //     console.error(err);
  //   }
  // };

  // const handleRequest = async () => {
  //   if (!isInitialized) {
  //     setError('CA SDK not initialized');
  //     return;
  //   }
  //   if (!isConnected || !isValidAddress(address)) {
  //     setError('Please connect a valid wallet');
  //     return;
  //   }
  //   try {
  //     await ca.request({
  //       method: 'eth_sendTransaction',
  //       params: [{
  //         from: address,
  //         to: '0x0000000000000000000000000000000000000002', // Dummy recipient
  //         value: '10000000000000000', // 0.01 ETH in wei
  //         chainId: 1,
  //       }],
  //     });
  //     setError(null);
  //   } catch (err) {
  //     setError('Failed to execute request');
  //     console.error(err);
  //   }
  // };

  function formatTokenBalance(balance: string, decimals: number): string {
    const value = Number(balance) / Math.pow(10, decimals);
    return value.toLocaleString(undefined, { maximumFractionDigits: 6 });
  }

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
            <p>Total Unified Balance: {unifiedBalance ? `$${unifiedBalance.totalFiat.toFixed(2)} USD` : 'Loading...'}</p>
            {unifiedBalance && (
              <div style={{ marginBottom: '1em' }}>
                <strong>Token Balances:</strong>
                <ul style={{ listStyle: 'none', paddingLeft: 0 }}>
                  {unifiedBalance.individualBalances.map((token, idx) => (
                    <li key={token.symbol + '-' + token.decimals + '-' + idx} style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
                      {token.icon && (
                        <img src={token.icon} alt={token.symbol} style={{ width: 20, height: 20, marginRight: 8 }} />
                      )}
                      <span style={{ fontWeight: 500 }}>{token.symbol}:</span>
                      <span style={{ marginLeft: 6 }}>{formatTokenBalance(token.balance, token.decimals)}</span>
                      <span style={{ marginLeft: 6, color: '#888' }}>
                        (${typeof token.balanceInFiat === 'number' ? token.balanceInFiat.toFixed(2) : '0.00'})
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <p>Allowance Status: {allowanceStatus || 'No allowance set'}</p>
            <p>Intent Status: {intentStatus || 'No intent'}</p>
            <button className="app-button" onClick={handleDisconnect}>
              Disconnect
            </button>
            <button className="app-button" onClick={handleSetAllowance}>
              Set USDC Allowance
            </button>
            {/* <button className="app-button" onClick={handleTransfer}>Transfer USDC</button>
            <button className="app-button" onClick={handleBridge}>Bridge USDC</button>
            <button className="app-button" onClick={handleRequest}>Request ETH Transfer</button> */}
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

      {showBalancePopup && chainBalances && Array.isArray(chainBalances.tokens) && (
        <>
          <div className="balance-popup-overlay" onClick={closeBalancePopup}></div>
          <div className="balance-popup">
            <h2>Total Unified Balance</h2>
            <p>
              <strong>${chainBalances.tokens.reduce((sum, token) => sum + (token.balanceInFiat || 0), 0).toFixed(2)} USD</strong>
            </p>
            <div style={{ marginBottom: '1em' }}>
              <strong>Per-Chain Balances:</strong>
              <ul style={{ listStyle: 'none', paddingLeft: 0 }}>
                {(() => {
                  // Build a map: chainId -> [{ symbol, icon, balance, decimals }]
                  const chainMap: { [chainId: number]: { symbol: string, icon?: string, balance: string, decimals: number }[] } = {};
                  chainBalances.tokens.forEach(token => {
                    if (Array.isArray(token.breakdown)) {
                      token.breakdown.forEach(b => {
                        if (!chainMap[b.chainId]) chainMap[b.chainId] = [];
                        chainMap[b.chainId].push({
                          symbol: token.symbol,
                          icon: token.icon,
                          balance: b.balance,
                          decimals: token.decimals,
                        });
                      });
                    }
                  });
                  // Render
                  return Object.entries(chainMap).map(([chainId, tokens]) => (
                    <li key={chainId}>
                      <strong>{chainNames[Number(chainId)] || `Chain ${chainId}`}</strong>:
                      {tokens.map((t, i) => (
                        <span key={t.symbol + i} style={{ marginLeft: 8 }}>
                          {t.icon && <img src={t.icon} alt={t.symbol} style={{ width: 16, height: 16, marginRight: 4, verticalAlign: 'middle' }} />}
                          {t.symbol}: {(Number(t.balance) / Math.pow(10, t.decimals)).toLocaleString(undefined, { maximumFractionDigits: 6 })}
                        </span>
                      ))}
                    </li>
                  ));
                })()}
              </ul>
            </div>
            <button className="close-button" onClick={closeBalancePopup}>
              Close
            </button>
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