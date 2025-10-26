import React, { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { useStore } from '@/hooks/useStore';
import { LabelPairedFileArrowDownCaptionRegularIcon } from '@deriv/quill-icons/LabelPaired';
import { LabelPairedMoonCaptionRegularIcon } from '@deriv/quill-icons/LabelPaired';
import { LabelPairedExclamationCaptionRegularIcon } from '@deriv/quill-icons/LabelPaired';
import { Localize } from '@deriv-com/translations';

import './freebots.scss';

// Import the XML files directly
import x1 from './bot-files/AUTO wealth mine AI PREMIUM.xml';
import x2 from './bot-files/Emiisdtrader super bot S10.xml';
import x3 from './bot-files/Emiisdtrader expert 🚀📊.xml';
import x4 from './bot-files/Emiisdtrader 1$ System 💰.xml';
import x5 from './bot-files/Emiisdtrader Fusion-X 2025.xml';
import x6 from './bot-files/Emiisdtrader Rise & Fall Auto Switch 🔄📈📉.xml';
import x7 from './bot-files/Emiisdtrader Even_Odd Auto Switch 2025🔄.xml';
import x8 from './bot-files/Emiisdtrader Fusion Analyzer🔍🔍📊📊.xml';
import x9 from './bot-files/Emiisdtrader Encroach Trader 💵.xml';
import x10 from './bot-files/New DollarPrinterBot  2025 Version 💰💰💰.xml';
import x11 from './bot-files/Alpha Version 2025.xml';
import x12 from './bot-files/Emiisdtrader Version Of Candle Mine🎯🎯.xml';

const FreeBots = observer(() => {
    const { load_modal, dashboard, blockly_store } = useStore();
    const { handleFileChange } = load_modal;
    const [loadingBotId, setLoadingBotId] = useState<number | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);

    // Map filenames to their XML content
    const botXmlMap: Record<string, string> = {
        'AUTO wealth mine AI PREMIUM.xml': x1,
        'Emiisdtrader super bot S10.xml': x2,
        'Emiisdtrader expert 🚀📊.xml': x3,
        'Emiisdtrader 1$ System 💰.xml': x4,
        'Emiisdtrader Fusion-X 2025.xml': x5,
        'Emiisdtrader Rise & Fall Auto Switch 🔄📈📉.xml': x6,
        'Emiisdtrader Even_Odd Auto Switch 2025🔄.xml': x7,
        'Emiisdtrader Fusion Analyzer🔍🔍📊📊.xml': x8,
        'Emiisdtrader Encroach Trader 💵.xml': x9,
        'New DollarPrinterBot  2025 Version 💰💰💰.xml': x10,
        'Alpha Version 2025.xml': x11,
        'Emiisdtrader Version Of Candle Mine🎯🎯.xml': x12,
    };

    const bots = [
        {
            name: 'AUTO wealth mine AI PREMIUM',
            description: 'Advanced AI-powered wealth generation system with premium features',
            file: 'AUTO wealth mine AI PREMIUM.xml',
            icon: '🤖',
            gradient: 'linear-gradient(135deg, #FF6B6B, #4ECDC4)',
        },
        {
            name: 'Alpha Version 2025',
            description: 'Cutting-edge trading algorithm with next-gen technology',
            file: 'Alpha Version 2025.xml',
            icon: '🚀',
            gradient: 'linear-gradient(135deg, #667eea, #764ba2)',
        },
        {
            name: 'Emiisdtrader super bot S10',
            description: 'High-performance trading bot with S10 optimization',
            file: 'Emiisdtrader super bot S10.xml',
            icon: '⚡',
            gradient: 'linear-gradient(135deg, #f093fb, #f5576c)',
        },
        {
            name: 'New DollarPrinterBot 2025',
            description: 'Advanced currency trading system with profit optimization',
            file: 'New DollarPrinterBot  2025 Version 💰💰💰.xml',
            icon: '💰',
            gradient: 'linear-gradient(135deg, #4facfe, #00f2fe)',
        },
        {
            name: 'Emiisdtrader expert',
            description: 'Professional trading analysis with expert insights',
            file: 'Emiisdtrader expert 🚀📊.xml',
            icon: '📊',
            gradient: 'linear-gradient(135deg, #43e97b, #38f9d7)',
        },
        {
            name: 'Emiisdtrader 1$ System',
            description: 'Micro-investment system for consistent returns',
            file: 'Emiisdtrader 1$ System 💰.xml',
            icon: '💵',
            gradient: 'linear-gradient(135deg, #fa709a, #fee140)',
        },
        {
            name: 'Emiisdtrader Fusion-X 2025',
            description: 'Hybrid trading system combining multiple strategies',
            file: 'Emiisdtrader Fusion-X 2025.xml',
            icon: '🔮',
            gradient: 'linear-gradient(135deg, #a8edea, #fed6e3)',
        },
        {
            name: 'Rise & Fall Auto Switch',
            description: 'Automatic market trend detection and switching',
            file: 'Emiisdtrader Rise & Fall Auto Switch 🔄📈📉.xml',
            icon: '🔄',
            gradient: 'linear-gradient(135deg, #cd9cf2, #f6f3ff)',
        },
        {
            name: 'Even_Odd Auto Switch 2025',
            description: 'Advanced binary options trading automation',
            file: 'Emiisdtrader Even_Odd Auto Switch 2025🔄.xml',
            icon: '🎯',
            gradient: 'linear-gradient(135deg, #74ebd5, #9face6)',
        },
        {
            name: 'Fusion Analyzer',
            description: 'Comprehensive market analysis and prediction system',
            file: 'Emiisdtrader Fusion Analyzer🔍🔍📊📊.xml',
            icon: '🔍',
            gradient: 'linear-gradient(135deg, #d299c2, #fef9d7)',
        },
        {
            name: 'Encroach Trader',
            description: 'Stealth trading system for optimal entry points',
            file: 'Emiisdtrader Encroach Trader 💵.xml',
            icon: '🕵️',
            gradient: 'linear-gradient(135deg, #89f7fe, #66a6ff)',
        },
        {
            name: 'Candle Mine',
            description: 'Advanced candlestick pattern recognition system',
            file: 'Emiisdtrader Version Of Candle Mine🎯🎯.xml',
            icon: '🎯',
            gradient: 'linear-gradient(135deg, #fdbb2d, #22c1c3)',
        },
    ];

    const handleBotSelect = (filename: string, botIndex: number) => {
        setLoadError(null);
        setLoadingBotId(botIndex);
        dashboard.setActiveTab(1);

        const xmlContent = botXmlMap[filename];

        if (!xmlContent) {
            console.error(`XML content not found for ${filename}`);
            setLoadError(`Could not load bot: XML file "${filename}" not found`);
            setLoadingBotId(null);
            return;
        }

        const loadBot = () => {
            let attempts = 0;
            const maxAttempts = 50;

            const tryLoadBot = () => {
                if (!window.Blockly?.derivWorkspace) {
                    attempts++;
                    if (attempts > maxAttempts) {
                        setLoadError('Blockly workspace not available after multiple attempts');
                        setLoadingBotId(null);
                        return;
                    }
                    setTimeout(tryLoadBot, 100);
                    return;
                }

                try {
                    if (!xmlContent.includes('<xml') || !xmlContent.includes('</xml>')) {
                        throw new Error('Invalid XML format');
                    }

                    window.Blockly.derivWorkspace.asyncClear();
                    const xml = window.Blockly.utils.xml.textToDom(xmlContent);
                    window.Blockly.Xml.domToWorkspace(xml, window.Blockly.derivWorkspace);
                    window.Blockly.derivWorkspace.strategy_to_load = xmlContent;
                    window.Blockly.derivWorkspace.cleanUp();

                    console.log(`Successfully loaded bot: ${filename}`);
                    setLoadingBotId(null);
                } catch (error) {
                    console.error('Error loading bot:', error);
                    setLoadError(`Failed to load bot: ${error instanceof Error ? error.message : 'Unknown error'}`);
                    setLoadingBotId(null);
                }
            };

            tryLoadBot();
        };

        loadBot();
    };

    useEffect(() => {
        const cards = document.querySelectorAll('.free-bots__card');
        cards.forEach((card, index) => {
            setTimeout(() => {
                (card as HTMLElement).style.opacity = '1';
                (card as HTMLElement).style.transform = 'translateY(0) scale(1)';
            }, 150 * index);
        });
    }, []);

    return (
        <div className='free-bots'>
            {/* Animated Background Elements */}
            <div className='free-bots__background'>
                <div className='grid-background'>
                    <div className='grid-lines'></div>
                    <div className='grid-overlay'></div>
                </div>
                <div className='particle-effects'>
                    {[...Array(20)].map((_, i) => (
                        <div key={i} className='particle' style={{
                            left: `${Math.random() * 100}%`,
                            top: `${Math.random() * 100}%`,
                            animationDelay: `${Math.random() * 5}s`
                        }}></div>
                    ))}
                </div>
                <div className='connection-nodes'>
                    {[...Array(6)].map((_, i) => (
                        <div key={i} className='node' style={{
                            animationDelay: `${i * 0.8}s`
                        }}>
                            <div className='node-pulse'></div>
                        </div>
                    ))}
                </div>
            </div>

            <div className='free-bots__header'>
                <div className='header-glow'></div>
                <LabelPairedMoonCaptionRegularIcon 
                    height='48px' 
                    width='48px' 
                    fill='var(--button-primary-default)'
                    className='header-icon'
                />
                <h1>
                    <span className='title-glow'>Free Automated Bots</span>
                </h1>
                <p>Select any of our premium automated trading bots</p>
                <div className='header-particles'>
                    {[...Array(8)].map((_, i) => (
                        <div key={i} className='particle' style={{
                            animationDelay: `${i * 0.3}s`
                        }}></div>
                    ))}
                </div>
            </div>

            {loadError && (
                <div className='free-bots__error-message'>
                    <div className='error-glow'></div>
                    <LabelPairedExclamationCaptionRegularIcon 
                        height='24px' 
                        width='24px' 
                        fill='var(--status-danger)'
                    />
                    <span>{loadError}</span>
                </div>
            )}

            <div className='free-bots__scroll-container'>
                <div className='bot-list-container'>
                    <div className='free-bots__grid'>
                        {bots.map((bot, index) => (
                            <div
                                key={index}
                                className='free-bots__card'
                                style={{
                                    opacity: 0,
                                    transform: 'translateY(30px) scale(0.9)',
                                    transition: `all 0.6s ease-out ${index * 0.1}s`,
                                    '--card-gradient': bot.gradient,
                                } as React.CSSProperties}
                            >
                                <div className='card-glow'></div>
                                <div className='card-shine'></div>
                                
                                <div className='free-bots__card-icon' style={{ background: bot.gradient }}>
                                    {bot.icon}
                                </div>
                                
                                <div className='free-bots__card-content'>
                                    <div className='content-glow'></div>
                                    <h3>{bot.name}</h3>
                                    <p>{bot.description}</p>
                                    
                                    <button
                                        className={`free-bots__download-btn ${loadingBotId === index ? 'loading' : ''}`}
                                        onClick={() => handleBotSelect(bot.file, index)}
                                        disabled={loadingBotId !== null}
                                    >
                                        <div className='button-glow'></div>
                                        {loadingBotId === index ? (
                                            <div className='loading-spinner'>
                                                <div className='spinner-circle'></div>
                                                <span>Loading Bot...</span>
                                            </div>
                                        ) : (
                                            <>
                                                <LabelPairedFileArrowDownCaptionRegularIcon
                                                    height='18px'
                                                    width='18px'
                                                />
                                                <span>Load Bot</span>
                                                <div className='button-pulse'></div>
                                            </>
                                        )}
                                    </button>
                                </div>

                                <div className='bot-trail'></div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className='free-bots__footer'>
                <div className='scan-line'></div>
                <p>Powered by Advanced AI Trading Technology</p>
            </div>
        </div>
    );
});

export default FreeBots;
