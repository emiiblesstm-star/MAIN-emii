import React, { useState } from "react";
import TradingHubDisplay from "./trading-hub-display";
import AdvancedDisplay from "@/components/trading-hub/advanced-display.tsx";
import "./display-toggle.scss";

const Analysiss: React.FC = () => {
    return (
        <div className="iframe-container">
            <iframe
                src="https://api.binarytool.site/"
                title="Analysis"
                className="content-iframe"
            />
        </div>
    );
};
const Analysis: React.FC = () => {
    return (
        <div className="iframe-container">
            <iframe
                src="/sbs/analysis.html"
                title="AI Signal"
                className="content-iframe"
            />
        </div>
    );
};
const Expert: React.FC = () => {
    return (
        <div className="iframe-container">
            <iframe
                src="https://bot-analysis-tool-belex.web.app/"
                title="Expert AnalysisTool"
                className="content-iframe"
            />
        </div>
    );
};
const DisplayToggle: React.FC = () => {
    const [activeDisplay, setActiveDisplay] = useState<"analysiss" | "advanced" | " analysis" >("analysiss");

    return (
        <div className="display-container">
            {/* Toggle buttons */}
            <div className="display-toggle">
                <button
                    className={`display-toggle__button ${activeDisplay === "analysiss" ? "active-analysiss" : ""}`}
                    onClick={() => setActiveDisplay("analysiss")}
                >
                    🔮 Market Analyzer
                </button>
                <button
                    className={`display-toggle__button ${activeDisplay === "expert" ? "active-expert" : ""}`}
                    onClick={() => setActiveDisplay("expert")}
                >
                    ⚡ Expert Tool
                </button>
                <button
                    className={`display-toggle__button ${activeDisplay === "advanced" ? "active-advanced" : ""}`}
                    onClick={() => setActiveDisplay("advanced")}
                >
                    🚀 Advanced Analyzer 
                </button>
                <button
                    className={`display-toggle__button ${activeDisplay === "analysis" ? "active-analysis" : ""}`}
                    onClick={() => setActiveDisplay("analysis")}
                >
                    📈 Pro Tool
                </button>
            </div>

            {/* Content area - fixed height container */}
            <div className="display-content">
                {activeDisplay === "analysiss" && <Analysiss />}
                {activeDisplay === "expert" && <Expert />}
                {activeDisplay === "advanced" && <AdvancedDisplay />}
                {activeDisplay === "analysis" && <Analysis />}
            </div>
        </div>
    );
};

export default DisplayToggle;
