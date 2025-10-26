import React, { useState } from "react";
import AIEnhancedTradeUisignal from "@/pages/pro-tool/aIEnhancedTradeUisignal.tsx";
import "./display-toggle.scss";

// Simple iframe components for AI and Analysis
const AiPage: React.FC = () => {
    return (
        <div className="iframe-container">
            <iframe
                src="https://signals-scanner.vercel.app/"
                title="signals-scanner"
                className="content-iframe"
            />
        </div>
    );
};

const Analysis: React.FC = () => {
    return (
        <div className="iframe-container">
            <iframe
                src="https://smartanalysistool.com/signal-center"
                title="smart-analysis"
                className="content-iframe"
            />
        </div>
    );
};

const DisplayToggle: React.FC = () => {
    const [activeDisplay, setActiveDisplay] = useState<"aIEnhancedTradeUisignal" | "ai" | "analysis">("aIEnhancedTradeUisignal");

    return (
        <div className="display-container">
            {/* Toggle buttons */}
            <div className="display-toggle">
                <button
                    className={`display-toggle__button ${activeDisplay === "aIEnhancedTradeUisignal" ? "active-aIEnhancedTradeUisignal" : ""}`}
                    onClick={() => setActiveDisplay("aIEnhancedTradeUisignal")}
                >
                    🚀 AI Ml signals 
                </button>
                <button
                    className={`display-toggle__button ${activeDisplay === "ai" ? "active-ai" : ""}`}
                    onClick={() => setActiveDisplay("ai")}
                >
                    🚀 Signals Scanner
                </button>
                <button
                    className={`display-toggle__button ${activeDisplay === "analysis" ? "active-analysis" : ""}`}
                    onClick={() => setActiveDisplay("analysis")}
                >
                    📊 Smart Signals Tool
                </button>
            </div>

            {/* Content area - fixed height container */}
            <div className="display-content">
                {activeDisplay === "aIEnhancedTradeUisignal" && <AIEnhancedTradeUisignal />}
                {activeDisplay === "ai" && <AiPage />}
                {activeDisplay === "analysis" && <Analysis />}
            </div>
        </div>
    );
};

export default DisplayToggle;
