import React, { useState } from "react";
import AIEnhancedTradeUi from "@/pages/pro-tool/aIEnhancedTradeUi.tsx";
import TradingHubDisplay from "@/components/trading-hub/trading-hub-display.tsx";
import "./display-toggle.scss";

const Analysis: React.FC = () => {
    return (
        <div className="iframe-container">
            <iframe
                src="/sbs/thebot.html"
                title="Analysis"
                className="content-iframe"
            />
        </div>
    );
};

const DisplayToggle: React.FC = () => {
    const [activeDisplay, setActiveDisplay] = useState<"aIEnhancedTradeUi" | "aIEnhancedTradeUisignal">("aIEnhancedTradeUi");

    return (
        <div className="display-container">
            {/* Toggle buttons */}
            <div className="display-toggle">
                <button
                    className={`display-toggle__button ${activeDisplay === "aIEnhancedTradeUi" ? "active-aIEnhancedTradeUi" : ""}`}
                    onClick={() => setActiveDisplay("aIEnhancedTradeUi")}
                >
                    ⚡ AI Trading Engine
                </button>
                <button
                    className={`display-toggle__button ${activeDisplay === "trading" ? "active-trading" : ""}`}
                    onClick={() => setActiveDisplay("trading")}
                >
                    ⚡ Trading Hub
                </button>
                <button
                    className={`display-toggle__button ${activeDisplay === "analysis" ? "active-analysis" : ""}`}
                    onClick={() => setActiveDisplay("analysis")}
                >
                    📈 Auto AI
                </button>
            </div>

            {/* Content area - fixed height container */}
            <div className="display-content">
                {activeDisplay === "aIEnhancedTradeUi" && <AIEnhancedTradeUi />}
                {activeDisplay === "trading" && <TradingHubDisplay />}
                {activeDisplay === "analysis" && <Analysis />}
            </div>
        </div>
    );
};

export default DisplayToggle;
