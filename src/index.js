'use strict';
import wd from 'wd';
import fs from 'fs/promises';

import {
    LT_AUTH_ERROR,
    PROCESS_ENVIRONMENT,
    AUTOMATION_DASHBOARD_URL,
    AUTOMATION_HUB_URL,
    MOBILE_AUTOMATION_HUB_URL,
    _connect,
    _destroy,
    _getBrowserList,
    _parseCapabilities,
    _saveFile,
    _updateJobStatus,
    showTrace,
    LT_TUNNEL_NUMBER,
} from './util';

const WEB_DRIVER_PING_INTERVAL = 30 * 1000;

wd.configureHttp({
    timeout: 15 * 60 * 1000,

    retries: -1,
});

export default {
    // Multiple browsers support

    isMultiBrowser: true,

    browserNames: [],
    openedBrowsers: {},

    /**
     * Asynchronously starts a browser session using WebDriver and initializes the browser with the given capabilities and URL.
     * 
     * This function connects to a WebDriver hub (depending on whether the target device is a real mobile or not) and starts a browser session.
     * It also sets up a periodic ping to keep the WebDriver session alive and navigates to the specified URL. 
     * In case of any errors, the browser session is disposed and the error is thrown.
     * 
     * @async
     * @function _startBrowser
     * 
     * @param {string} id - The unique identifier for the browser session.
     * @param {string} url - The URL to navigate the browser to after initialization.
     * @param {Object} capabilities - The desired capabilities for the browser session, which may include browser type, device type, platform, etc.
     * @param {boolean} capabilities.isRealMobile - Flag indicating if the session is on a real mobile device.
     * 
     * @throws {Error} Throws an error if browser initialization or navigation fails.
     * 
     * @returns {Promise<void>} Returns a promise that resolves when the browser session has started successfully.
    */
    async _startBrowser (id, url, capabilities) {
        showTrace('StartBrowser Initiated for ', id);
        console.log('capabilities', capabilities);
        let webDriver = await wd.promiseChainRemote(
            `https://${PROCESS_ENVIRONMENT.LT_USERNAME}:${PROCESS_ENVIRONMENT.LT_ACCESS_KEY}@${AUTOMATION_HUB_URL}:443/wd/hub`,
            443,
        );

        if (capabilities.isRealMobile) {
            webDriver = await wd.promiseChainRemote(
                `https://${PROCESS_ENVIRONMENT.LT_USERNAME}:${PROCESS_ENVIRONMENT.LT_ACCESS_KEY}@${MOBILE_AUTOMATION_HUB_URL}:443/wd/hub`,
                443,
            );
        }

        const pingWebDriver = () => ping(webDriver);

        showTrace('webDriver ', webDriver);
        showTrace('pingWebDriver', pingWebDriver);

        webDriver.once('status', () => {
            webDriver.pingIntervalId = setInterval(
                pingWebDriver,
                WEB_DRIVER_PING_INTERVAL,
            );
            showTrace('pingIntervalId', webDriver.pingIntervalId);
        });
        this.openedBrowsers[id] = webDriver;
        showTrace(capabilities);
        try {
            await webDriver.init(capabilities).get(url);
        }
        catch (err) {
            // for (let tunnel = 0; tunnel < LT_TUNNEL_NUMBER; tunnel++) await _destroy(tunnel);
            this.dispose();

            showTrace('Error while starting browser for ', id);
            showTrace(err);
            throw err;
        }
    },

    /**
     * Asynchronously takes a screenshot of the current browser session and saves it to the specified path.
     * 
     * This function captures a screenshot from the browser session associated with the given ID, retrieves the image data as a base64 string, 
     * and then saves the screenshot to the specified file path.
     * 
     * @async
     * @function _takeScreenshot
     * 
     * @param {string} id - The unique identifier for the browser session from which the screenshot will be taken.
     * @param {string} screenshotPath - The file path where the screenshot will be saved.
     * 
     * @throws {Error} Throws an error if the screenshot could not be taken or the file could not be saved.
     * 
     * @returns {Promise<void>} Returns a promise that resolves when the screenshot has been successfully saved.
    */
    async _takeScreenshot (id, screenshotPath) {
        const base64Data = await this.openedBrowsers[id].takeScreenshot();

        await _saveFile(screenshotPath, base64Data);
    },


    /**
     * Asynchronously opens a browser session and navigates to the specified URL.
     * 
     * This function performs the following steps:
     * 1. Verifies the presence of necessary environment variables for authentication.
     * 2. Establishes connections via tunnels.
     * 3. Parses the capabilities required for the browser session based on the browser name.
     * 4. Starts the browser session and navigates to the given URL.
     * 5. Logs the session URL to a file if logging is enabled.
     * 6. Sets user-agent metadata for tracking purposes.
     * 
     * @async
     * @function openBrowser
     * 
     * @param {string} id - The unique identifier for the browser session.
     * @param {string} pageUrl - The URL to navigate the browser to after initialization.
     * @param {string} browserName - The name of the browser to be used in the session (e.g., Chrome, Firefox).
     * 
     * @throws {Error} Throws an error if required authentication credentials are missing, 
     *                 capabilities parsing fails, or the browser cannot be started.
     * 
     * @returns {Promise<void>} Returns a promise that resolves when the browser session has been successfully started and navigated to the URL.
    */
    async openBrowser (id, pageUrl, browserName) {
        if (
            !PROCESS_ENVIRONMENT.LT_USERNAME ||
            !PROCESS_ENVIRONMENT.LT_ACCESS_KEY
        )
            throw new Error(LT_AUTH_ERROR);

        for (let tunnel = 0; tunnel < LT_TUNNEL_NUMBER; tunnel++)
            await _connect(tunnel);

        const capabilities = await _parseCapabilities(id, browserName);

        if (capabilities instanceof Error) {
            showTrace('openBrowser error on  _parseCapabilities', capabilities);
            this.dispose();
            throw capabilities;
        }
        await this._startBrowser(id, pageUrl, capabilities);
        const sessionUrl = ` ${AUTOMATION_DASHBOARD_URL}/logs/?sessionID=${this.openedBrowsers[id].sessionID} `;

        if (PROCESS_ENVIRONMENT.LOG_LT_SESSION_URL) {
            const filePath =
                PROCESS_ENVIRONMENT.LT_SESSION_LOG_PATH || 'sessionUrls.txt';

            await this.writeSessionUrlToFile(sessionUrl, filePath);
        }

        showTrace('sessionURL', sessionUrl);

        this.setUserAgentMetaInfo(id, sessionUrl);
    },

    /**
     * Asynchronously closes the browser session for the given ID.
     * 
     * This function performs the following steps:
     * 1. Checks if there is an active browser session associated with the provided ID.
     * 2. Clears the periodic ping interval used to keep the WebDriver session alive.
     * 3. Attempts to quit the browser session if a valid session ID is found.
     * 4. Logs errors if the session cannot be closed or if no session is found.
     * 
     * @async
     * @function closeBrowser
     * 
     * @param {string} id - The unique identifier for the browser session to be closed.
     * 
     * @throws {Error} Logs and catches any errors that occur during the browser closure process.
     * 
     * @returns {Promise<void>} Returns a promise that resolves once the browser session is successfully closed or if no session is found.
    */
    async closeBrowser (id) {
        showTrace('closeBrowser Initiated for ', id);
        if (this.openedBrowsers[id]) {
            showTrace(this.openedBrowsers[id].sessionID);
            clearInterval(this.openedBrowsers[id].pingIntervalId);
            if (this.openedBrowsers[id].sessionID) {
                try {
                    await this.openedBrowsers[id].quit();
                }
                catch (err) {
                    showTrace(err);
                }
            }
            else {
                showTrace('SessionID not found for ', id);
                showTrace(this.openedBrowsers[id]);
            }
        }
        else showTrace('Browser not found in OPEN STATE for ', id);
    },

    /**
     * Asynchronously initializes the browser names by retrieving the list of available browsers.
     * 
     * This function calls the internal `_getBrowserList` method to populate the `browserNames` property 
     * with the names of the browsers that can be used in the session.
     * 
     * @async
     * @function init
     * 
     * @returns {Promise<void>} Returns a promise that resolves when the browser names have been successfully retrieved and initialized.
     * 
     * @throws {Error} Throws an error if the browser list cannot be retrieved.
    */
    async init () {
        this.browserNames = await _getBrowserList();
    },

    /**
     * Asynchronously disposes of all active resources, including tunnels.
     * 
     * This function iterates through all active tunnels and attempts to destroy them, handling any errors that occur during the process. 
     * It logs the start and completion of the disposal process as well as any errors encountered while destroying the tunnels.
     * 
     * @async
     * @function dispose
     * 
     * @throws {Error} Catches and logs any errors that occur during the tunnel destruction process.
     * 
     * @returns {Promise<void>} Returns a promise that resolves once all tunnels have been successfully destroyed.
     */
    async dispose () {
        showTrace('Dispose Initiated ...');
        try {
            for (let tunnel = 0; tunnel < LT_TUNNEL_NUMBER; tunnel++)
                await _destroy(tunnel);
        }
        catch (err) {
            showTrace('Error while destroying ...');
            showTrace(err);
        }
        showTrace('Dispose Completed');
    },

    /**
     * Asynchronously retrieves the list of available browser names.
     * 
     * This function returns the list of browser names that are currently available for use.
     * 
     * @async
     * @function getBrowserList
     * 
     * @returns {Promise<string[]>} A promise that resolves to an array of browser names.
    */
    async getBrowserList () {
        return this.browserNames;
    },

    /**
     * Asynchronously checks if the current browser name is valid.
     * 
     * This function always returns true, indicating that the browser name is considered valid.
     * 
     * @async
     * @function isValidBrowserName
     * 
     * @returns {Promise<boolean>} A promise that resolves to `true`, signifying that the browser name is valid.
    */
    async isValidBrowserName () {
        return true;
    },

    /**
     * Asynchronously resizes the browser window for the specified session.
     * 
     * This function retrieves the current window handle for the browser session associated with the given ID
     * and resizes the window to the specified width and height.
     * 
     * @async
     * @function resizeWindow
     * 
     * @param {string} id - The unique identifier for the browser session whose window is to be resized.
     * @param {number} width - The new width of the browser window in pixels.
     * @param {number} height - The new height of the browser window in pixels.
     * 
     * @returns {Promise<void>} Returns a promise that resolves when the window has been successfully resized.
     * 
     * @throws {Error} Throws an error if the window cannot be resized, such as if the session ID is invalid or the resize operation fails.
     */
    async resizeWindow (id, width, height) {
        const _windowHandle = await this.openedBrowsers[id].windowHandles();

        await this.openedBrowsers[id].windowSize(_windowHandle, width, height);
    },

    /**
     * Asynchronously maximizes the browser window for the specified session.
     * 
     * This function retrieves the current window handle for the browser session associated with the given ID
     * and maximizes the window to take up the full screen.
     * 
     * @async
     * @function maximizeWindow
     * 
     * @param {string} id - The unique identifier for the browser session whose window is to be maximized.
     * 
     * @returns {Promise<void>} Returns a promise that resolves when the window has been successfully maximized.
     * 
     * @throws {Error} Throws an error if the window cannot be maximized, such as if the session ID is invalid or the maximize operation fails.
    */
    async maximizeWindow (id) {
        const _windowHandle = await this.openedBrowsers[id].windowHandles();

        await this.openedBrowsers[id].maximize(_windowHandle);
    },

    /**
     * Asynchronously takes a screenshot of the specified browser session and saves it to the given file path.
     * 
     * This function invokes the internal `_takeScreenshot` method, which handles the actual screenshot capturing
     * and file saving process.
     * 
     * @async
     * @function takeScreenshot
     * 
     * @param {string} id - The unique identifier for the browser session from which the screenshot will be taken.
     * @param {string} screenshotPath - The file path where the screenshot will be saved.
     * 
     * @returns {Promise<void>} Returns a promise that resolves when the screenshot has been successfully taken and saved.
     * 
     * @throws {Error} Throws an error if the screenshot cannot be taken or saved.
    */
    async takeScreenshot (id, screenshotPath) {
        await this._takeScreenshot(id, screenshotPath);
    },

    /**
     * Asynchronously reports the result of a job associated with a browser session.
     * 
     * This function checks if there is an active browser session for the given ID. 
     * If a valid session is found, it updates the job status using the provided job result and job data.
     * 
     * @async
     * @function reportJobResult
     * 
     * @param {string} id - The unique identifier for the browser session associated with the job.
     * @param {string} jobResult - The result of the job to be reported (e.g., "passed", "failed").
     * @param {Object} jobData - Additional data related to the job that may be useful for reporting.
     * 
     * @returns {Promise<null|Object>} Returns a promise that resolves to the result of the job status update or null if no valid session is found.
     * 
     * @throws {Error} Throws an error if the job status update fails.
    */
    async reportJobResult (id, jobResult, jobData) {
        if (this.openedBrowsers[id] && this.openedBrowsers[id].sessionID) {
            const sessionID = this.openedBrowsers[id].sessionID;

            return await _updateJobStatus(
                sessionID,
                jobResult,
                jobData,
                this.JOB_RESULT,
            );
        }
        return null;
    },

    /**
     * Asynchronously writes the session URL to a specified file.
     * 
     * This function appends the provided session URL to the specified file. Each URL is appended on a new line.
     * If an error occurs during the file writing process, it is logged to the console.
     * 
     * @async
     * @function writeSessionUrlToFile
     * 
     * @param {string} sessionUrl - The URL of the session to be written to the file.
     * @param {string} filePath - The path of the file where the session URL will be appended.
     * 
     * @throws {Error} Logs an error if the file writing fails.
     * 
     * @returns {Promise<void>} Returns a promise that resolves when the session URL has been successfully written to the file.
    */
    async writeSessionUrlToFile (sessionUrl, filePath) {
        const dataToAppend = `${sessionUrl}\n`;

        try {
            await fs.appendFile(filePath, dataToAppend);
        }
        catch (err) {
            console.error('Error writing session URLs to file:', err);
        }
    },
};

/**
 * Handles the result of a WebDriver ping, logging errors or ignoring responses as necessary.
 * 
 * This function is invoked after a ping operation to the WebDriver. It logs any errors that occur during the ping.
 * If no error occurs, the ping response is logged but ignored.
 * 
 * @function handlePingError
 * 
 * @param {Error|null} err - The error object if an error occurred during the ping, or null if there was no error.
 * @param {Object} [res] - The response object from the ping, if available.
 * 
 * @returns {void} This function does not return a value.
 */
function handlePingError (err, res) {
    if (err) {
        showTrace('ping error :');
        showTrace(err);
    }
    else {
        showTrace('ignore ping response :');
        showTrace(res);
    }
}

/**
 * Pings the given WebDriver session to ensure it remains active.
 * 
 * This function sends a ping command to the provided WebDriver instance by executing a safe operation.
 * If an error occurs during the ping, the `handlePingError` callback is invoked to handler the error.
 * 
 * @function ping
 * 
 * @param {Object} webDriver - The WebDriver instance to ping.
 * 
 * @returns {void} This function does not return a value.
 */
function ping (webDriver) {
    webDriver.safeExecute(1, handlePingError);
}
