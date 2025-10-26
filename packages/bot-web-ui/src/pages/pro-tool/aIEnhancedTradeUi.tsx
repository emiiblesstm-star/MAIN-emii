"use client"
import { useEffect, useRef, useState } from "react"
import { observer } from "mobx-react-lite"
import { motion } from "framer-motion"
import { ArrowUp, Hash, Sigma, Dice5, Brain, Play, Square, AlertCircle, CheckCircle2, RefreshCw } from "lucide-react"
import {
  generateDerivApiInstance,
  V2GetActiveClientId,
  V2GetActiveToken,
} from "@/external/bot-skeleton/services/api/appId"
import { useStore } from "@/hooks/useStore"
import "./aIEnhancedTradeUi.scss"

// AI Trading Types
const aiTradeTypes = {
  evenodd: { name: "Even / Odd AI", icon: Dice5 },
  risefall: { name: "Rise / Fall AI", icon: ArrowUp },
  matchdiff: { name: "Differs AI", icon: Hash },
  digits: { name: "Over / Under AI", icon: Sigma },
}

// Digit Over/Under Subtypes
const digitSubTypes = {
  under8: "Under 8",
  over2: "Over 2",
  u4o5: "Under 4 & Over 5",
  u3o6: "Under 3 & Over 6",
}

// NEW: Martingale Manager Class
class MartingaleManager {
  private baseStake: number
  private multiplier: number
  private currentLevel: number
  private maxLevel: number

  constructor(baseStake: number, multiplier: number, maxLevel: number) {
    this.baseStake = baseStake
    this.multiplier = multiplier
    this.currentLevel = 0
    this.maxLevel = maxLevel
  }

  reset(): void {
    this.currentLevel = 0
  }

  nextStake(): number {
    if (this.currentLevel >= this.maxLevel) {
      return -1
    }

    const stake = this.baseStake * Math.pow(this.multiplier, this.currentLevel)
    this.currentLevel++
    return stake
  }

  getCurrentLevel(): number {
    return this.currentLevel
  }

  getCurrentStake(): number {
    return this.baseStake * Math.pow(this.multiplier, this.currentLevel)
  }

  canContinue(): boolean {
    return this.currentLevel < this.maxLevel
  }
}

// NEW: Recovery Manager Class
class RecoveryManager {
  private recoveryActive = false
  private recoveryAttempts = 0
  private maxRecoveryAttempts = 3
  private originalStrategy = ""
  private originalMarket = ""
  private originalDigit?: number

  constructor(maxRecoveryAttempts = 3) {
    this.maxRecoveryAttempts = maxRecoveryAttempts
  }

  shouldEnterRecovery(originalTradeType: string, lastTradeResult: "win" | "loss", selectedDigit?: number): boolean {
    const allowedRecoveryTypes = ["UNDER8", "OVER2", "DIFFERS"]

    if (lastTradeResult === "loss" && !this.recoveryActive && allowedRecoveryTypes.includes(originalTradeType)) {
      this.recoveryActive = true
      this.recoveryAttempts = 1
      this.originalStrategy = originalTradeType
      this.originalDigit = selectedDigit
      return true
    }
    return false
  }

  getRecoveryMarket(originalTradeType: string, selectedDigit?: number): { type: string; prediction?: number } {
    if (!this.recoveryActive) {
      return { type: originalTradeType }
    }

    let recoveryType = ""
    let prediction: number | undefined

    switch (originalTradeType) {
      case "UNDER8":
        recoveryType = "UNDER5"
        prediction = 5
        break
      case "OVER2":
        recoveryType = "OVER5"
        prediction = 5
        break
      case "DIFFERS":
        // FIXED: Force recovery to use digit over/under instead of differs
        recoveryType = "UNDER5" // Default to UNDER5 for differs recovery
        prediction = 5
        break
      default:
        recoveryType = originalTradeType
    }

    return { type: recoveryType, prediction }
  }

  onRecoveryWin(): void {
    this.reset()
  }

  onRecoveryLoss(): boolean {
    this.recoveryAttempts++

    if (this.recoveryAttempts >= this.maxRecoveryAttempts) {
      this.reset()
      return false
    }
    return true
  }

  reset(): void {
    this.recoveryActive = false
    this.recoveryAttempts = 0
    this.originalStrategy = ""
    this.originalMarket = ""
    this.originalDigit = undefined
  }

  isRecoveryActive(): boolean {
    return this.recoveryActive
  }

  getOriginalStrategy(): string {
    return this.originalStrategy
  }
}

// NEW: Trade Lifecycle Manager
class TradeLifecycleManager {
  private activeContracts: Map<
    string,
    {
      contractId: string
      resolve: () => void
      reject: (error: any) => void
      timeout: NodeJS.Timeout
      startTime: number
    }
  > = new Map()

  private readonly CONTRACT_TIMEOUT_MS = 30000

  waitForContractCompletion(contractId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.cleanupContract(contractId)
        reject(new Error(`Contract ${contractId} timeout after ${this.CONTRACT_TIMEOUT_MS}ms`))
      }, this.CONTRACT_TIMEOUT_MS)

      this.activeContracts.set(contractId, {
        contractId,
        resolve,
        reject,
        timeout,
        startTime: Date.now(),
      })
    })
  }

  contractCompleted(contractId: string): void {
    const contract = this.activeContracts.get(contractId)
    if (contract) {
      clearTimeout(contract.timeout)
      contract.resolve()
      this.activeContracts.delete(contractId)
    }
  }

  contractFailed(contractId: string, error: any): void {
    const contract = this.activeContracts.get(contractId)
    if (contract) {
      clearTimeout(contract.timeout)
      contract.reject(error)
      this.activeContracts.delete(contractId)
    }
  }

  private cleanupContract(contractId: string): void {
    const contract = this.activeContracts.get(contractId)
    if (contract) {
      clearTimeout(contract.timeout)
      this.activeContracts.delete(contractId)
    }
  }

  getActiveContractCount(): number {
    return this.activeContracts.size
  }

  cleanupAll(): void {
    this.activeContracts.forEach((contract, contractId) => {
      clearTimeout(contract.timeout)
      this.activeContracts.delete(contractId)
    })
  }
}

