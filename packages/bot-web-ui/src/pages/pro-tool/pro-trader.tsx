"use client"

import React from "react"
import { useEffect, useRef, useState, useCallback } from "react"
import { observer } from "mobx-react-lite"
import { motion, AnimatePresence } from "framer-motion"
import {
  TrendingUp,
  TrendingDown,
  Target,
  Zap,
  Layers,
  Activity,
  DollarSign,
  Clock,
  BarChart3,
  X,
  Check,
  AlertCircle,
  CalendarIcon,
  Info,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  History,
} from "lucide-react"
import {
  generateDerivApiInstance,
  V2GetActiveClientId,
  V2GetActiveToken,
} from "@/external/bot-skeleton/services/api/appId"
import { tradeOptionToBuy } from "@/external/bot-skeleton/services/tradeEngine/utils/helpers"
import { useStore } from "@/hooks/useStore"
import "./dtrader.scss"

// Debug logger
const debugLog = (message: string, data?: any) => {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[DTrader Debug] ${message}`, data || '');
  }
};

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
const CIRCLE_RADIUS = 36
const CIRCUMFERENCE = 2 * Math.PI * CIRCLE_RADIUS

const formatDate = (date: Date): string => {
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ]
  const day = date.getDate()
  const month = months[date.getMonth()]
  const year = date.getFullYear()

  const suffix = (day: number) => {
    if (day > 3 && day < 21) return "th"
    switch (day % 10) {
      case 1:
        return "st"
      case 2:
        return "nd"
      case 3:
        return "rd"
      default:
        return "th"
    }
  }

  return `${month} ${day}${suffix(day)}, ${year}`
}

const getDaysInMonth = (date: Date): number => {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
}

const getFirstDayOfMonth = (date: Date): number => {
  return new Date(date.getFullYear(), date.getMonth(), 1).getDay()
}

const isSameDay = (date1: Date | undefined, date2: Date): boolean => {
  if (!date1) return false
  return (
    date1.getDate() === date2.getDate() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getFullYear() === date2.getFullYear()
  )
}

interface CalendarProps {
  selected?: Date
  onSelect: (date: Date | undefined) => void
  disabled?: (date: Date) => boolean
}

const Calendar: React.FC<CalendarProps> = ({ selected, onSelect, disabled }) => {
  const [currentMonth, setCurrentMonth] = useState(selected || new Date())

  const daysInMonth = getDaysInMonth(currentMonth)
  const firstDayOfMonth = getFirstDayOfMonth(currentMonth)
  const monthName = currentMonth.toLocaleString("default", { month: "long" })
  const year = currentMonth.getFullYear()

  const previousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))
  }

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))
  }

  const selectDate = (day: number) => {
    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day)
    if (disabled && disabled(date)) return
    onSelect(date)
  }

  const days = []
  for (let i = 0; i < firstDayOfMonth; i++) {
    days.push(<div key={`empty-${i}`} className="dtrader__calendar-day dtrader__calendar-day--empty" />)
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day)
    const isSelected = isSameDay(selected, date)
    const isDisabled = disabled && disabled(date)
    const isToday = isSameDay(new Date(), date)

    days.push(
      <button
        key={day}
        className={`dtrader__calendar-day ${isSelected ? "dtrader__calendar-day--selected" : ""} ${isDisabled ? "dtrader__calendar-day--disabled" : ""} ${isToday ? "dtrader__calendar-day--today" : ""}`}
        onClick={() => selectDate(day)}
        disabled={isDisabled}
      >
        {day}
      </button>,
    )
  }

  return (
    <div className="dtrader__calendar">
      <div className="dtrader__calendar-header">
        <button className="dtrader__calendar-nav" onClick={previousMonth}>
          <ChevronLeft />
        </button>
        <div className="dtrader__calendar-title">
          {monthName} {year}
        </div>
        <button className="dtrader__calendar-nav" onClick={nextMonth}>
          <ChevronRight />
        </button>
      </div>
      <div className="dtrader__calendar-weekdays">
        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
          <div key={day} className="dtrader__calendar-weekday">
            {day}
          </div>
        ))}
      </div>
      <div className="dtrader__calendar-days">{days}</div>
    </div>
  )
}

interface PopoverProps {
  children: React.ReactNode
}

interface PopoverTriggerProps {
  asChild?: boolean
  children: React.ReactNode
}

interface PopoverContentProps {
  children: React.ReactNode
  align?: "start" | "center" | "end"
  className?: string
}

const PopoverContext = React.createContext<{
  isOpen: boolean
  setIsOpen: (open: boolean) => void
}>({
  isOpen: false,
  setIsOpen: () => {},
})

const Popover: React.FC<PopoverProps> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <PopoverContext.Provider value={{ isOpen, setIsOpen }}>
      <div className="dtrader__popover">{children}</div>
    </PopoverContext.Provider>
  )
}

const PopoverTrigger: React.FC<PopoverTriggerProps> = ({ children, asChild }) => {
  const { isOpen, setIsOpen } = React.useContext(PopoverContext)

  const handleClick = () => {
    setIsOpen(!isOpen)
  }

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<any>, {
      onClick: handleClick,
    })
  }

  return <div onClick={handleClick}>{children}</div>
}

const PopoverContent: React.FC<PopoverContentProps> = ({ children, align = "start", className = "" }) => {
  const { isOpen, setIsOpen } = React.useContext(PopoverContext)
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (contentRef.current && !contentRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside)
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [isOpen, setIsOpen])

  if (!isOpen) return null

  return (
    <div ref={contentRef} className={`dtrader__popover-content dtrader__popover-content--${align} ${className}`}>
      {children}
    </div>
  )
}

// FIXED: CORRECT barrier offsets in PRICE TERMS for ALL volatility indices
const volatilityBarrierOffsets: { [key: string]: { [key: number]: number } } = {
  "Volatility 10 (1s) Index": {
    1: 0.411,
    2: 0.384,
    3: 0.360,
    4: 0.343,
    5: 0.326,
  },
  "Volatility 10 Index": {
    1: 0.3539,
    2: 0.3308,
    3: 0.3102,
    4: 0.2952,
    5: 0.2810,
  },
  "Volatility 15 (1s) Index": {
    1: 0.8721,
    2: 0.8149,
    3: 0.7642,
    4: 0.7270,
    5: 0.6920,
  },
  "Volatility 25 (1s) Index": {
    1: 74.442,
    2: 69.600,
    3: 65.294,
    4: 62.130,
    5: 59.130,
  },
  "Volatility 25 Index": {
    1: 0.4006,
    2: 0.3744,
    3: 0.3511,
    4: 0.3340,
    5: 0.3179,
  },
  "Volatility 30 (1s) Index": {
    1: 0.7603,
    2: 0.7107,
    3: 0.6664,
    4: 0.6341,
    5: 0.6033,
  },
  "Volatility 50 (1s) Index": {
    1: 38.997,
    2: 36.424,
    3: 34.156,
    4: 32.504,
    5: 30.940,
  },
  "Volatility 50 Index": {
    1: 0.03713,
    2: 0.03472,
    3: 0.03258,
    4: 0.03099,
    5: 0.02950,
  },
  "Volatility 75 (1s) Index": {
    1: 1.500,
    2: 1.401,
    3: 1.315,
    4: 1.249,
    5: 1.188,
  },
  "Volatility 75 Index": {
    1: 27.42066,
    2: 25.63562,
    3: 24.02000,
    4: 22.84321,
    5: 21.73109,
  },
  "Volatility 90 (1s) Index": {
    1: 8.6700,
    2: 8.1028,
    3: 7.5993,
    4: 7.2337,
    5: 6.8843,
  },
  "Volatility 100 (1s) Index": {
    1: 0.482,
    2: 0.450,
    3: 0.422,
    4: 0.402,
    5: 0.382,
  },
  "Volatility 100 Index": {
    1: 0.661,
    2: 0.617,
    3: 0.579,
    4: 0.551,
    5: 0.524,
  },
};

// FIXED: Dynamic multiplier options based on volatility
const getMultiplierOptions = (displayName: string): number[] => {
  const multiplierMap: { [key: string]: number[] } = {
    "Volatility 10 (1s) Index": [400, 1000, 2000, 3000, 4000],
    "Volatility 10 Index": [400, 1000, 2000, 3000, 4000],
    "Volatility 15 (1s) Index": [300, 1000, 1500, 2000, 3000],
    "Volatility 25 (1s) Index": [160, 400, 800, 1200, 1600],
    "Volatility 25 Index": [160, 400, 800, 1200, 1600],
    "Volatility 30 (1s) Index": [140, 400, 700, 1000, 1400],
    "Volatility 50 (1s) Index": [80, 200, 400, 600, 800],
    "Volatility 50 Index": [80, 200, 400, 600, 800],
    "Volatility 75 (1s) Index": [50, 100, 200, 300, 500],
    "Volatility 75 Index": [50, 100, 200, 300, 500],
    "Volatility 90 (1s) Index": [45, 100, 200, 300, 450],
    "Volatility 100 (1s) Index": [40, 100, 200, 300, 400],
    "Volatility 100 Index": [40, 100, 200, 300, 400],
  };

  return multiplierMap[displayName] || [40, 100, 200, 300, 400];
};

const tradeTypes = {
  accumulators: {
    name: "Accumulators",
    icon: Activity,
    description: "Accumulate profits with each tick",
    color: "#F38181",
    contractType: "ACCU",
    growthRates: [0.01, 0.02, 0.03, 0.04, 0.05],
  },
  multipliers: {
    name: "Multipliers",
    icon: Layers,
    description: "Multiply your potential profit",
    color: "#4ECDC4",
    contractTypes: {
      up: "MULTUP",
      down: "MULTDOWN",
    },
  },
}

// FIXED: Use dynamic symbols like TradeUiClone instead of hardcoded configs
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

interface DTraderProps {
  defaultTradeType?: keyof typeof tradeTypes
  defaultSymbol?: string
  onTradeComplete?: (result: any) => void
}

interface TickData {
  quote: number
  epoch: number
  id?: string
  inRange?: boolean
  barrierUpper?: number
  barrierLower?: number
}

interface ProposalResponse {
  proposal?: {
    id: string
    ask_price: number
    display_value: string
    payout: number
    spot: number
    spot_time: number
    barrier?: string
    barrier2?: string
    high_barrier?: string
    low_barrier?: string
  }
  error?: {
    message: string
    code: string
  }
}

interface ContractUpdate {
  proposal_open_contract?: {
    contract_id: number
    buy_price: number
    sell_price: number
    current_spot: number
    current_spot_time: number
    profit: number
    profit_percentage: number
    status: string
    is_sold: number
    barrier?: string
    high_barrier?: string
    low_barrier?: string
    entry_spot: number
    exit_tick?: number
  }
}

interface BuyResponse {
  buy?: {
    contract_id: number
    buy_price: number
    balance_after: number
    longcode: string
    start_time: number
    transaction_id: string
  }
  error?: {
    message: string
    code: string
  }
}

interface TradeHistory {
  id: string
  type: string
  symbol: string
  stake: number
  profit: number
  timestamp: number
  status: "won" | "lost"
}

// FIXED: Use TradeUiClone's exact digit extraction that NEVER skips 0
const extractLastDigitFromFormatted = (priceStr: string): number | null => {
  try {
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
  } catch (error) {
    debugLog('Error extracting last digit', error);
    return null;
  }
}

// FIXED: Use TradeUiClone's exact price formatting
const formatPriceWithDecLen = (raw: any, sym: string, decimalLenBySymbol: Record<string, number>): string => {
  try {
    const decLen = decimalLenBySymbol[sym] || 2
    if (typeof decLen === "number" && !Number.isNaN(Number(raw))) {
      return Number(raw).toFixed(decLen)
    }
    return String(raw)
  } catch {
    return String(raw)
  }
}

// FIXED: Enhanced decimal place extraction
const extractDecimalPlaces = (price: number | string): number => {
  try {
    const priceStr = String(price)
    const parts = priceStr.split('.')
    if (parts.length > 1) {
      return parts[1].length
    }
    return 2
  } catch (error) {
    debugLog('Error extracting decimal places', error);
    return 2;
  }
}

// FIXED: Get barrier offset for specific volatility and growth rate
const getBarrierOffset = (displayName: string, growthRate: number): number => {
  try {
    const growthRateKey = Math.round(growthRate * 100) as 1 | 2 | 3 | 4 | 5
    const volatilityBarriers = volatilityBarrierOffsets[displayName]
    
    if (volatilityBarriers && volatilityBarriers[growthRateKey] !== undefined) {
      return volatilityBarriers[growthRateKey]
    }
    
    // Fallback to Volatility 100 Index if not found
    return volatilityBarrierOffsets["Volatility 100 Index"][growthRateKey] || 0.661
  } catch (error) {
    debugLog('Error getting barrier offset', error);
    return 0.661;
  }
}

const DTrader = observer(
  ({ defaultTradeType = "accumulators", defaultSymbol = "R_100", onTradeComplete }: DTraderProps) => {
    const { transactions, run_panel } = useStore()
    const apiRef = useRef<any>(null)

    const currentSymbolRef = useRef<string>("")
    const currentDisplayNameRef = useRef<string>("")
    const tickStreamIdRef = useRef<string | null>(null)
    const globalMsgHandlerRef = useRef<((evt: MessageEvent) => void) | null>(null)
    const connectionAttachedRef = useRef(false)
    const previousTickRef = useRef<TickData | null>(null)
    const chartAnimationRef = useRef<number | null>(null)

    const activeTradesRef = useRef<Record<string, any>>({})
    const stopFlagRef = useRef(false)
    const subIdByContractRef = useRef<Record<string, string | null>>({})
    const cumulativeProfitRef = useRef<number>(0)
    const proposalTimeoutRef = useRef<NodeJS.Timeout | null>(null)
    const chartCanvasRef = useRef<HTMLCanvasElement>(null)

    const isTradingRef = useRef(false)
    const currentTickCountRef = useRef(0)
    const accumulatorPayoutRef = useRef(0)
    const growthRateRef = useRef(0.03)
    const barrierHitRef = useRef(false)
    const totalProfitLossRef = useRef(0)

    // FIXED: Enhanced decimal tracking with proper initialization
    const decimalLenBySymbolRef = useRef<Record<string, number>>({})
    const [currentDecimalPlaces, setCurrentDecimalPlaces] = useState<number>(2)
    const [lastDigit, setLastDigit] = useState<number | null>(null)

    // FIXED: Dynamic symbols like TradeUiClone
    const [symbols, setSymbols] = useState<any[]>([])
    const [symbol, setSymbol] = useState(defaultSymbol)
    const [selectedTradeType, setSelectedTradeType] = useState<keyof typeof tradeTypes>(defaultTradeType)
    const [stake, setStake] = useState(10)
    const [duration, setDuration] = useState(5)
    const [durationType, setDurationType] = useState<"t" | "s" | "m" | "h" | "d">("t")
    const [prediction, setPrediction] = useState<"up" | "down">("up")
    
    // FIXED: Dynamic multiplier options based on selected symbol
    const [multiplierOptions, setMultiplierOptions] = useState<number[]>([40, 100, 200, 300, 400])
    const [multiplier, setMultiplier] = useState(40)
    
    const [barrier, setBarrier] = useState(0)
    const [barrierOffset, setBarrierOffset] = useState("+0.001")
    const [strikePrice, setStrikePrice] = useState("+0.00")
    const [takeProfit, setTakeProfit] = useState<number | null>(null)
    const [stopLoss, setStopLoss] = useState<number | null>(null)
    const [growthRate, setGrowthRate] = useState(0.03)
    const [expiryDate, setExpiryDate] = useState<Date | undefined>(undefined)

    const [chartGranularity, setChartGranularity] = useState<"tick" | "minute">("tick")
    const [chartTickCount, setChartTickCount] = useState(100)
    const [chartMinuteCount, setChartMinuteCount] = useState(5)

    const [isTrading, setIsTrading] = useState(false)
    const [currentPrice, setCurrentPrice] = useState<number | null>(null)
    const [contractId, setContractId] = useState<string | null>(null)
    const [profit, setProfit] = useState<number>(0)
    const [profitPercentage, setProfitPercentage] = useState<number>(0)
    const [entrySpot, setEntrySpot] = useState<number | null>(null)
    const [currentSpot, setCurrentSpot] = useState<number | null>(null)

    const [proposalId, setProposalId] = useState<string | null>(null)
    const [askPrice, setAskPrice] = useState<number | null>(null)
    const [payout, setPayout] = useState<number | null>(null)
    const [proposalError, setProposalError] = useState<string | null>(null)

    const [upperBarrier, setUpperBarrier] = useState<number | null>(null)
    const [lowerBarrier, setLowerBarrier] = useState<number | null>(null)
    const [barrierHit, setBarrierHit] = useState<boolean>(false)
    const [availableBarriers, setAvailableBarriers] = useState<string[]>([])
    const [barrierHitFlash, setBarrierHitFlash] = useState(false)
    const barrierFlashTimeoutRef = useRef<number | null>(null)

    const [priceHistory, setPriceHistory] = useState<{ time: number; price: number }[]>([])
    const [chartTimeRange, setChartTimeRange] = useState<"1m" | "5m" | "15m" | "1h">("5m")

    const [accumulatorTicks, setAccumulatorTicks] = useState<TickData[]>([])
    const [currentTickCount, setCurrentTickCount] = useState(0)
    const [tickHistory, setTickHistory] = useState<number[]>([])
    const [showHistory, setShowHistory] = useState(false)
    const [accumulatorPayout, setAccumulatorPayout] = useState(0)

    const [isAutoTrading, setIsAutoTrading] = useState(false)
    const [autoTradingStats, setAutoTradingStats] = useState({
      waitingForNewStats: false,
      ticksSinceBarrierBreach: 0,
      inTrade: false,
      ticksInTrade: 0,
    })

    const [totalProfitLoss, setTotalProfitLoss] = useState(0)
    const [tradeHistory, setTradeHistory] = useState<TradeHistory[]>([])

    const [tradeResult, setTradeResult] = useState<{
      type: "success" | "error" | "info"
      message: string
    } | null>(null)
    const [isConnected, setIsConnected] = useState(false)
    const [connectionError, setConnectionError] = useState<string | null>(null)
    const [showAdvancedOptions, setShowAdvancedOptions] = useState(false)
    const [isDropdownOpen, setIsDropdownOpen] = useState(false)

    // FIXED: Update multiplier options when symbol changes
    useEffect(() => {
      try {
        if (symbols.length > 0 && symbol) {
          const currentSymbolObj = symbols.find(s => s.symbol === symbol);
          if (currentSymbolObj) {
            const options = getMultiplierOptions(currentSymbolObj.display_name);
            setMultiplierOptions(options);
            currentDisplayNameRef.current = currentSymbolObj.display_name;
            
            // Reset multiplier to first option if current multiplier is not in new options
            if (!options.includes(multiplier)) {
              setMultiplier(options[0]);
            }
          }
        }
      } catch (error) {
        debugLog('Error updating multiplier options', error);
      }
    }, [symbol, symbols, multiplier]);

    // FIXED: Enhanced price formatting that ALWAYS preserves trailing zeros
    const formatPriceForDisplay = useCallback((price: number): string => {
      try {
        if (price === null || price === undefined) return "0.00"
        const decimalPlaces = decimalLenBySymbolRef.current[symbol] || currentDecimalPlaces
        const formatted = price.toFixed(decimalPlaces)
        return formatted
      } catch (error) {
        debugLog('Error formatting price', error);
        return "0.00";
      }
    }, [symbol, currentDecimalPlaces])

    // FIXED: Enhanced decimal place update with immediate response
    const updateDecimalPlaces = useCallback((price: number, sym: string) => {
      try {
        const decimalPlaces = extractDecimalPlaces(price)
        decimalLenBySymbolRef.current[sym] = decimalPlaces
        if (sym === symbol) {
          setCurrentDecimalPlaces(decimalPlaces)
        }
      } catch (error) {
        debugLog('Error updating decimal places', error);
      }
    }, [symbol])

    useEffect(() => {
      isTradingRef.current = isTrading
    }, [isTrading])

    useEffect(() => {
      currentTickCountRef.current = currentTickCount
    }, [currentTickCount])

    useEffect(() => {
      accumulatorPayoutRef.current = accumulatorPayout
    }, [accumulatorPayout])

    useEffect(() => {
      growthRateRef.current = growthRate
      // FIXED: Calculate barriers from previous tick when growth rate changes
      if (previousTickRef.current && selectedTradeType === "accumulators") {
        try {
          const { upper, lower } = calculateAccumulatorBarriers(previousTickRef.current, growthRate)
          setUpperBarrier(upper)
          setLowerBarrier(lower)
        } catch (error) {
          debugLog('Error calculating barriers on growth rate change', error);
        }
      }
    }, [growthRate, selectedTradeType])

    // FIXED: CORRECTED barrier calculation using FIXED PRICE OFFSETS (like Deriv)
    const calculateAccumulatorBarriers = useCallback((previousTick: TickData, growth: number) => {
      try {
        if (!previousTick || previousTick.quote === undefined) return { upper: null, lower: null }

        // Get the correct barrier offset for this volatility and growth rate
        const barrierOffset = getBarrierOffset(currentDisplayNameRef.current, growth)
        
        const previousPrice = previousTick.quote

        // FIXED: Calculate barriers using FIXED PRICE OFFSETS (not percentages)
        const upper = previousPrice + barrierOffset
        const lower = previousPrice - barrierOffset

        debugLog(`Barrier calculation: ${currentDisplayNameRef.current}, growth: ${growth}, barrierOffset: ${barrierOffset}, prevPrice: ${previousPrice}, upper: ${upper}, lower: ${lower}`)

        return { upper, lower }
      } catch (error) {
        debugLog('Error in calculateAccumulatorBarriers', error);
        return { upper: null, lower: null };
      }
    }, [])

    const isWithinBarriers = useCallback((currentPrice: number, upper: number, lower: number) => {
      try {
        return currentPrice > lower && currentPrice < upper
      } catch (error) {
        debugLog('Error in isWithinBarriers', error);
        return false;
      }
    }, [])

    // FIXED: Enhanced API initialization with ROBUST connection handling
    useEffect(() => {
      const initializeAPI = async () => {
        try {
          debugLog('Initializing API...');
          const token = V2GetActiveToken()
          const clientId = V2GetActiveClientId()

          if (!token || !clientId) {
            console.error("[DTrader] No active token or client ID found")
            setConnectionError("Authentication required. Please ensure you're logged in.")
            return
          }

          const api = generateDerivApiInstance()
          apiRef.current = api
          
          // Try multiple authorization approaches to be robust across API wrappers
          let authResult: any = null
          try {
            if (typeof api.authorize === 'function') {
              authResult = await api.authorize(token)
            } else if (typeof api.send === 'function') {
              authResult = await api.send({ authorize: token })
            } else {
              authResult = { error: { message: 'No authorize method available' } }
            }
          } catch (e: any) {
            authResult = e || { error: { message: String(e) } }
          }
          
          if (authResult && authResult.error) {
            throw new Error(authResult.error.message || 'Authorization failed')
          }
          
          debugLog("Deriv API initialized and authorized successfully")
          setIsConnected(true)
          setConnectionError(null)

          // FIXED: Load symbols dynamically with better error handling
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
            
            // Add any remaining symbols not in desiredDisplayNames
            const addedSymbols = new Set(ordered.map(s => s.symbol))
            for (const s of syn) {
              if (!addedSymbols.has(s.symbol)) {
                ordered.push(s)
              }
            }
            
            setSymbols(ordered)

            if (ordered.length > 0 && ordered[0]?.symbol) {
              const firstSymbol = ordered[0].symbol
              setSymbol(firstSymbol)
              currentSymbolRef.current = firstSymbol
              currentDisplayNameRef.current = ordered[0].display_name
              
              // Set initial multiplier options based on first symbol
              const firstSymbolObj = ordered[0];
              const initialOptions = getMultiplierOptions(firstSymbolObj.display_name);
              setMultiplierOptions(initialOptions);
              setMultiplier(initialOptions[0]);
              
              await startTicks(firstSymbol)
            }
          } catch (e: any) {
            console.error("[DTrader] Error loading symbols:", e)
            // Fallback to default symbols if API call fails
            const fallbackSymbols = [
              { symbol: "R_100", display_name: "Volatility 100 Index" },
              { symbol: "R_50", display_name: "Volatility 50 Index" },
              { symbol: "R_25", display_name: "Volatility 25 Index" },
              { symbol: "R_10", display_name: "Volatility 10 Index" },
            ]
            setSymbols(fallbackSymbols)
            currentDisplayNameRef.current = fallbackSymbols[0].display_name
          }

        } catch (error: any) {
          console.error("[DTrader] Failed to initialize Deriv API:", error)
          setConnectionError(`Failed to initialize API connection: ${error.message}`)
        }
      }

      initializeAPI()

      return () => {
        stopTicks()
      }
    }, [])

    // FIXED: Enhanced historical data analysis with immediate display
    const analyzeTicksFromHistory = async (sym: string, count = 50) => {
      try {
        if (!apiRef.current) {
          debugLog('API not available for historical data');
          return;
        }

        const res = await apiRef.current.send({ ticks_history: sym, count, end: 'latest' })
        // tolerate multiple response shapes
        const ticks_history = res?.history?.prices ?? res?.ticks?.prices ?? res?.prices ?? res?.history?.ticks ?? res?.ticks_history?.prices ?? res?.ticks_history?.prices ?? null

        if (!ticks_history || !Array.isArray(ticks_history)) {
          debugLog("No historical data available for", sym)
          decimalLenBySymbolRef.current[sym] = 2
          setCurrentDecimalPlaces(2)
          return
        }
        
        let maxDec = 2
        for (const price of ticks_history) {
          const decimalPlaces = extractDecimalPlaces(price)
          maxDec = Math.max(maxDec, decimalPlaces)
        }
        
        decimalLenBySymbolRef.current[sym] = maxDec
        if (sym === symbol) {
          setCurrentDecimalPlaces(maxDec)
        }

        const seedPrices = ticks_history
          .slice(-count)
          .map((p: any) => Number(p))
          .filter((n: any) => !Number.isNaN(n))

        const newPriceHistory = seedPrices.map((price, index) => ({ 
          time: Date.now() - (count - index) * 1000, 
          price 
        }))
        setPriceHistory(newPriceHistory)

        if (seedPrices.length > 0) {
          const lastPrice = seedPrices[seedPrices.length - 1]
          setCurrentPrice(lastPrice)
          
          const priceStr = formatPriceWithDecLen(lastPrice, sym, decimalLenBySymbolRef.current)
          const digit = extractLastDigitFromFormatted(priceStr)
          setLastDigit(digit)
        }

      } catch (err) {
        console.error("[DTrader] Error analyzing ticks history:", err)
        decimalLenBySymbolRef.current[sym] = 2
        setCurrentDecimalPlaces(2)
      }
    }

    // FIXED: CORRECTED close trade function with PROPER P/L calculation
    const closeTrade = useCallback(async (manualClose = false) => {
      try {
        if (!contractId || !apiRef.current) {
          setTradeResult({
            type: "error",
            message: "No active contract to close.",
          })
          return
        }

        debugLog("Closing trade:", contractId)
        
        const sellResult = await apiRef.current.send({
          sell: contractId,
          price: 0
        })

        const { error, sell } = sellResult
        if (error) {
          throw new Error(error.message || "Failed to close contract")
        }

        let finalProfit = 0
        let tickCount = 0
        
        if (selectedTradeType === "accumulators") {
          tickCount = currentTickCountRef.current
          
          // FIXED: CORRECT P/L calculation for accumulators
          // accumulatorPayout is the total payout INCLUDING the original stake
          // So profit = total payout - stake
          finalProfit = accumulatorPayoutRef.current - stake
          
          if (tickCount > 0) {
            setTickHistory(prev => [...prev, tickCount])
          }
          
          // FIXED: Update total P/L correctly - ONLY update here to avoid double counting
          totalProfitLossRef.current = totalProfitLossRef.current + finalProfit
          setTotalProfitLoss(totalProfitLossRef.current)
        } else {
          // For multipliers, profit is already the net P/L
          finalProfit = profit
          totalProfitLossRef.current = totalProfitLossRef.current + finalProfit
          setTotalProfitLoss(totalProfitLossRef.current)
        }

        let closeMessage = `Trade closed successfully.`
        if (manualClose) {
          if (selectedTradeType === "accumulators") {
            closeMessage = `Trade manually closed! Ticks: ${tickCount}, P/L: $${finalProfit.toFixed(2)}`
          } else {
            closeMessage = `Trade manually closed! Profit: $${finalProfit.toFixed(2)}`
          }
        } else if (selectedTradeType === "accumulators") {
          closeMessage = `Barrier breached! Ticks: ${tickCount}, P/L: $${finalProfit.toFixed(2)}`
        }

        setTradeResult({
          type: manualClose ? "info" : (finalProfit >= 0 ? "success" : "error"),
          message: closeMessage,
        })
        
        // FIXED: Reset trading state IMMEDIATELY
        setIsTrading(false)
        isTradingRef.current = false
        setContractId(null)
        setCurrentTickCount(0)
        currentTickCountRef.current = 0
        setAccumulatorPayout(0)
        accumulatorPayoutRef.current = 0
        setBarrierHit(false)
        barrierHitRef.current = false
        setProfit(0)
        setProfitPercentage(0)
        setEntrySpot(null)
        
      } catch (error: any) {
        console.error("[DTrader] Failed to close trade:", error)
        setTradeResult({
          type: "error",
          message: `Failed to close trade: ${error?.message || 'Unknown error'}`,
        })
      }
    }, [contractId, selectedTradeType, stake, profit])

    // FIXED: COMPLETELY REWRITTEN message handler with PROPER barrier calculation
    useEffect(() => {
      const api = apiRef.current
      if (!api) return

      // Create a robust message handler that handles all message formats
      const globalHandler = (evt: any) => {
        try {
          let data: any = null
          
          // Handle different message formats
          if (typeof evt === 'string') {
            try { data = JSON.parse(evt) } catch { data = evt }
          } else if (evt && typeof evt.data === 'string') {
            try { data = JSON.parse(evt.data) } catch { data = evt.data }
          } else if (evt && typeof evt.data === 'object' && evt.data !== null) {
            data = evt.data
          } else {
            data = evt
          }

          // FIXED: Handle tick data with multiple response formats
          if (data?.msg_type === "tick" || data?.tick || data?.error) {
            const tick = data.tick || data
            const sym = tick?.symbol || currentSymbolRef.current
            
            if (!sym || sym !== currentSymbolRef.current) return

            // Only process if we have a valid quote
            if (tick.quote === undefined && !data.error) return

            const tickData: TickData = {
              quote: tick.quote,
              epoch: tick.epoch || Date.now(),
              id: tick.id,
            }

            // FIXED: Immediate decimal place update
            if (tick.quote !== undefined) {
              updateDecimalPlaces(tick.quote, sym)

              // FIXED: Immediate price and digit update with PROPER digit 0 handling
              const priceStr = formatPriceWithDecLen(tick.quote, sym, decimalLenBySymbolRef.current)
              const digit = extractLastDigitFromFormatted(priceStr)
              setLastDigit(digit)

              setCurrentPrice(tick.quote)
              setCurrentSpot(tick.quote)

              // FIXED: Immediate chart update WITHOUT freezing
              setPriceHistory((prev) => {
                const newHistory = [...prev, { time: tick.epoch || Date.now(), price: tick.quote }]
                const maxPoints = chartGranularity === "tick" ? chartTickCount : chartMinuteCount * 60
                return newHistory.slice(-maxPoints)
              })

              // FIXED: Enhanced accumulator logic with CORRECT barrier calculation from PREVIOUS tick
              if (selectedTradeType === "accumulators") {
                // Calculate barriers from PREVIOUS tick (like Deriv does)
                if (previousTickRef.current) {
                  const { upper, lower } = calculateAccumulatorBarriers(previousTickRef.current, growthRateRef.current)
                  
                  if (upper && lower) {
                    setUpperBarrier(upper)
                    setLowerBarrier(lower)

                    const inRange = isWithinBarriers(tick.quote, upper, lower)
                    tickData.inRange = inRange
                    tickData.barrierUpper = upper
                    tickData.barrierLower = lower

                    setAccumulatorTicks((prev) => {
                      const newTicks = [...prev, tickData]
                      return newTicks.slice(-100)
                    })

                    if (isTradingRef.current) {
                      if (inRange) {
                        const newCount = currentTickCountRef.current + 1
                        setCurrentTickCount(newCount)
                        currentTickCountRef.current = newCount
                        
                        // FIXED: Calculate total payout (stake + accumulated profit)
                        const newPayout = stake + (newCount * stake * growthRateRef.current)
                        setAccumulatorPayout(newPayout)
                        accumulatorPayoutRef.current = newPayout
                        
                        // FIXED: Update current profit display
                        const currentProfit = newCount * stake * growthRateRef.current
                        setProfit(currentProfit)

                        if (takeProfit && currentProfit >= takeProfit) {
                          closeTrade()
                        }
                      } else {
                        setBarrierHit(true)
                        barrierHitRef.current = true
                        setBarrierHitFlash(true)
                        if (barrierFlashTimeoutRef.current) {
                          try { window.clearTimeout(barrierFlashTimeoutRef.current as any) } catch(e){}
                          barrierFlashTimeoutRef.current = null
                        }
                        barrierFlashTimeoutRef.current = window.setTimeout(() => {
                          setBarrierHitFlash(false)
                          barrierFlashTimeoutRef.current = null
                        }, 200)

                        if (currentTickCountRef.current > 0) {
                          setTickHistory(prev => [...prev, currentTickCountRef.current])
                        }

                        if (contractId) {
                          closeTrade()
                        }
                      }
                    }
                  }
                }

                // Update previous tick for NEXT barrier calculation
                previousTickRef.current = tickData
              }

              if (selectedTradeType !== "accumulators" && isTradingRef.current && contractId) {
                if (takeProfit && profit >= takeProfit) {
                  closeTrade()
                }

                if (stopLoss && profit <= -stopLoss) {
                  closeTrade()
                }
              }
            }
          }

          // FIXED: Handle contract updates
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

            setProfit(profit)
            setProfitPercentage(poc?.profit_percentage || 0)
            setCurrentSpot(poc?.current_spot)

            const isSold = Boolean(poc?.is_sold || poc?.status === "sold" || poc?.cancelled === 1)
            if (isSold) {
              const tradeProfit = Number(poc?.profit || 0)
              // FIXED: Remove double counting of P/L for accumulators - already handled in closeTrade
              if (selectedTradeType !== "accumulators") {
                totalProfitLossRef.current = totalProfitLossRef.current + tradeProfit
                setTotalProfitLoss(totalProfitLossRef.current)
              }

              try {
                cumulativeProfitRef.current = Number(cumulativeProfitRef.current || 0) + tradeProfit
              } catch {}

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
                if (run_panel?.setHasOpenContract) run_panel.setHasOpenContract(false)
                if (run_panel?.setContractStage) run_panel.setContractStage("CLOSED")
              } catch {}

              // FIXED: Reset trading state IMMEDIATELY
              setIsTrading(false)
              isTradingRef.current = false
              setContractId(null)
            }
          }

          // FIXED: Handle buy responses
          if (data.buy) {
            debugLog("Trade executed successfully:", data.buy)
            setContractId(data.buy.contract_id.toString())
            setEntrySpot(currentPrice)
            setBarrierHit(false)
            barrierHitRef.current = false

            // FIXED: Initialize accumulator payout to stake when trade starts
            if (selectedTradeType === "accumulators") {
              setAccumulatorPayout(stake)
              accumulatorPayoutRef.current = stake
            }

            try {
              transactions.onBotContractEvent({
                contract_id: data.buy.contract_id,
                transaction_ids: { buy: data.buy.transaction_id },
                buy_price: data.buy.buy_price,
                currency: "USD",
                contract_type: selectedTradeType,
                underlying: symbol,
                display_name: symbols.find(s => s.symbol === symbol)?.display_name || symbol,
                date_start: Math.floor(Date.now() / 1000),
                status: "open",
              } as any)
            } catch {}

            try {
              if (run_panel?.setHasOpenContract) run_panel.setHasOpenContract(true)
              if (run_panel?.setContractStage) run_panel.setContractStage("PURCHASE_SENT")
            } catch {}

            try {
              const cid = String(data.buy.contract_id || "")
              activeTradesRef.current[cid] = {
                contract_id: cid,
                currentProfit: 0,
              }
            } catch {}

            // Subscribe to contract updates
            if (apiRef.current?.send) {
              apiRef.current.send({
                proposal_open_contract: 1,
                contract_id: data.buy.contract_id,
                subscribe: 1,
              }).then((res: any) => {
                const subId = res?.subscription?.id ?? null
                if (subId) subIdByContractRef.current[String(data.buy.contract_id)] = subId
              }).catch(console.error)
            }

            setTradeResult({
              type: "success",
              message: `Trade opened! Contract ID: ${data.buy.contract_id}`,
            })
          }

          // FIXED: Handle buy errors
          if (data.error && data.msg_type === "buy") {
            console.error("[DTrader] Buy error:", data.error)
            setIsTrading(false)
            isTradingRef.current = false
            setTradeResult({
              type: "error",
              message: `Trade failed: ${data.error.message}`,
            })
          }
        } catch (err) {
          console.error("[DTrader] Message handler error:", err)
        }
      }

      // FIXED: IMPROVED connection attachment with multiple fallbacks
      const attachMessageHandler = () => {
        if (!api.connection) {
          console.warn('[DTrader] No API connection available')
          return false
        }

        try {
          // Try WebSocket event listener first
          if (typeof api.connection.addEventListener === 'function') {
            api.connection.addEventListener('message', globalHandler)
            globalMsgHandlerRef.current = globalHandler
            connectionAttachedRef.current = true
            debugLog('Message handler attached via addEventListener')
            return true
          }
          
          // Try direct onmessage assignment
          if (typeof api.connection.onmessage === 'function' || api.connection.onmessage === null) {
            api.connection.onmessage = globalHandler
            globalMsgHandlerRef.current = globalHandler
            connectionAttachedRef.current = true
            debugLog('Message handler attached via onmessage')
            return true
          }
          
          // Try API event system
          if (typeof api.on === 'function') {
            api.on('message', globalHandler)
            globalMsgHandlerRef.current = globalHandler
            connectionAttachedRef.current = true
            debugLog('Message handler attached via api.on')
            return true
          }
          
          console.warn('[DTrader] No supported connection event attach method found')
          return false
        } catch (e) {
          console.warn('[DTrader] Failed to attach global message handler', e)
          return false
        }
      }

      if (!connectionAttachedRef.current) {
        attachMessageHandler()
      }

      return () => {
        // FIXED: IMPROVED cleanup with proper detachment
        if (globalMsgHandlerRef.current && api.connection) {
          try {
            if (typeof api.connection.removeEventListener === 'function') {
              api.connection.removeEventListener("message", globalMsgHandlerRef.current)
            }
            if (api.connection.onmessage === globalMsgHandlerRef.current) {
              api.connection.onmessage = null
            }
            if (typeof api.off === 'function') {
              api.off('message', globalMsgHandlerRef.current)
            }
          } catch (e) {
            console.warn('[DTrader] Error removing message handler', e)
          }
          globalMsgHandlerRef.current = null
          connectionAttachedRef.current = false
        }

        // Clean up contract subscriptions
        try {
          Object.values(subIdByContractRef.current).forEach((sub) => {
            if (sub && apiRef.current?.forget) {
              try {
                apiRef.current.forget({ forget: sub })
              } catch (e) {
                console.warn('[DTrader] Error forgetting subscription', e)
              }
            }
          })
          subIdByContractRef.current = {}
        } catch (e) {
          console.warn('[DTrader] Error cleaning up subscriptions', e)
        }

        stopTicks()
      }
    }, [selectedTradeType, symbol, chartGranularity, chartTickCount, chartMinuteCount, takeProfit, stopLoss, entrySpot, stake, closeTrade, calculateAccumulatorBarriers, isWithinBarriers, updateDecimalPlaces, symbols])

    // FIXED: Enhanced chart drawing with immediate updates and NO freezing
    useEffect(() => {
      const drawChart = () => {
        try {
          if (!chartCanvasRef.current) return

          const canvas = chartCanvasRef.current
          const ctx = canvas.getContext("2d")
          if (!ctx) return

          const dpr = window.devicePixelRatio || 1
          const rect = canvas.getBoundingClientRect()
          canvas.width = rect.width * dpr
          canvas.height = rect.height * dpr
          ctx.scale(dpr, dpr)

          const width = rect.width
          const height = rect.height
          const padding = 40
          const chartWidth = width - 2 * padding
          const chartHeight = height - 2 * padding

          ctx.fillStyle = "#0f1724"
          ctx.fillRect(0, 0, width, height)

          if (priceHistory.length < 2) {
            ctx.fillStyle = "#64748b"
            ctx.font = "14px sans-serif"
            ctx.textAlign = "center"
            ctx.fillText("Waiting for price data...", width / 2, height / 2)
            return
          }

          const prices = priceHistory.map(p => p.price)
          const minPrice = Math.min(...prices)
          const maxPrice = Math.max(...prices)
          const priceRange = maxPrice - minPrice || 1
          const pricePadding = priceRange * 0.1
          const adjustedMin = minPrice - pricePadding
          const adjustedMax = maxPrice + pricePadding
          let adjustedRange = adjustedMax - adjustedMin
          if (adjustedRange === 0) adjustedRange = 1

          ctx.strokeStyle = "#334155"
          ctx.lineWidth = 1
          for (let i = 0; i <= 5; i++) {
            const y = padding + (i * chartHeight) / 5
            ctx.beginPath()
            ctx.moveTo(padding, y)
            ctx.lineTo(width - padding, y)
            ctx.stroke()
          }

          ctx.strokeStyle = barrierHitFlash ? "#ef4444" : "#3b82f6"
          ctx.lineWidth = 2
          ctx.beginPath()

          priceHistory.forEach((point, index) => {
            const x = padding + (index * chartWidth) / (priceHistory.length - 1)
            const y = height - padding - ((point.price - adjustedMin) / adjustedRange) * chartHeight

            if (index === 0) {
              ctx.moveTo(x, y)
            } else {
              ctx.lineTo(x, y)
            }
          })
          ctx.stroke()

          if (selectedTradeType === "accumulators" && upperBarrier && lowerBarrier) {
            const upperY = height - padding - ((upperBarrier - adjustedMin) / adjustedRange) * chartHeight
            ctx.strokeStyle = barrierHitFlash ? "#ef4444" : "#ef4444"
            ctx.setLineDash([5, 5])
            ctx.beginPath()
            ctx.moveTo(padding, upperY)
            ctx.lineTo(width - padding, upperY)
            ctx.stroke()
            
            const lowerY = height - padding - ((lowerBarrier - adjustedMin) / adjustedRange) * chartHeight
            ctx.strokeStyle = barrierHitFlash ? "#ef4444" : "#10b981"
            ctx.beginPath()
            ctx.moveTo(padding, lowerY)
            ctx.lineTo(width - padding, lowerY)
            ctx.stroke()
            ctx.setLineDash([])

            ctx.fillStyle = "#f8fafc"
            ctx.font = "10px sans-serif"
            ctx.fillText(`Upper: ${formatPriceForDisplay(upperBarrier)}`, width - padding - 80, upperY - 5)
            ctx.fillText(`Lower: ${formatPriceForDisplay(lowerBarrier)}`, width - padding - 80, lowerY + 15)
          }

          if (currentPrice) {
            const currentY = height - padding - ((currentPrice - adjustedMin) / adjustedRange) * chartHeight
            ctx.fillStyle = barrierHitFlash ? "#ef4444" : "#3b82f6"
            ctx.beginPath()
            ctx.arc(width - padding, currentY, 4, 0, 2 * Math.PI)
            ctx.fill()

            ctx.fillStyle = "#f8fafc"
            ctx.font = "12px sans-serif"
            ctx.fillText(formatPriceForDisplay(currentPrice), width - padding - 60, currentY - 10)
          }

          if (isTrading && entrySpot) {
            const entryY = height - padding - ((entrySpot - adjustedMin) / adjustedRange) * chartHeight
            ctx.strokeStyle = "#f59e0b"
            ctx.setLineDash([3, 3])
            ctx.beginPath()
            ctx.moveTo(padding, entryY)
            ctx.lineTo(width - padding, entryY)
            ctx.stroke()
            ctx.setLineDash([])
          }
        } catch (error) {
          debugLog('Error drawing chart', error);
        }
      }

      drawChart()
      chartAnimationRef.current = requestAnimationFrame(drawChart)

      return () => {
        if (chartAnimationRef.current) {
          cancelAnimationFrame(chartAnimationRef.current)
        }
      }
    }, [priceHistory, currentPrice, upperBarrier, lowerBarrier, isTrading, entrySpot, selectedTradeType, barrierHitFlash, formatPriceForDisplay])

    // FIXED: COMPLETELY REWRITTEN tick management with ERROR RESILIENCE
    const startTicks = async (sym: string) => {
      try {
        debugLog(`Starting ticks for: ${sym}`)
        
        // Reset states
        setCurrentPrice(null)
        setPriceHistory([])
        setLastDigit(null)
        setCurrentTickCount(0)
        setAccumulatorTicks([])
        setTradeResult({
          type: "info",
          message: `Connecting to ${symbols.find(s => s.symbol === sym)?.display_name || sym}...`,
        })
        
        // Stop previous ticks gracefully
        await stopTicks()
        currentSymbolRef.current = sym

        // Update current display name
        const symbolObj = symbols.find(s => s.symbol === sym)
        if (symbolObj) {
          currentDisplayNameRef.current = symbolObj.display_name
        }

        // Load historical data first
        await analyzeTicksFromHistory(sym, 50)
        
        // Subscribe to live ticks with robust error handling
        if (!apiRef.current) {
          throw new Error("API not available")
        }

        const res = await apiRef.current.send({ 
          ticks: sym, 
          subscribe: 1 
        })
        
        // Handle different response formats
        const subId = res?.subscription?.id ?? res?.ticks?.subscribe?.id ?? `ticks_${sym}`
        tickStreamIdRef.current = subId
        
        debugLog(`Tick subscription started for ${sym}, ID: ${subId}`)
        
        setTradeResult({
          type: "success",
          message: `Connected to ${symbols.find(s => s.symbol === sym)?.display_name || sym}. Live data active.`,
        })
      } catch (e: any) {
        console.error("[DTrader] Failed to start ticks:", e)
        const errorMsg = e?.message || "Unknown error"
        setConnectionError(`Tick stream error: ${errorMsg}`)
        setTradeResult({
          type: "error",
          message: `Failed to connect to ${symbols.find(s => s.symbol === sym)?.display_name || sym}: ${errorMsg}`,
        })
        
        // Fallback: try to use historical data even if live ticks fail
        try {
          await analyzeTicksFromHistory(sym, 100)
          setTradeResult({
            type: "info",
            message: `Using historical data for ${symbols.find(s => s.symbol === sym)?.display_name || sym}. Live data unavailable.`,
          })
        } catch (fallbackError) {
          console.error("[DTrader] Historical data also failed:", fallbackError)
        }
      }
    }

    // FIXED: IMPROVED stopTicks with BETTER error handling
    const stopTicks = async () => {
      try {
        if (tickStreamIdRef.current && apiRef.current) {
          const streamId = tickStreamIdRef.current
          tickStreamIdRef.current = null
          
          // Only try to forget if it looks like a valid subscription ID
          if (typeof streamId === 'string' && streamId.startsWith('ticks_')) {
            debugLog(`Skipping forget for non-subscription ID: ${streamId}`)
            return
          }
          
          if (typeof apiRef.current.forget === 'function') {
            await apiRef.current.forget({ forget: streamId })
            debugLog(`Successfully stopped ticks: ${streamId}`)
          }
        }
      } catch (e) {
        // Ignore forget errors - they're usually harmless
        console.warn("[DTrader] Non-critical error stopping ticks:", e)
      }
    }

    const authorizeIfNeeded = async () => {
      const token = V2GetActiveToken()
      const clientId = V2GetActiveClientId()
      if (!token || !clientId) throw new Error("No active token or client ID found")
      
      const { authorize, error } = await apiRef.current.authorize(token)
      if (error) throw error
      return authorize
    }

    // FIXED: Enhanced symbol change with ROBUST error handling
    const handleSymbolChange = async (newSymbol: string) => {
      try {
        debugLog(`Switching to symbol: ${newSymbol}`)
        
        // Update state immediately for responsive UI
        setSymbol(newSymbol)
        currentSymbolRef.current = newSymbol
        
        // Update current display name
        const symbolObj = symbols.find(s => s.symbol === newSymbol)
        if (symbolObj) {
          currentDisplayNameRef.current = symbolObj.display_name
        }
        
        await startTicks(newSymbol)
      } catch (error) {
        console.error(`[DTrader] Error switching to symbol ${newSymbol}:`, error)
        setTradeResult({
          type: "error",
          message: `Failed to switch to ${symbols.find(s => s.symbol === newSymbol)?.display_name || newSymbol}. Trying fallback...`,
        })
      }
    }

    // FIXED: Enhanced trade execution with BETTER state management
    const executeTrade = useCallback(async () => {
      try {
        if (!apiRef.current || !isConnected) {
          setTradeResult({
            type: "error",
            message: "Not connected to server. Please wait for connection.",
          })
          return
        }

        if (isTrading && contractId) {
          await closeTrade(true)
          return
        }

        if (stake < 1) {
          setTradeResult({
            type: "error",
            message: "Stake must be at least $1.",
          })
          return
        }

        setIsTrading(true)
        isTradingRef.current = true
        setTradeResult(null)
        
        if (selectedTradeType === "accumulators") {
          setCurrentTickCount(0)
          currentTickCountRef.current = 0
          // FIXED: Initialize accumulator payout to stake when trade starts
          setAccumulatorPayout(stake)
          accumulatorPayoutRef.current = stake
          setBarrierHit(false)
          barrierHitRef.current = false
        }
        
        setProfit(0)
        setProfitPercentage(0)

        await authorizeIfNeeded()

        let contractType = ""
        const tradeParams: any = {
          amount: stake,
          basis: "stake",
          currency: "USD",
          symbol: symbol,
        }

        switch (selectedTradeType) {
          case "multipliers":
            contractType = prediction === "up" ? "MULTUP" : "MULTDOWN"
            tradeParams.multiplier = multiplier
            if (takeProfit || stopLoss) {
              tradeParams.limit_order = {}
              if (takeProfit) tradeParams.limit_order.take_profit = takeProfit
              if (stopLoss) tradeParams.limit_order.stop_loss = stopLoss
            }
            break

          case "accumulators":
            contractType = "ACCU"
            tradeParams.growth_rate = growthRate
            if (takeProfit || stopLoss) {
              tradeParams.limit_order = {}
              if (takeProfit) tradeParams.limit_order.take_profit = takeProfit
              if (stopLoss) tradeParams.limit_order.stop_loss = stopLoss
            }
            break
        }

        debugLog("Executing trade:", { contractType, ...tradeParams })
        
        const buy_req = tradeOptionToBuy(contractType, tradeParams)
        let buyResponse: any = null
        
        if (typeof apiRef.current.buy === 'function') {
          buyResponse = await apiRef.current.buy(buy_req)
        } else if (typeof apiRef.current.send === 'function') {
          buyResponse = await apiRef.current.send(buy_req)
        } else {
          throw new Error('No buy/send method on API')
        }
        
        const buy = buyResponse?.buy ?? buyResponse
        const error = buyResponse?.error ?? buyResponse?.error
        if (error) throw error

        debugLog("Trade executed successfully:", buy)
        
        if (onTradeComplete) {
          onTradeComplete(buy)
        }
      } catch (error: any) {
        console.error("[DTrader] Trade execution failed:", error)
        setIsTrading(false)
        isTradingRef.current = false
        setTradeResult({
          type: "error",
          message: error.message || "Trade execution failed. Please try again.",
        })
      }
    }, [
      apiRef,
      isConnected,
      isTrading,
      contractId,
      stake,
      selectedTradeType,
      symbol,
      prediction,
      multiplier,
      takeProfit,
      stopLoss,
      growthRate,
      onTradeComplete,
      closeTrade,
    ])

    const resetTrade = useCallback(() => {
      try {
        setIsTrading(false)
        isTradingRef.current = false
        setContractId(null)
        setProfit(0)
        setProfitPercentage(0)
        setEntrySpot(null)
        setCurrentTickCount(0)
        currentTickCountRef.current = 0
        setAccumulatorPayout(0)
        accumulatorPayoutRef.current = 0
        setBarrierHit(false)
        barrierHitRef.current = false
        setTradeResult(null)
        setProposalId(null)
        setAskPrice(null)
        setPayout(null)
        setProposalError(null)
      } catch (error) {
        debugLog('Error resetting trade', error);
      }
    }, [])

    // FIXED: Enhanced trade type change with PROPER cleanup
    const handleTradeTypeChange = useCallback(
      async (type: keyof typeof tradeTypes) => {
        try {
          resetTrade()
          setSelectedTradeType(type)
          setPrediction("up")
          setMultiplier(40)
          setGrowthRate(0.03)
          growthRateRef.current = 0.03
          setTakeProfit(null)
          setStopLoss(null)
          setIsDropdownOpen(false)
          setProposalError(null)
          setTradeResult(null)

          // Restart ticks for the new trade type
          if (isConnected && symbol) {
            await startTicks(symbol)
          }
        } catch (error) {
          debugLog('Error changing trade type', error);
        }
      },
      [resetTrade, isConnected, symbol],
    )

    const toggleAutoTrading = useCallback(() => {
      try {
        if (isAutoTrading) {
          setIsAutoTrading(false)
          setAutoTradingStats({
            waitingForNewStats: false,
            ticksSinceBarrierBreach: 0,
            inTrade: false,
            ticksInTrade: 0,
          })
        } else {
          setIsAutoTrading(true)
          setAutoTradingStats({
            waitingForNewStats: true,
            ticksSinceBarrierBreach: 0,
            inTrade: false,
            ticksInTrade: 0,
          })
        }
      } catch (error) {
        debugLog('Error toggling auto trading', error);
      }
    }, [isAutoTrading])

    const TradeIcon = tradeTypes[selectedTradeType].icon

    // FIXED: Get current barrier offset for display
    const getCurrentBarrierOffset = () => {
      try {
        return getBarrierOffset(currentDisplayNameRef.current, growthRate)
      } catch (error) {
        debugLog('Error getting current barrier offset', error);
        return 0.661;
      }
    }

    return (
      <div className="dtrader">
        <div className="dtrader__header">
          <div className="dtrader__connection-status">
            <div
              className={`dtrader__connection-indicator ${isConnected ? "dtrader__connection-indicator--connected" : "dtrader__connection-indicator--disconnected"}`}
            />
            <span className="dtrader__connection-text">
              {isConnected ? "Connected" : "Disconnected"}
              {isConnected && currentPrice && " - Live Data"}
            </span>
          </div>
          <div className="dtrader__price">
            {currentPrice !== null ? (
              <>
                <span className="dtrader__price-label">Price:</span>
                <span className="dtrader__price-value">{formatPriceForDisplay(currentPrice)}</span>
                {lastDigit !== null && (
                  <span className="dtrader__last-digit">(Digit: {lastDigit})</span>
                )}
              </>
            ) : (
              <span className="dtrader__price-loading">Connecting to market data...</span>
            )}
          </div>
          <div className="dtrader__total-pl">
            <span className="dtrader__total-pl-label">Total P/L:</span>
            <span
              className={`dtrader__total-pl-value ${totalProfitLoss >= 0 ? "dtrader__total-pl-value--positive" : "dtrader__total-pl-value--negative"}`}
            >
              ${totalProfitLoss.toFixed(2)}
            </span>
          </div>
        </div>

        {connectionError && (
          <div className="dtrader__connection-error">
            <AlertCircle className="dtrader__connection-error-icon" />
            <span>{connectionError}</span>
          </div>
        )}

        <div className="dtrader__content">
          <div className="dtrader__panel dtrader__panel--config">
            <div className="dtrader__field">
              <label className="dtrader__label">Trade Type</label>
              <div className="dtrader__dropdown">
                <button
                  className="dtrader__dropdown-trigger"
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  disabled={isTrading}
                >
                  <TradeIcon className="dtrader__dropdown-icon" />
                  <span>{tradeTypes[selectedTradeType].name}</span>
                  <ChevronDown className="dtrader__dropdown-arrow" />
                </button>
                {isDropdownOpen && (
                  <div className="dtrader__dropdown-menu">
                    {Object.entries(tradeTypes)
                      .filter(([key]) => key === 'accumulators' || key === 'multipliers')
                      .map(([key, config]) => {
                        const Icon = config.icon
                        return (
                          <button
                            key={key}
                            className={`dtrader__dropdown-item ${selectedTradeType === key ? "dtrader__dropdown-item--active" : ""}`}
                            onClick={() => handleTradeTypeChange(key as keyof typeof tradeTypes)}
                          >
                            <Icon className="dtrader__dropdown-item-icon" />
                            <span>{config.name}</span>
                          </button>
                        )
                      })}
                  </div>
                )}
              </div>
            </div>

            <div className="dtrader__row">
              <div className="dtrader__field dtrader__field--third">
                <label className="dtrader__label">Symbol</label>
                <select
                  className="dtrader__select"
                  value={symbol}
                  onChange={async (e) => {
                    await handleSymbolChange(e.target.value)
                  }}
                  disabled={isTrading}
                >
                  {symbols.map((s) => (
                    <option key={s.symbol} value={s.symbol}>
                      {s.display_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="dtrader__field dtrader__field--third">
                <label className="dtrader__label">
                  <DollarSign className="dtrader__label-icon" />
                  Stake
                </label>
                <input
                  type="number"
                  className="dtrader__input"
                  value={stake}
                  onChange={(e) => setStake(Number(e.target.value))}
                  min={1}
                  step={1}
                  disabled={isTrading}
                />
              </div>

              {selectedTradeType === "multipliers" && (
                <div className="dtrader__field dtrader__field--third">
                  <label className="dtrader__label">
                    <Layers className="dtrader__label-icon" />
                    Multiplier
                  </label>
                  <select
                    className="dtrader__select"
                    value={multiplier}
                    onChange={(e) => setMultiplier(Number(e.target.value))}
                    disabled={isTrading}
                  >
                    {multiplierOptions.map((mult) => (
                      <option key={mult} value={mult}>
                        x{mult}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="dtrader__row">
              {selectedTradeType === "multipliers" && (
                <div className="dtrader__field dtrader__field--half">
                  <label className="dtrader__label">Prediction</label>
                  <div className="dtrader__prediction">
                    <button
                      className={`dtrader__prediction-btn ${prediction === "up" ? "dtrader__prediction-btn--active dtrader__prediction-btn--up" : ""}`}
                      onClick={() => setPrediction("up")}
                      disabled={isTrading}
                    >
                      <TrendingUp className="dtrader__prediction-icon" />
                      Up
                    </button>
                    <button
                      className={`dtrader__prediction-btn ${prediction === "down" ? "dtrader__prediction-btn--active dtrader__prediction-btn--down" : ""}`}
                      onClick={() => setPrediction("down")}
                      disabled={isTrading}
                    >
                      <TrendingDown className="dtrader__prediction-icon" />
                      Down
                    </button>
                  </div>
                </div>
              )}

              {selectedTradeType === "accumulators" && (
                <div className="dtrader__field dtrader__field--half">
                  <label className="dtrader__label">
                    <Activity className="dtrader__label-icon" />
                    Growth Rate
                  </label>
                  <select
                    className="dtrader__select"
                    value={growthRate}
                    onChange={(e) => {
                      const newRate = Number(e.target.value)
                      setGrowthRate(newRate)
                      growthRateRef.current = newRate
                    }}
                    disabled={isTrading}
                  >
                    {tradeTypes.accumulators.growthRates.map((rate) => (
                      <option key={rate} value={rate}>
                        {(rate * 100).toFixed(0)}% (Barrier: ±{getBarrierOffset(currentDisplayNameRef.current, rate)})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {(selectedTradeType === "multipliers" || selectedTradeType === "accumulators") && (
              <div className="dtrader__row">
                <div className="dtrader__field dtrader__field--half">
                  <label className="dtrader__label">Take Profit ($)</label>
                  <input
                    type="number"
                    className="dtrader__input"
                    value={takeProfit || ""}
                    onChange={(e) => setTakeProfit(e.target.value ? Number(e.target.value) : null)}
                    placeholder="Optional"
                    disabled={isTrading}
                  />
                </div>

                <div className="dtrader__field dtrader__field--half">
                  <label className="dtrader__label">Stop Loss ($)</label>
                  <input
                    type="number"
                    className="dtrader__input"
                    value={stopLoss || ""}
                    onChange={(e) => setStopLoss(e.target.value ? Number(e.target.value) : null)}
                    placeholder="Optional"
                    disabled={isTrading}
                  />
                </div>
              </div>
            )}

            <div className="dtrader__field">
              <label className="dtrader__label">
                <BarChart3 className="dtrader__label-icon" />
                Chart Display
              </label>
              <div className="dtrader__chart-granularity">
                <select
                  className="dtrader__select dtrader__select--granularity"
                  value={chartGranularity}
                  onChange={(e) => setChartGranularity(e.target.value as "tick" | "minute")}
                >
                  <option value="tick">Ticks</option>
                  <option value="minute">Minutes</option>
                </select>
                {chartGranularity === "tick" ? (
                  <input
                    type="number"
                    className="dtrader__input dtrader__input--granularity"
                    value={chartTickCount}
                    onChange={(e) => setChartTickCount(Number(e.target.value))}
                    min={10}
                    max={1000}
                    step={10}
                  />
                ) : (
                  <input
                    type="number"
                    className="dtrader__input dtrader__input--granularity"
                    value={chartMinuteCount}
                    onChange={(e) => setChartMinuteCount(Number(e.target.value))}
                    min={1}
                    max={60}
                    step={1}
                  />
                )}
              </div>
            </div>

            <AnimatePresence>
              {tradeResult && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className={`dtrader__result dtrader__result--${tradeResult.type}`}
                >
                  {tradeResult.type === "success" ? (
                    <Check className="dtrader__result-icon" />
                  ) : tradeResult.type === "error" ? (
                    <AlertCircle className="dtrader__result-icon" />
                  ) : (
                    <Info className="dtrader__result-icon" />
                  )}
                  <span>{tradeResult.message}</span>
                </motion.div>
              )}
            </AnimatePresence>

            {selectedTradeType === "accumulators" && isAutoTrading && (
              <div className="dtrader__auto-status">
                <div className="dtrader__auto-status-header">
                  <Activity className="dtrader__auto-status-icon" />
                  <span>Auto Trading Active</span>
                </div>
                <div className="dtrader__auto-status-info">
                  {autoTradingStats.waitingForNewStats && (
                    <p>Waiting for stable range... ({autoTradingStats.ticksSinceBarrierBreach}/14 ticks)</p>
                  )}
                  {autoTradingStats.inTrade && <p>In trade... ({autoTradingStats.ticksInTrade}/9 ticks)</p>}
                </div>
              </div>
            )}
          </div>

          <div className="dtrader__panel dtrader__panel--chart">
            <div className="dtrader__chart-container">
              <div className="dtrader__chart-header">
                <h3 className="dtrader__chart-title">
                  <BarChart3 className="dtrader__section-icon" />
                  Live Chart - {symbols.find(s => s.symbol === symbol)?.display_name || symbol}
                </h3>
                {upperBarrier && lowerBarrier && selectedTradeType === "accumulators" && (
                  <div className="dtrader__barrier-info">
                    <span className="dtrader__barrier-item dtrader__barrier-item--upper">
                      Upper: {formatPriceForDisplay(upperBarrier)} (Barrier: +{getCurrentBarrierOffset()})
                    </span>
                    <span className="dtrader__barrier-item dtrader__barrier-item--lower">
                      Lower: {formatPriceForDisplay(lowerBarrier)} (Barrier: -{getCurrentBarrierOffset()})
                    </span>
                  </div>
                )}
              </div>
              <canvas ref={chartCanvasRef} className="dtrader__chart" />
            </div>

            {/* MOVED: Execute Trade and Auto Trade buttons below the chart */}
            <div className="dtrader__chart-actions">
              <button
                className={`dtrader__btn ${isTrading ? "dtrader__btn--close" : "dtrader__btn--trade"}`}
                onClick={executeTrade}
                disabled={!isConnected || (isTrading && !contractId)}
              >
                {isTrading ? (
                  <>
                    <X className="dtrader__btn-icon" />
                    Close Trade
                  </>
                ) : (
                  <>
                    <Check className="dtrader__btn-icon" />
                    Execute Trade
                  </>
                )}
              </button>

              {selectedTradeType === "accumulators" && (
                <button
                  className={`dtrader__btn dtrader__btn--auto ${isAutoTrading ? "dtrader__btn--auto-active" : ""}`}
                  onClick={toggleAutoTrading}
                  disabled={isTrading}
                >
                  {isAutoTrading ? <Pause className="dtrader__btn-icon" /> : <Play className="dtrader__btn-icon" />}
                  {isAutoTrading ? "Stop Auto" : "Auto Trade"}
                </button>
              )}

              {isTrading && (
                <button
                  className="dtrader__btn dtrader__btn--manual-close"
                  onClick={() => closeTrade(true)}
                  disabled={!contractId}
                >
                  <X className="dtrader__btn-icon" />
                  Close Now
                </button>
              )}
            </div>

            {selectedTradeType === "accumulators" && (
              <div className="dtrader__accumulator-stats">
                <div className="dtrader__stats-header">
                  <h4 className="dtrader__stats-title">
                    <Activity className="dtrader__stats-icon" />
                    Accumulator Stats
                  </h4>
                  <button 
                    className="dtrader__history-toggle"
                    onClick={() => setShowHistory(!showHistory)}
                    title="Show history"
                  >
                    <History className="dtrader__history-icon" />
                  </button>
                </div>

                <div className="dtrader__current-stats">
                  <div className="dtrader__current-tick-count">
                    <span className="dtrader__current-count-label">Current Ticks:</span>
                    <span className="dtrader__current-count-value">{currentTickCount}</span>
                  </div>
                  
                  {accumulatorPayout > 0 && (
                    <div className="dtrader__accumulator-payout">
                      <span className="dtrader__payout-label">Total Payout:</span>
                      <span className="dtrader__payout-value">${accumulatorPayout.toFixed(2)}</span>
                    </div>
                  )}
                </div>

                {tickHistory.length > 0 && (
                  <div className="dtrader__tick-history-container">
                    <div className="dtrader__history-label">Previous Ranges:</div>
                    <div className="dtrader__history-row">
                      {tickHistory.slice(-10).map((count, index) => (
                        <div key={index} className="dtrader__history-count-item">
                          <span className="dtrader__count-number">{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {showHistory && tickHistory.length > 0 && (
                  <div className="dtrader__history-popup">
                    <div className="dtrader__history-popup-header">
                      <h5>Complete Range History ({tickHistory.length} ranges)</h5>
                      <button 
                        className="dtrader__history-close"
                        onClick={() => setShowHistory(false)}
                      >
                        <X size={16} />
                      </button>
                    </div>
                    <div className="dtrader__history-list">
                      {tickHistory.map((count, index) => (
                        <div key={index} className="dtrader__history-item">
                          <span className="dtrader__history-index">Range {index + 1}:</span>
                          <span className="dtrader__history-count">{count} ticks</span>
                          <span className="dtrader__history-timestamp">
                            {new Date(Date.now() - (tickHistory.length - index) * 1000).toLocaleTimeString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {isTrading && (
              <div className="dtrader__status">
                <div className="dtrader__status-actions">
                  <button
                    className="dtrader__status-close-btn"
                    onClick={() => closeTrade(true)}
                    disabled={!contractId}
                  >
                    <X className="dtrader__status-close-icon" />
                    Close Trade Immediately
                  </button>
                </div>
                
                <div className="dtrader__status-item">
                  <span className="dtrader__status-label">Contract ID:</span>
                  <span className="dtrader__status-value">{contractId || "Pending..."}</span>
                </div>

                {entrySpot !== null && (
                  <div className="dtrader__status-item">
                    <span className="dtrader__status-label">Entry Spot:</span>
                    <span className="dtrader__status-value">{formatPriceForDisplay(entrySpot)}</span>
                  </div>
                )}

                {currentSpot !== null && (
                  <div className="dtrader__status-item">
                    <span className="dtrader__status-label">Current Spot:</span>
                    <span className="dtrader__status-value">{formatPriceForDisplay(currentSpot)}</span>
                  </div>
                )}

                <div className="dtrader__status-item dtrader__status-item--profit">
                  <span className="dtrader__status-label">Current P&L:</span>
                  <span
                    className={`dtrader__status-value ${profit >= 0 ? "dtrader__status-value--positive" : "dtrader__status-value--negative"}`}
                  >
                    ${profit.toFixed(2)} ({profitPercentage.toFixed(2)}%)
                  </span>
                </div>

                {selectedTradeType === "accumulators" && (
                  <>
                    <div className="dtrader__status-item">
                      <span className="dtrader__status-label">Current Ticks:</span>
                      <span className="dtrader__status-value">{currentTickCount}</span>
                    </div>
                    <div className="dtrader__status-item">
                      <span className="dtrader__status-label">Total Payout:</span>
                      <span className="dtrader__status-value">${accumulatorPayout.toFixed(2)}</span>
                    </div>
                  </>
                )}

                {barrierHit && selectedTradeType === "accumulators" && (
                  <div className="dtrader__status-item dtrader__status-item--warning">
                    <span className="dtrader__status-label">Status:</span>
                    <span className="dtrader__status-value">Barrier Breached!</span>
                  </div>
                )}
              </div>
            )}

            {!isTrading && selectedTradeType !== "accumulators" && (
              <div className="dtrader__empty">
                <Activity className="dtrader__empty-icon" />
                <p className="dtrader__empty-text">
                  Configure your trade parameters and click "Execute Trade" to start trading.
                </p>
              </div>
            )}

            {!isTrading && selectedTradeType === "accumulators" && accumulatorTicks.length === 0 && (
              <div className="dtrader__empty">
                <Activity className="dtrader__empty-icon" />
                <p className="dtrader__empty-text">
                  Accumulator ready. Barriers will be calculated from previous ticks. Click "Execute Trade" to start.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  },
)

DTrader.displayName = "DTrader"

export default DTrader
