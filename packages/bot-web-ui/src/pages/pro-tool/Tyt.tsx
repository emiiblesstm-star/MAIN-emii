"use client"
import { useEffect, useRef, useState, useLayoutEffect } from "react"
import { observer } from "mobx-react-lite"
import { motion } from "framer-motion"
import { ArrowUp, Hash, Sigma, Dice5, TrendingUp } from "lucide-react"
import {
  generateDerivApiInstance,
  V2GetActiveClientId,
  V2GetActiveToken,
} from "@/external/bot-skeleton/services/api/appId"
import { tradeOptionToBuy } from "@/external/bot-skeleton/services/tradeEngine/utils/helpers"
import { useStore } from "@/hooks/useStore"
import "./pro-tool.scss"

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
const CIRCLE_RADIUS = 36
const CIRCUMFERENCE = 2 * Math.PI * CIRCLE_RADIUS

const themes = {
  digits: { name: "Over / Under (Digits)", icon: Sigma },
  evenodd: { name: "Even / Odd", icon: Dice5 },
  risefall: { name: "Rise / Fall", icon: ArrowUp },
  matchdiff: { name: "Matches / Differs", icon: Hash },
  higherlower: { name: "Higher / Lower", icon: TrendingUp },
}

function DynamicTradeCard({ activeKey, onChangeActiveKey, children, statusText }: any) {
  const theme = themes[activeKey] || themes.digits
  const Icon = theme.icon

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -6 }}
      transition={{ type: "spring", stiffness: 220, damping: 22 }}
      className="trade-card"
    >
      <div className="card-header small">
        <div className="header-left">
          <div className="header-content">
            <div className="icon-wrapper">
              <Icon size={18} />
            </div>
            <h3>{theme.name}</h3>
          </div>

          <div className="trade-type-select">
            <label className="visually-hidden">Trade Type</label>
            <select value={activeKey} onChange={(e) => onChangeActiveKey(e.target.value)}>
              <option value="digits">Over / Under (Digits)</option>
              <option value="evenodd">Even / Odd</option>
              <option value="risefall">Rise / Fall</option>
              <option value="matchdiff">Matches / Differs</option>
              <option value="higherlower">Higher / Lower</option>
            </select>
          </div>
        </div>

        <div className={`status-badge inactive`}>
          <span className={`status-dot`} />
          <span className="sr-only">Status</span>
        </div>
      </div>

      <div className="card-content">
        <div className="form-section">{children()}</div>
        {statusText && <div className="status-footer small">{statusText}</div>}
      </div>
    </motion.div>
  )
}

