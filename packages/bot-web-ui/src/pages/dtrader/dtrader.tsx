import React from 'react';
import { observer } from 'mobx-react-lite';
import IframeWrapper from '@/components/iframe-wrapper';

const Dtrader = observer(() => {
    return (
        <IframeWrapper
            src='https://derivmaster.pages.dev/?chart_type=area&interval=1t&symbol=1HZ100V&trade_type=accumulator'
            title='DTrader'
            className='dtrader-container'
        />
    );
});

export default Dtrader;
