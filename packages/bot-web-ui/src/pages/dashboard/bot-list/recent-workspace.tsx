import React from 'react';
import { observer } from '@deriv/stores';
import { useDBotStore } from 'Stores/useDBotStore';
import { TRecentStrategy } from './types';
import './recent-workspace.scss';
import { loadStrategy } from '../../../../../bot-skeleton/src/utils/local-storage';

const BOT_EMOJIS = ['🤖', '👾', '🦾', '🧠', '⚡', '💻', '🔮', '🎮'];
const BOT_DESCRIPTIONS = [
    "This bot uses moving averages to identify trends. It enters trades when short-term averages cross above long-term ones.",
    "A volatility-based bot that expands position size during high volatility. It uses Bollinger Bands to determine entry points.",
    "This mean-reversion bot trades when prices deviate from historical averages. It works best in ranging markets.",
    "A breakout strategy that enters trades when price moves beyond support/resistance. Uses volume confirmation.",
    "This bot implements a simple scalping strategy. It aims for small profits with tight stop losses.",
    "A momentum-based bot that follows strong trending moves. Uses RSI to avoid overbought conditions.",
    "This grid bot places orders at fixed intervals above and below price. It profits from market oscillations.",
    "A news-based bot that reacts to economic events. Uses sentiment analysis to determine trade direction."
];

const RecentWorkspace = observer(({ workspace, index }: { workspace: TRecentStrategy, index: number }) => {
    const { dashboard } = useDBotStore();
    const strategyIdRef = React.useRef(workspace.id);
    const strategyNameRef = React.useRef(workspace.name || 'Untitled Bot');
    const perfPercent = React.useMemo(() => {
        const base = String(strategyIdRef.current || strategyNameRef.current);
        let h = 0;
        for (let i = 0; i < base.length; i++) h = (h * 31 + base.charCodeAt(i)) >>> 0;
        return 55 + (h % 45);
    }, []);

    const handleClick = async () => {
        console.log(`[CLICK] Loading bot: ${strategyIdRef.current}, Name: ${strategyNameRef.current}`);
        try {
            // Ensure Bot Builder tab is active so Blockly can mount and initialize the workspace
            dashboard.setActiveTab(1);

            // Wait for Blockly workspace to be ready (poll up to ~5s)
            const waitForWorkspace = () =>
                new Promise<boolean>(resolve => {
                    const start = Date.now();
                    const interval = setInterval(() => {
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        const Blockly: any = (window as unknown as { Blockly?: unknown }).Blockly;
                        const ready = !!(Blockly && (Blockly as any).derivWorkspace);
                        if (ready) {
                            clearInterval(interval);
                            resolve(true);
                        } else if (Date.now() - start > 5000) {
                            clearInterval(interval);
                            resolve(false);
                        }
                    }, 100);
                });

            const workspace_ready = await waitForWorkspace();
            if (!workspace_ready) {
                console.error('[ERROR] Blockly workspace not initialized in time');
                return;
            }

            const success = await loadStrategy(strategyIdRef.current);
            if (success) {
                console.log(`[SUCCESS] Bot loaded successfully: ${strategyNameRef.current}`);
            } else {
                console.error(`[ERROR] Failed to load bot: ${strategyNameRef.current}`);
            }
        } catch (error) {
            console.error(`[ERROR] Exception while loading bot: ${strategyNameRef.current}`, error);
        }
    };

    const randomEmoji = BOT_EMOJIS[index % BOT_EMOJIS.length];
    const botDescription = BOT_DESCRIPTIONS[index % BOT_DESCRIPTIONS.length];

    return (
        <div className="dbot-workspace-card" onClick={handleClick} data-bot-id={workspace.id}>
            {/* Background elements */}
            <div className="dbot-workspace-card__particles">
                {Array.from({ length: 12 }).map((_, i) => (
                    <span key={i}></span>
                ))}
            </div>
            <div className="dbot-workspace-card__border-glow"></div>

            {/* Content */}
            <div className="dbot-workspace-card__emoji">{randomEmoji}</div>
            <div className="dbot-workspace-card__content">
                <div className="dbot-workspace-card__header">
                    <div className="dbot-workspace-card__name">
                        {strategyNameRef.current}
                    </div>
                    <button className="dbot-workspace-card__action">
                        <span>Load</span>
                        <div className="dbot-workspace-card__arrow">→</div>
                    </button>
                </div>
                <div className="dbot-workspace-card__description">
                    {botDescription}
                </div>
                <div className="dbot-workspace-card__metrics">
                    <div className="dbot-workspace-card__meter">
                        <div
                            className="dbot-workspace-card__meter-fill"
                            style={{ width: `${perfPercent}%` }}
                        />
                        <div className="dbot-workspace-card__meter-shine" />
                    </div>
                    <div className="dbot-workspace-card__percent">{perfPercent}%</div>
                </div>
                <div className="dbot-workspace-card__preview" aria-hidden>
                    <div className="dbot-workspace-card__preview-line"></div>
                    <div className="dbot-workspace-card__preview-line"></div>
                    <div className="dbot-workspace-card__preview-line"></div>
                    <div className="dbot-workspace-card__preview-line"></div>
                    <div className="dbot-workspace-card__preview-line"></div>
                </div>
            </div>
            <div className="dbot-workspace-card__shine"></div>
        </div>
    );
});

export default RecentWorkspace;