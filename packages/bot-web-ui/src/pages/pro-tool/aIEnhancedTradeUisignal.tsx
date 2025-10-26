"use client"
import { useEffect, useRef, useState } from "react"
import { observer } from "mobx-react-lite"
import { motion } from "framer-motion"
import { ArrowUp, Hash, Sigma, Dice5, Brain, Play, Square, AlertCircle, CheckCircle2, RefreshCw, Signal } from "lucide-react"
import {
  generateDerivApiInstance,
  V2GetActiveClientId,
  V2GetActiveToken,
} from "@/external/bot-skeleton/services/api/appId"
import { useStore } from "@/hooks/useStore"
import "./aIEnhancedTradeUisignal.scss"

// AI Signal Types
const aiSignalTypes = {
  evenodd: { name: "Even / Odd Signals", icon: Dice5 },
  risefall: { name: "Rise / Fall Signals", icon: ArrowUp },
  matchdiff: { name: "Differs Signals", icon: Hash },
  digits: { name: "Over / Under Signals", icon: Sigma },
}

// Digit Over/Under Subtypes
const digitSubTypes = {
  under8: "Under 8",
  over2: "Over 2",
  u4o5: "Under 4 & Over 5",
  u3o6: "Under 3 & Over 6",
}

// Signal Types for Rise/Fall
const riseFallSignalTypes = {
  signal1: "Signal 1 (Current Strategy)",
  signal2: "Signal 2 (Consecutive Opposites)"
}

