/**
 * Ajax module abstract.
 *
 * This is a special definition class that the Winter framework will use to interpret the current module as an
 * "ajax" module to handle all AJAX requests.
 *
 * This can also be used as the default AJAX handler which will run using the `fetch()` method that is default in
 * modern browsers.
 *
 * @copyright 2021 Winter.
 * @author Ben Thomson <git@alfreido.com>
 */
class Request extends Winter.Module {
    /**
     * Constructor.
     *
     * @param {Winter} winter
     * @param {HTMLElement} element
     * @param {string} handler
     * @param {Object} options
     * @returns
     */
    constructor(winter, element, handler, options) {
        super(winter);

        this.element = element;
        this.handler = handler;
        this.options = options || {};

        this.checkRequest();
        if (!this.winter.globalEvent('ajaxSetup', this)) {
            return;
        }

        if (!this.doClientValidation()) {
            return;
        }

        if (this.confirm) {
            this.doConfirm().then((confirmed) => {
                if (confirmed) {
                    this.doAjax().then(
                        (response) => {
                            this.processUpdate(response).then(
                                () => {
                                    if (response.X_WINTER_SUCCESS === false) {
                                        this.processError(response);
                                    } else {
                                        this.processResponse(response);
                                    }
                                }
                            );
                        },
                        (error) => {
                            this.processError(error);
                        }
                    );
                }
            });
        } else {
            this.doAjax().then(
                (response) => {
                    this.processUpdate(response).then(
                        () => {
                            if (response.X_WINTER_SUCCESS === false) {
                                this.processError(response);
                            } else {
                                this.processResponse(response);
                            }
                        }
                    );
                },
                (error) => {
                    this.processError(error);
                }
            );
        }
    }

    /**
     * Dependencies for this module.
     *
     * @returns {string[]}
     */
    dependencies() {
        return ['jsonParser', 'sanitizer'];
    }

    /**
     * Validates the element and handler given in the request.
     */
    checkRequest() {
        if (this.element !== undefined && this.element instanceof Element === false) {
            throw new Error('The element provided must be an Element instance');
        }

        if (this.handler === undefined) {
            throw new Error('The AJAX handler name is not specified.')
        }

        if (!this.handler.match(/^(?:\w+\:{2})?on*/)) {
            throw new Error('Invalid AJAX handler name. The correct handler name format is: "onEvent".')
        }
    }

    /**
     * Run client-side validation on the form, if available.
     *
     * @returns {boolean}
     */
    doClientValidation() {
        if (this.options.browserValidate === true && this.form) {
            if (this.form.checkValidity() === false) {
                this.form.reportValidity();
                return false;
            }
        }

        return true;
    }

    /**
     * Executes the AJAX query.
     *
     * Returns a Promise object for when the AJAX request is completed.
     *
     * @returns {Promise}
     */
    doAjax() {
        return new Promise((resolve, reject) => {
            fetch(
                this.url, {
                    method: 'POST',
                    headers: this.headers,
                    body: this.data,
                    redirect: 'follow',
                    mode: 'same-origin',
                }
            ).then(
                (response) => {
                    if (!response.ok && response.status !== 406) {
                        if (response.headers.has('Content-Type') && response.headers.get('Content-Type').includes('/json')) {
                            response.json().then(
                                (responseData) => {
                                    reject(this.renderError(
                                        responseData.message,
                                        responseData.exception,
                                        responseData.file,
                                        responseData.line,
                                        responseData.trace
                                    ));
                                },
                                (error) => {
                                    reject(this.renderError(`Unable to parse JSON response: ${error}`));
                                }
                            );
                        } else {
                            response.text().then(
                                (responseText) => {
                                    reject(this.renderError(responseText));
                                },
                                (error) => {
                                    reject(this.renderError(`Unable to process response: ${error}`));
                                }
                            );
                        }
                    } else {
                        if (response.headers.has('Content-Type') && response.headers.get('Content-Type').includes('/json')) {
                            response.json().then(
                                (responseData) => {
                                    resolve(Object.assign({}, responseData, {
                                        X_WINTER_SUCCESS: response.status !== 406,
                                        X_WINTER_RESPONSE_CODE: response.status,
                                    }));
                                },
                                (error) => {
                                    reject(this.renderError(`Unable to parse JSON response: ${error}`));
                                }
                            );
                        } else {
                            response.text().then(
                                (responseData) => {
                                    resolve(responseData);
                                },
                                (error) => {
                                    reject(this.renderError(`Unable to process response: ${error}`));
                                }
                            );
                        }
                    }
                },
                (responseError) => {
                    reject(this.renderError(`Unable to retrieve a response from the server: ${responseError}`));
                }
            );
        });
    }

