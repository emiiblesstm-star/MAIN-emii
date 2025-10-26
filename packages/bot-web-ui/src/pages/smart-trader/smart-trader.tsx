"use client"

import type React from "react"
import { useEffect, useRef, useState, useLayoutEffect } from "react"
import { observer } from "mobx-react-lite"
import { localize } from "@deriv-com/translations"
import {
  generateDerivApiInstance,
  V2GetActiveClientId,
  V2GetActiveToken,
} from "@/external/bot-skeleton/services/api/appId"
import { contract_stages } from "@/constants/contract-stage"
import { useStore } from "@/hooks/useStore"
import "./smart-trader.scss"

// Minimal trade types we will support initially
const TRADE_TYPES = [
  { value: "DIGITOVER", label: "Digits Over" },
  { value: "DIGITUNDER", label: "Digits Under" },
  { value: "DIGITEVEN", label: "Even" },
  { value: "DIGITODD", label: "Odd" },
  { value: "DIGITMATCH", label: "Matches" },
  { value: "DIGITDIFF", label: "Differs" },
]

const tradeOptionToBuy = (contract_type: string, trade_option: any) => {
  const buy = {
    buy: "1",
    price: trade_option.amount,
    parameters: {
      amount: trade_option.amount,
      basis: trade_option.basis,
      contract_type,
      currency: trade_option.currency,
      duration: trade_option.duration,
      duration_unit: trade_option.duration_unit,
      symbol: trade_option.symbol,
    },
  }
  if (trade_option.prediction !== undefined) buy.parameters.selected_tick = trade_option.prediction
  if (!["TICKLOW", "TICKHIGH"].includes(contract_type) && trade_option.prediction !== undefined)
    buy.parameters.barrier = trade_option.prediction
  return buy
}

const Text = ({ children, size, color }: { children: React.ReactNode; size?: string; color?: string }) => (
  <span className={`text-${size || "base"} text-${color || "default"}`}>{children}</span>
)

/** Robust extractor for last digit — fallback when decimal length unknown */
const extractLastDigitFromFormatted = (priceStr: string): number | null => {
  try {
    if (!priceStr) return null
    const parts = priceStr.split(".")
    if (parts.length < 2) {
      const last = parts[0].slice(-1)
      return /^\d$/.test(last) ? Number(last) : null
    }
    const decimal = parts[1]
    if (decimal.length === 0) {
      const last = parts[0].slice(-1)
      return /^\d$/.test(last) ? Number(last) : null
    }
    const last = decimal.slice(-1)
    return /^\d$/.test(last) ? Number(last) : null
  } catch {
    return null
  }
}

type BulkRow = {
  id: string
  symbol: string
  tradeType: string
  ticks: number
  stake: number | null
  tp: number | null
  sl: number | null
  ou_target?: number | null
  md_target?: number | null
  status: string
  contract_id?: string | null
}