function AISignalPanel({
  activeSignalKey,
  onAnalyze,
  onGetSignal,
  analysisResult,
  isAnalyzing,
  isMonitoring,
  digitSubType,
  onDigitSubTypeChange,
  availableMarkets,
  onMarketSelect,
  onRefresh,
  currentSignal,
  riseFallSignalType,
  onRiseFallSignalTypeChange,
}: any) {
  const theme = aiSignalTypes[activeSignalKey] || aiSignalTypes.evenodd
  const Icon = theme.icon

  const renderSignalSpecificControls = () => {
    switch (activeSignalKey) {
      case "digits":
        return (
          <div className="digit-subtype-selector">
            <label>Digit Strategy:</label>
            <select value={digitSubType} onChange={(e) => onDigitSubTypeChange(e.target.value)} disabled={isMonitoring}>
              {Object.entries(digitSubTypes).map(([key, value]) => (
                <option key={key} value={key}>
                  {value}
                </option>
              ))}
            </select>
          </div>
        )
      case "risefall":
        return (
          <div className="signal-type-selector">
            <label>Signal Type:</label>
            <select value={riseFallSignalType} onChange={(e) => onRiseFallSignalTypeChange(e.target.value)} disabled={isMonitoring}>
              {Object.entries(riseFallSignalTypes).map(([key, value]) => (
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
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="ai-signal-panel">
      {/* Enhanced Background Elements */}
      <div className="grid-background">
        <div className="grid-lines"></div>
        <div className="grid-overlay"></div>
      </div>
      
      <div className="data-points-container">
        {Array.from({ length: 12 }).map((_, i) => (
          <motion.div
            key={i}
            className='data-point'
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

      <div className="binary-rain">
        {Array.from({ length: 15 }).map((_, i) => (
          <motion.div
            key={i}
            className='binary-digit'
            style={{
              left: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 5}s`,
            }}
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: '100vh', opacity: [0, 0.7, 0] }}
            transition={{
              duration: 5 + Math.random() * 10,
              repeat: Infinity,
              ease: 'linear',
            }}
          >
            {Math.random() > 0.5 ? '1' : '0'}
          </motion.div>
        ))}
      </div>

      <div className="connection-nodes">
        {Array.from({ length: 6 }).map((_, i) => (
          <motion.div
            key={i}
            className='node'
            animate={{
              scale: [0.8, 1.2, 0.8],
              opacity: [0.5, 1, 0.5],
            }}
            transition={{
              duration: 2 + Math.random() * 2,
              repeat: Infinity,
              delay: Math.random() * 2,
            }}
          >
            <div className='node-pulse'></div>
          </motion.div>
        ))}
      </div>

      <div className="panel-header">
        <div className="header-content">
          <div className="icon-wrapper">
            <Signal size={20} />
          </div>
          <h3>AI Signal Engine</h3>
        </div>
        <div className="header-actions">
          <button className="btn-refresh" onClick={onRefresh} title="Refresh Tool">
            <RefreshCw size={16} />
          </button>
          <div className={`status-indicator ${isMonitoring ? "monitoring" : isAnalyzing ? "analyzing" : "idle"}`}>
            {isMonitoring ? "MONITORING" : isAnalyzing ? "ANALYZING" : "IDLE"}
          </div>
        </div>
      </div>

      <div className="panel-content">
        {renderSignalSpecificControls()}

        {availableMarkets && availableMarkets.length > 0 && (
          <div className="market-selection">
            <label>Select Market:</label>
            <div className="market-list">
              {availableMarkets.map((market: any, index: number) => (
                <div
                  key={index}
                  className={`market-option ${market.selected ? "selected" : ""}`}
                  onClick={() => onMarketSelect(market)}
                >
                  <div className="market-name">{market.symbolData.display_name}</div>
                  <div className="market-details">
                    {market.type} {market.percentage ? `(${market.percentage.toFixed(1)}%)` : ""}
                    {market.digit !== undefined && ` - Digit: ${market.digit}`}
                  </div>
                  <div className="market-score">Score: {market.score?.toFixed(1) || "N/A"}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="ai-controls">
          <button
            className={`btn-analyze ${isAnalyzing ? "analyzing" : ""}`}
            onClick={onAnalyze}
            disabled={isMonitoring || isAnalyzing}
          >
            {isAnalyzing ? (
              <>
                <div className="spinner"></div>
                Scanning All Volatilities...
              </>
            ) : (
              <>
                <Brain size={16} />
                Scan All Volatilities
              </>
            )}
          </button>

          {analysisResult && (
            <div className={`analysis-result ${analysisResult.found ? "success" : "warning"}`}>
              {analysisResult.found ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
              {analysisResult.message}
            </div>
          )}

          <div className="signal-controls">
            <button
              className={`btn-get-signal ${isMonitoring ? "active" : ""}`}
              onClick={onGetSignal}
              disabled={!analysisResult?.found && !isMonitoring}
            >
              {isMonitoring ? (
                <>
                  <Square size={16} />
                  Stop Signal Monitoring
                </>
              ) : (
                <>
                  <Signal size={16} />
                  Get Live Signals
                </>
              )}
            </button>
          </div>
        </div>

        {currentSignal && (
          <div className="signal-display">
            <div className="signal-header">
              <Signal size={20} />
              <h4>LIVE TRADING SIGNAL</h4>
              <div className="signal-badge">ACTIVE</div>
            </div>
            <div className="signal-content">
              <div className="signal-message">{currentSignal.message}</div>
              <div className="signal-instructions">
                <h5>Execution Instructions:</h5>
                <div className="instructions-list">
                  {currentSignal.instructions.map((instruction: string, index: number) => (
                    <div key={index} className="instruction-item">
                      <div className="instruction-number">{index + 1}</div>
                      <div className="instruction-text">{instruction}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="signal-warning">
                ⚠️ Always analyze before trading. Trade responsibly.
              </div>
            </div>
          </div>
        )}

        {isMonitoring && !currentSignal && (
          <div className="monitoring-status">
            <div className="pulse-dot"></div>
            <span>Monitoring market for entry signals...</span>
          </div>
        )}
      </div>
    </motion.div>
  )
}

const AISignalTool = observer(() => {
  const { transactions, run_panel } = useStore()
  const apiRef = useRef<any>(null)

  // Core state and refs
  const currentSymbolRef = useRef<string>("")
  const tickStreamIdRef = useRef<string | null>(null)
  const globalMsgHandlerRef = useRef<((evt: MessageEvent) => void) | null>(null)
  const connectionAttachedRef = useRef(false)
  const activeSubscriptionsRef = useRef<Set<string>>(new Set())

  const [symbols, setSymbols] = useState<any[]>([])
  const [symbol, setSymbol] = useState<string>("")
  const [account_currency, setAccountCurrency] = useState("USD")
  const [status, setStatus] = useState("Ready to connect...")
  const [lastDigit, setLastDigit] = useState<number | null>(null)

  const liveDigitsRef = useRef<number[]>([])
  const livePricesRef = useRef<number[]>([])
  const decimalLenBySymbolRef = useRef<Record<string, number>>({})
  const [ticksProcessed, setTicksProcessed] = useState(0)

  // AI Signal State
  const [activeSignalKey, setActiveSignalKey] = useState<"evenodd" | "risefall" | "matchdiff" | "digits">("evenodd")
  const [digitSubType, setDigitSubType] = useState<keyof typeof digitSubTypes>("under8")
  const [riseFallSignalType, setRiseFallSignalType] = useState<"signal1" | "signal2">("signal1")
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isMonitoring, setIsMonitoring] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<{ found: boolean; message: string; data?: any } | null>(null)
  const [availableMarkets, setAvailableMarkets] = useState<any[]>([])
  const [currentSignal, setCurrentSignal] = useState<{message: string, instructions: string[]} | null>(null)

  // Signal detection refs
  const analysisDataRef = useRef<any>(null)
  const consecutiveOppositeCountRef = useRef<number>(0)
  const recentMovementsRef = useRef<Array<"R" | "F">>([])
  const recentDigitsRef = useRef<number[]>([])

  // Entry triggers for signal detection
  const signalTriggeredRef = useRef<boolean>(false)

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

  // Initialize API and connection
  const initializeTool = async () => {
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

                if (livePricesRef.current.length >= 2) {
                  const prevPrice = livePricesRef.current[livePricesRef.current.length - 2]
                  const movement = priceVal > prevPrice ? "R" : priceVal < prevPrice ? "F" : "F"
                  recentMovementsRef.current.push(movement)
                  if (recentMovementsRef.current.length > 10) recentMovementsRef.current.shift()
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

      await initializeSymbols()
      setStatus("✅ Connected to Deriv - Ready for Signal Analysis")
    } catch (error: any) {
      setStatus(`❌ Connection error: ${error?.message || "Unknown error"}`)
    }
  }

  useEffect(() => {
    initializeTool()

    return () => {
      if (globalMsgHandlerRef.current && apiRef.current?.connection) {
        apiRef.current.connection.removeEventListener("message", globalMsgHandlerRef.current)
      }
      stopTicks()
    }
  }, [])

  // Signal monitoring effect
  useEffect(() => {
    if (!isMonitoring || lastDigit === null) return

    const timer = setTimeout(() => {
      checkForSignal().catch(console.error)
    }, 100)

    return () => clearTimeout(timer)
  }, [lastDigit, isMonitoring])

  const checkForSignal = async () => {
    if (!isMonitoring || signalTriggeredRef.current) return

    const currentDigit = lastDigit
    if (currentDigit === null) return

    let signal = null

    switch (activeSignalKey) {
      case "evenodd":
        signal = checkEvenOddSignal(currentDigit)
        break
      case "risefall":
        signal = checkRiseFallSignal()
        break
      case "matchdiff":
        signal = checkMatchDiffSignal(currentDigit)
        break
      case "digits":
        signal = checkDigitSignal(currentDigit)
        break
    }

    if (signal) {
      setCurrentSignal(signal)
      signalTriggeredRef.current = true
      setStatus(`🎯 SIGNAL DETECTED: ${signal.message.split('.')[0]}`)
    }
  }

  const checkEvenOddSignal = (currentDigit: number): any => {
    const analysis = analysisDataRef.current
    if (!analysis) return null

    const targetType = analysis.targetType
    const oppositeType = analysis.oppositeType
    const requiredOpposite = analysis.requiredOpposite || 4

    const isOpposite = (targetType === "EVEN" && currentDigit % 2 !== 0) || (targetType === "ODD" && currentDigit % 2 === 0)
    const isTarget = (targetType === "EVEN" && currentDigit % 2 === 0) || (targetType === "ODD" && currentDigit % 2 !== 0)

    if (isOpposite) {
      consecutiveOppositeCountRef.current++
    } else if (isTarget && consecutiveOppositeCountRef.current >= requiredOpposite) {
      consecutiveOppositeCountRef.current = 0
      
      return {
        message: `Wait for ${requiredOpposite} consecutive ${oppositeType.toLowerCase()} digits to appear. Immediately a ${targetType.toLowerCase()} digit appears. Run your bot.`,
        instructions: [
          `Open your bot or pRo dTrader tool`,
          `Set trade type to ${targetType === "EVEN" ? "DIGIT EVEN" : "DIGIT ODD"}`,
          `Wait for ${requiredOpposite} ${oppositeType.toLowerCase()} digits then trade on ${targetType.toLowerCase()}`,
          `Use Your Preferred bot or pRo dTrader or Smart Money for execution`
        ]
      }
    } else {
      consecutiveOppositeCountRef.current = 0
    }

    return null
  }

  const checkRiseFallSignal = (): any => {
    const analysis = analysisDataRef.current
    if (!analysis || recentMovementsRef.current.length < 2) return null

    const targetType = analysis.targetType
    const oppositeType = analysis.oppositeType
    const requiredOpposite = riseFallSignalType === "signal1" ? 2 : 4

    const currentMovement = recentMovementsRef.current[recentMovementsRef.current.length - 1]
    const isOpposite = currentMovement === oppositeType
    const isTarget = currentMovement === targetType

    if (isOpposite) {
      consecutiveOppositeCountRef.current++
    } else if (isTarget && consecutiveOppositeCountRef.current >= requiredOpposite) {
      consecutiveOppositeCountRef.current = 0
      
      const signalMessage = riseFallSignalType === "signal1" 
        ? `Market ${targetType.toLowerCase()} signal detected after ${requiredOpposite} consecutive ${oppositeType.toLowerCase()} movements.`
        : `Wait for ${requiredOpposite} consecutive ${oppositeType.toLowerCase()} movements. Immediately a ${targetType.toLowerCase()} movement appears.`

      return {
        message: signalMessage,
        instructions: [
          `Open your bot or pRo dTrader tool`,
          `Set trade type to ${targetType === "R" ? "RISE" : "FALL"}`,
          riseFallSignalType === "signal2" ? `Wait for ${requiredOpposite} ${oppositeType.toLowerCase()} movements then trade` : "Execute trade now",
          `Use Your Preferred bot or pRo dTrader for execution`,
          `Always analyze before trading`
        ]
      }
    } else {
      consecutiveOppositeCountRef.current = 0
    }

    return null
  }

  const checkMatchDiffSignal = (currentDigit: number): any => {
    const analysis = analysisDataRef.current
    if (!analysis) return null

    if (analysis.type === "DIFFERS" && currentDigit === analysis.digit) {
      return {
        message: `Digit ${analysis.digit} appeared - DIFFERS signal detected.`,
        instructions: [
          `Open your bot or pRo dTrader or Smart Money tool`,
          `Set trade type to DIGIT DIFFERS`,
          `Set barrier to ${analysis.digit}`,
          `Execute trade immediately`,
          `Use Your Preferred bot or pRo dTrader or Smart Money for execution`
        ]
      }
    }

    return null
  }

  const checkDigitSignal = (currentDigit: number): any => {
    const analysis = analysisDataRef.current
    if (!analysis) return null

    switch (digitSubType) {
      case "under8":
        if (currentDigit === 8 || currentDigit === 9) {
          return {
            message: `Digit ${currentDigit} appeared - UNDER 8 signal detected.`,
            instructions: [
              `Open your bot or pRo dTrader or Smart Money tool`,
              `Set trade type to DIGIT UNDER`,
              `Set barrier to 8`,
              `Set recovery to UNDER 5 in your bot settings`,
              `Use Your Preferred bot or pRo dTrader or Smart Money for execution`,
              `Wait for digit 8 or 9 to appear then trade`
            ]
          }
        }
        break

      case "over2":
        if (currentDigit <= 2) {
          return {
            message: `Digit ${currentDigit} appeared - OVER 2 signal detected.`,
            instructions: [
              `Open your bot or pRo dTrader or Smart Money tool`,
              `Set trade type to DIGIT OVER`,
              `Set barrier to 2`,
              `Set recovery to OVER 5 in your bot settings`,
              `Use Your Preferred bot or pRo dTrader or Smart Money for execution`,
              `Wait for digit 0, 1, or 2 to appear then trade`
            ]
          }
        }
        break

      case "u4o5":
        if (currentDigit === 4 || currentDigit === 5) {
          return {
            message: `Digit ${currentDigit} appeared - UNDER 4 & OVER 5 signal detected.`,
            instructions: [
              `Open Smart Money tool in bulk mode`,
              `Add first row: UNDER 4 with barrier 4`,
              `Add second row: OVER 5 with barrier 5`,
              `Or use Advanced AI then Auto AI then over under bot`,
              `Wait for digit 4 or 5 to appear`,
              `Start bulk trading when signal appears`,
              `Analyze before trading`
            ]
          }
        }
        break

      case "u3o6":
        if (currentDigit === 3 || currentDigit === 6) {
          return {
            message: `Digit ${currentDigit} appeared - UNDER 3 & OVER 6 signal detected.`,
            instructions: [
              `Open Smart Money tool in bulk mode`,
              `Add first row: UNDER 3 with barrier 3`,
              `Add second row: OVER 6 with barrier 6`,
              `Or use Advanced AI then Auto AI then over under bot`,
              `Wait for digit 3, 4, 5 or 6 to appear in two sequence`,
              `Start bulk trading when signal appears`,
              `Analyze before trading`
            ]
          }
        }
        break
    }

    return null
  }

  const refreshTool = () => {
    stopSignalMonitoring()

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
    setCurrentSignal(null)
    setLastDigit(null)
    setTicksProcessed(0)
    setStatus("Tool refreshed - Ready to connect...")

    liveDigitsRef.current = []
    livePricesRef.current = []
    recentDigitsRef.current = []
    recentMovementsRef.current = []
    analysisDataRef.current = null
    signalTriggeredRef.current = false
    consecutiveOppositeCountRef.current = 0

    setTimeout(() => {
      initializeTool()
    }, 1000)
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

        switch (activeSignalKey) {
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

        await startTicks(bestMarket.symbolData.symbol)

        analysisMessage = `✅ Best Market: ${bestMarket.symbolData.display_name} - `
        switch (activeSignalKey) {
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

    await startTicks(market.symbolData.symbol)

    let analysisMessage = `✅ Selected Market: ${market.symbolData.display_name} - `
    switch (activeSignalKey) {
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

  const startSignalMonitoring = async () => {
    if (!analysisResult?.found) {
      setStatus("❌ Please analyze markets first")
      return
    }

    try {
      await authorizeIfNeeded()

      setIsMonitoring(true)
      setCurrentSignal(null)
      signalTriggeredRef.current = false
      consecutiveOppositeCountRef.current = 0

      setStatus("🔍 Signal Monitoring Started - Watching for entry signals...")
    } catch (error: any) {
      setStatus(`❌ Failed to start signal monitoring: ${error?.message || "Unknown error"}`)
    }
  }

  const stopSignalMonitoring = () => {
    setIsMonitoring(false)
    signalTriggeredRef.current = false
    setStatus("🛑 Signal Monitoring Stopped")
  }

  // Market analysis functions (unchanged from original)
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

    const digitCounts = new Array(10).fill(0)
    digits.forEach((d) => digitCounts[d]++)

    const digitPercentages = digitCounts.map((count) => (count / digits.length) * 100)

    for (let i = 0; i < 10; i++) {
      if (i === 5) continue
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

  return (
    <div className="ai-signal-tool-enhanced">
      {/* Enhanced Background Elements */}
      <div className="global-background">
        <div className="grid-background">
          <div className="grid-lines"></div>
          <div className="grid-overlay"></div>
        </div>

        <div className="data-points-container">
          {Array.from({ length: 20 }).map((_, i) => (
            <motion.div
              key={i}
              className='data-point'
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

        <div className="particle-effects">
          {Array.from({ length: 8 }).map((_, i) => (
            <motion.div
              key={`particle-${i}`}
              className='particle'
              initial={{
                opacity: 0,
                x: Math.random() * window.innerWidth,
                y: Math.random() * window.innerHeight,
              }}
              animate={{
                opacity: [0, 0.6, 0],
                scale: [0, 1, 0],
                x: Math.random() * window.innerWidth,
                y: Math.random() * window.innerHeight,
              }}
              transition={{
                duration: 6 + Math.random() * 4,
                repeat: Infinity,
                delay: Math.random() * 8,
                ease: "easeInOut",
              }}
            />
          ))}
        </div>

        <div className="binary-rain">
          {Array.from({ length: 25 }).map((_, i) => (
            <motion.div
              key={i}
              className='binary-digit'
              style={{
                left: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 5}s`,
              }}
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: '100vh', opacity: [0, 0.7, 0] }}
              transition={{
                duration: 5 + Math.random() * 10,
                repeat: Infinity,
                ease: 'linear',
              }}
            >
              {Math.random() > 0.5 ? '1' : '0'}
            </motion.div>
          ))}
        </div>

        <div className="connection-nodes">
          {Array.from({ length: 8 }).map((_, i) => (
            <motion.div
              key={i}
              className='node'
              animate={{
                scale: [0.8, 1.2, 0.8],
                opacity: [0.5, 1, 0.5],
              }}
              transition={{
                duration: 2 + Math.random() * 2,
                repeat: Infinity,
                delay: Math.random() * 2,
              }}
            >
              <div className='node-pulse'></div>
            </motion.div>
          ))}
        </div>
      </div>

      <div className="signal-tool-header">
        <div className="header-title">
          <Signal size={24} />
          <h1>AI Signal Generator</h1>
        </div>
        <div className="connection-status">
          <div className="status-dot connected"></div>
          <span>Connected to Deriv</span>
        </div>
      </div>

      <div className="signal-tool-content">
        <div className="signal-type-selector">
          <h3>Signal Type</h3>
          <select
            value={activeSignalKey}
            onChange={(e) => {
              setActiveSignalKey(e.target.value as any)
              setAnalysisResult(null)
              setAvailableMarkets([])
              setCurrentSignal(null)
              stopSignalMonitoring()
            }}
            disabled={isMonitoring}
          >
            {Object.entries(aiSignalTypes).map(([key, value]) => (
              <option key={key} value={key}>
                {value.name}
              </option>
            ))}
          </select>
        </div>

        <AISignalPanel
          activeSignalKey={activeSignalKey}
          onAnalyze={analyzeMarkets}
          onGetSignal={isMonitoring ? stopSignalMonitoring : startSignalMonitoring}
          analysisResult={analysisResult}
          isAnalyzing={isAnalyzing}
          isMonitoring={isMonitoring}
          digitSubType={digitSubType}
          onDigitSubTypeChange={setDigitSubType}
          availableMarkets={availableMarkets}
          onMarketSelect={handleMarketSelect}
          onRefresh={refreshTool}
          currentSignal={currentSignal}
          riseFallSignalType={riseFallSignalType}
          onRiseFallSignalTypeChange={setRiseFallSignalType}
        />

        <div className="status-panel">
          <div className="status-message">{status}</div>
          <div className="market-info">
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
          </div>
        </div>
      </div>
    </div>
  )
})

export default AISignalTool