function AITradingPanel({
  activeTradeKey,
  onAnalyze,
  onStartTrading,
  onStopTrading,
  analysisResult,
  isAnalyzing,
  isTrading,
  digitSubType,
  onDigitSubTypeChange,
  availableMarkets,
  onMarketSelect,
  onRefresh,
  totalWin,
  totalLoss,
  netProfit,
}: any) {
  const theme = aiTradeTypes[activeTradeKey] || aiTradeTypes.evenodd
  const Icon = theme.icon

  const renderTradeSpecificControls = () => {
    switch (activeTradeKey) {
      case "digits":
        return (
          <div className="digit-subtype-selector">
            <label>Digit Strategy:</label>
            <select value={digitSubType} onChange={(e) => onDigitSubTypeChange(e.target.value)} disabled={isTrading}>
              {Object.entries(digitSubTypes).map(([key, value]) => (
                <option key={key} value={key}>
                  {value}
                </option>
              ))}
            </select>
          </div>
        )
      case "matchdiff":
        return (
          <div className="match-type-selector">
            <label>Strategy:</label>
            <div className="strategy-display">
              Differs Only
            </div>
          </div>
        )
      default:
        return null
    }
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20, rotateY: 10 }} 
      animate={{ opacity: 1, y: 0, rotateY: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="ai-trading-panel"
    >
      <div className="panel-header">
        <div className="header-content">
          <div className="icon-wrapper">
            <Brain size={24} />
          </div>
          <h3>AI Trading Engine</h3>
        </div>
        <div className="header-actions">
          <motion.button 
            className="btn-refresh" 
            onClick={onRefresh} 
            title="Refresh Tool"
            whileHover={{ scale: 1.1, rotate: 180 }}
            whileTap={{ scale: 0.9 }}
          >
            <RefreshCw size={18} />
          </motion.button>
          <div className={`status-indicator ${isTrading ? "trading" : isAnalyzing ? "analyzing" : "idle"}`}>
            {isTrading ? "TRADING" : isAnalyzing ? "ANALYZING" : "IDLE"}
          </div>
        </div>
      </div>

      <div className="panel-content">
        {renderTradeSpecificControls()}

        {availableMarkets && availableMarkets.length > 0 && (
          <motion.div 
            className="market-selection"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            transition={{ duration: 0.4 }}
          >
            <label>Select Market:</label>
            <div className="market-list">
              {availableMarkets.map((market: any, index: number) => (
                <motion.div
                  key={index}
                  className={`market-option ${market.selected ? "selected" : ""}`}
                  onClick={() => onMarketSelect(market)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <div className="market-name">{market.symbolData.display_name}</div>
                  <div className="market-details">
                    {market.type} {market.percentage ? `(${market.percentage.toFixed(1)}%)` : ""}
                    {market.digit !== undefined && ` - Digit: ${market.digit}`}
                  </div>
                  <div className="market-score">Score: {market.score?.toFixed(1) || "N/A"}</div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        <div className="ai-controls">
          <motion.button
            className={`btn-analyze ${isAnalyzing ? "analyzing" : ""}`}
            onClick={onAnalyze}
            disabled={isTrading || isAnalyzing}
            whileHover={{ scale: isTrading || isAnalyzing ? 1 : 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            {isAnalyzing ? (
              <>
                <div className="spinner"></div>
                Scanning All Volatilities...
              </>
            ) : (
              <>
                <Brain size={18} />
                Scan All Volatilities
              </>
            )}
          </motion.button>

          {analysisResult && (
            <motion.div 
              className={`analysis-result ${analysisResult.found ? "success" : "warning"}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              {analysisResult.found ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
              {analysisResult.message}
            </motion.div>
          )}

          <div className="trading-controls">
            <motion.button
              className={`btn-trading-start ${isTrading ? "active" : ""}`}
              onClick={isTrading ? onStopTrading : onStartTrading}
              disabled={!analysisResult?.found && !isTrading}
              whileHover={{ scale: (!analysisResult?.found && !isTrading) ? 1 : 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {isTrading ? (
                <>
                  <Square size={18} />
                  Stop AI Trader
                </>
              ) : (
                <>
                  <Play size={18} />
                  Start AI Trader
                </>
              )}
            </motion.button>
          </div>
        </div>

        {isTrading && (
          <motion.div 
            className="trading-stats"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="stat-item">
              <span className="label">Win Rate:</span>
              <span className="value" id="win-rate">
                0%
              </span>
            </div>
            <div className="stat-item">
              <span className="label">Current Streak:</span>
              <span className="value" id="current-streak">
                0
              </span>
            </div>
            <div className="stat-item">
              <span className="label">Active Trades:</span>
              <span className="value" id="active-trades">
                0
              </span>
            </div>
            <div className="stat-item">
              <span className="label">Status:</span>
              <span className="value" id="trading-status">
                Monitoring
              </span>
            </div>
            {/* Enhanced Profit/Loss Display Section */}
            <div className="profit-loss-section">
              <div className="pl-title">Profit & Loss</div>
              <div className="pl-items">
                <motion.div 
                  className="pl-item profit"
                  whileHover={{ scale: 1.05 }}
                >
                  <span className="label">Total Profit:</span>
                  <span className="value positive">${totalWin.toFixed(2)}</span>
                </motion.div>
                <motion.div 
                  className="pl-item loss"
                  whileHover={{ scale: 1.05 }}
                >
                  <span className="label">Total Loss:</span>
                  <span className="value negative">${totalLoss.toFixed(2)}</span>
                </motion.div>
                <motion.div 
                  className={`pl-item net ${netProfit >= 0 ? "positive" : "negative"}`}
                  whileHover={{ scale: 1.05 }}
                >
                  <span className="label">Net P/L:</span>
                  <span className={`value ${netProfit >= 0 ? "positive" : "negative"}`}>
                    ${netProfit.toFixed(2)}
                  </span>
                </motion.div>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  )
}

const AIEnhancedTradeUi = observer(() => {
  const { transactions, run_panel } = useStore()
  const apiRef = useRef<any>(null)

  // Core state and refs
  const currentSymbolRef = useRef<string>("")
  const tickStreamIdRef = useRef<string | null>(null)
  const globalMsgHandlerRef = useRef<((evt: MessageEvent) => void) | null>(null)
  const connectionAttachedRef = useRef(false)
  const activeTradesRef = useRef<Record<string, any>>({})
  const subIdByContractRef = useRef<Record<string, string | null>>({})
  const cumulativeProfitRef = useRef<number>(0)
  const totalProfitRef = useRef<number>(0)

  const [symbols, setSymbols] = useState<any[]>([])
  const [symbol, setSymbol] = useState<string>("")
  const [account_currency, setAccountCurrency] = useState("USD")
  const [status, setStatus] = useState("Ready to connect...")
  const [lastDigit, setLastDigit] = useState<number | null>(null)

  const liveDigitsRef = useRef<number[]>([])
  const livePricesRef = useRef<number[]>([])
  const decimalLenBySymbolRef = useRef<Record<string, number>>({})
  const [ticksProcessed, setTicksProcessed] = useState(0)

  // AI Trading State
  const [activeTradeKey, setActiveTradeKey] = useState<"evenodd" | "risefall" | "matchdiff" | "digits">("evenodd")
  const [digitSubType, setDigitSubType] = useState<keyof typeof digitSubTypes>("under8")
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isTrading, setIsTrading] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<{ found: boolean; message: string; data?: any } | null>(null)
  const [availableMarkets, setAvailableMarkets] = useState<any[]>([])

  // NEW: Profit/Loss tracking state
  const [totalWin, setTotalWin] = useState<number>(0)
  const [totalLoss, setTotalLoss] = useState<number>(0)
  const [netProfit, setNetProfit] = useState<number>(0)

  // Trading Configuration
  const [stake, setStake] = useState<number>(1)
  const [martingaleMultiplier, setMartingaleMultiplier] = useState<number | null>(null)
  const [maxMartingale, setMaxMartingale] = useState<number | null>(null)
  const [takeProfit, setTakeProfit] = useState<number | null>(null)
  const [stopLoss, setStopLoss] = useState<number | null>(null)
  const [ticks, setTicks] = useState<number>(1)
  const [totalPL, setTotalPL] = useState<number>(0)

  // NEW: Manager instances
  const martingaleManagerRef = useRef<MartingaleManager | null>(null)
  const recoveryManagerRef = useRef<RecoveryManager | null>(null)
  const tradeLifecycleRef = useRef<TradeLifecycleManager | null>(null)

  // AI Logic Refs
  const analysisDataRef = useRef<any>(null)
  const tradingActiveRef = useRef<boolean>(false)
  const lossStreakRef = useRef<number>(0)
  const tradeHistoryRef = useRef<{ win: number; loss: number }>({ win: 0, loss: 0 })
  const entryPatternRef = useRef<number[]>([])
  const recentDigitsRef = useRef<number[]>([])
  const recentMovementsRef = useRef<Array<"R" | "F">>([])

  // Strategy-specific refs
  const consecutiveOppositeCountRef = useRef<number>(0)

  // NEW: Separate tracking for each trade type
  const under8EntryTriggeredRef = useRef<boolean>(false)
  const over2EntryTriggeredRef = useRef<boolean>(false)
  const differsEntryTriggeredRef = useRef<boolean>(false)
  const u4o5EntryTriggeredRef = useRef<boolean>(false)
  const u3o6EntryTriggeredRef = useRef<boolean>(false)
  const u3o6PatternRef = useRef<number[]>([])
  const evenOddEntryTriggeredRef = useRef<boolean>(false)
  const riseFallEntryTriggeredRef = useRef<boolean>(false)

  // NEW: SmartTrader-style contract completion tracking
  const currentContractRef = useRef<{
    contract_id: string
    completed: boolean
    profit: number
  } | null>(null)

  // Enhanced recovery mode refs
  const recoveryModeRef = useRef<boolean>(false)
  const recoveryStrategyRef = useRef<string>("")
  const isInRecoveryModeRef = useRef<boolean>(false)
  const lastOutcomeWasLossRef = useRef<boolean>(false)

  // Trading statistics
  const tradesCountRef = useRef<number>(0)
  const winsCountRef = useRef<number>(0)
  const currentStreakRef = useRef<number>(0)

  // Continuous trading refs
  const continuousTradingRef = useRef<boolean>(false)
  const firstEntryTriggeredRef = useRef<boolean>(false)
  const stopFlagRef = useRef<boolean>(false)
  const waitingForContractRef = useRef<boolean>(false)

  // NEW: Market lock for stickiness
  const marketLockRef = useRef<boolean>(false)
  const lockedMarketRef = useRef<string>("")
  const lockedTradeTypeRef = useRef<string>("")

  const activeSubscriptionsRef = useRef<Set<string>>(new Set())

  // Desired markets for analysis
  const desiredDisplayNames = [
    "Volatility 10 (1s) Index",
    "Volatility 10 Index",
    "Volatility 15 (1s) Index",
    "Volatility 25 (1s) Index",
    "Volatility 25 Index",
    "Volatility 30 (1s) Index",
    "Volatility 50 (1s) Index",
    "Volatility 50 Index",
    "Volatility 75 (1s) Index",
    "Volatility 75 Index",
    "Volatility 90 (1s) Index",
    "Volatility 100 (1s) Index",
    "Volatility 100 Index",
  ]

  // NEW: Initialize managers
  const initializeManagers = () => {
    const multiplier = martingaleMultiplier || 2
    const maxLevel = maxMartingale || 5

    martingaleManagerRef.current = new MartingaleManager(stake, multiplier, maxLevel)
    recoveryManagerRef.current = new RecoveryManager(3)
    tradeLifecycleRef.current = new TradeLifecycleManager()
  }

  // NEW: Enhanced contract completion handler with manager integration
  const handleContractCompletion = (contractData: any) => {
    const profit = Number(contractData?.profit || 0)
    const wasWin = profit > 0
    const contractId = String(contractData?.contract_id || "")

    // NEW: Update profit/loss tracking
    if (wasWin) {
      setTotalWin(prev => prev + profit)
      setNetProfit(prev => prev + profit)
    } else {
      setTotalLoss(prev => prev + Math.abs(profit))
      setNetProfit(prev => prev + profit) // profit is negative for losses
    }

    // Notify trade lifecycle manager
    if (tradeLifecycleRef.current) {
      tradeLifecycleRef.current.contractCompleted(contractId)
    }

    // Apply enhanced recovery logic with managers
    applyEnhancedRecoveryLogic(wasWin)

    // Update trading stats
    if (wasWin) {
      winsCountRef.current++
      currentStreakRef.current = Math.max(0, currentStreakRef.current) + 1

      // Reset martingale on win
      if (martingaleManagerRef.current) {
        martingaleManagerRef.current.reset()
      }

      // Handle recovery win
      if (recoveryManagerRef.current?.isRecoveryActive()) {
        recoveryManagerRef.current.onRecoveryWin()
        recoveryModeRef.current = false
        isInRecoveryModeRef.current = false

        // Reset entry triggers on recovery win
        under8EntryTriggeredRef.current = false
        over2EntryTriggeredRef.current = false
        differsEntryTriggeredRef.current = false
      }
    } else {
      currentStreakRef.current = Math.min(0, currentStreakRef.current) - 1
      lossStreakRef.current++

      // Apply martingale with manager
      if (martingaleManagerRef.current) {
        const nextStake = martingaleManagerRef.current.nextStake()
        if (nextStake === -1) {
          setStatus(`🛑 Max Martingale reached! Stopping trading.`)
          stopAITrading()
          return
        }
      }

      // Check if we should enter recovery mode
      if (recoveryManagerRef.current && analysisDataRef.current) {
        const shouldRecover = recoveryManagerRef.current.shouldEnterRecovery(
          analysisDataRef.current.type,
          "loss",
          analysisDataRef.current.digit,
        )

        if (shouldRecover) {
          recoveryModeRef.current = true
          isInRecoveryModeRef.current = true
          setStatus(`🔄 Recovery Mode ACTIVATED | Martingale: ${martingaleManagerRef.current?.getCurrentLevel() || 0}`)
        }
      }
    }

    tradesCountRef.current++
    updateTradingStatsDisplay()

    cumulativeProfitRef.current += profit
    totalProfitRef.current += profit
    setTotalPL(cumulativeProfitRef.current)

    // FIXED: Update run panel when contract completes - BLOCK RISE/FALL
    if (activeTradeKey !== "risefall") {
      if (run_panel?.setHasOpenContract) {
        run_panel.setHasOpenContract(false)
      }
      if (run_panel?.setContractStage) {
        run_panel.setContractStage("CLOSED")
      }
    }

    currentContractRef.current = null
    waitingForContractRef.current = false

    // Reset entry trigger for the specific trade type
    switch (activeTradeKey) {
      case "evenodd":
        evenOddEntryTriggeredRef.current = false
        break
      case "risefall":
        riseFallEntryTriggeredRef.current = false
        break
      case "matchdiff":
        differsEntryTriggeredRef.current = false
        break
      case "digits":
        switch (digitSubType) {
          case "under8":
            under8EntryTriggeredRef.current = false
            break
          case "over2":
            over2EntryTriggeredRef.current = false
            break
          case "u4o5":
            u4o5EntryTriggeredRef.current = false
            break
          case "u3o6":
            u3o6EntryTriggeredRef.current = false
            u3o6PatternRef.current = []
            break
        }
        break
    }

    // Check TP/SL
    checkTPSL()
  }

  // NEW: Enhanced recovery logic with manager
  const applyEnhancedRecoveryLogic = (wasWin: boolean) => {
    if (wasWin) {
      // WIN: Reset everything
      lossStreakRef.current = 0
      isInRecoveryModeRef.current = false
      lastOutcomeWasLossRef.current = false

      // Reset to original strategy if in recovery
      if (recoveryModeRef.current) {
        recoveryModeRef.current = false
        setStatus(`✅ Recovery complete! Reset to base stake: $${stake}`)

        // Restore original strategy
        if (analysisDataRef.current?.originalStrategy) {
          analysisDataRef.current.type = analysisDataRef.current.originalStrategy
        }
      } else {
        setStatus(`✅ Trade WIN! Reset to base stake: $${stake}`)
      }
    } else {
      // LOSS: Enhanced recovery logic
      lastOutcomeWasLossRef.current = true

      // Handle recovery loss
      if (recoveryManagerRef.current?.isRecoveryActive()) {
        const shouldContinue = recoveryManagerRef.current.onRecoveryLoss()
        if (!shouldContinue) {
          setStatus(`🛑 Max recovery attempts reached! Stopping trading.`)
          stopAITrading()
          return
        }
      }

      setStatus(`🔴 Trade LOSS! Next stake: $${martingaleManagerRef.current?.getCurrentStake().toFixed(2) || stake}`)
    }
  }

  // FIXED: Enhanced contract event handler for run panel - BLOCK RISE/FALL
  const handleContractEventForRunPanel = (contractData: any) => {
    try {
      // BLOCK RISE/FALL from showing on run panel
      if (activeTradeKey === "risefall") {
        return
      }

      transactions.onBotContractEvent(contractData)

      const isSold = Boolean(contractData?.is_sold || contractData?.status === "sold" || contractData?.cancelled === 1)

      if (run_panel?.setContractStage) {
        if (isSold) {
          run_panel.setContractStage("CLOSED")
        } else {
          run_panel.setContractStage("PURCHASE_SENT")
        }
      }

      if (run_panel?.setHasOpenContract) {
        const hasOpenContracts = Object.keys(activeTradesRef.current).length > 0
        run_panel.setHasOpenContract(hasOpenContracts)
      }

      // FIXED: Update run panel when trading stops
      if (!tradingActiveRef.current && run_panel?.setIsRunning) {
        run_panel.setIsRunning(false)
        run_panel.setHasOpenContract(false)
        run_panel.setContractStage("NOT_RUNNING")
      }
    } catch (err) {
      console.error("Error updating run panel:", err)
    }
  }

  const refreshTool = () => {
    stopAITrading()

    activeSubscriptionsRef.current.forEach((subId) => {
      try {
        if (apiRef.current?.forget) {
          apiRef.current.forget({ forget: subId })
        }
      } catch (err) {
        console.error("Error unsubscribing:", err)
      }
    })
    activeSubscriptionsRef.current.clear()

    setAnalysisResult(null)
    setAvailableMarkets([])
    setLastDigit(null)
    setTicksProcessed(0)
    setTotalPL(0)
    
    // NEW: Reset profit/loss tracking
    setTotalWin(0)
    setTotalLoss(0)
    setNetProfit(0)
    
    setStatus("Tool refreshed - Ready to connect...")

    // Reset managers
    if (martingaleManagerRef.current) martingaleManagerRef.current.reset()
    if (recoveryManagerRef.current) recoveryManagerRef.current.reset()
    if (tradeLifecycleRef.current) {
      tradeLifecycleRef.current.cleanupAll()
    }

    liveDigitsRef.current = []
    livePricesRef.current = []
    recentDigitsRef.current = []
    recentMovementsRef.current = []
    analysisDataRef.current = null
    tradingActiveRef.current = false
    lossStreakRef.current = 0
    consecutiveOppositeCountRef.current = 0

    // NEW: Reset all entry triggers
    under8EntryTriggeredRef.current = false
    over2EntryTriggeredRef.current = false
    differsEntryTriggeredRef.current = false
    u4o5EntryTriggeredRef.current = false
    u3o6EntryTriggeredRef.current = false
    u3o6PatternRef.current = []
    evenOddEntryTriggeredRef.current = false
    riseFallEntryTriggeredRef.current = false

    recoveryModeRef.current = false
    recoveryStrategyRef.current = ""
    tradesCountRef.current = 0
    winsCountRef.current = 0
    currentStreakRef.current = 0

    // Reset continuous trading
    continuousTradingRef.current = false
    firstEntryTriggeredRef.current = false
    stopFlagRef.current = false
    waitingForContractRef.current = false

    // Reset market lock
    marketLockRef.current = false
    lockedMarketRef.current = ""
    lockedTradeTypeRef.current = ""

    updateTradingStatsDisplay()

    setTimeout(() => {
      initializeTrading()
    }, 1000)
  }

  // Initialize API and connection
  const initializeTrading = async () => {
    try {
      const api = generateDerivApiInstance()
      apiRef.current = api

      const globalHandler = (evt: MessageEvent) => {
        try {
          const data = typeof evt.data === "string" ? JSON.parse(evt.data as any) : evt.data

          if (data?.msg_type === "tick") {
            const tick = data.tick
            const sym = tick?.symbol
            if (!sym || sym !== currentSymbolRef.current) return

            const raw = tick.quote
            const priceStr = formatPriceWithDecLen(raw, sym)
            const digit = extractLastDigitFromFormatted(priceStr)

            if (digit !== null) {
              liveDigitsRef.current.push(digit)
              if (liveDigitsRef.current.length > 2000) liveDigitsRef.current.shift()
              setLastDigit(digit)
              setTicksProcessed((prev) => prev + 1)

              recentDigitsRef.current.push(digit)
              if (recentDigitsRef.current.length > 10) recentDigitsRef.current.shift()

              const priceVal = Number(raw)
              if (!Number.isNaN(priceVal)) {
                livePricesRef.current.push(priceVal)
                if (livePricesRef.current.length > 2000) livePricesRef.current.shift()

                // ENHANCED: Better rise/fall detection
                if (livePricesRef.current.length >= 2) {
                  const prevPrice = livePricesRef.current[livePricesRef.current.length - 2]
                  const movement = priceVal > prevPrice ? "R" : priceVal < prevPrice ? "F" : "F"
                  recentMovementsRef.current.push(movement)
                  if (recentMovementsRef.current.length > 10) recentMovementsRef.current.shift()
                }
              }
            }
          }

          if (data?.msg_type === "proposal_open_contract" || data?.proposal_open_contract) {
            const poc = data.proposal_open_contract ?? data
            const contractId = String(poc?.contract_id || poc?.contract?.contract_id || "")

            if (contractId && activeTradesRef.current[contractId]) {
              const profit = Number(poc?.profit || 0)
              activeTradesRef.current[contractId].currentProfit = profit

              handleContractEventForRunPanel(poc)

              const isSold = Boolean(poc?.is_sold || poc?.status === "sold" || poc?.cancelled === 1)
              if (isSold) {
                // Handle contract completion with enhanced recovery logic
                handleContractCompletion(poc)

                delete activeTradesRef.current[contractId]
                updateActiveTradesCount()

                checkTPSL()

                if (currentContractRef.current?.contract_id === contractId) {
                  currentContractRef.current.completed = true
                }
              }
            }
          }
        } catch (err) {
          console.error("Error processing message:", err)
        }
      }

      if (apiRef.current?.connection && !connectionAttachedRef.current) {
        apiRef.current.connection.addEventListener("message", globalHandler)
        globalMsgHandlerRef.current = globalHandler
        connectionAttachedRef.current = true
      }

      // Initialize managers
      initializeManagers()

      await initializeSymbols()
      setStatus("✅ Connected to Deriv - Ready for AI Trading")
    } catch (error: any) {
      setStatus(`❌ Connection error: ${error?.message || "Unknown error"}`)
    }
  }

  useEffect(() => {
    initializeTrading()

    return () => {
      tradingActiveRef.current = false
      continuousTradingRef.current = false
      stopFlagRef.current = true
      if (globalMsgHandlerRef.current && apiRef.current?.connection) {
        apiRef.current.connection.removeEventListener("message", globalMsgHandlerRef.current)
      }
      if (tradeLifecycleRef.current) {
        tradeLifecycleRef.current.cleanupAll()
      }
      stopTicks()
    }
  }, [])

  // FIXED: Enhanced trading effect with proper contract completion waiting
  useEffect(() => {
    if (!isTrading || lastDigit === null || waitingForContractRef.current) return

    const timer = setTimeout(() => {
      if (continuousTradingRef.current && firstEntryTriggeredRef.current) {
        // Continuous trading mode - execute trade immediately (but wait for completion)
        executeContinuousTrade().catch(console.error)
      } else {
        // Entry-based mode - check for entry condition
        executeAITradeLogic().catch(console.error)
      }
    }, 100)

    return () => clearTimeout(timer)
  }, [lastDigit, isTrading, waitingForContractRef.current])

  // NEW: Enhanced continuous trade execution with lifecycle management
  const executeContinuousTrade = async () => {
    if (!tradingActiveRef.current || !analysisDataRef.current || waitingForContractRef.current) return

    try {
      const currentStrategy = getCurrentStrategy()

      let tradeType = ""
      let prediction: number | null = null

      // Determine trade type based on current strategy
      switch (activeTradeKey) {
        case "evenodd":
          tradeType = analysisDataRef.current.target
          break
        case "risefall":
          tradeType = analysisDataRef.current.target
          break
        case "matchdiff":
          // FIXED: When in recovery mode for differs, force digit over/under trading
          if (currentStrategy === "DIFFERS") {
            tradeType = "DIFFERS"
            prediction = analysisDataRef.current.digit
          } else if (currentStrategy === "UNDER5" || currentStrategy === "OVER5") {
            // Force digit over/under in recovery mode
            tradeType = currentStrategy
            prediction = 5
          }
          break
        case "digits":
          if (currentStrategy === "UNDER8") {
            tradeType = "UNDER8"
            prediction = 8
          } else if (currentStrategy === "OVER2") {
            tradeType = "OVER2"
            prediction = 2
          } else if (currentStrategy === "UNDER5") {
            tradeType = "UNDER5"
            prediction = 5
          } else if (currentStrategy === "OVER5") {
            tradeType = "OVER5"
            prediction = 5
          }
          break
      }

      if (tradeType) {
        waitingForContractRef.current = true
        const contractId = await executeTradeWithLifecycle(tradeType, prediction, { skipActiveCheck: false })

        if (contractId) {
          // Wait for contract completion with timeout
          try {
            await tradeLifecycleRef.current?.waitForContractCompletion(contractId)
          } catch (error) {
            console.error(`Contract ${contractId} timeout or error:`, error)
            // Clean up and continue
            delete activeTradesRef.current[contractId]
            updateActiveTradesCount()
          }
        }

        waitingForContractRef.current = false
      }
    } catch (err) {
      console.error("Continuous trade error:", err)
      waitingForContractRef.current = false
    }
  }

  // NEW: Get current strategy with recovery consideration
  const getCurrentStrategy = (): string => {
    if (recoveryModeRef.current && recoveryManagerRef.current) {
      const recoveryMarket = recoveryManagerRef.current.getRecoveryMarket(
        analysisDataRef.current?.type,
        analysisDataRef.current?.digit,
      )
      return recoveryMarket.type
    }
    return analysisDataRef.current?.type || ""
  }

  // NEW: Enhanced trade execution with lifecycle management
  const executeTradeWithLifecycle = async (
    tradeType: string,
    prediction: number | null = null,
    opts: { skipActiveCheck?: boolean } = {},
  ): Promise<string | null> => {
    // Prevent opening a new contract if other active contracts exist unless explicitly overridden
    const skip = opts?.skipActiveCheck === true
    try {
      const activeCount = tradeLifecycleRef.current?.getActiveContractCount() ?? 0
      if (!skip && activeCount > 0) {
        return null
      }
    } catch (e) {
      console.warn("Error checking active contract count:", e)
    }

    if (!tradingActiveRef.current) return null

    try {
      const currentStake = martingaleManagerRef.current?.getCurrentStake() || stake

      const { contract_type, barrier } = mapToDerivContractType(tradeType, prediction)

      const buy_req: any = {
        buy: 1,
        parameters: {
          contract_type: contract_type,
          amount: currentStake,
          basis: "stake",
          currency: account_currency,
          duration: ticks,
          duration_unit: "t",
          symbol: currentSymbolRef.current,
        },
        price: currentStake,
      }

      if (barrier) {
        buy_req.parameters.barrier = barrier
      }

      let buyResp: any = null

      try {
        buyResp = await apiRef.current.send(buy_req)
      } catch (buyErr: any) {
        console.error("Buy attempt failed:", buyErr)
        throw buyErr
      }

      if (buyResp?.error) {
        console.error("API returned error:", buyResp.error)
        setStatus(`❌ Trade error: ${buyResp.error.message || "API error"}`)
        return null
      }

      const buyObj = buyResp?.buy || null
      if (!buyObj) {
        console.error("Invalid buy response - no buy object:", buyResp)
        setStatus("❌ Invalid buy response - check debug panel")
        return null
      }

      const contractId = String(buyObj.contract_id ?? "")

      if (!contractId) {
        console.error("Buy response missing contract_id:", buyResp)
        setStatus("❌ Trade placed but contract_id missing - inspect debug panel")
        return null
      }

      const transactionId = buyObj.transaction_id ?? null
      const buyPrice = buyObj.buy_price ?? 0

      // Track current contract for completion
      currentContractRef.current = {
        contract_id: contractId,
        completed: false,
        profit: 0,
      }

      activeTradesRef.current[contractId] = {
        contract_id: contractId,
        tradeType,
        prediction,
        stake: currentStake,
        currentProfit: 0,
        isRecovery: recoveryModeRef.current,
        transactionId,
      }
      updateActiveTradesCount()

      // Enhanced run panel integration - BLOCK RISE/FALL
      if (activeTradeKey !== "risefall") {
        try {
          if (run_panel?.setHasOpenContract) {
            run_panel.setHasOpenContract(true)
          }
          if (run_panel?.setContractStage) {
            run_panel.setContractStage("PURCHASE_SENT")
          }
        } catch (runPanelErr) {
          console.error("Run panel update error:", runPanelErr)
        }
      }

      handleContractEventForRunPanel({
        contract_id: contractId,
        transaction_ids: { buy: transactionId },
        buy_price: buyPrice,
        currency: account_currency,
        contract_type: contract_type,
        underlying: currentSymbolRef.current,
        display_name:
          symbols.find((s: any) => s.symbol === currentSymbolRef.current)?.display_name || currentSymbolRef.current,
        date_start: Math.floor(Date.now() / 1000),
        status: "open",
      })

      try {
        const res = await apiRef.current.send?.({
          proposal_open_contract: 1,
          contract_id: contractId,
          subscribe: 1,
        })
        const subId = res?.subscription?.id ?? null
        if (subId) {
          subIdByContractRef.current[contractId] = subId
          activeSubscriptionsRef.current.add(subId)
        }
      } catch (subErr) {
        console.error("Subscription error (contract will still be tracked):", subErr)
      }

      const recoveryText = recoveryModeRef.current ? " (Recovery Mode)" : ""
      const martingaleText = martingaleManagerRef.current?.getCurrentLevel()
        ? ` [Martingale: x${martingaleManagerRef.current.getCurrentLevel()}]`
        : ""

      setStatus(`✅ Placed ${contract_type} trade - Stake: $${currentStake.toFixed(2)}${recoveryText}${martingaleText}`)

      return contractId
    } catch (error: any) {
      console.error("executeTrade error:", error)
      setStatus(`❌ Trade error: ${error?.message || "Unknown error"}`)
      updateTradingStatus("Error")
      return null
    }
  }

  // FIXED: Enhanced recovery mode activation with correct strategies
  const activateRecoveryMode = () => {
    const currentStrategy = analysisDataRef.current?.type
    let recoveryStrategy = ""

    // Enhanced recovery strategies for each trade type
    switch (activeTradeKey) {
      case "evenodd":
        recoveryStrategy = analysisDataRef.current.target === "DIGITEVEN" ? "DIGITODD" : "DIGITEVEN"
        break
      case "risefall":
        recoveryStrategy = analysisDataRef.current.target === "CALL" ? "PUT" : "CALL"
        break
      case "matchdiff":
        // FIXED: Force digit over/under for differs recovery
        if (currentStrategy === "DIFFERS") {
          recoveryStrategy = "UNDER5" // Force to digit under/over
        }
        break
      case "digits":
        if (currentStrategy === "UNDER8") {
          recoveryStrategy = "UNDER5"
        } else if (currentStrategy === "OVER2") {
          recoveryStrategy = "OVER5"
        } else if (currentStrategy === "U4O5") {
          recoveryStrategy = "U3O6"
        } else if (currentStrategy === "U3O6") {
          recoveryStrategy = "U4O5"
        }
        break
    }

    recoveryModeRef.current = true
    recoveryStrategyRef.current = recoveryStrategy
    isInRecoveryModeRef.current = true

    setStatus(`🔄 Recovery Mode: ${recoveryStrategy}`)
  }

  const initializeSymbols = async () => {
    try {
      const { active_symbols } = await apiRef.current.send({ active_symbols: "brief" })
      const syn = (active_symbols || [])
        .filter((s: any) => /synthetic/i.test(s.market) || /^R_/.test(s.symbol))
        .map((s: any) => ({ symbol: s.symbol, display_name: s.display_name }))

      const ordered: any[] = []
      const lookup = new Map(syn.map((s: any) => [s.display_name, s]))
      for (const name of desiredDisplayNames) {
        const found = lookup.get(name)
        if (found) ordered.push(found)
      }

      setSymbols(ordered.length > 0 ? ordered : syn)

      if (ordered[0]?.symbol) {
        setSymbol(ordered[0].symbol)
        currentSymbolRef.current = ordered[0].symbol
        await startTicks(ordered[0].symbol)
      }
    } catch (e: any) {
      setStatus(`Symbols error: ${e?.message || "Unknown"}`)
    }
  }

  const startTicks = async (sym: string) => {
    stopTicks()

    try {
      currentSymbolRef.current = sym
      await analyzeTicksFromHistory(sym, 1000)

      const res = await apiRef.current.send({ ticks: sym, subscribe: 1 })
      const subId = res?.subscription?.id ?? res?.ticks?.subscribe?.id ?? null
      tickStreamIdRef.current = subId ?? String(sym)
      if (subId) {
        activeSubscriptionsRef.current.add(subId)
      }
    } catch (e: any) {
      console.error("Tick stream error:", e)
    }
  }

  const stopTicks = () => {
    if (tickStreamIdRef.current && apiRef.current) {
      try {
        apiRef.current.forget?.({ forget: tickStreamIdRef.current })
        activeSubscriptionsRef.current.delete(tickStreamIdRef.current)
      } catch {}
      tickStreamIdRef.current = null
    }
  }

  const analyzeTicksFromHistory = async (sym: string, count = 1000) => {
    try {
      const res = await apiRef.current.send({ ticks_history: sym, count, end: "latest" })
      const ticks_history = res?.history?.prices ?? res?.ticks?.prices ?? res?.ticks_history?.prices ?? res?.prices
      if (!ticks_history || !Array.isArray(ticks_history)) return

      let maxDec = 0
      for (const price of ticks_history) {
        const s = String(price)
        const parts = s.split(".")
        if (parts.length > 1) maxDec = Math.max(maxDec, parts[1].length)
      }
      decimalLenBySymbolRef.current[sym] = maxDec

      const seedDigits = ticks_history
        .slice(-count)
        .map((p: any) => {
          const f = Number(p).toFixed(maxDec)
          const d = extractLastDigitFromFormatted(f)
          return d === null ? null : d
        })
        .filter((d: any) => d !== null) as number[]

      const seedPrices = ticks_history
        .slice(-count)
        .map((p: any) => Number(p))
        .filter((n: any) => !Number.isNaN(n))

      liveDigitsRef.current = seedDigits.slice(-1000)
      livePricesRef.current = seedPrices.slice(-1000)
      recentDigitsRef.current = seedDigits.slice(-10)

      // Initialize recent movements
      if (seedPrices.length >= 2) {
        for (let i = 1; i < Math.min(seedPrices.length, 10); i++) {
          const movement = seedPrices[i] > seedPrices[i - 1] ? "R" : "F"
          recentMovementsRef.current.push(movement)
        }
      }

      setTicksProcessed((prev) => prev + seedDigits.length)
    } catch (err) {
      console.error("Error analyzing ticks:", err)
    }
  }

  const formatPriceWithDecLen = (raw: any, sym: string) => {
    try {
      const decLen = decimalLenBySymbolRef.current[sym]
      if (typeof decLen === "number" && !Number.isNaN(Number(raw))) {
        return Number(raw).toFixed(decLen)
      }
      return String(raw)
    } catch {
      return String(raw)
    }
  }

  const extractLastDigitFromFormatted = (priceStr: string): number | null => {
    if (typeof priceStr !== "string") priceStr = String(priceStr)
    const parts = priceStr.split(".")
    if (parts.length > 1) {
      const dec = parts[1]
      if (dec.length > 0) {
        const ch = dec[dec.length - 1]
        if (/\d/.test(ch)) return Number(ch)
      }
    }
    const intPart = parts[0]
    if (intPart && intPart.length > 0) {
      const ch = intPart[intPart.length - 1]
      if (/\d/.test(ch)) return Number(ch)
    }
    return null
  }

  const authorizeIfNeeded = async () => {
    try {
      const token = V2GetActiveToken()
      const clientId = V2GetActiveClientId()
      if (!token || !clientId) throw new Error("No active token or client ID found")

      const { authorize, error } = await apiRef.current.authorize(token)
      if (error) throw error

      setAccountCurrency(authorize?.currency || "USD")
      return authorize
    } catch (error: any) {
      setStatus(`❌ Authorization error: ${error?.message || "Unknown error"}`)
      throw error
    }
  }

  // NEW: Enhanced market selection with locking
  const lockMarket = (symbol: string, tradeType: string) => {
    marketLockRef.current = true
    lockedMarketRef.current = symbol
    lockedTradeTypeRef.current = tradeType
  }

  const unlockMarket = () => {
    marketLockRef.current = false
    lockedMarketRef.current = ""
    lockedTradeTypeRef.current = ""
  }

  const analyzeMarkets = async () => {
    setIsAnalyzing(true)
    setAnalysisResult(null)
    setAvailableMarkets([])
    setStatus("🔍 AI is scanning all volatility markets...")

    try {
      const suitableMarkets: any[] = []

      for (const symbolData of symbols) {
        const sym = symbolData.symbol
        setStatus(`🔍 Analyzing ${symbolData.display_name}...`)

        currentSymbolRef.current = sym
        await startTicks(sym)

        await new Promise((resolve) => setTimeout(resolve, 2000))

        let marketAnalysis = null

        switch (activeTradeKey) {
          case "evenodd":
            marketAnalysis = await analyzeEvenOddMarkets()
            if (marketAnalysis && marketAnalysis.percentage > 52.5) {
              suitableMarkets.push({ ...marketAnalysis, symbolData, score: marketAnalysis.percentage })
            }
            break

          case "risefall":
            marketAnalysis = await analyzeRiseFallMarkets()
            if (marketAnalysis && marketAnalysis.percentage > 52.5) {
              suitableMarkets.push({ ...marketAnalysis, symbolData, score: marketAnalysis.percentage })
            }
            break

          case "matchdiff":
            marketAnalysis = await analyzeMatchDiffMarkets()
            if (marketAnalysis) {
              const score = marketAnalysis.percentage ? 100 - marketAnalysis.percentage : 85
              suitableMarkets.push({ ...marketAnalysis, symbolData, score })
            }
            break

          case "digits":
            marketAnalysis = await analyzeDigitMarkets()
            if (marketAnalysis) {
              suitableMarkets.push({ ...marketAnalysis, symbolData, score: 80 })
            }
            break
        }

        await new Promise((resolve) => setTimeout(resolve, 1000))
      }

      suitableMarkets.sort((a, b) => (b.score || 0) - (a.score || 0))

      if (suitableMarkets.length > 1) {
        setAvailableMarkets(suitableMarkets)
        setStatus(`🎯 Found ${suitableMarkets.length} suitable markets. Please select one.`)
        setAnalysisResult({
          found: true,
          message: `Found ${suitableMarkets.length} suitable markets. Please select one.`,
          data: suitableMarkets[0],
        })
        setIsAnalyzing(false)
        return
      }

      let analysisMessage = ""

      if (suitableMarkets.length > 0) {
        const bestMarket = suitableMarkets[0]
        setSymbol(bestMarket.symbolData.symbol)
        currentSymbolRef.current = bestMarket.symbolData.symbol
        analysisDataRef.current = bestMarket

        // NEW: Lock the market
        lockMarket(bestMarket.symbolData.symbol, bestMarket.type)

        await startTicks(bestMarket.symbolData.symbol)

        analysisMessage = `✅ Best Market: ${bestMarket.symbolData.display_name} - `
        switch (activeTradeKey) {
          case "evenodd":
          case "risefall":
            analysisMessage += `${bestMarket.type} at ${bestMarket.percentage.toFixed(1)}%`
            break
          case "matchdiff":
            analysisMessage += `${bestMarket.type}`
            if (bestMarket.digit !== undefined) {
              analysisMessage += ` (Digit: ${bestMarket.digit})`
            }
            break
          case "digits":
            analysisMessage += `${digitSubTypes[digitSubType]}`
            break
        }

        setStatus(`🎯 AI Scan Complete: ${analysisMessage}`)
      } else {
        analysisMessage = "❌ No suitable market found across all volatilities"
        setStatus(analysisMessage)
      }

      setAnalysisResult({
        found: suitableMarkets.length > 0,
        message: analysisMessage,
        data: suitableMarkets[0] || null,
      })
    } catch (error: any) {
      setStatus(`❌ Analysis error: ${error?.message || "Unknown error"}`)
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleMarketSelect = async (market: any) => {
    setSymbol(market.symbolData.symbol)
    currentSymbolRef.current = market.symbolData.symbol
    analysisDataRef.current = market

    // NEW: Lock the market
    lockMarket(market.symbolData.symbol, market.type)

    await startTicks(market.symbolData.symbol)

    let analysisMessage = `✅ Selected Market: ${market.symbolData.display_name} - `
    switch (activeTradeKey) {
      case "evenodd":
      case "risefall":
        analysisMessage += `${market.type} at ${market.percentage.toFixed(1)}%`
        break
      case "matchdiff":
        analysisMessage += `${market.type}`
        if (market.digit !== undefined) {
          analysisMessage += ` (Digit: ${market.digit})`
        }
        break
      case "digits":
        analysisMessage += `${digitSubTypes[digitSubType]}`
        break
    }

    setStatus(`🎯 Market Selected: ${analysisMessage}`)
    setAnalysisResult({
      found: true,
      message: analysisMessage,
      data: market,
    })
    setAvailableMarkets([])
  }

  // Preserved market analysis functions (unchanged as required)
  const analyzeEvenOddMarkets = async (): Promise<any> => {
    const digits = liveDigitsRef.current.slice(-1000)
    if (digits.length < 500) return null

    const evenCount = digits.filter((d) => d % 2 === 0).length
    const oddCount = digits.length - evenCount
    const evenPercentage = (evenCount / digits.length) * 100
    const oddPercentage = (oddCount / digits.length) * 100

    if (evenPercentage > 52.5) {
      return {
        symbol: currentSymbolRef.current,
        type: "EVEN",
        percentage: evenPercentage,
        target: "DIGITEVEN",
        opposite: "DIGITODD",
        targetType: "EVEN",
        oppositeType: "ODD",
        requiredOpposite: 4,
      }
    } else if (oddPercentage > 52.5) {
      return {
        symbol: currentSymbolRef.current,
        type: "ODD",
        percentage: oddPercentage,
        target: "DIGITODD",
        opposite: "DIGITEVEN",
        targetType: "ODD",
        oppositeType: "EVEN",
        requiredOpposite: 4,
      }
    }

    return null
  }

  const analyzeRiseFallMarkets = async (): Promise<any> => {
    const prices = livePricesRef.current.slice(-1000)
    if (prices.length < 500) return null

    let riseCount = 0
    let fallCount = 0

    for (let i = 1; i < prices.length; i++) {
      if (prices[i] > prices[i - 1]) riseCount++
      else if (prices[i] < prices[i - 1]) fallCount++
    }

    const risePercentage = (riseCount / (riseCount + fallCount)) * 100
    const fallPercentage = (fallCount / (riseCount + fallCount)) * 100

    if (risePercentage > 52.5) {
      return {
        symbol: currentSymbolRef.current,
        type: "RISE",
        percentage: risePercentage,
        target: "CALL",
        opposite: "PUT",
        targetType: "R",
        oppositeType: "F",
        requiredOpposite: 2,
      }
    } else if (fallPercentage > 52.5) {
      return {
        symbol: currentSymbolRef.current,
        type: "FALL",
        percentage: fallPercentage,
        target: "PUT",
        opposite: "CALL",
        targetType: "F",
        oppositeType: "R",
        requiredOpposite: 2,
      }
    }

    return null
  }

  const analyzeMatchDiffMarkets = async (): Promise<any> => {
    const digits = liveDigitsRef.current.slice(-1000)
    if (digits.length < 500) return null

    // REMOVED: Matches logic - only differs remains
    const digitCounts = new Array(10).fill(0)
    digits.forEach((d) => digitCounts[d]++)

    const digitPercentages = digitCounts.map((count) => (count / digits.length) * 100)

    for (let i = 0; i < 10; i++) {
      if (i === 5) continue // Skip digit 5 for differs
      if (digitPercentages[i] < 9) {
        const firstHalf = digits.slice(0, Math.floor(digits.length / 2))
        const secondHalf = digits.slice(Math.floor(digits.length / 2))

        const firstCount = firstHalf.filter((d) => d === i).length
        const secondCount = secondHalf.filter((d) => d === i).length

        const firstPct = (firstCount / firstHalf.length) * 100
        const secondPct = (secondCount / secondHalf.length) * 100

        if (secondPct < firstPct) {
          return {
            symbol: currentSymbolRef.current,
            type: "DIFFERS",
            digit: i,
            percentage: digitPercentages[i],
          }
        }
      }
    }

    return null
  }

  const analyzeDigitMarkets = async (): Promise<any> => {
    const digits = liveDigitsRef.current.slice(-1000)
    if (digits.length < 500) return null

    const digitCounts = new Array(10).fill(0)
    digits.forEach((d) => digitCounts[d]++)
    const digitPercentages = digitCounts.map((count) => (count / digits.length) * 100)

    switch (digitSubType) {
      case "under8":
        if (digitPercentages[8] < 10 && digitPercentages[9] < 10) {
          return {
            symbol: currentSymbolRef.current,
            type: "UNDER8",
            originalStrategy: "UNDER8",
            percentages: digitPercentages,
          }
        }
        break

      case "over2":
        if (digitPercentages[0] < 10 && digitPercentages[1] < 10 && digitPercentages[2] < 10) {
          return {
            symbol: currentSymbolRef.current,
            type: "OVER2",
            originalStrategy: "OVER2",
            percentages: digitPercentages,
          }
        }
        break

      case "u4o5":
        if (digitPercentages[4] < 10 && digitPercentages[5] < 10) {
          return {
            symbol: currentSymbolRef.current,
            type: "U4O5",
            originalStrategy: "U4O5",
            percentages: digitPercentages,
          }
        }
        break

      case "u3o6":
        if (digitPercentages[3] < 10 && digitPercentages[6] < 10) {
          return {
            symbol: currentSymbolRef.current,
            type: "U3O6",
            originalStrategy: "U3O6",
            percentages: digitPercentages,
          }
        }
        break
    }

    return null
  }

  const startAITrading = async () => {
    if (!analysisResult?.found) {
      setStatus("❌ Please analyze markets first")
      return
    }

    try {
      await authorizeIfNeeded()

      // Reinitialize managers with current settings
      initializeManagers()

      setIsTrading(true)
      tradingActiveRef.current = true
      lossStreakRef.current = 0
      consecutiveOppositeCountRef.current = 0

      // NEW: Reset all entry triggers
      under8EntryTriggeredRef.current = false
      over2EntryTriggeredRef.current = false
      differsEntryTriggeredRef.current = false
      u4o5EntryTriggeredRef.current = false
      u3o6EntryTriggeredRef.current = false
      u3o6PatternRef.current = []
      evenOddEntryTriggeredRef.current = false
      riseFallEntryTriggeredRef.current = false

      recoveryModeRef.current = false
      recoveryStrategyRef.current = ""

      // Reset continuous trading flags
      continuousTradingRef.current = false
      firstEntryTriggeredRef.current = false
      isInRecoveryModeRef.current = false
      lastOutcomeWasLossRef.current = false
      stopFlagRef.current = false
      waitingForContractRef.current = false

      // Initialize run panel - BLOCK RISE/FALL
      if (activeTradeKey !== "risefall") {
        if (run_panel?.setIsRunning) {
          run_panel.setIsRunning(true)
        }
        if (run_panel?.setContractStage) {
          run_panel.setContractStage("STARTING")
        }
      }

      setStatus("🤖 AI Trader Started - Monitoring for entry signals...")
      updateTradingStatus("Monitoring")
    } catch (error: any) {
      setStatus(`❌ Failed to start AI trading: ${error?.message || "Unknown error"}`)
    }
  }

  const stopAITrading = () => {
    setIsTrading(false)
    tradingActiveRef.current = false
    continuousTradingRef.current = false
    firstEntryTriggeredRef.current = false
    stopFlagRef.current = true
    waitingForContractRef.current = false

    // Clean up trade lifecycle
    if (tradeLifecycleRef.current) {
      tradeLifecycleRef.current.cleanupAll()
    }

    unlockMarket()

    // Update run panel when stopping - BLOCK RISE/FALL
    if (activeTradeKey !== "risefall") {
      if (run_panel?.setIsRunning) {
        run_panel.setIsRunning(false)
      }
      if (run_panel?.setHasOpenContract) {
        run_panel.setHasOpenContract(false)
      }
      if (run_panel?.setContractStage) {
        run_panel.setContractStage("NOT_RUNNING")
      }
    }

    setStatus("🛑 AI Trader Stopped")
    updateTradingStatus("Stopped")
  }

  // FIXED: Enhanced AI trade logic with strict separation
  const executeAITradeLogic = async () => {
    try {
      if (!tradingActiveRef.current || !analysisDataRef.current || waitingForContractRef.current) return

      const currentDigit = lastDigit
      if (currentDigit === null || typeof currentDigit === "undefined") return

      let shouldTrade = false
      let tradeType = ""
      let prediction: number | null = null
      let multiPredictions: any[] | null = null

      const currentStrategy = getCurrentStrategy()

      // FIXED: Strict separation of trade types with individual entry tracking
      switch (activeTradeKey) {
        case "evenodd":
          if (!evenOddEntryTriggeredRef.current) {
            const res = checkEvenOddEntry(currentDigit)
            shouldTrade = res.shouldTrade
            tradeType = res.tradeType
            prediction = res.prediction
            if (shouldTrade) evenOddEntryTriggeredRef.current = true
          }
          break
        case "risefall":
          if (!riseFallEntryTriggeredRef.current) {
            const res = checkRiseFallEntry()
            shouldTrade = res.shouldTrade
            tradeType = res.tradeType
            prediction = res.prediction
            if (shouldTrade) riseFallEntryTriggeredRef.current = true
          }
          break
        case "matchdiff":
          if (!differsEntryTriggeredRef.current) {
            const res = checkMatchDiffEntry(currentDigit, currentStrategy)
            shouldTrade = res.shouldTrade
            tradeType = res.tradeType
            prediction = res.prediction
            multiPredictions = res.multiPredictions
            if (shouldTrade) differsEntryTriggeredRef.current = true
          }
          break
        case "digits":
          switch (digitSubType) {
            case "under8":
              if (!under8EntryTriggeredRef.current) {
                const res = checkUnder8Entry(currentDigit, currentStrategy)
                shouldTrade = res.shouldTrade
                tradeType = res.tradeType
                prediction = res.prediction
                if (shouldTrade) under8EntryTriggeredRef.current = true
              }
              break
            case "over2":
              if (!over2EntryTriggeredRef.current) {
                const res = checkOver2Entry(currentDigit, currentStrategy)
                shouldTrade = res.shouldTrade
                tradeType = res.tradeType
                prediction = res.prediction
                if (shouldTrade) over2EntryTriggeredRef.current = true
              }
              break
            case "u4o5":
              if (!u4o5EntryTriggeredRef.current) {
                const res = checkU4O5Entry(currentDigit, currentStrategy)
                shouldTrade = res.shouldTrade
                tradeType = res.tradeType
                prediction = res.prediction
                multiPredictions = res.multiPredictions
                if (shouldTrade) u4o5EntryTriggeredRef.current = true
              }
              break
            case "u3o6":
              if (!u3o6EntryTriggeredRef.current) {
                const res = checkU3O6Entry(currentDigit, currentStrategy)
                shouldTrade = res.shouldTrade
                tradeType = res.tradeType
                prediction = res.prediction
                multiPredictions = res.multiPredictions
                if (shouldTrade) u3o6EntryTriggeredRef.current = true
              }
              break
          }
          break
        default:
          break
      }

      if (!shouldTrade || !tradeType) return

      // Start continuous trading for non-waiting types after first entry
      if (!firstEntryTriggeredRef.current) {
        firstEntryTriggeredRef.current = true

        const waitingTypes = ["U4O5", "U3O6"]
        const shouldUseContinuous = !waitingTypes.includes(tradeType)

        if (shouldUseContinuous) {
          continuousTradingRef.current = true
          setStatus("🚀 Continuous Trading ACTIVATED - Trading until TP/SL reached")
        }
      }

      updateTradingStatus("Executing Trade")
      setStatus("Placing trade(s)...")

      // Handle dual trades for U4O5 and U3O6
      if (tradeType === "DUAL" && Array.isArray(multiPredictions) && multiPredictions.length > 0) {
        const limitedPredictions = multiPredictions.slice(0, 2)

        waitingForContractRef.current = true
        const tradePromises = limitedPredictions.map((p: any) =>
          executeTradeWithLifecycle(p.type || "DIGIT", p.prediction, { skipActiveCheck: true }),
        )

        const contractIds = await Promise.all(tradePromises)

        // Wait for all contracts to complete
        if (tradeLifecycleRef.current) {
          try {
            await Promise.all(
              contractIds
                .filter((id) => id !== null)
                .map((id) => tradeLifecycleRef.current!.waitForContractCompletion(id!)),
            )
          } catch (error) {
            console.error("Some dual trades timed out:", error)
          }
        }

        waitingForContractRef.current = false
        return
      }

      // Standard single trade execution
      waitingForContractRef.current = true
      let mappedTradeType = tradeType
      // Map strategy markers to explicit Deriv digit over/under contract types
      if (tradeType === "UNDER8" || tradeType === "UNDER5") mappedTradeType = "DIGITUNDER"
      if (tradeType === "OVER2" || tradeType === "OVER5") mappedTradeType = "DIGITOVER"

      const contractId = await executeTradeWithLifecycle(mappedTradeType, prediction, {
        skipActiveCheck: false,
      })

      // Wait for contract completion if in continuous trading mode
      if (continuousTradingRef.current && contractId) {
        try {
          await tradeLifecycleRef.current?.waitForContractCompletion(contractId)
        } catch (error) {
          console.error(`Contract ${contractId} timeout:`, error)
        }
      }

      waitingForContractRef.current = false
    } catch (err) {
      console.error("executeAITradeLogic error:", err)
      waitingForContractRef.current = false
    } finally {
      updateTradingStatus("Monitoring")
    }
  }

  // FIXED: Enhanced entry detection functions for each trade type

  const checkEvenOddEntry = (currentDigit: number): any => {
    const analysis = analysisDataRef.current
    if (!analysis) return { shouldTrade: false, tradeType: "", prediction: null }

    const targetType = analysis.targetType
    const oppositeType = analysis.oppositeType
    const requiredOpposite = analysis.requiredOpposite || 4

    const isOpposite =
      (targetType === "EVEN" && currentDigit % 2 !== 0) || (targetType === "ODD" && currentDigit % 2 === 0)

    const isTarget =
      (targetType === "EVEN" && currentDigit % 2 === 0) || (targetType === "ODD" && currentDigit % 2 !== 0)

    if (isOpposite) {
      consecutiveOppositeCountRef.current++
    } else if (isTarget && consecutiveOppositeCountRef.current >= requiredOpposite) {
      const result = {
        shouldTrade: true,
        tradeType: analysis.target,
        prediction: null,
      }
      consecutiveOppositeCountRef.current = 0
      return result
    } else {
      consecutiveOppositeCountRef.current = 0
    }

    return { shouldTrade: false, tradeType: "", prediction: null }
  }

  const checkRiseFallEntry = (): any => {
    const analysis = analysisDataRef.current
    if (!analysis || recentMovementsRef.current.length < 2)
      return { shouldTrade: false, tradeType: "", prediction: null }

    const targetType = analysis.targetType
    const oppositeType = analysis.oppositeType
    const requiredOpposite = analysis.requiredOpposite || 2

    // Get current movement (last in array)
    const currentMovement = recentMovementsRef.current[recentMovementsRef.current.length - 1]

    // Check if current movement is opposite to target
    const isOpposite = currentMovement === oppositeType
    const isTarget = currentMovement === targetType

    if (isOpposite) {
      consecutiveOppositeCountRef.current++
    } else if (isTarget && consecutiveOppositeCountRef.current >= requiredOpposite) {
      const result = {
        shouldTrade: true,
        tradeType: analysis.target,
        prediction: null,
      }
      consecutiveOppositeCountRef.current = 0
      return result
    } else {
      consecutiveOppositeCountRef.current = 0
    }

    return { shouldTrade: false, tradeType: "", prediction: null }
  }

  const checkMatchDiffEntry = (currentDigit: number, currentStrategy: string): any => {
    const analysis = analysisDataRef.current
    if (!analysis) return { shouldTrade: false, tradeType: "", prediction: null, multiPredictions: null }

    const strategy = currentStrategy === "DIFFERS" ? "DIFFERS" : analysis.type

    if (strategy === "DIFFERS") {
      if (currentDigit === analysis.digit) {
        return {
          shouldTrade: true,
          tradeType: "DIFFERS",
          prediction: analysis.digit,
          multiPredictions: null,
        }
      }
    } else if (strategy === "UNDER5" || strategy === "OVER5") {
      // FIXED: When in recovery mode for differs, force digit over/under trading
      return {
        shouldTrade: true,
        tradeType: strategy,
        prediction: 5,
        multiPredictions: null,
      }
    }

    return { shouldTrade: false, tradeType: "", prediction: null, multiPredictions: null }
  }

  // FIXED: New specific entry functions for each digit strategy
  const checkUnder8Entry = (currentDigit: number, currentStrategy: string): any => {
    const analysis = analysisDataRef.current
    if (!analysis) return { shouldTrade: false, tradeType: "", prediction: null }

    const strategy = currentStrategy

    if (strategy === "UNDER8" || strategy === "UNDER5") {
      const targetDigit = strategy === "UNDER8" ? 8 : 5

      if (
        (strategy === "UNDER8" && (currentDigit === 8 || currentDigit === 9)) ||
        (strategy === "UNDER5" && currentDigit >= 5)
      ) {
        return {
          shouldTrade: true,
          tradeType: strategy,
          prediction: targetDigit,
          multiPredictions: null,
        }
      }
    }

    return { shouldTrade: false, tradeType: "", prediction: null, multiPredictions: null }
  }

  const checkOver2Entry = (currentDigit: number, currentStrategy: string): any => {
    const analysis = analysisDataRef.current
    if (!analysis) return { shouldTrade: false, tradeType: "", prediction: null }

    const strategy = currentStrategy

    if (strategy === "OVER2" || strategy === "OVER5") {
      const targetDigit = strategy === "OVER2" ? 2 : 5

      if ((strategy === "OVER2" && currentDigit <= 2) || (strategy === "OVER5" && currentDigit <= 5)) {
        return {
          shouldTrade: true,
          tradeType: strategy,
          prediction: targetDigit,
          multiPredictions: null,
        }
      }
    }

    return { shouldTrade: false, tradeType: "", prediction: null, multiPredictions: null }
  }

  const checkU4O5Entry = (currentDigit: number, currentStrategy: string): any => {
    const analysis = analysisDataRef.current
    if (!analysis) return { shouldTrade: false, tradeType: "", prediction: null, multiPredictions: null }

    const strategy = currentStrategy

    if (strategy === "U4O5" || strategy === "U3O6") {
      if (strategy === "U4O5" && (currentDigit === 4 || currentDigit === 5)) {
        return {
          shouldTrade: true,
          tradeType: "DUAL",
          prediction: null,
          multiPredictions: [
            { type: "U4", prediction: 4 },
            { type: "O5", prediction: 5 },
          ],
        }
      }
    }

    return { shouldTrade: false, tradeType: "", prediction: null, multiPredictions: null }
  }

  const checkU3O6Entry = (currentDigit: number, currentStrategy: string): any => {
    const analysis = analysisDataRef.current
    if (!analysis) return { shouldTrade: false, tradeType: "", prediction: null, multiPredictions: null }

    const strategy = currentStrategy

    if (strategy === "U3O6" || strategy === "U4O5") {
      if (strategy === "U3O6" && currentDigit >= 3 && currentDigit <= 6) {
        u3o6PatternRef.current.push(currentDigit)

        if (u3o6PatternRef.current.length >= 2) {
          const result = {
            shouldTrade: true,
            tradeType: "DUAL",
            prediction: null,
            multiPredictions: [
              { type: "U3", prediction: 3 },
              { type: "O6", prediction: 6 },
            ],
          }
          u3o6PatternRef.current = []
          return result
        }
      } else {
        // Reset pattern if digit is outside range
        u3o6PatternRef.current = []
      }
    }

    return { shouldTrade: false, tradeType: "", prediction: null, multiPredictions: null }
  }

  // Preserved contract type mapping (unchanged)
  const mapToDerivContractType = (
    tradeType: string,
    prediction: number | null,
  ): { contract_type: string; barrier?: string } => {
    switch (tradeType) {
      case "DIGITEVEN":
        return { contract_type: "DIGITEVEN" }
      case "DIGITODD":
        return { contract_type: "DIGITODD" }
      case "CALL":
        return { contract_type: "CALL" }
      case "PUT":
        return { contract_type: "PUT" }
      case "DIFFERS":
        return { contract_type: "DIGITDIFF", barrier: String(prediction ?? 0) }
      case "DIGITUNDER":
        // Digit Over/Under - Under prediction: win if last digit < barrier
        return { contract_type: "DIGITUNDER", barrier: String(prediction ?? 0) }
      case "DIGITOVER":
        // Digit Over/Under - Over prediction: win if last digit > barrier
        return { contract_type: "DIGITOVER", barrier: String(prediction ?? 0) }
      case "DIGIT":
        return { contract_type: "DIGITMATCH", barrier: String(prediction ?? 0) }
      case "UNDER8":
        return { contract_type: "DIGITUNDER", barrier: "8" }
      case "UNDER5":
        return { contract_type: "DIGITUNDER", barrier: "5" }
      case "U4":
        return { contract_type: "DIGITUNDER", barrier: "4" }
      case "U3":
        return { contract_type: "DIGITUNDER", barrier: "3" }
      case "OVER2":
        return { contract_type: "DIGITOVER", barrier: "2" }
      case "OVER5":
        return { contract_type: "DIGITOVER", barrier: "5" }
      case "O5":
        return { contract_type: "DIGITOVER", barrier: "5" }
      case "O6":
        return { contract_type: "DIGITOVER", barrier: "6" }
      default:
        console.warn(`Unknown trade type: ${tradeType}, using as-is`)
        return { contract_type: tradeType }
    }
  }

  // Legacy executeTrade function for compatibility
  const executeTrade = async (
    tradeType: string,
    prediction: number | null = null,
    opts: { skipActiveCheck?: boolean } = {},
  ) => {
    return executeTradeWithLifecycle(tradeType, prediction, opts)
  }

  const updateActiveTradesCount = () => {
    const activeTradesElement = document.getElementById("active-trades")
    if (activeTradesElement) {
      activeTradesElement.textContent = Object.keys(activeTradesRef.current).length.toString()
    }
  }

  const updateTradingStatus = (status: string) => {
    const statusElement = document.getElementById("trading-status")
    if (statusElement) {
      statusElement.textContent = status
    }
  }

  const checkTPSL = () => {
    const total = cumulativeProfitRef.current
    if (takeProfit !== null && total >= takeProfit) {
      setStatus(`✅ Take Profit reached: $${total.toFixed(2)}`)
      stopAITrading()
      return true
    }
    if (stopLoss !== null && total <= -Math.abs(stopLoss)) {
      setStatus(`🛑 Stop Loss reached: $${total.toFixed(2)}`)
      stopAITrading()
      return true
    }
    return false
  }

  const updateTradingStatsDisplay = () => {
    const tradesCount = tradesCountRef.current
    const winsCount = winsCountRef.current
    const winRate = tradesCount > 0 ? (winsCount / tradesCount) * 100 : 0
    const currentStreak = currentStreakRef.current

    const winRateElement = document.getElementById("win-rate")
    const streakElement = document.getElementById("current-streak")

    if (winRateElement) winRateElement.textContent = `${winRate.toFixed(1)}%`
    if (streakElement) {
      streakElement.textContent =
        currentStreak > 0 ? `${currentStreak} Wins` : currentStreak < 0 ? `${Math.abs(currentStreak)} Losses` : "0"
    }
  }

  return (
    <div className="ai-pro-trader">
      {/* 3D Background Elements */}
      <div className="floating-elements">
        <div className="floating-element"></div>
        <div className="floating-element"></div>
        <div className="floating-element"></div>
      </div>

      {/* Data Points Animation */}
      <div className="data-points-container">
        {Array.from({ length: 15 }).map((_, i) => (
          <motion.div
            key={i}
            className="data-point"
            initial={{
              opacity: 0,
              x: Math.random() * 100 - 50,
              y: Math.random() * 100 - 50,
            }}
            animate={{
              opacity: [0, 0.8, 0],
              scale: [0, 1.3, 0],
              rotate: [0, 360],
            }}
            transition={{
              duration: 4 + Math.random() * 3,
              repeat: Infinity,
              delay: Math.random() * 6,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>

      <motion.div 
        className="ai-trader-header"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <div className="pl-display">
          <span className="pl-label">Total P/L:</span>
          <span className={`pl-value ${totalPL >= 0 ? "positive" : "negative"}`}>${totalPL.toFixed(2)}</span>
        </div>
        <div className="connection-status">
          <div className="status-dot connected"></div>
          <span>Connected to Deriv</span>
        </div>
      </motion.div>

      <div className="ai-trader-content">
        <motion.div 
          className="config-panel"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          <div className="config-section">
            <h3>Trading Configuration</h3>

            <div className="config-grid">
              <div className="config-item">
                <label>Trade Type</label>
                <select
                  value={activeTradeKey}
                  onChange={(e) => {
                    setActiveTradeKey(e.target.value as any)
                    setAnalysisResult(null)
                    setAvailableMarkets([])
                    if (recoveryManagerRef.current) recoveryManagerRef.current.reset()
                    continuousTradingRef.current = false
                    firstEntryTriggeredRef.current = false
                    unlockMarket()
                  }}
                  disabled={isTrading}
                >
                  {Object.entries(aiTradeTypes).map(([key, value]) => (
                    <option key={key} value={key}>
                      {value.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="config-item">
                <label>Base Stake ($)</label>
                <input
                  type="number"
                  min="1"
                  step="0.1"
                  value={stake}
                  onChange={(e) => setStake(Number(e.target.value))}
                  disabled={isTrading}
                />
              </div>

              <div className="config-item">
                <label>Martingale Multiplier</label>
                <input
                  type="number"
                  min="1"
                  step="0.1"
                  placeholder="Default: 2"
                  value={martingaleMultiplier ?? ""}
                  onChange={(e) => setMartingaleMultiplier(e.target.value ? Number(e.target.value) : null)}
                  disabled={isTrading}
                />
              </div>

              <div className="config-item">
                <label>Max Martingale Level</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  placeholder="Default: 5"
                  value={maxMartingale ?? ""}
                  onChange={(e) => setMaxMartingale(e.target.value ? Number(e.target.value) : null)}
                  disabled={isTrading}
                />
              </div>

              <div className="config-item">
                <label>Take Profit ($)</label>
                <input
                  type="number"
                  step="0.1"
                  placeholder="Leave empty for no limit"
                  value={takeProfit ?? ""}
                  onChange={(e) => setTakeProfit(e.target.value ? Number(e.target.value) : null)}
                  disabled={isTrading}
                />
              </div>

              <div className="config-item">
                <label>Stop Loss ($)</label>
                <input
                  type="number"
                  step="0.1"
                  placeholder="Leave empty for no limit"
                  value={stopLoss ?? ""}
                  onChange={(e) => setStopLoss(e.target.value ? Number(e.target.value) : null)}
                  disabled={isTrading}
                />
              </div>

              <div className="config-item">
                <label>Ticks</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={ticks}
                  onChange={(e) => setTicks(Number(e.target.value))}
                  disabled={isTrading}
                />
              </div>
            </div>
          </div>
        </motion.div>

        <AITradingPanel
          activeTradeKey={activeTradeKey}
          onAnalyze={analyzeMarkets}
          onStartTrading={startAITrading}
          onStopTrading={stopAITrading}
          analysisResult={analysisResult}
          isAnalyzing={isAnalyzing}
          isTrading={isTrading}
          digitSubType={digitSubType}
          onDigitSubTypeChange={setDigitSubType}
          availableMarkets={availableMarkets}
          onMarketSelect={handleMarketSelect}
          onRefresh={refreshTool}
          // NEW: Pass profit/loss data
          totalWin={totalWin}
          totalLoss={totalLoss}
          netProfit={netProfit}
        />
      </div>

      <motion.div 
        className="status-bar"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.3 }}
      >
        <div className="status-content">
          <div className="status-icon">📊</div>
          <div className="status-text">{status}</div>
        </div>
        {isTrading && (
          <div className="trading-indicator">
            <div className="pulse"></div>
            <span>AI TRADING ACTIVE</span>
            {recoveryModeRef.current && (
              <span className="recovery-badge">RECOVERY MODE</span>
            )}
          </div>
        )}
      </motion.div>

      <motion.div 
        className="market-info"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.4 }}
      >
        <div className="info-item">
          <span className="label">Current Symbol:</span>
          <span className="value">{symbol || "None"}</span>
        </div>
        <div className="info-item">
          <span className="label">Last Digit:</span>
          <span className="value">{lastDigit !== null ? lastDigit : "Waiting..."}</span>
        </div>
        <div className="info-item">
          <span className="label">Ticks Processed:</span>
          <span className="value">{ticksProcessed}</span>
        </div>
      </motion.div>
    </div>
  )
})

export default AIEnhancedTradeUi