function CirclesDisplay({
  percentages,
  lastDigit,
  onSelectDigit,
  digitRefs,
  activeMode,
  recentDigits,
  recentRiseFall,
  recentHigherLower,
  evenOddPct,
  riseFallPct,
  higherLowerPct,
  overDigitStats,
  underDigitStats,
}: any) {
  const max = Math.max(...percentages)
  const min = Math.min(...percentages)

  const renderCircles = () => (
    <div className="circles-wrap">
      <div className="circles-grid" role="list">
        {Array.from({ length: 10 }).map((_, i) => {
          const pct = percentages[i] || 0
          const arcPct = clamp(pct, 2, 30)
          const dash = (arcPct / 100) * CIRCUMFERENCE
          const dashArray = `${dash} ${CIRCUMFERENCE}`
          const isMax = pct === max
          const isMin = pct === min
          const isActive = lastDigit === i

          return (
            <div
              key={i}
              role="listitem"
              className={`digit-circle ${isActive ? "is-current" : ""}`}
              onClick={() => onSelectDigit(i)}
              ref={(el: HTMLDivElement | null) => (digitRefs.current[i] = el)}
              data-digit={i}
              tabIndex={0}
            >
              <svg width="100%" height="100%" viewBox="0 0 88 88" className="circle-svg" aria-hidden>
                <g transform="translate(44,44)">
                  <circle r={CIRCLE_RADIUS} className="circle-bg" />
                  <circle
                    r={CIRCLE_RADIUS}
                    className={`circle-arc ${isMax ? "max" : isMin ? "min" : ""}`}
                    strokeDasharray={dashArray}
                    strokeDashoffset={CIRCUMFERENCE * 0.25}
                  />
                  <text x="0" y="-4" textAnchor="middle" alignmentBaseline="central" className="svg-digit">
                    {String(i)}
                  </text>
                  <text x="0" y="16" textAnchor="middle" alignmentBaseline="central" className="svg-pct">
                    {pct.toFixed(1)}%
                  </text>
                </g>
              </svg>
            </div>
          )
        })}
      </div>
    </div>
  )

  const historyLimit = 7

  return (
    <div className="circles-and-history">
      {renderCircles()}

      {activeMode === "evenodd" && (
        <div className="history-block" aria-live="polite">
          <div className="history-row" role="list">
            {(recentDigits || []).slice(-historyLimit).map((d: number, i: number) => {
              const cls = d % 2 === 0 ? "pill-even" : "pill-odd"
              return (
                <div key={`e_${i}`} className={`pill ${cls}`}>
                  {d % 2 === 0 ? "E" : "O"}
                </div>
              )
            })}
          </div>

          <div className="history-stats">
            <div className="stat-evenodd">
              <strong>{evenOddPct.even.toFixed(2)}%</strong> <span>Even</span>
            </div>
            <div className="stat-evenodd">
              <strong>{evenOddPct.odd.toFixed(2)}%</strong> <span>Odd</span>
            </div>
          </div>
        </div>
      )}

      {activeMode === "risefall" && (
        <div className="history-block" aria-live="polite">
          <div className="history-row" role="list">
            {(recentRiseFall || []).slice(-historyLimit).map((r: "R" | "F", i: number) => {
              const cls = r === "R" ? "pill-even" : "pill-odd"
              return (
                <div key={`r_${i}`} className={`pill ${cls}`}>
                  {r}
                </div>
              )
            })}
          </div>

          <div className="history-stats">
            <div className="stat-evenodd">
              <strong>{riseFallPct.rise.toFixed(2)}%</strong> <span>Rise</span>
            </div>
            <div className="stat-evenodd">
              <strong>{riseFallPct.fall.toFixed(2)}%</strong> <span>Fall</span>
            </div>
          </div>
        </div>
      )}

      {activeMode === "higherlower" && (
        <div className="history-block" aria-live="polite">
          <div className="history-row" role="list">
            {(recentHigherLower || []).slice(-historyLimit).map((h: "H" | "L", i: number) => {
              const cls = h === "H" ? "pill-even" : "pill-odd"
              return (
                <div key={`h_${i}`} className={`pill ${cls}`}>
                  {h}
                </div>
              )
            })}
          </div>

          <div className="history-stats">
            <div className="stat-evenodd">
              <strong>{higherLowerPct.higher.toFixed(2)}%</strong> <span>Higher</span>
            </div>
            <div className="stat-evenodd">
              <strong>{higherLowerPct.lower.toFixed(2)}%</strong> <span>Lower</span>
            </div>
          </div>
        </div>
      )}

      {activeMode === "digits" && (
        <div className="history-block over-under-stats" aria-live="polite">
          <div className="over-under-container compact">
            <div className="over-section">
              <div className="section-title">OVER</div>
              <div className="digit-stats-row compact">
                {Array.from({ length: 10 }).map((_, i) => (
                  <div key={`over_${i}`} className="digit-stat-item compact">
                    <div className="digit-label compact">{i}</div>
                    <div className="digit-percentage compact">{overDigitStats[i].toFixed(1)}%</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="under-section">
              <div className="section-title">UNDER</div>
              <div className="digit-stats-row compact">
                {Array.from({ length: 10 }).map((_, i) => (
                  <div key={`under_${i}`} className="digit-stat-item compact">
                    <div className="digit-label compact">{i}</div>
                    <div className="digit-percentage compact">{underDigitStats[i].toFixed(1)}%</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const TradeUiClone = observer(() => {
  const { transactions, run_panel } = useStore()
  const apiRef = useRef<any>(null)

  const currentSymbolRef = useRef<string>("")
  const tickStreamIdRef = useRef<string | null>(null)
  const globalMsgHandlerRef = useRef<((evt: MessageEvent) => void) | null>(null)
  const connectionAttachedRef = useRef(false)

  const activeTradesRef = useRef<Record<string, any>>({})
  const stopFlagRef = useRef(false)

  const subIdByContractRef = useRef<Record<string, string | null>>({})

  const cumulativeProfitRef = useRef<number>(0)
  const totalProfitRef = useRef<number>(0)

  const [symbols, setSymbols] = useState<any[]>([])
  const [symbol, setSymbol] = useState<string>("")
  const [account_currency, setAccountCurrency] = useState("USD")
  const [status, setStatus] = useState("")
  const [lastDigit, setLastDigit] = useState<number | null>(null)

  const liveDigitsRef = useRef<number[]>([])
  const livePricesRef = useRef<number[]>([])

  const [percentages, setPercentages] = useState<number[]>(Array(10).fill(0))
  const [evenOddPct, setEvenOddPct] = useState<{ even: number; odd: number }>({ even: 0, odd: 0 })
  const [riseFallPct, setRiseFallPct] = useState<{ rise: number; fall: number }>({ rise: 0, fall: 0 })
  const [higherLowerPct, setHigherLowerPct] = useState<{ higher: number; lower: number }>({ higher: 0, lower: 0 })

  const [overDigitStats, setOverDigitStats] = useState<number[]>(Array(10).fill(0))
  const [underDigitStats, setUnderDigitStats] = useState<number[]>(Array(10).fill(0))

  const decimalLenBySymbolRef = useRef<Record<string, number>>({})
  const [ticksProcessed, setTicksProcessed] = useState(0)

  const [stake, setStake] = useState<number | null>(1)
  const [ticks, setTicks] = useState<number | null>(1)
  const [predictionDigit, setPredictionDigit] = useState<number | null>(null)

  const [digitMode, setDigitMode] = useState<"over" | "under">("over")
  const [parity, setParity] = useState<"even" | "odd">("even")
  const [direction, setDirection] = useState<"rise" | "fall">("rise")
  const [matchType, setMatchType] = useState<"matches" | "differs">("matches")
  const [matchDigit, setMatchDigit] = useState<number | null>(null)

  // FIXED: Higher/Lower state variables
  const [higherLowerType, setHigherLowerType] = useState<"higher" | "lower">("higher")
  const [higherLowerBarrierType, setHigherLowerBarrierType] = useState<"+" | "-">("+")
  const [higherLowerBarrierValue, setHigherLowerBarrierValue] = useState<number | null>(0.05)

  const [takeProfit, setTakeProfit] = useState<number | null>(null)
  const [stopLoss, setStopLoss] = useState<number | null>(null)

  const [martingaleMultiplier, setMartingaleMultiplier] = useState<number | null>(2.0)
  
  // SMART TRADER LOGIC VARIABLES
  const martingaleStepRef = useRef<number>(0)
  const baseStakeRef = useRef<number>(1)
  const currentStakeRef = useRef<number>(1)
  const lossStreakRef = useRef<number>(0)
  const lastOutcomeWasLossRef = useRef<boolean>(false)

  // JET MODE - Default to ON (fast mode)
  const [jetModeEnabled, setJetModeEnabled] = useState<boolean>(true)
  const jetModeEnabledRef = useRef<boolean>(true)

  // SMART TRADER RECOVERY MODE VARIABLES
  const [recoveryModeEnabled, setRecoveryModeEnabled] = useState<boolean>(true)
  const [recoveryTradeType, setRecoveryTradeType] = useState<"DIGITOVER" | "DIGITUNDER">("DIGITUNDER")
  const [recoveryTargetDigit, setRecoveryTargetDigit] = useState<number>(2)
  const isInRecoveryModeRef = useRef<boolean>(false)

  const [autoSwitchEnabled, setAutoSwitchEnabled] = useState<boolean>(false)
  const tradesOnCurrentSymbolRef = useRef<number>(0)
  const nextSwitchThresholdRef = useRef<number>(0)

  const [activeTradeKey, setActiveTradeKey] = useState<"digits" | "evenodd" | "risefall" | "matchdiff" | "higherlower">(
    "digits",
  )

  const circlesPanelRef = useRef<HTMLDivElement | null>(null)
  const digitRefs = useRef<Array<HTMLDivElement | null>>([])
  const [containerW, setContainerW] = useState(500)
  const [debugPriceStr, setDebugPriceStr] = useState<string | null>(null)
  const [showDebug, setShowDebug] = useState<boolean>(false)

  const [indicatorPos, setIndicatorPos] = useState<{ left: number; top: number; visible: boolean }>({
    left: -999,
    top: -999,
    visible: false,
  })

  // SMART TRADER CONTRACT COMPLETION TRACKING
  const currentContractRef = useRef<{
    contract_id: string;
    completed: boolean;
    profit: number;
  } | null>(null)

  const contractCompletionPromiseRef = useRef<{ resolve: () => void; reject: (error: any) => void } | null>(null)

  // JET MODE FAST TRADING TRACKING
  const jetModeContractsRef = useRef<Set<string>>(new Set())
  const jetModeTradeCounterRef = useRef<number>(0)

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

  const [autoTrading, setAutoTrading] = useState(false)
  const autoTradingRef = useRef(false)

  // SMART TRADER MARTINGALE LOGIC
  const applySmartTraderMartingaleLogic = (wasWin: boolean) => {
    if (wasWin) {
      // WIN: Reset everything
      lossStreakRef.current = 0
      martingaleStepRef.current = 0
      currentStakeRef.current = baseStakeRef.current
      isInRecoveryModeRef.current = false
      lastOutcomeWasLossRef.current = false
      
      setStatus(`✅ Trade WIN! Reset to base stake: $${baseStakeRef.current}`)
    } else {
      // LOSS: Apply Smart Trader martingale logic
      lastOutcomeWasLossRef.current = true
      lossStreakRef.current++
      
      // Apply martingale multiplier
      if (martingaleMultiplier && martingaleMultiplier > 1) {
        martingaleStepRef.current = lossStreakRef.current
        currentStakeRef.current = Number((baseStakeRef.current * Math.pow(martingaleMultiplier, lossStreakRef.current)).toFixed(2))
      }
      
      // SMART TRADER RECOVERY MODE LOGIC
      if (recoveryModeEnabled && lossStreakRef.current >= 1 && 
          (activeTradeKey === "digits" || activeTradeKey === "matchdiff")) {
        isInRecoveryModeRef.current = true
        setStatus(`🔄 Recovery Mode ACTIVATED | Martingale: $${currentStakeRef.current} (x${martingaleStepRef.current})`)
      } else {
        setStatus(`🔴 Trade LOSS! Next stake: $${currentStakeRef.current} (x${martingaleStepRef.current})`)
      }
    }
  }

  // UPDATED: Contract completion handler with SMART TRADER LOGIC
  const handleContractCompletion = (contractData: any) => {
    const profit = Number(contractData?.profit || 0)
    const wasWin = profit > 0
    const contractId = String(contractData?.contract_id || "")
    
    // Remove from jet mode tracking
    jetModeContractsRef.current.delete(contractId)
    
    // Apply Smart Trader logic only when Jet Mode is OFF
    if (!jetModeEnabledRef.current) {
      applySmartTraderMartingaleLogic(wasWin)
    } else {
      // Jet Mode ON: Simple status update
      jetModeTradeCounterRef.current++
      if (wasWin) {
        setStatus(`✅ Jet Trade #${jetModeTradeCounterRef.current} WIN! Profit: $${profit.toFixed(2)}`)
      } else {
        setStatus(`🔴 Jet Trade #${jetModeTradeCounterRef.current} LOSS! Loss: $${Math.abs(profit).toFixed(2)}`)
      }
    }

    // Resolve contract completion promise for Smart Trader mode
    if (contractCompletionPromiseRef.current) {
      contractCompletionPromiseRef.current.resolve()
      contractCompletionPromiseRef.current = null
    }

    currentContractRef.current = null
  }

  useEffect(() => {
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
          if (showDebug) setDebugPriceStr(priceStr)
          const digit = extractLastDigitFromFormatted(priceStr)
          if (digit !== null) {
            liveDigitsRef.current.push(digit)
            if (liveDigitsRef.current.length > 2000) liveDigitsRef.current.shift()
            setLastDigit(digit)
            setTicksProcessed((prev) => prev + 1)

            const priceVal = Number(raw)
            if (!Number.isNaN(priceVal)) {
              livePricesRef.current.push(priceVal)
              if (livePricesRef.current.length > 2000) livePricesRef.current.shift()
            }
          }
          return
        }

        if (data?.msg_type === "proposal_open_contract" || data?.proposal_open_contract) {
          const poc = data.proposal_open_contract ?? data
          const contractId = String(poc?.contract_id || poc?.contract?.contract_id || "")
          if (!contractId) return

          try {
            transactions.onBotContractEvent(poc)
          } catch {}

          const profit = Number(poc?.profit || 0)
          if (activeTradesRef.current[contractId]) {
            activeTradesRef.current[contractId].currentProfit = profit
          }

          // JET MODE: Track all open contracts
          if (jetModeEnabledRef.current && poc?.status === "open") {
            jetModeContractsRef.current.add(contractId)
          }

          const isSold = Boolean(poc?.is_sold || poc?.status === "sold" || poc?.cancelled === 1)
          if (isSold) {
            try {
              cumulativeProfitRef.current = Number(cumulativeProfitRef.current || 0) + Number(poc?.profit || 0)
              totalProfitRef.current = Number(totalProfitRef.current || 0) + Number(poc?.profit || 0)
            } catch {}

            // SMART TRADER: Handle contract completion
            if (currentContractRef.current?.contract_id === contractId) {
              currentContractRef.current.completed = true
              currentContractRef.current.profit = Number(poc?.profit || 0)
              handleContractCompletion(poc)
            } else if (jetModeEnabledRef.current) {
              // JET MODE: Handle completion for any contract
              handleContractCompletion(poc)
            }

            const sub = subIdByContractRef.current[contractId]
            if (sub && apiRef.current?.forget) {
              try {
                apiRef.current.forget({ forget: sub })
              } catch {}
              delete subIdByContractRef.current[contractId]
            }

            try {
              delete activeTradesRef.current[contractId]
            } catch {}

            try {
              if (run_panel?.setHasOpenContract) {
                // Only set hasOpenContract to false if no more jet mode contracts
                if (!jetModeEnabledRef.current || jetModeContractsRef.current.size === 0) {
                  run_panel.setHasOpenContract(false)
                }
              }
              if (run_panel?.setContractStage) run_panel.setContractStage && run_panel.setContractStage("CLOSED")
            } catch {}

            checkTPSL()
          } else {
            checkTPSL()
          }
        }
      } catch (err) {}
    }

    try {
      if (apiRef.current?.connection && !connectionAttachedRef.current) {
        apiRef.current.connection.addEventListener("message", globalHandler)
        globalMsgHandlerRef.current = globalHandler
        connectionAttachedRef.current = true
      }
    } catch {}

    const init = async () => {
      try {
        const { active_symbols } = await api.send({ active_symbols: "brief" })
        let syn = (active_symbols || [])
          .filter((s: any) => /synthetic/i.test(s.market) || /^R_/.test(s.symbol))
          .map((s: any) => ({ symbol: s.symbol, display_name: s.display_name }))
        
        const ordered: any[] = []
        const lookup = new Map(syn.map((s: any) => [s.display_name, s]))
        for (const name of desiredDisplayNames) {
          const found = lookup.get(name)
          if (found) {
            ordered.push(found)
          }
        }
        
        syn = ordered
        setSymbols(syn)

        if (syn[0]?.symbol) {
          setSymbol(syn[0].symbol)
          await startTicks(syn[0].symbol)
        }
      } catch (e: any) {
        setStatus(`Init error: ${e?.message || "Unknown"}`)
      }
    }
    init()

    const onResize = () => {
      if (circlesPanelRef.current) setContainerW(circlesPanelRef.current.clientWidth)
      recalcIndicatorPosition()
    }
    window.addEventListener("resize", onResize)
    onResize()

    return () => {
      try {
        if (globalMsgHandlerRef.current && apiRef.current?.connection) {
          apiRef.current.connection.removeEventListener("message", globalMsgHandlerRef.current)
          globalMsgHandlerRef.current = null
          connectionAttachedRef.current = false
        }
      } catch {}

      try {
        Object.values(subIdByContractRef.current).forEach((sub) => {
          if (sub && apiRef.current?.forget)
            try {
              apiRef.current.forget({ forget: sub })
            } catch {}
        })
        subIdByContractRef.current = {}
      } catch {}

      stopTicks()
      window.removeEventListener("resize", onResize)
      apiRef.current?.disconnect?.()
    }
  }, [])

  // Effect to sync jetModeEnabledRef with state
  useEffect(() => {
    jetModeEnabledRef.current = jetModeEnabled
    
    // When switching to Jet Mode ON, reset Smart Trader states
    if (jetModeEnabled) {
      martingaleStepRef.current = 0
      lossStreakRef.current = 0
      currentStakeRef.current = baseStakeRef.current
      isInRecoveryModeRef.current = false
      lastOutcomeWasLossRef.current = false
      jetModeContractsRef.current.clear()
      jetModeTradeCounterRef.current = 0
    }
  }, [jetModeEnabled])

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
      setTicksProcessed((prev) => prev + seedDigits.length)

      computePercentages()
    } catch (err) {}
  }

  const computePercentages = () => {
    const buf = liveDigitsRef.current.slice(-1000)
    const counts = new Array(10).fill(0)
    buf.forEach((d) => {
      if (typeof d === "number" && d >= 0 && d <= 9) counts[d]++
    })
    const total = Math.max(1, buf.length)
    const pcts = counts.map((c) => (c / total) * 100)
    setPercentages(pcts)

    const evenCount = counts.reduce((acc, c, i) => acc + (i % 2 === 0 ? c : 0), 0)
    const oddCount = Math.max(0, buf.length - evenCount)
    const evenPct = (evenCount / Math.max(1, buf.length)) * 100
    const oddPct = (oddCount / Math.max(1, buf.length)) * 100
    setEvenOddPct({ even: evenPct, odd: oddPct })

    const prices = livePricesRef.current.slice(-1000)
    let rise = 0,
      fall = 0
    let higher = 0,
      lower = 0
    for (let i = 1; i < prices.length; i++) {
      const a = prices[i - 1],
        b = prices[i]
      if (b > a) {
        rise++
        higher++
      } else if (b < a) {
        fall++
        lower++
      }
      if (i >= 5) {
        const recentPrices = prices.slice(i - 5, i)
        const avg = recentPrices.reduce((sum, price) => sum + price, 0) / recentPrices.length
        if (b > avg) higher++
        else if (b < avg) lower++
      }
    }
    const rfTotal = Math.max(1, rise + fall)
    setRiseFallPct({ rise: (rise / rfTotal) * 100, fall: (fall / rfTotal) * 100 })

    const hlTotal = Math.max(1, higher + lower)
    setHigherLowerPct({ higher: (higher / hlTotal) * 100, lower: (lower / hlTotal) * 100 })

    const overCounts = new Array(10).fill(0)
    const underCounts = new Array(10).fill(0)

    buf.forEach((d) => {
      if (typeof d === "number" && d >= 0 && d <= 9) {
        for (let target = 0; target <= 9; target++) {
          if (d > target) {
            overCounts[target]++
          } else if (d < target) {
            underCounts[target]++
          }
        }
      }
    })

    const overPcts = overCounts.map((c) => (c / Math.max(1, buf.length)) * 100)
    const underPcts = underCounts.map((c) => (c / Math.max(1, buf.length)) * 100)

    setOverDigitStats(overPcts)
    setUnderDigitStats(underPcts)
  }

  useEffect(() => {
    const iv = setInterval(() => computePercentages(), 1000)
    return () => clearInterval(iv)
  }, [])

  const startTicks = async (sym: string) => {
    stopTicks()

    liveDigitsRef.current = []
    livePricesRef.current = []
    setPercentages(Array(10).fill(0))
    setEvenOddPct({ even: 0, odd: 0 })
    setRiseFallPct({ rise: 0, fall: 0 })
    setHigherLowerPct({ higher: 0, lower: 0 })
    setOverDigitStats(Array(10).fill(0))
    setUnderDigitStats(Array(10).fill(0))
    setLastDigit(null)
    setTicksProcessed(0)
    digitRefs.current = new Array(10).fill(null)

    await analyzeTicksFromHistory(sym, 1000)

    try {
      currentSymbolRef.current = sym

      const res = await apiRef.current.send({ ticks: sym, subscribe: 1 })
      const subId = res?.subscription?.id ?? res?.ticks?.subscribe?.id ?? null
      tickStreamIdRef.current = subId ?? String(sym)
    } catch (e: any) {
      setStatus(`Tick stream error: ${e?.message || "Unknown"}`)
    }
  }

  const stopTicks = () => {
    if (tickStreamIdRef.current && apiRef.current) {
      try {
        apiRef.current.forget?.({ forget: tickStreamIdRef.current })
      } catch {}
      tickStreamIdRef.current = null
    }
    currentSymbolRef.current = ""
    setLastDigit(null)
  }

  const authorizeIfNeeded = async () => {
    const token = V2GetActiveToken()
    const clientId = V2GetActiveClientId()
    if (!token || !clientId) throw new Error("No active token or client ID found")
    const { authorize, error } = await apiRef.current.authorize(token)
    if (error) throw error
    setAccountCurrency(authorize?.currency || "USD")
    return authorize
  }

  const computeTotalProfit = () => {
    const openSum = Object.values(activeTradesRef.current).reduce(
      (s: number, t: any) => s + Number(t.currentProfit || 0),
      0,
    )
    return Number(totalProfitRef.current || 0) + openSum
  }

  const checkTPSL = () => {
    const total = computeTotalProfit()
    if (takeProfit !== null && total >= takeProfit) {
      setStatus(`✅ Take Profit reached: ${total.toFixed(2)}`)
      stopFlagRef.current = true
      if (autoTradingRef.current) stopAutoTrading()
      return true
    }
    if (stopLoss !== null && total <= -Math.abs(stopLoss)) {
      setStatus(`🛑 Stop Loss reached: ${total.toFixed(2)}`)
      stopFlagRef.current = true
      if (autoTradingRef.current) stopAutoTrading()
      return true
    }
    return false
  }

  const switchToRandomVolatility = async () => {
    if (!autoSwitchEnabled || symbols.length <= 1) return

    const eligibleSymbols = symbols.filter((s) => desiredDisplayNames.includes(s.display_name))

    if (eligibleSymbols.length === 0) return

    const currentIndex = eligibleSymbols.findIndex((s) => s.symbol === symbol)
    const availableIndices = eligibleSymbols.map((_, i) => i).filter((i) => i !== currentIndex)

    if (availableIndices.length === 0) return

    const randomIndex = availableIndices[Math.floor(Math.random() * availableIndices.length)]
    const newSymbol = eligibleSymbols[randomIndex].symbol

    setSymbol(newSymbol)
    currentSymbolRef.current = newSymbol
    await startTicks(newSymbol)

    nextSwitchThresholdRef.current = Math.floor(Math.random() * 5) + 1
    tradesOnCurrentSymbolRef.current = 0

    setStatus(`🔄 Switched to ${eligibleSymbols[randomIndex].display_name}`)
  }

  // SMART TRADER: Wait for contract completion
  const waitForContractCompletion = async (): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (jetModeEnabledRef.current) {
        // Jet Mode ON: Don't wait, resolve immediately
        resolve()
        return
      }

      // Jet Mode OFF: Wait for contract completion
      const checkInterval = setInterval(() => {
        if (!currentContractRef.current || currentContractRef.current.completed) {
          clearInterval(checkInterval)
          resolve()
        }
      }, 100)

      // Safety timeout
      setTimeout(() => {
        clearInterval(checkInterval)
        resolve()
      }, 60000) // 60 second timeout
    })
  }

  // FIXED: Higher/Lower trade execution using CALL/PUT with barrier
  const executeHigherLowerTrade = async () => {
    const contract_type = higherLowerType === "higher" ? "CALL" : "PUT"
    const barrier = `${higherLowerBarrierType}${higherLowerBarrierValue}`
    
    const proposal = await apiRef.current.send({
      proposal: 1,
      amount: currentStakeRef.current,
      basis: "stake",
      contract_type,
      currency: account_currency,
      duration: ticks || 5,
      duration_unit: "t",
      symbol: symbol,
      barrier: barrier,
    })

    if (proposal?.error) {
      throw new Error(proposal.error.message)
    }

    const buyResult = await apiRef.current.send({
      buy: proposal.proposal.id,
      price: proposal.proposal.ask_price,
    })

    if (buyResult?.error) {
      throw new Error(buyResult.error.message)
    }

    return buyResult.buy
  }

  // UPDATED: Purchase contract with CORRECT HIGHER/LOWER IMPLEMENTATION
  const purchaseContract = async (
    tradeType: string,
    prediction?: number | null,
    additionalParams?: any,
  ) => {
    await authorizeIfNeeded()

    // Use current stake (includes martingale when Jet Mode is OFF)
    const stakeToUse = jetModeEnabledRef.current ? baseStakeRef.current : currentStakeRef.current

    // SMART TRADER RECOVERY MODE LOGIC (only when Jet Mode is OFF)
    const shouldUseRecovery = !jetModeEnabledRef.current && recoveryModeEnabled && isInRecoveryModeRef.current && 
      (activeTradeKey === "digits" || activeTradeKey === "matchdiff")

    const finalTradeType = shouldUseRecovery ? recoveryTradeType : tradeType

    let finalPrediction = prediction
    if (shouldUseRecovery && (recoveryTradeType === "DIGITOVER" || recoveryTradeType === "DIGITUNDER")) {
      finalPrediction = recoveryTargetDigit
    }

    const currentSym = currentSymbolRef.current || symbol

    // SPECIAL HANDLING FOR HIGHER/LOWER
    if (activeTradeKey === "higherlower") {
      if (!higherLowerBarrierValue || higherLowerBarrierValue <= 0) {
        throw new Error("Invalid barrier value for Higher/Lower trade")
      }
      
      const buyResult = await executeHigherLowerTrade()
      
      // SMART TRADER: Track current contract for completion (only when Jet Mode OFF)
      if (!jetModeEnabledRef.current) {
        currentContractRef.current = {
          contract_id: String(buyResult?.contract_id || ""),
          completed: false,
          profit: 0
        }
      } else {
        // JET MODE: Track contract for fast trading
        jetModeContractsRef.current.add(String(buyResult?.contract_id || ""))
      }

      const jetStatus = jetModeEnabledRef.current ? " [JET ON - FAST]" : " [JET OFF - SAFE]"
      const recoveryStatus = shouldUseRecovery ? " [RECOVERY MODE]" : ""
      const martingaleStatus = !jetModeEnabledRef.current && martingaleStepRef.current > 0 ? ` [MARTINGALE: $${stakeToUse} (x${martingaleStepRef.current})]` : ` [BASE: $${stakeToUse}]`
      setStatus(`Purchased Higher/Lower: ${higherLowerType} | Barrier: ${higherLowerBarrierType}${higherLowerBarrierValue}${jetStatus}${recoveryStatus}${martingaleStatus}`)

      try {
        transactions.onBotContractEvent({
          contract_id: buyResult?.contract_id,
          transaction_ids: { buy: buyResult?.transaction_id },
          buy_price: buyResult?.buy_price,
          currency: account_currency,
          contract_type: higherLowerType === "higher" ? "CALL" : "PUT",
          underlying: currentSym,
          display_name: symbols.find((s) => s.symbol === currentSym)?.display_name || currentSym,
          date_start: Math.floor(Date.now() / 1000),
          status: "open",
        } as any)
      } catch {}

      try {
        if (run_panel?.setHasOpenContract) run_panel.setHasOpenContract(true)
        if (run_panel?.setContractStage) run_panel.setContractStage && run_panel.setContractStage("PURCHASE_SENT")
      } catch {}

      try {
        const cid = String(buyResult?.contract_id || "")
        activeTradesRef.current[cid] = {
          contract_id: cid,
          tp: takeProfit ?? undefined,
          sl: stopLoss ?? undefined,
          currentProfit: 0,
          initialStake: stakeToUse,
        }
      } catch {}

      try {
        const res = await apiRef.current.send({ proposal_open_contract: 1, contract_id: buyResult?.contract_id, subscribe: 1 })
        const subId = res?.subscription?.id ?? null
        if (subId) subIdByContractRef.current[String(buyResult?.contract_id)] = subId
        if (res?.proposal_open_contract) {
          try {
            transactions.onBotContractEvent(res.proposal_open_contract)
          } catch {}
        }
      } catch {}

      return buyResult
    }

    // ORIGINAL LOGIC FOR OTHER TRADE TYPES
    const trade_option: any = {
      amount: stakeToUse,
      basis: "stake",
      contractTypes: [finalTradeType],
      currency: account_currency,
      duration: Number(ticks || 0),
      duration_unit: "t",
      symbol: currentSym,
      ...additionalParams,
    }
    if (finalPrediction !== undefined && finalPrediction !== null) trade_option.prediction = Number(finalPrediction)

    const buy_req = tradeOptionToBuy(finalTradeType, trade_option)
    const { buy, error } = await apiRef.current.buy(buy_req)
    if (error) throw error

    // SMART TRADER: Track current contract for completion (only when Jet Mode OFF)
    if (!jetModeEnabledRef.current) {
      currentContractRef.current = {
        contract_id: String(buy?.contract_id || ""),
        completed: false,
        profit: 0
      }
    } else {
      // JET MODE: Track contract for fast trading
      jetModeContractsRef.current.add(String(buy?.contract_id || ""))
    }

    const jetStatus = jetModeEnabledRef.current ? " [JET ON - FAST]" : " [JET OFF - SAFE]"
    const recoveryStatus = shouldUseRecovery ? " [RECOVERY MODE]" : ""
    const martingaleStatus = !jetModeEnabledRef.current && martingaleStepRef.current > 0 ? ` [MARTINGALE: $${stakeToUse} (x${martingaleStepRef.current})]` : ` [BASE: $${stakeToUse}]`
    setStatus(`Purchased: ${buy?.longcode || "Contract"}${jetStatus}${recoveryStatus}${martingaleStatus}`)

    try {
      transactions.onBotContractEvent({
        contract_id: buy?.contract_id,
        transaction_ids: { buy: buy?.transaction_id },
        buy_price: buy?.buy_price,
        currency: account_currency,
        contract_type: finalTradeType,
        underlying: currentSym,
        display_name: symbols.find((s) => s.symbol === currentSym)?.display_name || currentSym,
        date_start: Math.floor(Date.now() / 1000),
        status: "open",
      } as any)
    } catch {}

    try {
      if (run_panel?.setHasOpenContract) run_panel.setHasOpenContract(true)
      if (run_panel?.setContractStage) run_panel.setContractStage && run_panel.setContractStage("PURCHASE_SENT")
    } catch {}

    try {
      const cid = String(buy?.contract_id || "")
      activeTradesRef.current[cid] = {
        contract_id: cid,
        tp: takeProfit ?? undefined,
        sl: stopLoss ?? undefined,
        currentProfit: 0,
        initialStake: stakeToUse,
      }
    } catch {}

    try {
      const res = await apiRef.current.send({ proposal_open_contract: 1, contract_id: buy?.contract_id, subscribe: 1 })
      const subId = res?.subscription?.id ?? null
      if (subId) subIdByContractRef.current[String(buy?.contract_id)] = subId
      if (res?.proposal_open_contract) {
        try {
          transactions.onBotContractEvent(res.proposal_open_contract)
        } catch {}
      }
    } catch {}

    return buy
  }

  const handleDigitsTrade = async () => {
    try {
      setStatus("Processing...")
      const tradeType = digitMode === "over" ? "DIGITOVER" : "DIGITUNDER"

      await purchaseContract(tradeType, predictionDigit)
    } catch (e: any) {
      setStatus(`Error: ${e?.message || "Unknown"}`)
    }
  }

  const handleEvenOddTrade = async () => {
    try {
      setStatus("Processing...")
      const tradeType = parity === "even" ? "DIGITEVEN" : "DIGITODD"

      await purchaseContract(tradeType, null)
    } catch (e: any) {
      setStatus(`Error: ${e?.message || "Unknown"}`)
    }
  }

  const handleRiseFallTrade = async () => {
    try {
      setStatus("Processing...")
      const tradeType = direction === "rise" ? "CALL" : "PUT"

      await purchaseContract(tradeType, null)
    } catch (e: any) {
      setStatus(`Error: ${e?.message || "Unknown"}`)
    }
  }

  const handleMatchDiffTrade = async () => {
    try {
      setStatus("Processing...")
      const tradeType = matchType === "matches" ? "DIGITMATCH" : "DIGITDIFF"

      await purchaseContract(tradeType, matchDigit ?? undefined)
    } catch (e: any) {
      setStatus(`Error: ${e?.message || "Unknown"}`)
    }
  }

  const handleHigherLowerTrade = async () => {
    try {
      setStatus("Processing Higher/Lower...")
      await purchaseContract("CALL", null) // The type will be handled in purchaseContract
    } catch (e: any) {
      setStatus(`Error: ${e?.message || "Unknown"}`)
    }
  }

  const handleSingleTradeOnce = async () => {
    if (activeTradeKey === "digits") return handleDigitsTrade()
    if (activeTradeKey === "evenodd") return handleEvenOddTrade()
    if (activeTradeKey === "risefall") return handleRiseFallTrade()
    if (activeTradeKey === "matchdiff") return handleMatchDiffTrade()
    if (activeTradeKey === "higherlower") return handleHigherLowerTrade()
  }

  const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms))

  // UPDATED: Auto trading with PROPER JET MODE FAST TRADING
  const startAutoTrading = async () => {
    if (autoTradingRef.current) return
    
    // Initialize stake tracking
    baseStakeRef.current = stake ?? 1
    currentStakeRef.current = baseStakeRef.current
    martingaleStepRef.current = 0
    lossStreakRef.current = 0
    isInRecoveryModeRef.current = false
    lastOutcomeWasLossRef.current = false
    jetModeTradeCounterRef.current = 0
    jetModeContractsRef.current.clear()
    
    setStatus(`Auto trading started - ${jetModeEnabled ? "JET ON (FAST)" : "JET OFF (SAFE)"} - Base stake: $${baseStakeRef.current}`)
    autoTradingRef.current = true
    setAutoTrading(true)
    stopFlagRef.current = false

    totalProfitRef.current = 0
    cumulativeProfitRef.current = 0
    tradesOnCurrentSymbolRef.current = 0
    nextSwitchThresholdRef.current = Math.floor(Math.random() * 5) + 1

    ;(async () => {
      while (autoTradingRef.current && !stopFlagRef.current) {
        try {
          // Clear any previous contract reference (for Smart Trader mode)
          if (!jetModeEnabledRef.current) {
            currentContractRef.current = null
          }

          // Execute trade
          await handleSingleTradeOnce()

          if (autoSwitchEnabled) {
            tradesOnCurrentSymbolRef.current++
          }

          // UPDATED: JET MODE LOGIC - FAST TRADING WITH 200ms DELAY
          if (!jetModeEnabledRef.current) {
            // JET MODE OFF (SAFE): Wait for contract to complete before next trade
            await waitForContractCompletion()
          } else {
            // JET MODE ON (FAST): Wait only 200ms and continue to next trade immediately
            await sleep(200)
          }

          // Check if we should switch symbols
          if (autoSwitchEnabled && tradesOnCurrentSymbolRef.current >= nextSwitchThresholdRef.current) {
            await switchToRandomVolatility()
            tradesOnCurrentSymbolRef.current = 0
          }
        } catch (err: any) {
          setStatus(`Auto loop error: ${err?.message || "Error"}`)
          await sleep(1000)
        }

        checkTPSL()
        if (stopFlagRef.current || !autoTradingRef.current) break
      }

      autoTradingRef.current = false
      setAutoTrading(false)
      if (stopFlagRef.current) {
        setStatus((s) => `${s} • Auto stopped (TP/SL reached)`)
      } else {
        setStatus("Auto stopped")
      }
    })()
  }

  const stopAutoTrading = () => {
    autoTradingRef.current = false
    setAutoTrading(false)
    setStatus("Auto stopped by user")
  }

  const toggleAuto = (v?: boolean) => {
    if (typeof v === "boolean") {
      if (v) startAutoTrading()
      else stopAutoTrading()
    } else {
      if (autoTradingRef.current) stopAutoTrading()
      else startAutoTrading()
    }
  }

  // UPDATED: Jet Mode toggle handler
  const toggleJetMode = () => {
    if (autoTrading) {
      setStatus("❌ Cannot change Jet Mode while auto trading is active")
      return
    }
    
    const newJetMode = !jetModeEnabled
    setJetModeEnabled(newJetMode)
    
    // Reset Smart Trader states when turning Jet Mode ON
    if (newJetMode) {
      martingaleStepRef.current = 0
      lossStreakRef.current = 0
      currentStakeRef.current = baseStakeRef.current
      isInRecoveryModeRef.current = false
      lastOutcomeWasLossRef.current = false
      jetModeContractsRef.current.clear()
      jetModeTradeCounterRef.current = 0
    }
    
    setStatus(`🛩️ Jet Mode ${newJetMode ? "ON (FAST)" : "OFF (SAFE)"}${newJetMode ? " - Martingale/Recovery disabled" : " - Martingale/Recovery enabled"}`)
  }

  const onSelectSymbol = (s: string) => {
    setSymbol(s)
    startTicks(s)
    tradesOnCurrentSymbolRef.current = 0
  }

  const onSelectDigitFromCircles = (d: number) => {
    setPredictionDigit(d)
    setLastDigit(d)
  }

  const recalcIndicatorPosition = () => {
    const idx = lastDigit
    const panel = circlesPanelRef.current
    if (idx === null || idx === undefined || !panel) {
      setIndicatorPos({ left: -999, top: -999, visible: false })
      return
    }
    const target = digitRefs.current[idx]
    if (!target) {
      setIndicatorPos({ left: -999, top: -999, visible: false })
      return
    }

    const panelRect = panel.getBoundingClientRect()
    const tRect = target.getBoundingClientRect()

    const left = Math.round(tRect.left - panelRect.left + tRect.width / 2 - 10)
    const gap = 6
    const top = Math.round(tRect.bottom - panelRect.top + gap)

    setIndicatorPos({ left, top, visible: true })
  }

  useLayoutEffect(() => {
    recalcIndicatorPosition()
    const id = setTimeout(recalcIndicatorPosition, 140)
    return () => clearTimeout(id)
  }, [lastDigit, percentages, containerW])

  useLayoutEffect(() => {
    if (circlesPanelRef.current) setContainerW(circlesPanelRef.current.clientWidth)
  }, [circlesPanelRef.current])

  const recentDigitsDisplay = liveDigitsRef.current.slice(-24)
  const recentRiseFall = (() => {
    const p = livePricesRef.current.slice(-25)
    const res: Array<"R" | "F"> = []
    for (let i = 1; i < p.length; i++) {
      if (p[i] > p[i - 1]) res.push("R")
      else if (p[i] < p[i - 1]) res.push("F")
      else res.push("F")
    }
    return res
  })()

  const recentHigherLower = (() => {
    const p = livePricesRef.current.slice(-25)
    const res: Array<"H" | "L"> = []
    for (let i = 1; i < p.length; i++) {
      if (i >= 5) {
        const recentPrices = p.slice(i - 5, i)
        const avg = recentPrices.reduce((sum, price) => sum + price, 0) / recentPrices.length
        if (p[i] > avg) res.push("H")
        else if (p[i] < avg) res.push("L")
        else res.push("L")
      } else {
        if (p[i] > p[i - 1]) res.push("H")
        else if (p[i] < p[i - 1]) res.push("L")
        else res.push("L")
      }
    }
    return res
  })()

  return (
    <div className="pro-trader">
      {/* Header Section */}
      <div className="pro-trader__header">
        <div className="pro-trader__connection-status">
          <div className="pro-trader__connection-indicator pro-trader__connection-indicator--connected" />
          <span className="pro-trader__connection-text">Connected</span>
        </div>
        
        <div className="pro-trader__total-pl">
          <span className="pro-trader__total-pl-label">Total P/L:</span>
          <span className={`pro-trader__total-pl-value ${computeTotalProfit() >= 0 ? "pro-trader__total-pl-value--positive" : "pro-trader__total-pl-value--negative"}`}>
            ${computeTotalProfit().toFixed(2)}
          </span>
        </div>
      </div>

      {/* Main Content */}
      <div className="pro-trader__content">
        {/* Left Panel - Configuration */}
        <div className="pro-trader__panel pro-trader__panel--config">
          <div className="top-controls">
            <div className="volatility-select">
              <label>Volatility</label>
              <select value={symbol} onChange={(e) => onSelectSymbol(e.target.value)} disabled={autoTrading}>
                {symbols.map((s) => (
                  <option key={s.symbol} value={s.symbol}>
                    {s.display_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="auto-switch-control">
              <button
                className={`btn-switch ${autoSwitchEnabled ? "active" : ""}`}
                onClick={() => setAutoSwitchEnabled(!autoSwitchEnabled)}
                title="Auto-switch volatility randomly"
              >
                {autoSwitchEnabled ? "🔄 Auto-Switch ON" : "🔄 Auto-Switch OFF"}
              </button>
            </div>
          </div>

          {/* TP/SL Section with Jet Mode */}
          <div className="tp-sl-section">
            <div className="tp-input compact">
              <label>Take Profit (global)</label>
              <input
                type="number"
                step="0.1"
                value={takeProfit ?? ""}
                onChange={(e) => setTakeProfit(e.target.value === "" ? null : Number(e.target.value))}
                disabled={autoTrading}
              />
            </div>
            <div className="sl-input compact">
              <label>Stop Loss (global)</label>
              <input
                type="number"
                step="0.1"
                value={stopLoss ?? ""}
                onChange={(e) => setStopLoss(e.target.value === "" ? null : Number(e.target.value))}
                disabled={autoTrading}
              />
            </div>

            {/* Show martingale only when Jet Mode is OFF */}
            {!jetModeEnabled && (
              <div className="martingale-input compact">
                <label>Martingale Multiplier</label>
                <input
                  type="number"
                  step="0.1"
                  min="1"
                  value={martingaleMultiplier ?? ""}
                  onChange={(e) => setMartingaleMultiplier(e.target.value === "" ? null : Number(e.target.value))}
                  disabled={autoTrading}
                  placeholder="e.g., 2.0"
                />
              </div>
            )}
            
            {/* Jet Mode Toggle */}
            <div className="jet-mode-input compact">
              <label>Jet Mode</label>
              <div className={`jet-mode-box ${jetModeEnabled ? "jet-on" : "jet-off"}`}>
                <button
                  className="jet-toggle-btn"
                  onClick={toggleJetMode}
                  disabled={autoTrading}
                  title={jetModeEnabled ? "Fast trading - no waiting, no martingale/recovery" : "Safe trading - waits for completion, with martingale/recovery"}
                >
                  {jetModeEnabled ? "🛩️ JET ON" : "🛩️ JET OFF"}
                </button>
                <div className="jet-mode-info">
                  {jetModeEnabled ? "Fast mode" : "Safe mode"}
                </div>
              </div>
            </div>
          </div>

          {/* Recovery Section - only show when Jet Mode is OFF */}
          {!jetModeEnabled && (activeTradeKey === "digits" || activeTradeKey === "matchdiff") && (
            <div className="recovery-section">
              <div className="recovery-header">
                <label>Recovery Mode</label>
                <button
                  className={`btn-recovery ${recoveryModeEnabled ? "active" : ""}`}
                  onClick={() => setRecoveryModeEnabled(!recoveryModeEnabled)}
                  disabled={autoTrading}
                >
                  {recoveryModeEnabled ? "ON" : "OFF"}
                </button>
              </div>

              {recoveryModeEnabled && (
                <div className="recovery-options">
                  <div className="recovery-field">
                    <label>Recovery Trade Type</label>
                    <select
                      value={recoveryTradeType}
                      onChange={(e) => setRecoveryTradeType(e.target.value as any)}
                      disabled={autoTrading}
                    >
                      <option value="DIGITOVER">Digits Over</option>
                      <option value="DIGITUNDER">Digits Under</option>
                    </select>
                  </div>
                  <div className="recovery-field">
                    <label>Recovery Target Digit</label>
                    <select
                      value={recoveryTargetDigit}
                      onChange={(e) => setRecoveryTargetDigit(Number(e.target.value))}
                      disabled={autoTrading}
                    >
                      {Array.from({ length: 10 }, (_, i) => (
                        <option key={i} value={i}>
                          {i}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="recovery-info">
                    <small>Recovery mode activates after 1 loss and continues with martingale until win</small>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Trade Grid */}
          <div className="trade-grid">
            <DynamicTradeCard
              activeKey={activeTradeKey}
              onChangeActiveKey={(k: any) => setActiveTradeKey(k)}
              statusText={
                activeTradeKey === "digits"
                  ? `Mode ${digitMode.toUpperCase()} • Prediction: ${predictionDigit !== null ? predictionDigit : "—"} • Current Stake: $${currentStakeRef.current} • Ticks: ${ticks ?? "—"} • Jet: ${jetModeEnabled ? "ON (FAST)" : "OFF (SAFE)"}`
                  : activeTradeKey === "evenodd"
                    ? `Parity ${parity.toUpperCase()} • Current Stake: $${currentStakeRef.current} • Ticks ${ticks ?? "—"} • Jet: ${jetModeEnabled ? "ON (FAST)" : "OFF (SAFE)"}`
                    : activeTradeKey === "risefall"
                      ? `Direction ${direction.toUpperCase()} • Current Stake: $${currentStakeRef.current} • Ticks ${ticks ?? "—"} • Jet: ${jetModeEnabled ? "ON (FAST)" : "OFF (SAFE)"}`
                      : activeTradeKey === "matchdiff"
                        ? `Type ${matchType.toUpperCase()} ${matchType === "matches" ? (matchDigit ?? "—") : "(any)"} • Current Stake: $${currentStakeRef.current} • Ticks ${ticks ?? "—"} • Jet: ${jetModeEnabled ? "ON (FAST)" : "OFF (SAFE)"}`
                        : `${higherLowerType.toUpperCase()} • Barrier: ${higherLowerBarrierType}${higherLowerBarrierValue ?? "—"} • Current Stake: $${currentStakeRef.current} • Ticks: ${ticks ?? "—"} • Jet: ${jetModeEnabled ? "ON (FAST)" : "OFF (SAFE)"}`
              }
            >
              {() => (
                <>
                  {activeTradeKey === "digits" && (
                    <div className="form-grid">
                      <div className="form-field">
                        <label>Trade Type</label>
                        <div className="radio-group-boxed">
                          <label className={digitMode === "over" ? "selected" : ""}>
                            <input
                              type="radio"
                              name="digits-type"
                              value="over"
                              checked={digitMode === "over"}
                              onChange={() => setDigitMode("over")}
                              disabled={autoTrading}
                            />{" "}
                            Over
                          </label>
                          <label className={digitMode === "under" ? "selected" : ""}>
                            <input
                              type="radio"
                              name="digits-type"
                              value="under"
                              checked={digitMode === "under"}
                              onChange={() => setDigitMode("under")}
                              disabled={autoTrading}
                            />{" "}
                            Under
                          </label>
                        </div>
                      </div>

                      <div className="form-field">
                        <label>Prediction Digit</label>
                        <input
                          type="number"
                          min={0}
                          max={9}
                          value={predictionDigit ?? ""}
                          onChange={(e) => setPredictionDigit(e.target.value === "" ? null : Number(e.target.value))}
                          disabled={autoTrading}
                        />
                      </div>

                      <div className="form-field">
                        <label>Base Stake</label>
                        <input
                          type="number"
                          min={0}
                          value={stake ?? ""}
                          onChange={(e) => {
                            const newStake = e.target.value === "" ? null : Number(e.target.value)
                            setStake(newStake)
                            baseStakeRef.current = newStake ?? 1
                            // Reset to base stake when user changes it
                            currentStakeRef.current = baseStakeRef.current
                            martingaleStepRef.current = 0
                            lossStreakRef.current = 0
                          }}
                          disabled={autoTrading}
                        />
                      </div>

                      <div className="form-field">
                        <label>Ticks</label>
                        <input
                          type="number"
                          min={1}
                          value={ticks ?? ""}
                          onChange={(e) => setTicks(e.target.value === "" ? null : Number(e.target.value))}
                          disabled={autoTrading}
                        />
                      </div>
                    </div>
                  )}

                  {activeTradeKey === "evenodd" && (
                    <div className="form-grid">
                      <div className="form-field">
                        <label>Select</label>
                        <div className="radio-group-boxed">
                          <label className={parity === "even" ? "selected" : ""}>
                            <input
                              type="radio"
                              name="parity"
                              value="even"
                              checked={parity === "even"}
                              onChange={() => setParity("even")}
                              disabled={autoTrading}
                            />{" "}
                            Even
                          </label>
                          <label className={parity === "odd" ? "selected" : ""}>
                            <input
                              type="radio"
                              name="parity"
                              value="odd"
                              checked={parity === "odd"}
                              onChange={() => setParity("odd")}
                              disabled={autoTrading}
                            />{" "}
                            Odd
                          </label>
                        </div>
                      </div>

                      <div className="form-field">
                        <label>Base Stake</label>
                        <input
                          type="number"
                          min={0}
                          value={stake ?? ""}
                          onChange={(e) => {
                            const newStake = e.target.value === "" ? null : Number(e.target.value)
                            setStake(newStake)
                            baseStakeRef.current = newStake ?? 1
                            // Reset to base stake when user changes it
                            currentStakeRef.current = baseStakeRef.current
                            martingaleStepRef.current = 0
                            lossStreakRef.current = 0
                          }}
                          disabled={autoTrading}
                        />
                      </div>

                      <div className="form-field">
                        <label>Ticks</label>
                        <input
                          type="number"
                          min={1}
                          value={ticks ?? ""}
                          onChange={(e) => setTicks(e.target.value === "" ? null : Number(e.target.value))}
                          disabled={autoTrading}
                        />
                      </div>
                    </div>
                  )}

                  {activeTradeKey === "risefall" && (
                    <div className="form-grid">
                      <div className="form-field">
                        <label>Direction</label>
                        <div className="radio-group-boxed">
                          <label className={direction === "rise" ? "selected" : ""}>
                            <input
                              type="radio"
                              name="direction"
                              value="rise"
                              checked={direction === "rise"}
                              onChange={() => setDirection("rise")}
                              disabled={autoTrading}
                            />{" "}
                            Rise
                          </label>
                          <label className={direction === "fall" ? "selected" : ""}>
                            <input
                              type="radio"
                              name="direction"
                              value="fall"
                              checked={direction === "fall"}
                              onChange={() => setDirection("fall")}
                              disabled={autoTrading}
                            />{" "}
                            Fall
                          </label>
                        </div>
                      </div>

                      <div className="form-field">
                        <label>Base Stake</label>
                        <input
                          type="number"
                          min={0}
                          value={stake ?? ""}
                          onChange={(e) => {
                            const newStake = e.target.value === "" ? null : Number(e.target.value)
                            setStake(newStake)
                            baseStakeRef.current = newStake ?? 1
                            // Reset to base stake when user changes it
                            currentStakeRef.current = baseStakeRef.current
                            martingaleStepRef.current = 0
                            lossStreakRef.current = 0
                          }}
                          disabled={autoTrading}
                        />
                      </div>

                      <div className="form-field">
                        <label>Ticks</label>
                        <input
                          type="number"
                          min={1}
                          value={ticks ?? ""}
                          onChange={(e) => setTicks(e.target.value === "" ? null : Number(e.target.value))}
                          disabled={autoTrading}
                        />
                      </div>
                    </div>
                  )}

                  {activeTradeKey === "matchdiff" && (
                    <div className="form-grid">
                      <div className="form-field">
                        <label>Type</label>
                        <div className="radio-group-boxed">
                          <label className={matchType === "matches" ? "selected" : ""}>
                            <input
                              type="radio"
                              name="matchType"
                              value="matches"
                              checked={matchType === "matches"}
                              onChange={() => setMatchType("matches")}
                              disabled={autoTrading}
                            />{" "}
                            Matches
                          </label>
                          <label className={matchType === "differs" ? "selected" : ""}>
                            <input
                              type="radio"
                              name="matchType"
                              value="differs"
                              checked={matchType === "differs"}
                              onChange={() => setMatchType("differs")}
                              disabled={autoTrading}
                            />{" "}
                            Differs
                          </label>
                        </div>
                      </div>

                      <div className="form-field">
                        <label>Digit</label>
                        <input
                          type="number"
                          min={0}
                          max={9}
                          value={matchDigit ?? ""}
                          onChange={(e) => setMatchDigit(e.target.value === "" ? null : Number(e.target.value))}
                          disabled={autoTrading}
                        />
                      </div>

                      <div className="form-field">
                        <label>Base Stake</label>
                        <input
                          type="number"
                          min={0}
                          value={stake ?? ""}
                          onChange={(e) => {
                            const newStake = e.target.value === "" ? null : Number(e.target.value)
                            setStake(newStake)
                            baseStakeRef.current = newStake ?? 1
                            // Reset to base stake when user changes it
                            currentStakeRef.current = baseStakeRef.current
                            martingaleStepRef.current = 0
                            lossStreakRef.current = 0
                          }}
                          disabled={autoTrading}
                        />
                      </div>

                      <div className="form-field">
                        <label>Ticks</label>
                        <input
                          type="number"
                          min={1}
                          value={ticks ?? ""}
                          onChange={(e) => setTicks(e.target.value === "" ? null : Number(e.target.value))}
                          disabled={autoTrading}
                        />
                      </div>
                    </div>
                  )}

                  {activeTradeKey === "higherlower" && (
                    <div className="form-grid">
                      <div className="form-field">
                        <label>Trade Type</label>
                        <div className="radio-group-boxed">
                          <label className={higherLowerType === "higher" ? "selected" : ""}>
                            <input
                              type="radio"
                              name="higherLowerType"
                              value="higher"
                              checked={higherLowerType === "higher"}
                              onChange={() => setHigherLowerType("higher")}
                              disabled={autoTrading}
                            />{" "}
                            Higher
                          </label>
                          <label className={higherLowerType === "lower" ? "selected" : ""}>
                            <input
                              type="radio"
                              name="higherLowerType"
                              value="lower"
                              checked={higherLowerType === "lower"}
                              onChange={() => setHigherLowerType("lower")}
                              disabled={autoTrading}
                            />{" "}
                            Lower
                          </label>
                        </div>
                      </div>

                      <div className="form-field">
                        <label>Barrier Type</label>
                        <select
                          value={higherLowerBarrierType}
                          onChange={(e) => setHigherLowerBarrierType(e.target.value as "+" | "-")}
                          disabled={autoTrading}
                        >
                          <option value="+">+ (Positive Barrier)</option>
                          <option value="-">- (Negative Barrier)</option>
                        </select>
                      </div>

                      <div className="form-field">
                        <label>Barrier Value</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          value={higherLowerBarrierValue ?? ""}
                          onChange={(e) => setHigherLowerBarrierValue(e.target.value === "" ? null : Number(e.target.value))}
                          disabled={autoTrading}
                        />
                      </div>

                      <div className="form-field">
                        <label>Base Stake</label>
                        <input
                          type="number"
                          min={0}
                          value={stake ?? ""}
                          onChange={(e) => {
                            const newStake = e.target.value === "" ? null : Number(e.target.value)
                            setStake(newStake)
                            baseStakeRef.current = newStake ?? 1
                            // Reset to base stake when user changes it
                            currentStakeRef.current = baseStakeRef.current
                            martingaleStepRef.current = 0
                            lossStreakRef.current = 0
                          }}
                          disabled={autoTrading}
                        />
                      </div>

                      <div className="form-field">
                        <label>Ticks</label>
                        <input
                          type="number"
                          min={1}
                          value={ticks ?? ""}
                          onChange={(e) => setTicks(e.target.value === "" ? null : Number(e.target.value))}
                          disabled={autoTrading}
                        />
                      </div>
                    </div>
                  )}
                </>
              )}
            </DynamicTradeCard>
          </div>

          {/* Status Display */}
          {status && (
            <div className="pro-trader__status">
              <div className="pro-trader__status-item">
                <span className="pro-trader__status-label">Status:</span>
                <span className="pro-trader__status-value">{status}</span>
              </div>
              <div className="pro-trader__status-item">
                <span className="pro-trader__status-label">Loss Streak:</span>
                <span className="pro-trader__status-value">{lossStreakRef.current}</span>
              </div>
              <div className="pro-trader__status-item">
                <span className="pro-trader__status-label">Current Stake:</span>
                <span className="pro-trader__status-value">${currentStakeRef.current.toFixed(2)}</span>
              </div>
              {!jetModeEnabled && isInRecoveryModeRef.current && (
                <div className="pro-trader__status-item pro-trader__status-item--recovery">
                  <span className="pro-trader__status-label">Recovery:</span>
                  <span className="pro-trader__status-value">ACTIVE ({recoveryTradeType} - Digit {recoveryTargetDigit})</span>
                </div>
              )}
              {!jetModeEnabled && martingaleStepRef.current > 0 && (
                <div className="pro-trader__status-item">
                  <span className="pro-trader__status-label">Martingale:</span>
                  <span className="pro-trader__status-value">x{martingaleStepRef.current}</span>
                </div>
              )}
              {jetModeEnabled && (
                <div className="pro-trader__status-item">
                  <span className="pro-trader__status-label">Jet Trades:</span>
                  <span className="pro-trader__status-value">#{jetModeTradeCounterRef.current}</span>
                </div>
              )}
              <div className="pro-trader__status-item">
                <span className="pro-trader__status-label">Jet Mode:</span>
                <span className={`pro-trader__status-value ${jetModeEnabled ? "jet-mode-on" : "jet-mode-off"}`}>
                  {jetModeEnabled ? "ON (FAST)" : "OFF (SAFE)"}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Right Panel - Circles Display */}
        <div className="pro-trader__panel pro-trader__panel--chart">
          <div className="circles-section">
            <div className="circles-panel" ref={circlesPanelRef}>
              <div className="circles-panel-inner">
                <CirclesDisplay
                  percentages={percentages}
                  lastDigit={lastDigit}
                  onSelectDigit={onSelectDigitFromCircles}
                  digitRefs={digitRefs}
                  activeMode={
                    activeTradeKey === "evenodd"
                      ? "evenodd"
                      : activeTradeKey === "risefall"
                        ? "risefall"
                        : activeTradeKey === "higherlower"
                          ? "higherlower"
                          : "digits"
                  }
                  recentDigits={recentDigitsDisplay}
                  recentRiseFall={recentRiseFall}
                  recentHigherLower={recentHigherLower}
                  evenOddPct={evenOddPct}
                  riseFallPct={riseFallPct}
                  higherLowerPct={higherLowerPct}
                  overDigitStats={overDigitStats}
                  underDigitStats={underDigitStats}
                />

                <div
                  className="circle-indicator"
                  style={{
                    left: indicatorPos.left,
                    top: indicatorPos.top,
                    opacity: indicatorPos.visible ? 1 : 0,
                  }}
                  aria-hidden
                >
                  <div className="triangle" />
                </div>
              </div>
            </div>

            <div className="after-circles">
              <div className="circles-legend">
                <div className="legend-item">
                  <span className="dot high" /> High
                </div>
                <div className="legend-item">
                  <span className="dot low" /> Low
                </div>
                <div className="legend-item">
                  <label>
                    <input type="checkbox" checked={showDebug} onChange={(e) => setShowDebug(e.target.checked)} /> Show
                    price string
                  </label>
                </div>
              </div>
              {showDebug && debugPriceStr && (
                <div className="debug-row">
                  PriceStr: <code>{debugPriceStr}</code>
                </div>
              )}
            </div>
          </div>
          
          {/* New Buttons Section Below Circles */}
          <div className="circles-buttons">
            <button
              className={`btn-auto ${autoTrading ? "active" : ""}`}
              onClick={() => toggleAuto()}
              title="Start/Stop Auto Trading"
            >
              {autoTrading ? "Stop Auto Trading" : "Start Auto Trading"}
            </button>
            <button className="btn-primary" onClick={() => handleSingleTradeOnce()} disabled={autoTrading}>
              Execute Single Trade
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}) 

export default TradeUiClone
