import React, { useState } from "react";
import ProTool from "@/pages/pro-tool/pro-tool.tsx";
import ProTrader from "@/pages/pro-tool/pro-trader.tsx";
import "./display-toggle.scss";

const DisplayToggle: React.FC = () => {
    const [activeDisplay, setActiveDisplay] = useState<"protool" | "advanced" | "aIEnhancedTradeUi">("protool");

    return (
        <div className="display-container">
            {/* Toggle buttons */}
            <div className="display-toggle">
                <button
                    className={`display-toggle__button ${activeDisplay === "protool" ? "active-protool" : ""}`}
                    onClick={() => setActiveDisplay("protool")}
                >
                    ⚡ 🤖 Digits & up/down
                </button>
                <button
                    className={`display-toggle__button ${activeDisplay === "advanced" ? "active-advanced" : ""}`}
                    onClick={() => setActiveDisplay("advanced")}
                >
                    🚀 Advanced Dtrader
                </button>
            </div>

            {/* Content area - fixed height container */}
            <div className="display-content">
                {activeDisplay === "protool" && <ProTool />}
                {activeDisplay === "advanced" && <ProTrader />}
            </div>
        </div>
    );
};

export default DisplayToggle;