    /**
     * Prepares for updating the partials from the AJAX response.
     *
     * If any partials are returned from the AJAX response, this method will also action the partial updates.
     *
     * Returns a Promise object which tracks when the partial update is complete.
     *
     * @param {Object} response
     * @returns {Promise}
     */
    processUpdate(response) {
        return new Promise((resolve, reject) => {
            if (typeof this.options.beforeUpdate === 'function') {
                if (this.options.beforeUpdate.apply(this, [response]) === false) {
                    reject();
                    return;
                }
            }

            // Extract partial information
            const partials = {};
            for (const [key, value] of Object.entries(response)) {
                if (key.substr(0, 8) !== 'X_WINTER') {
                    partials[key] = value;
                }
            }

            if (Object.keys(partials).length === 0) {
                resolve();
                return;
            }

            const promises = this.winter.globalPromiseEvent('ajaxBeforeUpdate', this, response);
            promises.then(
                () => {
                    this.doUpdate(partials).then(
                        () => {
                            // Allow for HTML redraw
                            window.requestAnimationFrame(() => resolve());
                        },
                        () => {
                            reject();
                        }
                    );
                },
                () => {
                    reject();
                }
            );
        });
    }

    /**
     * Updates the partials with the given content.
     *
     * @param {Object} partials
     * @returns {Promise}
     */
    doUpdate(partials) {
        return new Promise((resolve) => {
            for (const [partial, content] of Object.entries(partials)) {
                let selector = this.options.update[partial]
                    ? this.options.update[partial]
                    : partial;

                let mode = 'replace';

                if (selector.substr(0, 1) === '@') {
                    mode = 'append';
                    selector = selector.substr(1);
                } else if (selector.substr(0, 1) === '^') {
                    mode = 'prepend';
                    selector = selector.substr(1);
                }

                const elements = document.querySelectorAll(selector);
                if (elements.length > 0) {
                    elements.forEach((element) => {
                        switch (mode) {
                            case 'replace':
                                element.innerHTML = this.winter.sanitizer().sanitize(content);
                                break;
                            case 'append':
                                element.innerHTML += this.winter.sanitizer().sanitize(content);
                                break;
                            case 'prepend':
                                element.innerHTML = this.winter.sanitizer().sanitize(content) + element.innerHTML;
                                break;
                        }
                    });
                }

                resolve();
            }
        });
    }

    /**
     * Processes the response data.
     *
     * This fires off all necessary processing functions depending on the response, ie. if there's any flash
     * messages to handle, or any redirects to be undertaken.
     *
     * @param {Object} response
     * @returns {void}
     */
    processResponse(response) {
        // Check for a redirect from the response, or use the redirect as specified in the options. This takes
        // precedent over all other checks.
        if (response.X_WINTER_REDIRECT || this.redirect) {
            this.processRedirect(response.X_WINTER_REDIRECT || this.redirect);
            return;
        }

        if (this.flash && response.X_WINTER_FLASH_MESSAGES) {
            this.processFlashMessages(response.X_WINTER_FLASH_MESSAGES);
        }

        if (response.X_WINTER_ASSETS) {
            this.processAssets(response.X_WINTER_ASSETS)
        }
    }

