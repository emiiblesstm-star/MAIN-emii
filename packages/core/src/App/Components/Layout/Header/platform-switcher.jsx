import 'Sass/app/_common/components/platform-switcher.scss';

import { useDevice } from '@deriv-com/ui';
import { getPlatformInformation } from '@deriv/shared';
import { CSSTransition } from 'react-transition-group';
import { PlatformDropdown } from './platform-dropdown.jsx';
import { PlatformSwitcherLoader } from './Components/Preloader/platform-switcher.jsx';
import PropTypes from 'prop-types';
import React from 'react';
import classNames from 'classnames';
import { withRouter } from 'react-router-dom';
import derivBotImg from '../../../../public/images/icons/deriv_bot.png';
import derivTraderImg from '../../../../public/images/icons/deriv_trader.png';

const PlatformSwitcher = ({
    toggleDrawer,
    app_routing_history,
    platform_config = [],
    current_language,
    is_landing_company_loaded,
    is_logged_in,
    is_logging_in,
    setTogglePlatformType,
}) => {
    const [is_open, setIsOpen] = React.useState(false);

    const is_close_drawer_fired_ref = React.useRef(false);

    const { isDesktop } = useDevice();

    React.useEffect(() => {
        if (is_close_drawer_fired_ref.current) {
            if (typeof toggleDrawer === 'function') {
                toggleDrawer();
            }
        }
        is_close_drawer_fired_ref.current = false;
    });

    const closeDrawer = () => {
        setIsOpen(false);
        is_close_drawer_fired_ref.current = true;
    };

    return (is_logged_in || is_logging_in ? !is_landing_company_loaded : app_routing_history.length === 0) ? (
        <div
            data-testid='dt_platform_switcher_preloader'
            className={classNames('platform-switcher__preloader', {
                'platform-switcher__preloader--is-mobile': !isDesktop,
            })}
        >
            <PlatformSwitcherLoader is_mobile={!isDesktop} speed={3} />
        </div>
    ) : (
        <React.Fragment>
            <div
                data-testid='dt_platform_switcher'
                className={classNames(
                    'platform-switcher',
                    { 'platform-switcher--active': is_open },
                    { 'platform-switcher--is-mobile': !isDesktop }
                )}
                onClick={() => setIsOpen(!is_open)}
            >
                {(() => {
                    const platform_info = getPlatformInformation(app_routing_history);
                    const is_bot = platform_info.icon === 'IcRebrandingDerivBot';
                    const img_src = is_bot ? derivTraderImg : derivBotImg;
                    const alt_text = is_bot ? 'Deriv Trader' : 'Deriv Bot';
                    const icon_class = is_bot ? 'custom-trader-icon' : 'custom-bot-icon';
                    return (
                        <img
                            src={img_src}
                            alt={alt_text}
                            className={classNames('platform-switcher__icon', icon_class)}
                            draggable={false}
                        />
                    );
                })()}
            </div>
            <CSSTransition
                mountOnEnter
                appear
                in={is_open}
                classNames={{
                    enterDone: 'platform-dropdown--enter-done',
                }}
                timeout={isDesktop && is_open ? 0 : 250}
                unmountOnExit
            >
                <PlatformDropdown
                    platform_config={platform_config}
                    closeDrawer={closeDrawer}
                    current_language={current_language}
                    app_routing_history={app_routing_history}
                    setTogglePlatformType={setTogglePlatformType}
                />
            </CSSTransition>
        </React.Fragment>
    );
};

PlatformSwitcher.propTypes = {
    platform_config: PropTypes.array,
    toggleDrawer: PropTypes.func,
    current_language: PropTypes.string,
    app_routing_history: PropTypes.array,
    is_landing_company_loaded: PropTypes.bool,
    is_logged_in: PropTypes.bool,
    is_logging_in: PropTypes.bool,
    setTogglePlatformType: PropTypes.func,
};

export default withRouter(PlatformSwitcher);
