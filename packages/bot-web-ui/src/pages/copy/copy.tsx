import React, { useEffect, useRef, useState } from 'react';

const AiPage: React.FC = () => {
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const [iframeHeight, setIframeHeight] = useState('600px'); // Default height

    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            if (event.data?.iframeHeight) {
                setIframeHeight(`${event.data.iframeHeight}px`);
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, []);

    return (
        <div style={{ width: '100%' }}>
            <iframe
                ref={iframeRef}
                src="/sbs/copytrading.html"
                title="Copytrade"
                style={{
                    width: '100%',
                    height: iframeHeight,
                    border: 'none',
                }}
            />
        </div>
    );
};

export default AiPage;