    /**
     * Processes an error response from the AJAX request.
     *
     * This fires off all necessary processing functions depending on the error response, ie. if there's any error or
     * validation messages to handle.
     *
     * @param {Object|Error} error
     */
    processError(error) {
        if (error instanceof Error) {
            this.processErrorMessage(error.message);
        } else {
            // Process validation errors
            if (error.X_WINTER_ERROR_FIELDS) {
                this.processValidationErrors(error.X_WINTER_ERROR_FIELDS);
            }

            if (error.X_WINTER_ERROR_MESSAGE) {
                this.processErrorMessage(error.X_WINTER_ERROR_MESSAGE);
            }
        }
    }

    /**
     * Processes a redirect response.
     *
     * By default, this processor will simply redirect the user in their browser.
     *
     * Modules can augment this functionality from the `ajaxRedirect` event. You may also override this functionality on
     * a per-request basis through the `handleRedirectResponse` callback option. If a `false` is returned from either, the
     * redirect will be cancelled.
     *
     * @param {string} url
     * @returns {void}
     */
    processRedirect(url) {
        // Run a custom per-request redirect handler. If false is returned, don't run the redirect.
        if (typeof this.options.handleRedirectResponse === 'function') {
            if (this.options.handleRedirectResponse.apply(this, [url]) === false) {
                return;
            }
        }

        // Allow modules to cancel the redirect
        if (this.winter.globalEvent('ajaxRedirect', url) === false) {
            return;
        }

        // Indicate that the AJAX request is finished if we're still on the current page
        // so that the loading indicator for redirects that just change the hash value of
        // the URL instead of leaving the page will properly stop.
        // @see https://github.com/octobercms/october/issues/2780
        window.addEventListener('popstate', () => {
            if (this.element) {
                const event = document.createEvent('CustomEvent');
                event.eventName = 'ajaxRedirected';
                this.element.dispatchEvent(event);
            }
        }, {
            once: true
        });

        window.location.assign(url)
    }

    /**
     * Processes an error message.
     *
     * By default, this processor will simply alert the user through a simple `alert()` call.
     *
     * Modules can augment this functionality from the `ajaxErrorMessage` event. You may also override this functionality
     * on a per-request basis through the `handleErrorMessage` callback option. If a `false` is returned from either, the
     * error message handling will be cancelled.
     *
     * @param {string} message
     * @returns {void}
     */
    processErrorMessage(message) {
        // Run a custom per-request handler for error messages. If false is returned, do not process the error messages
        // any further.
        if (typeof this.options.handleErrorMessage === 'function') {
            if (this.options.handleErrorMessage.apply(this, [message]) === false) {
                return;
            }
        }

        // Allow modules to cancel the error message being shown
        if (this.winter.globalEvent('ajaxErrorMessage', message) === false) {
            return;
        }

        // By default, show a browser error message
        alert(message);
    }

    /**
     * Processes flash messages from the response.
     *
     * By default, no flash message handling will occur.
     *
     * Modules can augment this functionality from the `ajaxFlashMessages` event. You may also override this functionality
     * on a per-request basis through the `handleFlashMessages` callback option. If a `false` is returned from either, the
     * flash message handling will be cancelled.
     *
     * @param {Object} messages
     * @returns
     */
    processFlashMessages(messages) {
        // Run a custom per-request flash handler. If false is returned, don't show the flash message
        if (typeof this.options.handleFlashMessages === 'function') {
            if (this.options.handleFlashMessages.apply(this, [messages]) === false) {
                return;
            }
        }

        // Allow modules to cancel the flash messages
        if (this.winter.globalEvent('ajaxFlashMessages', messages) === false) {
            return;
        }
    }

    /**
     * Processes validation errors for fields.
     *
     * By default, no validation error handling will occur.
     *
     * Modules can augment this functionality from the `ajaxValidationErrors` event. You may also override this functionality
     * on a per-request basis through the `handleValidationErrors` callback option. If a `false` is returned from either, the
     * validation error handling will be cancelled.
     *
     * @param {Object} fields
     * @returns
     */
    processValidationErrors(fields) {
        if (typeof this.options.handleValidationErrors === 'function') {
            if (this.options.handleValidationErrors.apply(this, [this.form, fields]) === false) {
                return;
            }
        }

        // Allow modules to cancel the validation errors being handled
        if (this.winter.globalEvent('ajaxValidationErrors', this.form, fields) === false) {
            return;
        }
    }

