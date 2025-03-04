import { delegate } from 'jquery-events-to-dom-events';

/**
 * Backend AJAX handler.
 *
 * This is a utility script that resolves some backwards-compatibility issues with the functionality
 * that relies on the old framework, and ensures that Snowboard works well within the Backend
 * environment.
 *
 * Functions:
 *  - Adds the "render" jQuery event to Snowboard requests that widgets use to initialise.
 *  - Hooks into the main jQuery AJAX workflow events of the original AJAX framework (`ajaxPromise` at the beginning
 *     of an AJAX request, `ajaxDone`/`ajaxRedirected`/`ajaxFail` at the end of the beginning of an AJAX requests)
 *     and simulates comparable Snowboard events to allow Snowboard functionality that acts on AJAX events to
 *     to function in the Backend (Flash messages, loader bar)
 *  - Ensures the CSRF token is included in requests.
 *
 * @copyright 2021 Winter.
 * @author Ben Thomson <git@alfreido.com>
 */
export default class Handler extends Snowboard.Singleton {
    construct() {
        this.requests = [];
    }

    /**
     * Event listeners.
     *
     * @returns {Object}
     */
    listens() {
        return {
            ready: 'ready',
            ajaxFetchOptions: 'ajaxFetchOptions',
            ajaxUpdateComplete: 'ajaxUpdateComplete',
        };
    }

    /**
     * Ready handler.
     *
     * Fires off a "render" event.
     */
    ready() {
        if (!window.jQuery) {
            return;
        }

        // Add global event for rendering in Snowboard
        delegate('render');
        document.addEventListener('$render', () => {
            this.snowboard.globalEvent('render');
        });

        // Add "render" event for backwards compatibility
        window.jQuery(document).trigger('render');

        // Add global events for AJAX queries and route them to the Snowboard global events and
        // necessary UI functionality
        delegate('ajaxPromise', ['event', 'context']);
        delegate('ajaxDone', ['event', 'context', 'data']);
        delegate('ajaxRedirected', ['event']);
        delegate('ajaxFail', ['event', 'context', 'textStatus']);

        document.addEventListener('$ajaxPromise', (event) => {
            this.requests[event.target] = Promise.withResolvers();
            this.snowboard.globalEvent('ajaxStart', this.requests[event.target].promise, {
                element: event.target,
                options: {},
            });
        });
        document.addEventListener('$ajaxDone', (event) => {
            this.requests[event.target].resolve(event.detail.data);
            this.snowboard.globalEvent('ajaxDone', event.detail.data, {
                element: event.target,
                options: {},
            });
        });
        document.addEventListener('$ajaxRedirected', (event) => {
            this.requests[event.target].resolve();
            this.snowboard.globalEvent('ajaxDone', event.detail.data, {
                element: event.target,
                options: {},
            });
        });
        document.addEventListener('$ajaxFail', (event) => {
            this.requests[event.target].reject(event.detail.textStatus);
            this.snowboard.globalEvent('ajaxDone', event.detail.data, {
                element: event.target,
                options: {},
            });
        });
    }

    /**
     * Adds the jQuery AJAX prefilter that the old framework uses to inject the CSRF token in AJAX
     * calls.
     */
    addPrefilter() {
        if (!window.jQuery) {
            return;
        }

        window.jQuery.ajaxPrefilter((options) => {
            if (this.hasToken()) {
                if (!options.headers) {
                    options.headers = {};
                }
                options.headers['X-CSRF-TOKEN'] = this.getToken();
            }
        });
    }

    /**
     * Fetch options handler.
     *
     * Ensures that the CSRF token is included in Snowboard requests.
     *
     * @param {Object} options
     */
    ajaxFetchOptions(options) {
        if (this.hasToken()) {
            options.headers['X-CSRF-TOKEN'] = this.getToken();
        }
    }

    /**
     * Update complete handler.
     *
     * Fires off a "render" event when partials are updated so that any widgets included in
     * responses are correctly initialised.
     */
    ajaxUpdateComplete() {
        if (!window.jQuery) {
            return;
        }

        // Add "render" event for backwards compatibility
        window.jQuery(document).trigger('render');
    }

    /**
     * Determines if a CSRF token is available.
     *
     * @returns {Boolean}
     */
    hasToken() {
        const tokenElement = document.querySelector('meta[name="csrf-token"]');

        if (!tokenElement) {
            return false;
        }
        if (!tokenElement.hasAttribute('content')) {
            return false;
        }

        return true;
    }

    /**
     * Gets the CSRF token.
     *
     * @returns {String}
     */
    getToken() {
        return document.querySelector('meta[name="csrf-token"]').getAttribute('content');
    }
}
