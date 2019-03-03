/** @license
 * Copyright (c) 2017 NightDev, LLC
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without limitation of the rights to use, copy, modify, merge,
 * and/or publish copies of the Software, and to permit persons to whom the
 * Software is furnished to do so, subject to the following conditions:
 * 
 * The above copyright notice, any copyright notices herein, and this permission
 * notice shall be included in all copies or substantial portions of the Software,
 * the Software, or portions of the Software, may not be sold for profit, and the
 * Software may not be distributed nor sub-licensed without explicit permission
 * from the copyright owner.
 * 
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * 
 * Should any questions arise concerning your usage of this Software, or to
 * request permission to distribute this Software, please contact the copyright
 * holder at https://nightdev.com/contact
 * 
 * ---------------------------------
 * 
 *   Unofficial TLDR:
 * 
 *   Free to modify for personal use
 *   Need permission to distribute the code
 *   Can't sell addon or features of the addon
 * 
 */

(() => {
    if (!String.prototype.includes || !Array.prototype.findIndex) return;
    if (window.location.pathname.endsWith('.html')) return;
    if (!['www.twitch.tv', 'canary.twitch.tv', 'clips.twitch.tv'].includes(window.location.hostname)) return;

    if (window.Ember) {
        const script = document.createElement('script');
        script.type = 'text/javascript';
        script.src = 'https://legacy.betterttv.net/betterttv.js';
        const head = document.getElementsByTagName('head')[0];
        if (!head) return;
        head.appendChild(script);
        return;
    }

    const IS_PROD = process.env.NODE_ENV !== 'development';

    try {
        if (IS_PROD && localStorage.getItem('bttv_developerMode') === 'true') {
            const script = document.createElement('script');
            script.type = 'text/javascript';
            script.src = `${process.env.DEV_CDN_ENDPOINT}betterttv.js`;
            const head = document.getElementsByTagName('head')[0];
            if (!head) return;
            head.appendChild(script);
            return;
        }
    } catch (_) {}

    const Raven = require('raven-js');

    /*

     TODO:

     - TwitchEmotes Sub Emote Tip
     - Disable Channel Header (Twitch did not implement this yet)

    */

    if (IS_PROD) {
        Raven.config(
            process.env.SENTRY_URL,
            {
                release: process.env.GIT_REV,
                environment: process.env.NODE_ENV,
                captureUnhandledRejections: false,
                ignoreErrors: [
                    'InvalidAccessError',
                    'out of memory',
                    'InvalidStateError',
                    'QuotaExceededError',
                    'NotFoundError',
                    'SecurityError',
                    'AbortError',
                    'TypeMismatchError',
                    'HierarchyRequestError',
                    'IndexSizeError',
                    /^undefined$/,
                ],
                whitelistUrls: [
                    /betterttv\.js/,
                    /\.betterttv\.net/
                ],
                shouldSendCallback: data => {
                    if (data.message && data.message.includes('raven-js/src/raven')) return false;
                    const exception = data.exception && data.exception.values[0];
                    if (exception && ['NS_ERROR_NOT_INITIALIZED', 'NS_ERROR_OUT_OF_MEMORY', 'NS_ERROR_FAILURE', 'NS_ERROR_FILE_CORRUPTED'].includes(exception.type)) return false;
                    if (data.exception && data.exception.values.length < 2) return false;
                    return true;
                }
            }
        ).install();
    }

    const debug = require('./utils/debug');

    require('./modules/**/index.js', {mode: (base, files) => {
        return files.map(module => {
            return `
                try {
                    require('${module}');
                } catch (e) {
                    Raven.captureException(e);
                    debug.error('Failed to ${module}', e.stack);
                }
            `;
        }).join(' ');
    }});

    debug.log(`BetterTTV v${debug.version} loaded. ${process.env.NODE_ENV} @ ${process.env.GIT_REV}`);

    window.BetterTTV = {
        version: debug.version,
        settings: require('./settings')
    };
})();