    /**
     * Confirms the request with the user before proceeding.
     *
     * This is an asynchronous method. By default, it will use the browser's `confirm()` method to query the user to
     * confirm the action. This method will return a Promise with a boolean value depending on whether the user confirmed
     * or not.
     *
     * Modules can augment this functionality from the `ajaxConfirmMessage` event. You may also override this functionality
     * on a per-request basis through the `handleConfirmMessage` callback option. If a `false` is returned from either,
     * the confirmation is assumed to have been denied.
     *
     * @returns {Promise}
     */
    async doConfirm() {
        // Allow for a custom handler for the confirmation, per request.
        if (typeof this.options.handleConfirmMessage === 'function') {
            if (this.options.handleConfirmMessage.apply(this, [this.confirm]) === false) {
                return false;
            }

            return true;
        }

        // If no modules have customised the confirmation, use a simple browser confirmation.
        if (this.winter.listensToEvent('ajaxConfirmMessage').length === 0) {
            return confirm(this.confirm);
        }

        // Run custom module confirmations
        const promises = this.winter.globalPromiseEvent('ajaxConfirmMessage', this, this.confirm);

        try {
            const fulfilled = await promises;
            if (fulfilled) {
                return true;
            }
        } catch (e) {}

        return false;
    }

    get form() {
        if (this.options.form) {
            return this.options.form;
        }
        if (!this.element) {
            return null;
        }

        return this.element.closest('form');
    }

    get context() {
        return {
            handler: this.handler,
            options: this.options,
        };
    }

    get headers() {
        const headers = {
            'X-Requested-With': 'XMLHttpRequest', // Keeps compatibility with jQuery AJAX
            'X-WINTER-REQUEST-HANDLER': this.handler,
            'X-WINTER-REQUEST-PARTIALS': this.extractPartials(this.options.update || []),
        };

        if (this.flash) {
            headers['X-WINTER-REQUEST-FLASH'] = 1;
        }

        if (this.xsrfToken) {
            headers['X-XSRF-TOKEN'] = this.xsrfToken;
        }

        return headers;
    }

    get loading() {
        return this.options.loading || false;
    }

    get url() {
        return this.options.url || window.location.href;
    }

    get redirect() {
        return (this.options.redirect && this.options.redirect.length) ? this.options.redirect : null;
    }

    get flash() {
        return this.options.flash || false;
    }

    get files() {
        if (this.options.files === true) {
            if (typeof FormData === undefined) {
                console.warn('This browser does not support file uploads');
                return false;
            }

            return true;
        }

        return false;
    }

    get xsrfToken() {
        let cookieValue = null;

        if (document.cookie && document.cookie !== '') {
            const cookies = document.cookie.split(';');

            for (let i = 0; i < cookies.length; i++) {
                let cookie = cookies[i].trim();

                if (cookie.substring(0, 11) == ('XSRF-TOKEN' + '=')) {
                    cookieValue = decodeURIComponent(cookie.substring(11));
                    break;
                }
            }
        }

        return cookieValue;
    }

    get data() {
        const data = (typeof this.options.data === 'object') ? this.options.data : {};
        console.log(data);

        const formData = new FormData();
        if (Object.keys(data).length > 0) {
            for (const [key, value] of Object.entries(data)) {
                formData.append(key, value);
            }
        }

        return formData;
    }

    get confirm() {
        return this.options.confirm || false;
    }

    /**
     * Extracts partials.
     *
     * @param {Object} update
     * @returns {string}
     */
    extractPartials(update) {
        return Object.keys(update).join('&');
    }

    /**
     * Renders an error with useful debug information.
     *
     * This method is used internally when the AJAX request could not be completed or processed correctly due to an error.
     *
     * @param {string} message
     * @param {string} exception
     * @param {string} file
     * @param {Number} line
     * @param {string[]} trace
     * @returns {Error}
     */
    renderError(message, exception, file, line, trace) {
        const error = new Error(message);
        error.exception = exception || null;
        error.file = file || null;
        error.line = line || null;
        error.trace = trace || [];
        return error;
    }
}

winter.addModule('request', Request);