const SmartTrader = observer(() => {
  const store = useStore()
  const { run_panel, transactions } = store

  const apiRef = useRef<any>(null)

  // --- New refs for multi-subscription handling ---
  // store subscription id keyed by symbol (when server returns id)
  const subscriptionIdBySymbolRef = useRef<Record<string, string>>({})
  // set of symbols we consider subscribed (includes ones that returned AlreadySubscribed)
  const subscribedSymbolsRef = useRef<Set<string>>(new Set())
  // one global message handler attached to websocket connection
  const globalMessageHandlerRef = useRef<((evt: MessageEvent) => void) | null>(null)
  // currently displayed symbol (the one UI shows digits for)
  const currentDisplayedSymbolRef = useRef<string | null>(null)
  // decimal length per symbol determined from ticks_history
  const decimalLenBySymbolRef = useRef<Record<string, number>>({})

  const lastOutcomeWasLossRef = useRef(false)
  const isInRecoveryModeRef = useRef(false)

  const [is_authorized, setIsAuthorized] = useState(false)
  const [account_currency, setAccountCurrency] = useState<string>("USD")
  const [symbols, setSymbols] = useState<Array<{ symbol: string; display_name: string }>>([])

  // Form state (single-trade)
  const [symbol, setSymbol] = useState<string>("")
  const [tradeType, setTradeType] = useState<string>("DIGITOVER")
  const [ticks, setTicks] = useState<number | null>(null)
  const [stake, setStake] = useState<number | null>(null)
  const [baseStake, setBaseStake] = useState<number | null>(null)

  const [takeProfit, setTakeProfit] = useState<string>("")
  const [stopLoss, setStopLoss] = useState<string>("")

  // Updated default predictions for Over/Under
  const [targetDigit, setTargetDigit] = useState<string>("5")
  const [recoveryTradeType, setRecoveryTradeType] = useState<string>("DIGITUNDER")
  const [recoveryTargetDigit, setRecoveryTargetDigit] = useState<string>("2")
  const [mdPrediction, setMdPrediction] = useState<string>("")
  const [martingaleMultiplier, setMartingaleMultiplier] = useState<number | null>(null)

  const [recoveryModeEnabled, setRecoveryModeEnabled] = useState<boolean>(true)

  const [tickBasedTrading, setTickBasedTrading] = useState<boolean>(false)
  const [tickInterval, setTickInterval] = useState<number | null>(null)
  const tickCounterRef = useRef<number>(0)

  const totalProfitRef = useRef<number>(0)

  // Live digits state (for the currently displayed symbol)
  const HISTORY_LEN = 1000
  const [digits, setDigits] = useState<number[]>([])
  const [lastDigit, setLastDigit] = useState<number | null>(null)
  const [ticksProcessed, setTicksProcessed] = useState<number>(0)

  const [status, setStatus] = useState<string>("")
  const [is_running, setIsRunning] = useState(false)
  const stopFlagRef = useRef<boolean>(false)

  const activeTradesRef = useRef<
    Map<string, { tp: number | null; sl: number | null; initialStake: number; currentProfit?: number }>
  >(new Map())

  // Bulk
  const [bulkMode, setBulkMode] = useState<"simultaneous" | "sequential">("simultaneous")
  const [bulkRows, setBulkRows] = useState<BulkRow[]>([])

  // Display mode toggle (default: numbers)
  const [displayMode, setDisplayMode] = useState<"numbers" | "circles">("numbers")

  // Over/Under target digit selector for single-trade ("" = fallback)
  const [ouTargetDigit, setOuTargetDigit] = useState<string>("")

  // Circles indicator refs
  const circlesContainerRef = useRef<HTMLDivElement | null>(null)
  const [indicatorLeftPx, setIndicatorLeftPx] = useState<number>(-9999)

  const ouPredPreLoss = "5"
  const ouPredPostLoss = "2"

  // -----------------------------
  // === NEW: Circles analysis state
  // -----------------------------
  const [analyzeN, setAnalyzeN] = useState<number>(100) // default analyze last N ticks
  const [isAnalyzed, setIsAnalyzed] = useState<boolean>(false)
  const [freqCounts, setFreqCounts] = useState<number[]>(new Array(10).fill(0))
  const [freqPercentages, setFreqPercentages] = useState<number[]>(new Array(10).fill(0))
  const [freqTotal, setFreqTotal] = useState<number>(0)
  const [useLiveIfAvailable, setUseLiveIfAvailable] = useState<boolean>(true)

  const computeFrequenciesFromDigits = (arr: number[]) => {
    const counts = new Array(10).fill(0)
    for (const d of arr) {
      if (typeof d === "number" && d >= 0 && d <= 9) counts[d]++
    }
    const total = counts.reduce((s, n) => s + n, 0) || 1
    const percentages = counts.map((c) => (c / total) * 100)
    return { counts, percentages, total }
  }

  const analyzeTicksFromHistory = async (sym: string, N: number) => {
    // prefer live buffer if available and requested
    if (useLiveIfAvailable && digits.length >= N) {
      const slice = digits.slice(-N)
      const { counts, percentages, total } = computeFrequenciesFromDigits(slice)
      setFreqCounts(counts)
      setFreqPercentages(percentages)
      setFreqTotal(total)
      setIsAnalyzed(true)
      setStatus(`Analyzed ${N} ticks FROM LIVE BUFFER for ${sym}.`)
      return
    }

    // fallback to ticks_history
    try {
      const req = {
        ticks_history: sym,
        adjust_start_time: 1,
        count: N,
        end: "latest",
        start: 1,
        style: "ticks",
      }
      const res = await apiRef.current.send(req)
      if (res?.error) {
        setStatus(`History error: ${JSON.stringify(res.error)}`)
        return
      }
      const history = res?.history
      if (!history || !Array.isArray(history.prices) || history.prices.length === 0) {
        setStatus(`No history prices returned for ${sym}`)
        return
      }
      const prices: any[] = history.prices
      // detect decimal length like original logic (preserve trailing zeros)
      let maxDec = 0
      for (const p of prices) {
        const s = String(p)
        const idx = s.indexOf(".")
        if (idx >= 0) {
          const decLen = s.length - idx - 1
          if (decLen > maxDec) maxDec = decLen
        }
      }
      decimalLenBySymbolRef.current[sym] = maxDec

      const counts = new Array(10).fill(0)
      for (const p of prices) {
        const qn = Number(p)
        const priceStr = Number.isFinite(qn) ? qn.toFixed(maxDec) : String(p)
        const lastDigit = extractLastDigitFromFormatted(priceStr)
        if (lastDigit !== null) counts[lastDigit]++
      }
      const total = counts.reduce((s, n) => s + n, 0) || 1
      const percentages = counts.map((c) => (c / total) * 100)
      setFreqCounts(counts)
      setFreqPercentages(percentages)
      setFreqTotal(total)
      setIsAnalyzed(true)
      setStatus(`Analyzed ${prices.length} ticks FROM HISTORY for ${sym}.`)
    } catch (err: any) {
      console.error("analyzeTicksFromHistory error", err)
      setStatus(`Analyze error: ${err?.message || JSON.stringify(err)}`)
    }
  }

  // -----------------------------
  // === end new analysis state
  // -----------------------------

  const computeFrequencies = () => {
    // if user performed analysis, prefer it
    if (isAnalyzed && freqPercentages && freqPercentages.length === 10) {
      return { counts: freqCounts, percentages: freqPercentages, total: freqTotal || 1 }
    }

    const slice = digits.slice(-HISTORY_LEN)
    const total = slice.length || 1
    const counts = new Array(10).fill(0)
    for (const d of slice) {
      if (typeof d === "number" && d >= 0 && d <= 9) counts[d]++
    }
    const percentages = counts.map((c) => (c / total) * 100)
    return { counts, percentages, total }
  }

  useLayoutEffect(() => {
    const el = circlesContainerRef.current
    if (!el || lastDigit == null) {
      setIndicatorLeftPx(-9999)
      return
    }
    const cw = el.clientWidth
    const per = cw / 10
    setIndicatorLeftPx(lastDigit * per + per / 2)
  }, [lastDigit, digits, freqPercentages])

  useEffect(() => {
    const onResize = () => {
      const el = circlesContainerRef.current
      if (!el) return
      if (lastDigit != null) {
        const per = el.clientWidth / 10
        setIndicatorLeftPx(lastDigit * per + per / 2)
      }
    }
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [lastDigit])

  const getHintClass = (d: number) => {
    if (tradeType === "DIGITEVEN") return d % 2 === 0 ? "is-green" : "is-red"
    if (tradeType === "DIGITODD") return d % 2 !== 0 ? "is-green" : "is-red"
    if (tradeType === "DIGITOVER" || tradeType === "DIGITUNDER") {
      const activePred =
        ouTargetDigit !== ""
          ? Number(ouTargetDigit)
          : isInRecoveryModeRef.current && recoveryModeEnabled
            ? Number(recoveryTargetDigit)
            : Number(targetDigit)

      const activeTradeType = isInRecoveryModeRef.current && recoveryModeEnabled ? recoveryTradeType : tradeType

      if (activeTradeType === "DIGITOVER") {
        if (d > Number(activePred)) return "is-green"
        if (d < Number(activePred)) return "is-red"
        return "is-neutral"
      }
      if (activeTradeType === "DIGITUNDER") {
        if (d < Number(activePred)) return "is-green"
        if (d > Number(activePred)) return "is-red"
        return "is-neutral"
      }
    }
    if (tradeType === "DIGITMATCH") {
      const targetDigitValue = mdPrediction === "" ? 5 : Number(mdPrediction)
      return d === targetDigitValue ? "is-green" : "is-red"
    }
    if (tradeType === "DIGITDIFF") {
      const targetDigitValue = mdPrediction === "" ? 5 : Number(mdPrediction)
      return d !== targetDigitValue ? "is-green" : "is-red"
    }
    return ""
  }

  const validateInputs = () => {
    const errors: string[] = []
    if (stake === null) errors.push("Stake must be set")
    if (stake !== null && stake < 0.35) errors.push("Stake must be at least 0.35")
    if (stake !== null && stake > 50000) errors.push("Stake too high")
    if (takeProfit !== "" && Number(takeProfit) < 0) errors.push("Take Profit cannot be negative")
    if (stopLoss !== "" && Number(stopLoss) < 0) errors.push("Stop Loss cannot be negative")
    if (ticks === null) errors.push("Ticks must be set")
    if (ticks !== null && (ticks < 1 || ticks > 10)) errors.push("Ticks must be between 1-10")
    if (tickBasedTrading && (tickInterval === null || tickInterval < 1))
      errors.push("Tick interval must be set and >= 1")
    return errors
  }

  const validateBulkRows = (rows: BulkRow[]) => {
    const errors: string[] = []
    rows.forEach((r, idx) => {
      if (!r.symbol) errors.push(`Row ${idx + 1}: symbol missing`)
      if (!r.tradeType) errors.push(`Row ${idx + 1}: tradeType missing`)
      if (r.ticks < 1 || r.ticks > 10) errors.push(`Row ${idx + 1}: ticks must be between 1-10`)
      if (r.stake === null || r.stake === undefined) errors.push(`Row ${idx + 1}: stake missing`)
      if (r.stake !== null && r.stake < 0.35) errors.push(`Row ${idx + 1}: stake must be >= 0.35`)
      if (r.tp !== null && r.tp < 0) errors.push(`Row ${idx + 1}: TP cannot be negative`)
      if (r.sl !== null && r.sl < 0) errors.push(`Row ${idx + 1}: SL cannot be negative`)
    })
    return errors
  }

  useEffect(() => {
    const api = generateDerivApiInstance()
    apiRef.current = api

    const init = async () => {
      try {
        const { active_symbols, error: asErr } = await api.send({ active_symbols: "brief" })
        if (asErr) throw asErr

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
          "Boom 300 Index",
          "Boom 500 Index",
          "Boom 600 Index",
          "Boom 900 Index",
          "Boom 1000 Index",
          "Crash 300 Index",
          "Crash 500 Index",
          "Crash 600 Index",
          "Crash 900 Index",
          "Crash 1000 Index",
          "Bear Market Index",
          "Bull Market Index",
          "Jump 10 Index",
          "Jump 25 Index",
          "Jump 50 Index",
          "Jump 75 Index",
          "Jump 100 Index",
          "Range Break 100 Index",
          "Range Break 200 Index",
          "Step Index 100",
          "Step Index 200",
          "Step Index 300",
          "Step Index 400",
          "Step Index 500",
        ]

        const normalize = (s: string) => (s || "").toLowerCase().replace(/\s+/g, " ").trim()
        const raw: any[] = active_symbols || []

        const nameToCandidates: Record<string, Array<{ symbol: string; display_name: string }>> = {}

        for (const entry of raw) {
          const disp = entry.display_name || entry.symbol || ""
          const n = normalize(disp)
          if (!nameToCandidates[n]) nameToCandidates[n] = []
          nameToCandidates[n].push({ symbol: entry.symbol, display_name: disp })
        }

        const matchedEntries: Array<{ symbol: string; display_name: string }> = []
        // reset alternates map
        const alternatesByDisplay: Record<string, string[]> = {}

        for (const desired of desiredDisplayNames) {
          const desiredNorm = normalize(desired)
          let candidates: Array<{ symbol: string; display_name: string }> = []

          if (nameToCandidates[desiredNorm]) {
            candidates = nameToCandidates[desiredNorm].slice()
          } else {
            const fuzzyCandidates = raw
              .map((s) => ({ symbol: s.symbol, display_name: s.display_name || s.symbol }))
              .filter((s) => {
                const nd = normalize(s.display_name)
                if (nd.includes(desiredNorm) || desiredNorm.includes(nd)) return true
                const dTokens = desiredNorm.split(" ").filter(Boolean)
                let common = 0
                for (const tok of dTokens) if (nd.includes(tok)) common++
                return common >= Math.max(1, Math.floor(dTokens.length / 2))
              })
            candidates = fuzzyCandidates
          }

          if (candidates.length > 0) {
            const uniqueSymbols: Array<{ symbol: string; display_name: string }> = []
            const seen = new Set<string>()
            for (const c of candidates) {
              if (!seen.has(c.symbol)) {
                uniqueSymbols.push(c)
                seen.add(c.symbol)
              }
            }

            let initial = uniqueSymbols[0]
            for (const u of uniqueSymbols) {
              if (normalize(u.display_name) === desiredNorm) {
                initial = u
                break
              }
            }

            matchedEntries.push({ symbol: initial.symbol, display_name: initial.display_name })
            alternatesByDisplay[initial.display_name] = uniqueSymbols
              .filter((u) => u.symbol !== initial.symbol)
              .map((u) => u.symbol)
          } else {
            console.warn(`SmartTrader init: requested product not found in active_symbols: ${desired}`)
          }
        }

        // store alternates
        // (we will only use this alternates object inside startTicks when needed)
        // set symbols for dropdown
        const deduped = Array.from(
          matchedEntries
            .reduce((acc, cur) => {
              if (!acc.has(cur.symbol)) acc.set(cur.symbol, cur)
              return acc
            }, new Map<string, { symbol: string; display_name: string }>())
            .values(),
        )

        setSymbols(deduped)

        // Put alternates into alternatesByDisplayRef (so fallback logic can access)
        alternatesByDisplayRef.current = alternatesByDisplay

        if (!deduped || deduped.length === 0) {
          console.warn("SmartTrader: none of the requested derived products were found in active_symbols.")
          setStatus(
            "Warning: none of the requested derived products were found in Deriv active_symbols for this account. Check availability.",
          )
        } else {
          if (!symbol && deduped[0]?.symbol) setSymbol(deduped[0].symbol)
          if (deduped[0]?.symbol) startTicks(deduped[0].symbol)
        }
      } catch (e: any) {
        console.error("SmartTrader init error", e)
        setStatus(e?.message || "Failed to load symbols")
      }
    }
    init()

    return () => {
      try {
        // cleanup: forget all subscription ids we collected
        const ids = Object.values(subscriptionIdBySymbolRef.current || {})
        ids.forEach((id) => {
          try {
            apiRef.current?.forget?.({ forget: id })
          } catch {}
        })
        subscriptionIdBySymbolRef.current = {}
        subscribedSymbolsRef.current.clear()
        if (globalMessageHandlerRef.current) {
          try {
            apiRef.current?.connection?.removeEventListener("message", globalMessageHandlerRef.current)
          } catch {}
          globalMessageHandlerRef.current = null
        }
        api?.disconnect?.()
      } catch {}
    }
  }, [])

  const authorizeIfNeeded = async () => {
    if (is_authorized) return
    const token = V2GetActiveToken()
    if (!token) {
      setStatus("No token found. Please log in and select an account.")
      throw new Error("No token")
    }
    const { authorize, error } = await apiRef.current.authorize(token)
    if (error) {
      setStatus(`Authorization error: ${error.message || error.code}`)
      throw error
    }
    setIsAuthorized(true)
    const loginid = authorize?.loginid || V2GetActiveClientId()
    setAccountCurrency(authorize?.currency || "USD")
    try {
      store?.client?.setLoginId?.(loginid || "")
      store?.client?.setCurrency?.(authorize?.currency || "USD")
      store?.client?.setIsLoggedIn?.(true)
    } catch {}
  }

  // alternates map (populated at init)
  const alternatesByDisplayRef = useRef<Record<string, string[]>>({})

  // helper: ensure a global message handler is attached once
  const ensureGlobalMessageHandler = () => {
    if (globalMessageHandlerRef.current) return
    const handler = (evt: MessageEvent) => {
      try {
        const data = JSON.parse(evt.data as any)
        // ignore errors here; other code may handle them
        if (!data) return
        // tick messages for any symbol: update only if it matches the currently displayed symbol
        if (data?.msg_type === "tick" && data?.tick?.symbol) {
          const tickSym = data.tick.symbol
          const activeSym = currentDisplayedSymbolRef.current
          if (activeSym && tickSym === activeSym) {
            const rawQuote = data.tick.quote
            // decimal length from history if available
            const decLen = decimalLenBySymbolRef.current[activeSym]
            let priceStr = ""
            try {
              const qn = Number(rawQuote)
              if (!Number.isFinite(qn)) {
                priceStr = String(rawQuote)
              } else if (typeof decLen === "number" && !Number.isNaN(decLen) && decLen >= 0) {
                priceStr = qn.toFixed(decLen)
              } else {
                const s = String(rawQuote)
                const idx = s.indexOf(".")
                if (idx >= 0) {
                  const dd = s.length - idx - 1
                  priceStr = qn.toFixed(dd)
                } else {
                  priceStr = qn.toString()
                }
              }
            } catch {
              priceStr = String(rawQuote)
            }

            const digit = extractLastDigitFromFormatted(priceStr)
            if (digit !== null && !Number.isNaN(digit) && digit >= 0 && digit <= 9) {
              setLastDigit(digit)
              setDigits((prev) => {
                const next =
                  prev.length >= HISTORY_LEN
                    ? [...prev.slice(prev.length - (HISTORY_LEN - 1)), digit]
                    : [...prev, digit]
                return next
              })
              setTicksProcessed((prev) => prev + 1)

              if (tickBasedTrading && is_running && tickInterval !== null && !stopFlagRef.current) {
                tickCounterRef.current++
                if (tickCounterRef.current >= tickInterval) {
                  tickCounterRef.current = 0
                  purchaseOnce().catch((err) => {
                    console.error("Tick-based trade error:", err)
                    setStatus(`Tick-based trade error: ${err?.message || JSON.stringify(err)}`)
                  })
                }
              }
            }
          }
        }

        // If server returns an error object with AlreadySubscribed in a tick reply, surface it but don't break
        if (data?.msg_type === "tick" && data?.error) {
          // log it - it may include AlreadySubscribed
          console.warn("tick msg with error:", data.error)
        }
      } catch (e) {
        // swallow parse errors
      }
    }
    globalMessageHandlerRef.current = handler
    try {
      apiRef.current?.connection?.addEventListener("message", handler)
    } catch {}
  }

  /**
   * startTicks improved:
   * - Keeps multiple subscriptions active (one per symbol) — avoids re-subscribing to already-subscribed symbols
   * - If symbol already subscribed: simply switch displayed symbol (fast)
   * - If not subscribed: request ticks_history to determine decimal length, then subscribe
   * - Handles AlreadySubscribed responses gracefully by marking the symbol subscribed
   */
  const startTicks = async (sym: string) => {
    // set what UI should display immediately
    currentDisplayedSymbolRef.current = sym
    setDigits([])
    setLastDigit(null)
    setTicksProcessed(0)

    // ensure we have a message handler listening for ticks for the displayed symbol
    ensureGlobalMessageHandler()

    // If we already subscribed to this symbol earlier, do not re-subscribe — just return
    if (subscribedSymbolsRef.current.has(sym)) {
      setSymbol(sym)
      setStatus("") // clear prior status
      // reset analysis when switching
      setIsAnalyzed(false)
      return
    }

    try {
      // 1) get ticks_history to detect decimal precision
      try {
        const histReq = {
          ticks_history: sym,
          adjust_start_time: 1,
          count: 100,
          end: "latest",
          start: 1,
          style: "ticks",
        }
        const { history, error: histErr } = await apiRef.current.send(histReq)
        if (histErr) {
          console.warn("ticks_history error for", sym, histErr)
          setStatus(`Ticks history error: ${JSON.stringify(histErr)}`)
        } else if (history && Array.isArray(history.prices)) {
          const prices: any[] = history.prices
          let maxDec = 0
          for (const p of prices) {
            const s = String(p)
            const idx = s.indexOf(".")
            if (idx >= 0) {
              const decLen = s.length - idx - 1
              if (decLen > maxDec) maxDec = decLen
            }
          }
          decimalLenBySymbolRef.current[sym] = maxDec
        }
      } catch (err) {
        // continue even if history request fails
        console.warn("ticks_history request failed:", err)
      }

      // 2) subscribe to ticks for this symbol
      const subRes = await apiRef.current.send({ ticks: sym, subscribe: 1 })
      // If server returned an error object, handle gracefully
      if (subRes?.error) {
        const e = subRes.error
        // If it's AlreadySubscribed, mark it as subscribed and continue
        if (e?.code === "AlreadySubscribed") {
          subscribedSymbolsRef.current.add(sym)
          setSymbol(sym)
          setStatus("")
          console.warn(`AlreadySubscribed for ${sym} — will assume active subscription on server.`)
        } else {
          // surface other errors but don't crash
          setStatus(`Tick subscription error: ${JSON.stringify(e)}`)
          console.error("Tick subscription error:", e)
        }
      }

      if (subRes?.subscription?.id) {
        subscriptionIdBySymbolRef.current[sym] = subRes.subscription.id
        subscribedSymbolsRef.current.add(sym)
        setSymbol(sym)
        setStatus("")
      } else if (!subRes?.subscription?.id && !subRes?.error) {
        // Some servers respond differently; still mark subscribed if no error.
        subscribedSymbolsRef.current.add(sym)
        setSymbol(sym)
        setStatus("")
      }
      // fallback check: if the displayed symbol receives no ticks shortly, attempt alternates (like before)
      const displayNameForSym = symbols.find((s) => s.symbol === sym)?.display_name
      if (displayNameForSym) {
        // reset attempt idx
        const prevProcessed = ticksProcessed
        const schedule = window.setTimeout(() => {
          // if no ticks arrived since we requested subscription, try alternates
          if (ticksProcessed <= prevProcessed) {
            const altList = alternatesByDisplayRef.current[displayNameForSym] || []
            // find next alternate not tried / not subscribed
            for (const alt of altList) {
              if (!subscribedSymbolsRef.current.has(alt)) {
                // attempt to subscribe to alternate symbol (do not forget current)
                console.warn(`No ticks for ${sym}. Attempting alternate ${alt}`)
                startTicks(alt)
                return
              }
            }
            // if all alternates are subscribed or none, just set status
            setStatus(`No ticks available for ${sym}.`)
          }
        }, 1500)
        // cleanup timer in 2s to avoid leaks — we don't keep a reference since it's local
        setTimeout(() => clearTimeout(schedule), 2200)
      }
    } catch (err: any) {
      console.error("startTicks general error", err)
      setStatus(`Tick subscription error: ${JSON.stringify(err)}`)
    }
  }

  const purchaseOnce = async (customStake?: number) => {
    await authorizeIfNeeded()

    const amountToUse = customStake ?? stake
    if (amountToUse == null) throw new Error("Stake not set")

    const currentTradeType =
      (tradeType === "DIGITOVER" || tradeType === "DIGITUNDER") && isInRecoveryModeRef.current && recoveryModeEnabled
        ? recoveryTradeType
        : tradeType

    const trade_option: any = {
      amount: Number(amountToUse),
      basis: "stake",
      contractTypes: [currentTradeType],
      currency: account_currency,
      duration: Number(ticks),
      duration_unit: "t",
      symbol,
    }
    if (currentTradeType === "DIGITOVER" || currentTradeType === "DIGITUNDER") {
      const activePred =
        ouTargetDigit !== ""
          ? Number(ouTargetDigit)
          : isInRecoveryModeRef.current && recoveryModeEnabled
            ? Number(recoveryTargetDigit)
            : Number(targetDigit)
      trade_option.prediction = activePred
    } else if (currentTradeType === "DIGITMATCH" || currentTradeType === "DIGITDIFF") {
      trade_option.prediction = mdPrediction === "" ? 5 : Number(mdPrediction)
    }

    const buy_req = tradeOptionToBuy(currentTradeType, trade_option)
    const { buy, error } = await apiRef.current.buy(buy_req)
    if (error) throw error

    if (buy?.contract_id) {
      activeTradesRef.current.set(String(buy.contract_id), {
        tp: takeProfit === "" ? null : Number(takeProfit),
        sl: stopLoss === "" ? null : Number(stopLoss),
        initialStake: Number(customStake ?? stake ?? 0),
        currentProfit: 0,
      })
    }

    setStatus(`Purchased: ${buy?.longcode || "Contract"} (ID: ${buy?.contract_id})`)
    return buy
  }

  const checkTPSL = (contractId: string, currentProfit: number) => {
    const tradeData = activeTradesRef.current.get(String(contractId))
    if (!tradeData) return false

    tradeData.currentProfit = currentProfit

    let actualTotalProfit = 0
    for (const [id, trade] of activeTradesRef.current.entries()) {
      actualTotalProfit += trade.currentProfit || 0
    }

    totalProfitRef.current = actualTotalProfit

    const { tp, sl } = tradeData
    if (tp != null && totalProfitRef.current >= tp) {
      setStatus(`✅ Take Profit reached! Total profit: +${totalProfitRef.current.toFixed(2)}`)
      activeTradesRef.current.clear()
      stopFlagRef.current = true
      setIsRunning(false)
      try {
        run_panel.setIsRunning(false)
        run_panel.setHasOpenContract(false)
        run_panel.setContractStage(contract_stages.NOT_RUNNING)
      } catch {}
      return true
    }
    if (sl != null && totalProfitRef.current <= -sl) {
      setStatus(`🛑 Stop Loss reached! Total loss: ${totalProfitRef.current.toFixed(2)}`)
      activeTradesRef.current.clear()
      stopFlagRef.current = true
      setIsRunning(false)
      try {
        run_panel.setIsRunning(false)
        run_panel.setHasOpenContract(false)
        run_panel.setContractStage(contract_stages.NOT_RUNNING)
      } catch {}
      return true
    }
    return false
  }

  const onRun = async () => {
    const errors = validateInputs()
    if (errors.length > 0) {
      setStatus(`Validation errors: ${errors.join(", ")}`)
      return
    }

    setStatus("")
    setIsRunning(true)
    stopFlagRef.current = false
    totalProfitRef.current = 0
    isInRecoveryModeRef.current = false

    run_panel.toggleDrawer(true)
    run_panel.setActiveTabIndex(1)
    run_panel.run_id = `smart-${Date.now()}`
    run_panel.setIsRunning(true)
    run_panel.setContractStage(contract_stages.STARTING)

    try {
      const validatedStake = stake as number
      let baseStakeLocal = baseStake ?? validatedStake
      if (baseStakeLocal !== validatedStake) {
        setBaseStake(validatedStake)
        baseStakeLocal = validatedStake
      }

      let lossStreak = 0
      let step = 0

      if (tickBasedTrading) {
        tickCounterRef.current = 0
        setStatus("Tick-based trading started. Waiting for tick intervals...")
        while (!stopFlagRef.current) {
          await new Promise((res) => setTimeout(res, 100))
        }
      } else {
        while (!stopFlagRef.current) {
          const multiplier = martingaleMultiplier ?? 1.0
          const effectiveStake =
            step > 0 ? Number((baseStakeLocal * Math.pow(multiplier, step)).toFixed(2)) : baseStakeLocal

          setStake(effectiveStake)

          const isOU = tradeType === "DIGITOVER" || tradeType === "DIGITUNDER"

          const buy = await purchaseOnce(effectiveStake)

          try {
            const symbol_display = symbols.find((s) => s.symbol === symbol)?.display_name || symbol
            transactions.onBotContractEvent({
              contract_id: buy?.contract_id,
              transaction_ids: { buy: buy?.transaction_id },
              buy_price: buy?.buy_price,
              currency: account_currency,
              contract_type: tradeType as any,
              underlying: symbol,
              display_name: symbol_display,
              date_start: Math.floor(Date.now() / 1000),
              status: "open",
            } as any)
          } catch {}

          run_panel.setHasOpenContract(true)
          run_panel.setContractStage(contract_stages.PURCHASE_SENT)

          try {
            const res = await apiRef.current.send({
              proposal_open_contract: 1,
              contract_id: buy?.contract_id,
              subscribe: 1,
            })
            const { error, proposal_open_contract: pocInit, subscription } = res || {}
            if (error) throw error

            let pocSubId: string | null = subscription?.id || null
            const targetId = String(buy?.contract_id || "")

            if (pocInit && String(pocInit?.contract_id || "") === targetId) {
              transactions.onBotContractEvent(pocInit)
              run_panel.setHasOpenContract(true)
            }

            await new Promise<void>((resolve) => {
              const onMsg = (evt: MessageEvent) => {
                try {
                  const data = JSON.parse(evt.data as any)
                  if (data?.msg_type === "proposal_open_contract") {
                    const poc = data.proposal_open_contract
                    if (!poc) return
                    if (!pocSubId && data?.subscription?.id) pocSubId = data.subscription.id
                    if (String(poc?.contract_id || "") === targetId) {
                      transactions.onBotContractEvent(poc)
                      run_panel.setHasOpenContract(true)

                      const currentProfit = Number(poc?.profit || 0)
                      const shouldClose = checkTPSL(targetId, currentProfit)

                      if (poc?.is_sold || poc?.status === "sold" || shouldClose) {
                        try {
                          if (pocSubId) apiRef.current?.forget?.({ forget: pocSubId })
                        } catch {}
                        apiRef.current?.connection?.removeEventListener("message", onMsg)

                        run_panel.setContractStage(contract_stages.CONTRACT_CLOSED)
                        run_panel.setHasOpenContract(false)

                        const profit = Number(poc?.profit || 0)

                        if (isOU && !shouldClose && recoveryModeEnabled) {
                          if (profit > 0) {
                            lastOutcomeWasLossRef.current = false
                            isInRecoveryModeRef.current = false
                            lossStreak = 0
                            step = 0
                            setStake(baseStakeLocal)
                            setStatus(`✅ Win! Profit: +${profit.toFixed(2)} - Reset to original prediction`)
                          } else {
                            lastOutcomeWasLossRef.current = true
                            if (!isInRecoveryModeRef.current) {
                              isInRecoveryModeRef.current = true
                              setStatus(`❌ Loss: ${profit.toFixed(2)} - Switching to recovery prediction`)
                            }
                            lossStreak++
                            step = Math.min(step + 1, 50)
                          }
                        } else if (!shouldClose) {
                          if (profit > 0) {
                            lastOutcomeWasLossRef.current = false
                            lossStreak = 0
                            step = 0
                            setStake(baseStakeLocal)
                          } else {
                            lastOutcomeWasLossRef.current = true
                            lossStreak++
                            step = Math.min(step + 1, 50)
                          }
                        }

                        resolve()
                      }
                    }
                  }
                } catch {}
              }

              apiRef.current?.connection?.addEventListener("message", onMsg)

              const checkStopInterval = setInterval(() => {
                if (stopFlagRef.current) {
                  try {
                    if (pocSubId) apiRef.current?.forget?.({ forget: pocSubId })
                  } catch {}
                  try {
                    apiRef.current?.connection?.removeEventListener("message", onMsg)
                  } catch {}
                  clearInterval(checkStopInterval)
                  resolve()
                }
              }, 200)
            })
          } catch (subErr) {
            console.error("subscribe poc error", subErr)
          }

          if (stopFlagRef.current) break

          await new Promise((res) => setTimeout(res, 500))
        }
      }
    } catch (e: any) {
      console.error("SmartTrader run loop error", e)
      const msg = e?.message || e?.error?.message || "Something went wrong"
      setStatus(`Error: ${msg}`)
    } finally {
      setIsRunning(false)
      run_panel.setIsRunning(false)
      run_panel.setHasOpenContract(false)
      run_panel.setContractStage(contract_stages.NOT_RUNNING)
    }
  }

  const onStop = () => {
    stopFlagRef.current = true
    setIsRunning(false)
  }

  // ... existing code for bulk helpers ...

  // Bulk helpers
  const addBulkRow = () => {
    setBulkRows((prev) => [
      ...prev,
      {
        id: `row-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        symbol: symbol || (symbols[0]?.symbol ?? ""),
        tradeType: tradeType,
        ticks: ticks || 1,
        stake: stake ?? baseStake ?? null,
        tp: takeProfit === "" ? null : Number(takeProfit),
        sl: stopLoss === "" ? null : Number(stopLoss),
        ou_target:
          tradeType === "DIGITOVER" || tradeType === "DIGITUNDER"
            ? targetDigit !== ""
              ? Number(targetDigit)
              : ouTargetDigit === ""
                ? null
                : Number(ouTargetDigit)
            : ouTargetDigit === ""
              ? null
              : Number(ouTargetDigit),
        md_target: mdPrediction === "" ? null : Number(mdPrediction),
        status: "idle",
        contract_id: null,
      },
    ])
  }

  const updateBulkRow = (id: string, patch: Partial<BulkRow>) => {
    setBulkRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }

  const removeBulkRow = (id: string) => {
    setBulkRows((prev) => prev.filter((r) => r.id !== id))
  }

  const startBulk = async () => {
    if (bulkRows.length === 0) {
      setStatus("No bulk rows configured")
      return
    }
    const errors = validateBulkRows(bulkRows)
    if (errors.length > 0) {
      setStatus(`Bulk validation errors: ${errors.join("; ")}`)
      return
    }

    setStatus("")
    setIsRunning(true)
    stopFlagRef.current = false
    run_panel.toggleDrawer(true)
    run_panel.setActiveTabIndex(1)
    run_panel.run_id = `bulk-${Date.now()}`
    run_panel.setIsRunning(true)
    run_panel.setContractStage(contract_stages.STARTING)

    try {
      if (bulkMode === "simultaneous") {
        await Promise.all(
          bulkRows.map(async (row) => {
            if (stopFlagRef.current) return
            try {
              await authorizeIfNeeded()

              const trade_option: any = {
                amount: Number(row.stake ?? 0),
                basis: "stake",
                contractTypes: [row.tradeType],
                currency: account_currency,
                duration: Number(row.ticks),
                duration_unit: "t",
                symbol: row.symbol,
              }

              if (row.tradeType === "DIGITOVER" || row.tradeType === "DIGITUNDER") {
                const activePred =
                  row.ou_target != null
                    ? row.ou_target
                    : ouTargetDigit !== ""
                      ? Number(ouTargetDigit)
                      : isInRecoveryModeRef.current && recoveryModeEnabled
                        ? ouPredPostLoss === ""
                          ? 2
                          : Number(ouPredPostLoss)
                        : ouPredPreLoss === ""
                          ? 5
                          : Number(ouPredPreLoss)
                trade_option.prediction = activePred
              } else if (row.tradeType === "DIGITMATCH" || row.tradeType === "DIGITDIFF") {
                trade_option.prediction =
                  row.md_target != null ? row.md_target : mdPrediction === "" ? 5 : Number(mdPrediction)
              }

              const buy_req = tradeOptionToBuy(row.tradeType, trade_option)
              const { buy, error } = await apiRef.current.buy(buy_req)
              if (error) {
                updateBulkRow(row.id, { status: "error" })
                return
              }

              const contractId = String(buy?.contract_id)
              activeTradesRef.current.set(contractId, {
                tp: row.tp,
                sl: row.sl,
                initialStake: Number(row.stake ?? 0),
                currentProfit: 0,
              })

              try {
                const res = await apiRef.current.send({
                  proposal_open_contract: 1,
                  contract_id: contractId,
                  subscribe: 1,
                })
                const { subscription } = res || {}
                updateBulkRow(row.id, { status: "submitted", contract_id: contractId })
                await new Promise<void>((resolve) => {
                  const pocSubId: string | null = subscription?.id || null
                  const onMsg = (evt: MessageEvent) => {
                    try {
                      const data = JSON.parse(evt.data as any)
                      if (data?.msg_type === "proposal_open_contract") {
                        const poc = data.proposal_open_contract
                        if (String(poc?.contract_id || "") === contractId) {
                          transactions.onBotContractEvent(poc)
                          const currentProfit = Number(poc?.profit || 0)
                          const closedByTPSL = checkTPSL(contractId, currentProfit)
                          if (poc?.is_sold || poc?.status === "sold" || closedByTPSL) {
                            try {
                              if (pocSubId) apiRef.current?.forget?.({ forget: pocSubId })
                            } catch {}
                            try {
                              apiRef.current?.connection?.removeEventListener("message", onMsg)
                            } catch {}
                            updateBulkRow(row.id, { status: closedByTPSL ? "closed-by-tp/sl" : "closed" })
                            resolve()
                          }
                        }
                      }
                    } catch {}
                  }
                  apiRef.current?.connection?.addEventListener("message", onMsg)

                  const safety = setInterval(() => {
                    if (stopFlagRef.current) {
                      clearInterval(safety)
                      try {
                        if (pocSubId) apiRef.current?.forget?.({ forget: pocSubId })
                      } catch {}
                      try {
                        apiRef.current?.connection?.removeEventListener("message", onMsg)
                      } catch {}
                      updateBulkRow(row.id, { status: "aborted" })
                      resolve()
                    }
                  }, 200)
                })
              } catch (subErr) {
                console.error("bulk subscribe error", subErr)
                updateBulkRow(row.id, { status: "error" })
              }
            } catch (err) {
              console.error("bulk simultaneous buy error", err)
              updateBulkRow(row.id, { status: "error" })
            }
          }),
        )
      } else {
        for (let i = 0; i < bulkRows.length; i++) {
          if (stopFlagRef.current) break
          const row = bulkRows[i]
          try {
            await authorizeIfNeeded()
            const trade_option: any = {
              amount: Number(row.stake ?? 0),
              basis: "stake",
              contractTypes: [row.tradeType],
              currency: account_currency,
              duration: Number(row.ticks),
              duration_unit: "t",
              symbol: row.symbol,
            }
            if (row.tradeType === "DIGITOVER" || row.tradeType === "DIGITUNDER") {
              const activePred =
                row.ou_target != null
                  ? row.ou_target
                  : ouTargetDigit !== ""
                    ? Number(ouTargetDigit)
                    : isInRecoveryModeRef.current && recoveryModeEnabled
                      ? ouPredPostLoss === ""
                        ? 2
                        : Number(ouPredPostLoss)
                      : ouPredPreLoss === ""
                        ? 5
                        : Number(ouPredPreLoss)
              trade_option.prediction = activePred
            } else if (row.tradeType === "DIGITMATCH" || row.tradeType === "DIGITDIFF") {
              trade_option.prediction =
                row.md_target != null ? row.md_target : mdPrediction === "" ? 5 : Number(mdPrediction)
            }

            const buy_req = tradeOptionToBuy(row.tradeType, trade_option)
            const { buy, error } = await apiRef.current.buy(buy_req)
            if (error) {
              updateBulkRow(row.id, { status: "error" })
              continue
            }

            const contractId = String(buy?.contract_id)
            activeTradesRef.current.set(contractId, {
              tp: row.tp,
              sl: row.sl,
              initialStake: Number(row.stake ?? 0),
              currentProfit: 0,
            })
            updateBulkRow(row.id, { status: "submitted", contract_id: contractId })

            try {
              const res = await apiRef.current.send({
                proposal_open_contract: 1,
                contract_id: contractId,
                subscribe: 1,
              })
              const { subscription } = res || {}
              await new Promise<void>((resolve) => {
                const pocSubId: string | null = subscription?.id || null
                const onMsg = (evt: MessageEvent) => {
                  try {
                    const data = JSON.parse(evt.data as any)
                    if (data?.msg_type === "proposal_open_contract") {
                      const poc = data.proposal_open_contract
                      if (String(poc?.contract_id || "") === contractId) {
                        transactions.onBotContractEvent(poc)
                        const currentProfit = Number(poc?.profit || 0)
                        const closedByTPSL = checkTPSL(contractId, currentProfit)
                        if (poc?.is_sold || poc?.status === "sold" || closedByTPSL) {
                          try {
                            if (pocSubId) apiRef.current?.forget?.({ forget: pocSubId })
                          } catch {}
                          try {
                            apiRef.current?.connection?.removeEventListener("message", onMsg)
                          } catch {}
                          updateBulkRow(row.id, { status: closedByTPSL ? "closed-by-tp/sl" : "closed" })
                          resolve()
                        }
                      }
                    }
                  } catch {}
                }
                apiRef.current?.connection?.addEventListener("message", onMsg)

                const safety = setInterval(() => {
                  if (stopFlagRef.current) {
                    clearInterval(safety)
                    try {
                      if (pocSubId) apiRef.current?.forget?.({ forget: pocSubId })
                    } catch {}
                    try {
                      apiRef.current?.connection?.removeEventListener("message", onMsg)
                    } catch {}
                    updateBulkRow(row.id, { status: "aborted" })
                    resolve()
                  }
                }, 200)
              })
            } catch (subErr) {
              console.error("bulk subscribe error seq", subErr)
              updateBulkRow(row.id, { status: "error" })
            }
          } catch (err) {
            console.error("bulk sequential buy error", err)
            updateBulkRow(row.id, { status: "error" })
          }
        }
      }
    } catch (e: any) {
      console.error("bulk run error", e)
      setStatus(`Bulk run error: ${e?.message || e}`)
    } finally {
      setIsRunning(false)
      run_panel.setIsRunning(false)
      run_panel.setHasOpenContract(false)
      run_panel.setContractStage(contract_stages.NOT_RUNNING)
    }
  }

  const stopBulk = () => {
    stopFlagRef.current = true
    setIsRunning(false)
    activeTradesRef.current.clear()
  }

  // UI data for circles
  const { percentages } = computeFrequencies()
  const avgPercent = percentages.reduce((s, p) => s + p, 0) / percentages.length
  const SVG_SIZE = 36
  const R = 14
  const CIRCUMFERENCE = 2 * Math.PI * R

  const maxPct = Math.max(...percentages)
  const minPct = Math.min(...percentages)

  // analyze click handler for UI
  const onAnalyzeClick = async () => {
    if (!symbol) {
      setStatus("Select a symbol first")
      return
    }
    // clamp N to 1..1000
    const N = Math.max(1, Math.min(1000, Math.floor(analyzeN || 1)))
    setAnalyzeN(N)
    setStatus(`Analyzing last ${N} ticks for ${symbol}...`)
    await analyzeTicksFromHistory(symbol, N)
  }

  // When user switches symbol, reset analysis
  const onSymbolChange = (v: string) => {
    setSymbol(v)
    setIsAnalyzed(false)
    startTicks(v)
  }

  // Auto-refresh analysis for circles view: analyze last 1000 ticks every 1s
  useEffect(() => {
    let timerId: number | null = null
    let running = true
    const startAuto = async () => {
      if (!symbol) return
      setAnalyzeN(1000)
      setUseLiveIfAvailable(true)
      try {
        await analyzeTicksFromHistory(symbol, 1000)
      } catch (e) {}
      if (!running) return
      timerId = window.setInterval(() => {
        if (!symbol) return
        analyzeTicksFromHistory(symbol, 1000).catch(() => {})
      }, 1000)
    }
    if (displayMode === "circles") {
      startAuto()
    } else {
      setIsAnalyzed(false)
    }
    return () => {
      running = false
      if (timerId) {
        clearInterval(timerId)
        timerId = null
      }
    }
  }, [displayMode, symbol])

  return (
    <div className="smart-trader">
      <div className="smart-trader__container">
        <div className="smart-trader__content">
          <div className="smart-trader__card">
            {/* BULK MODE SECTION MOVED TO TOP */}
            <div style={{ borderTop: "1px solid var(--border-normal)", paddingTop: 12, marginTop: 12 }}>
              <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 8 }}>
                <label style={{ minWidth: 90 }}>{localize("Bulk Mode")}</label>
                <select value={bulkMode} onChange={(e) => setBulkMode(e.target.value as any)}>
                  <option value="simultaneous">Simultaneous</option>
                  <option value="sequential">Sequential</option>
                </select>
                <button className="smart-trader__run" onClick={addBulkRow} disabled={is_running}>
                  {localize("Add Row")}
                </button>
                <button
                  className="smart-trader__run"
                  onClick={startBulk}
                  disabled={is_running || bulkRows.length === 0}
                >
                  {localize("Start Bulk")}
                </button>
                <button className="smart-trader__stop" onClick={stopBulk} disabled={!is_running}>
                  {localize("Stop Bulk")}
                </button>
              </div>

              <div
                style={{
                  maxHeight: 260,
                  overflowY: "auto",
                  border: "1px solid var(--border-normal)",
                  borderRadius: 8,
                  padding: 8,
                }}
              >
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: "left" }}>#</th>
                      <th style={{ textAlign: "left" }}>Symbol</th>
                      <th style={{ textAlign: "left" }}>Type</th>
                      <th style={{ textAlign: "left" }}>Ticks</th>
                      <th style={{ textAlign: "left" }}>Stake</th>
                      <th style={{ textAlign: "left" }}>TP</th>
                      <th style={{ textAlign: "left" }}>SL</th>
                      <th style={{ textAlign: "left" }}>OU Target</th>
                      <th style={{ textAlign: "left" }}>MD Target</th>
                      <th style={{ textAlign: "left" }}>Status</th>
                      <th style={{ textAlign: "left" }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {bulkRows.map((r, idx) => (
                      <tr key={r.id} style={{ borderTop: "1px solid var(--border-normal)" }}>
                        <td>{idx + 1}</td>
                        <td>
                          <select value={r.symbol} onChange={(e) => updateBulkRow(r.id, { symbol: e.target.value })}>
                            {symbols.map((s) => (
                              <option key={s.symbol} value={s.symbol}>
                                {s.display_name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <select
                            value={r.tradeType}
                            onChange={(e) => updateBulkRow(r.id, { tradeType: e.target.value })}
                          >
                            {TRADE_TYPES.map((t) => (
                              <option key={t.value} value={t.value}>
                                {t.label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <input
                            type="number"
                            min={1}
                            max={10}
                            value={r.ticks}
                            onChange={(e) => updateBulkRow(r.id, { ticks: Number(e.target.value) })}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            step="0.01"
                            min={0.35}
                            value={r.stake ?? ""}
                            placeholder="Stake"
                            onChange={(e) =>
                              updateBulkRow(r.id, { stake: e.target.value === "" ? null : Number(e.target.value) })
                            }
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            step="0.01"
                            min={0}
                            value={r.tp ?? ""}
                            placeholder="TP"
                            onChange={(e) =>
                              updateBulkRow(r.id, { tp: e.target.value === "" ? null : Number(e.target.value) })
                            }
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            step="0.01"
                            min={0}
                            value={r.sl ?? ""}
                            placeholder="SL"
                            onChange={(e) =>
                              updateBulkRow(r.id, { sl: e.target.value === "" ? null : Number(e.target.value) })
                            }
                          />
                        </td>
                        <td>
                          {r.tradeType === "DIGITOVER" || r.tradeType === "DIGITUNDER" ? (
                            <select
                              value={r.ou_target ?? ""}
                              onChange={(e) =>
                                updateBulkRow(r.id, {
                                  ou_target: e.target.value === "" ? null : Number(e.target.value),
                                })
                              }
                            >
                              <option value="">(none)</option>
                              {Array.from({ length: 10 }, (_, i) => (
                                <option key={i} value={String(i)}>
                                  {i}
                                </option>
                              ))}
                            </select>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td>
                          {r.tradeType === "DIGITMATCH" || r.tradeType === "DIGITDIFF" ? (
                            <select
                              value={r.md_target ?? ""}
                              onChange={(e) =>
                                updateBulkRow(r.id, {
                                  md_target: e.target.value === "" ? null : Number(e.target.value),
                                })
                              }
                            >
                              <option value="">(none)</option>
                              {Array.from({ length: 10 }, (_, i) => (
                                <option key={i} value={String(i)}>
                                  {i}
                                </option>
                              ))}
                            </select>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td>{r.status}</td>
                        <td>
                          <button onClick={() => removeBulkRow(r.id)}>Remove</button>
                        </td>
                      </tr>
                    ))}
                    {bulkRows.length === 0 && (
                      <tr>
                        <td colSpan={11} style={{ textAlign: "center", padding: 12 }}>
                          No bulk rows. Click "Add Row" to create one with current single-trade defaults.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* top controls unchanged */}
            <div className="smart-trader__row smart-trader__row--two">
              <div className="smart-trader__field">
                <label htmlFor="st-symbol">{localize("Volatility")}</label>
                <select
                  id="st-symbol"
                  value={symbol}
                  onChange={(e) => {
                    const v = e.target.value
                    onSymbolChange(v)
                  }}
                >
                  {symbols.map((s) => (
                    <option key={s.symbol} value={s.symbol}>
                      {s.display_name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="smart-trader__field">
                <label htmlFor="st-tradeType">{localize("Trade type")}</label>
                <select
                  id="st-tradeType"
                  value={tradeType}
                  onChange={(e) => {
                    const v = e.target.value
                    setTradeType(v)
                    if (v !== "DIGITOVER" && v !== "DIGITUNDER") setOuTargetDigit("")
                    if (v !== "DIGITMATCH" && v !== "DIGITDIFF") setMdPrediction("")
                  }}
                >
                  {TRADE_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* inputs with nullable ticks and stake */}
            <div className="smart-trader__row smart-trader__row--compact">
              <div className="smart-trader__field">
                <label htmlFor="st-ticks">{localize("Ticks")}</label>
                <input
                  id="st-ticks"
                  type="number"
                  min={1}
                  max={10}
                  value={ticks ?? ""}
                  placeholder="Enter ticks"
                  onChange={(e) => setTicks(e.target.value === "" ? null : Number(e.target.value))}
                />
              </div>
              <div className="smart-trader__field">
                <label htmlFor="st-stake">{localize("Stake")}</label>
                <input
                  id="st-stake"
                  type="number"
                  step="0.01"
                  min={0.35}
                  value={stake ?? ""}
                  placeholder="Enter stake amount"
                  onChange={(e) => setStake(e.target.value === "" ? null : Number(e.target.value))}
                />
              </div>
              <div className="smart-trader__field">
                <label htmlFor="st-takeprofit">{localize("Take Profit")}</label>
                <input
                  id="st-takeprofit"
                  type="number"
                  step="0.01"
                  min={0}
                  value={takeProfit}
                  placeholder="Total profit target"
                  onChange={(e) => setTakeProfit(e.target.value)}
                />
              </div>
              <div className="smart-trader__field">
                <label htmlFor="st-stoploss">{localize("Stop Loss")}</label>
                <input
                  id="st-stoploss"
                  type="number"
                  step="0.01"
                  min={0}
                  value={stopLoss}
                  placeholder="Total loss limit"
                  onChange={(e) => setStopLoss(e.target.value)}
                />
              </div>
            </div>

            {(tradeType === "DIGITOVER" || tradeType === "DIGITUNDER") && (
              <>
                <div className="smart-trader__row smart-trader__row--two">
                  <div className="smart-trader__field">
                    <label htmlFor="st-target-digit">{localize("Target digit for over/under")}</label>
                    <select id="st-target-digit" value={targetDigit} onChange={(e) => setTargetDigit(e.target.value)}>
                      {Array.from({ length: 10 }, (_, i) => (
                        <option key={i} value={String(i)}>
                          {i}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="smart-trader__field">
                    <label htmlFor="st-martingale">{localize("Martingale multiplier")}</label>
                    <input
                      id="st-martingale"
                      type="number"
                      min={1}
                      step="0.1"
                      value={martingaleMultiplier ?? ""}
                      placeholder="e.g., 2.0"
                      onChange={(e) =>
                        setMartingaleMultiplier(e.target.value === "" ? null : Math.max(1, Number(e.target.value)))
                      }
                    />
                  </div>
                </div>

                <div className="smart-trader__row smart-trader__row--two">
                  <div className="smart-trader__field">
                    <label>{localize("Recovery Mode")}</label>
                    <button
                      onClick={() => setRecoveryModeEnabled(!recoveryModeEnabled)}
                      style={{
                        padding: "8px 16px",
                        borderRadius: "4px",
                        border: "none",
                        backgroundColor: recoveryModeEnabled ? "#52c41a" : "#ff4d4f",
                        color: "white",
                        cursor: "pointer",
                        fontWeight: "bold",
                        width: "100%",
                      }}
                    >
                      {recoveryModeEnabled ? "ON" : "OFF"}
                    </button>
                  </div>
                  <div></div>
                </div>

                {recoveryModeEnabled && (
                  <>
                    <div className="smart-trader__row smart-trader__row--two">
                      <div className="smart-trader__field">
                        <label htmlFor="st-recovery-type">{localize("Recovery trade type (after loss)")}</label>
                        <select
                          id="st-recovery-type"
                          value={recoveryTradeType}
                          onChange={(e) => setRecoveryTradeType(e.target.value)}
                        >
                          <option value="DIGITOVER">Digits Over</option>
                          <option value="DIGITUNDER">Digits Under</option>
                        </select>
                      </div>
                      <div className="smart-trader__field">
                        <label htmlFor="st-recovery-digit">{localize("Recovery target digit")}</label>
                        <select
                          id="st-recovery-digit"
                          value={recoveryTargetDigit}
                          onChange={(e) => setRecoveryTargetDigit(e.target.value)}
                        >
                          {Array.from({ length: 10 }, (_, i) => (
                            <option key={i} value={String(i)}>
                              {i}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="smart-trader__row smart-trader__row--two">
                      <div className="smart-trader__field">
                        <label htmlFor="st-ou-target">{localize("Override target digit (optional)")}</label>
                        <select
                          id="st-ou-target"
                          value={ouTargetDigit}
                          onChange={(e) => setOuTargetDigit(e.target.value)}
                        >
                          <option value="">(use recovery system)</option>
                          {Array.from({ length: 10 }, (_, i) => (
                            <option key={i} value={String(i)}>
                              {i}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div></div>
                    </div>
                  </>
                )}
              </>
            )}

            {(tradeType === "DIGITEVEN" || tradeType === "DIGITODD") && (
              <div className="smart-trader__Row smart-trader__row--two">
                <div className="smart-trader__field">
                  <label htmlFor="st-martingale-eo">{localize("Martingale multiplier")}</label>
                  <input
                    id="st-martingale-eo"
                    type="number"
                    min={1}
                    step="0.1"
                    value={martingaleMultiplier ?? ""}
                    placeholder="e.g., 2.0"
                    onChange={(e) =>
                      setMartingaleMultiplier(e.target.value === "" ? null : Math.max(1, Number(e.target.value)))
                    }
                  />
                </div>
                <div></div>
              </div>
            )}

            {(tradeType === "DIGITMATCH" || tradeType === "DIGITDIFF") && (
              <div className="smart-trader__row smart-trader__row--two">
                <div className="smart-trader__field">
                  <label htmlFor="st-md-target">
                    {localize(`${tradeType === "DIGITMATCH" ? "Matches" : "Differs"} target digit`)}
                  </label>
                  <select id="st-md-target" value={mdPrediction} onChange={(e) => setMdPrediction(e.target.value)}>
                    <option value="">Select digit</option>
                    {Array.from({ length: 10 }, (_, i) => (
                      <option key={i} value={String(i)}>
                        {i}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="smart-trader__field">
                  <label htmlFor="st-martingale-md">{localize("Martingale multiplier")}</label>
                  <input
                    id="st-martingale-md"
                    type="number"
                    min={1}
                    step="0.1"
                    value={martingaleMultiplier ?? ""}
                    placeholder="e.g., 2.0"
                    onChange={(e) =>
                      setMartingaleMultiplier(e.target.value === "" ? null : Math.max(1, Number(e.target.value)))
                    }
                  />
                </div>
              </div>
            )}

            <div className="smart-trader__row smart-trader__row--two">
              <div className="smart-trader__field">
                <label htmlFor="st-tick-based">
                  <input
                    id="st-tick-based"
                    type="checkbox"
                    checked={tickBasedTrading}
                    onChange={(e) => setTickBasedTrading(e.target.checked)}
                    style={{ marginRight: "8px" }}
                  />
                  {localize("Enable tick-based trading")}
                </label>
              </div>
              {tickBasedTrading && (
                <div className="smart-trader__field">
                  <label htmlFor="st-tick-interval">{localize("Trade every N ticks")}</label>
                  <input
                    id="st-tick-interval"
                    type="number"
                    min={1}
                    value={tickInterval ?? ""}
                    placeholder="e.g., 1"
                    onChange={(e) => setTickInterval(e.target.value === "" ? null : Number(e.target.value))}
                  />
                </div>
              )}
            </div>

            {/* Display toggle (Numbers kept unchanged) */}
            <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 8 }}>
              <label style={{ marginRight: 8 }}>{localize("Display")}</label>
              <select value={displayMode} onChange={(e) => setDisplayMode(e.target.value as any)}>
                <option value="numbers">Numbers</option>
                <option value="circles">Circles</option>
              </select>
            </div>

            {/* NUMBERS VIEW: UNCHANGED visually/logic from original working version */}
            {displayMode === "numbers" ? (
              <>
                <div className="smart-trader__digits">
                  {digits.slice(-10).map((d, idx) => (
                    <div
                      key={`${idx}-${d}`}
                      className={`smart-trader__digit ${d === lastDigit ? "is-current" : ""} ${getHintClass(d)}`}
                    >
                      {d}
                    </div>
                  ))}
                </div>

                <div className="smart-trader__meta">
                  <Text size="xs" color="general">
                    {localize("Ticks Processed:")} {ticksProcessed}
                  </Text>
                  <Text size="xs" color="general">
                    {localize("Last Digit:")} {lastDigit ?? "-"}
                  </Text>
                  {(tradeType === "DIGITOVER" || tradeType === "DIGITUNDER") && (
                    <Text
                      size="xs"
                      color={isInRecoveryModeRef.current && recoveryModeEnabled ? "loss-danger" : "prominent"}
                    >
                      {isInRecoveryModeRef.current && recoveryModeEnabled ? "🔄 Recovery Mode" : "✅ Normal Mode"}
                    </Text>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="st-circles-wrapper" style={{ marginTop: 12 }}>
                  {/* NEW: Analyze controls for circles */}
                  {displayMode !== "circles" && (
                    <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
                      <label style={{ fontSize: 12 }}>Analyze last</label>
                      <input
                        type="number"
                        min={1}
                        max={1000}
                        value={analyzeN}
                        onChange={(e) => {
                          let v = Number(e.target.value || 1)
                          if (isNaN(v)) v = 1
                          v = Math.max(1, Math.min(1000, Math.floor(v)))
                          setAnalyzeN(v)
                        }}
                        style={{ width: 88 }}
                      />
                      <label style={{ fontSize: 12 }}>ticks</label>
                      <button
                        onClick={onAnalyzeClick}
                        style={{ padding: "6px 10px", marginLeft: 6 }}
                        title="Analyze last N ticks (up to 1000)"
                      >
                        Analyze
                      </button>
                      <label style={{ fontSize: 12, marginLeft: 8 }}>
                        <input
                          type="checkbox"
                          checked={useLiveIfAvailable}
                          onChange={(e) => setUseLiveIfAvailable(e.target.checked)}
                          style={{ marginRight: 6 }}
                        />
                        Use live buffer if available
                      </label>
                      {isAnalyzed && (
                        <div style={{ marginLeft: 12, fontSize: 12 }}>Analyzed: {freqTotal} ticks — updated</div>
                      )}
                    </div>
                  )}

                  <div
                    ref={circlesContainerRef}
                    className="st-circles__container"
                    role="region"
                    aria-label="Digit circles"
                    style={{
                      position: "relative",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "8px",
                      padding: "20px 0",
                    }}
                  >
                    <div
                      className="st-circles__indicator"
                      style={{
                        position: "absolute",
                        bottom: "-2px", // Positioned below the circles
                        left: indicatorLeftPx === -9999 ? -9999 : indicatorLeftPx - 8,
                        width: 0,
                        height: 0,
                        borderLeft: "8px solid transparent",
                        borderRight: "8px solid transparent",
                        borderBottom: "12px solid #ff6b35", // Triangle pointing up
                        transition: "left 0.3s ease",
                        zIndex: 10,
                      }}
                    />
                    {Array.from({ length: 10 }, (_, i) => {
                      const pct = percentages[i] ?? 0
                      const isMax = pct === maxPct
                      const isMin = pct === minPct
                      const arcPct = Math.min(Math.max(pct, 2), 30)
                      const dash = (arcPct / 100) * CIRCUMFERENCE
                      const dashArray = `${dash} ${CIRCUMFERENCE}`
                      const strokeColor = isMax ? "#13c2c2" : isMin ? "#ff4d4f" : "rgba(180,180,180,0.6)"
                      const dashOffset = (CIRCUMFERENCE - dash) / 2

                      return (
                        <div
                          key={i}
                          className="st-circle"
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            position: "relative",
                          }}
                        >
                          <svg
                            className="st-circle__svg"
                            viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
                            style={{
                              width: "clamp(56px, 8vw, 80px)",
                              height: "clamp(56px, 8vw, 80px)",
                            }}
                          >
                            <circle cx={SVG_SIZE / 2} cy={SVG_SIZE / 2} r={R - 2} fill="#2a2a2a" />
                            <circle
                              className="st-circle__bg"
                              cx={SVG_SIZE / 2}
                              cy={SVG_SIZE / 2}
                              r={R}
                              strokeWidth={4}
                              fill="none"
                              stroke="rgba(100,100,100,0.2)"
                            />
                            <circle
                              className="st-circle__progress"
                              cx={SVG_SIZE / 2}
                              cy={SVG_SIZE / 2}
                              r={R}
                              strokeWidth={4}
                              fill="none"
                              stroke={strokeColor}
                              strokeDasharray={dashArray}
                              strokeDashoffset={dashOffset}
                              style={{ transform: "rotate(-90deg)", transformOrigin: "50% 50%" }}
                            />
                          </svg>
                          <div
                            className="st-circle__label"
                            style={{
                              position: "absolute",
                              top: "50%",
                              left: "50%",
                              transform: "translate(-50%, -50%)",
                              textAlign: "center",
                              pointerEvents: "none",
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <div
                              className={`st-circle__digit ${lastDigit === i ? "is-current" : ""} ${getHintClass(i)}`}
                              style={{
                                fontSize: "clamp(18px, 3vw, 24px)",
                                fontWeight: "bold",
                                lineHeight: 1,
                                color: "white",
                                marginBottom: "2px",
                              }}
                            >
                              {i}
                            </div>
                            <div
                              className="st-circle__percent"
                              style={{
                                fontSize: "clamp(9px, 1.2vw, 11px)",
                                color: "rgba(255,255,255,0.7)",
                                lineHeight: 1,
                              }}
                            >
                              {pct.toFixed(1)}%
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  <div className="smart-trader__meta" style={{ marginTop: 8 }}>
                    <Text size="xs" color="general">
                      {isAnalyzed ? `Analyzed ticks: ${freqTotal}` : `Live buffer: ${digits.length} ticks`}
                    </Text>
                    <Text size="xs" color="general">
                      {localize("Last Digit:")} {lastDigit ?? "-"}
                    </Text>
                    {(tradeType === "DIGITOVER" || tradeType === "DIGITUNDER") && (
                      <Text
                        size="xs"
                        color={isInRecoveryModeRef.current && recoveryModeEnabled ? "loss-danger" : "prominent"}
                      >
                        {isInRecoveryModeRef.current && recoveryModeEnabled ? "🔄 Recovery Mode" : "✅ Normal Mode"}
                      </Text>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* ACTIONS: Start Trading and Stop (restored) */}
            <div className="smart-trader__actions">
              <button className="smart-trader__run" onClick={onRun} disabled={is_running || !symbol}>
                {is_running ? localize("Running...") : localize("Start Trading")}
              </button>
              {is_running && (
                <button className="smart-trader__stop" onClick={onStop}>
                  {localize("Stop")}
                </button>
              )}
            </div>

            {status && (
              <div className="smart-trader__status">
                <Text size="xs" color={/error|fail/i.test(status) ? "loss-danger" : "prominent"}>
                  {status}
                </Text>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
})

export default SmartTrader
