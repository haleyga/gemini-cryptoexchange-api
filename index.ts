import * as axiosDefault from 'axios';
import { AxiosRequestConfig, AxiosResponse } from 'axios';
import * as crypto from 'crypto';
import * as qs from 'qs';

/**
 * Just an alias.
 */
const axios = axiosDefault.default;

/**
 * Default configuration.
 */
const defaultConfig = {
    rootUrl: `https://api.gemini.com`,
    timeout: 10000,
    version: 'v1',
};

/**
 * Default HTTP agent configuration.
 */
const defaultAgentConfig = {
    baseURL: defaultConfig.rootUrl,
    headers: {
        'Cache-Control' : 'no-cache',
        'Content-Length': 0,
        'Content-Type'  : 'text/plain',
        'User-Agent'    : `Gemini API Client (gemini-cryptoexchange-api node package)`,
    },
    method : 'GET',
    timeout: defaultConfig.timeout,
};

/**
 * The public agent is essentially an alias for the default configuration.
 *
 * @type {{}}
 */
const publicAgentConfig = {
    ...defaultAgentConfig,
};

/**
 * The private agent begins life the same as the public agent, but with 'POST' specified.
 *
 * @type {{method: string}}
 */
const privateAgentConfig = {
    ...defaultAgentConfig,
    method: 'POST',
};

/**
 * The post body shape.
 */
export interface IPostBody {
    [key: string]: string | number;
}

/**
 * This function is exported so that a user can experiment with/understand how Gemini wants requests to be signed.
 * Essentially, for user edification ;).
 *
 * @param {string} path
 * @param {{}} postData
 * @param {string} secret
 * @returns {ISignature}
 */
export const signMessage = (path: string, postData: {}, secret: string): ISignature => {
    const nonce = Date.now().toString();

    const body    = { ...postData, nonce, request: path };
    const payload = new Buffer(JSON.stringify(body)).toString('base64');
    const digest  = crypto.createHmac('sha384', secret)
                          .update(payload)
                          .digest('hex');

    return { payload, digest };
};

/**
 * Shape of the signature object.
 */
export type ISignature = { digest: string; payload: string; };

/**
 * Convenient container for API keys.
 */
export type IApiAuth = { publicKey: string; privateKey: string; };

/**
 * The shape of a Gemini client.
 */
export interface IRawAgent {
    auth?: IApiAuth;

    isUpgraded(): boolean;

    getPublicEndpoint(endpoint: string,
                      queryParams?: {},
                      configOverride?: IGeminiRequestConfig): Promise<IGeminiResponse>;

    postToPrivateEndpoint(endpoint: string,
                          data?: IPostBody,
                          configOverride?: IGeminiRequestConfig): Promise<IGeminiResponse>;

    signMessage(privateKey: string, path: string, method: string, body?: {}): ISignature;

    upgrade(newAuth: IApiAuth): void;
}

/**
 * Factory function to get a new Gemini client.
 *
 * @param {IApiAuth} auth
 * @returns {IRawAgent}
 */
export const getRawAgent = (auth?: IApiAuth): IRawAgent => ({

    /**
     * This holds the user's API keys.
     */
    auth,

    /**
     * Fetches data from public (unauthenticated) endpoints.
     *
     * @param {string} endpoint
     * @param {{}} queryParams
     * @param configOverride
     * @returns {Promise<IGeminiResponse>}
     */
    async getPublicEndpoint(endpoint: string,
                            queryParams?: {},
                            configOverride?: IGeminiRequestConfig): Promise<IGeminiResponse> {

        // Construct local config object
        const config = { ...defaultConfig, ...configOverride };

        // The uri is a relative path to the publicAgentConfig#baseUrl
        const uri = `${config.version}/${endpoint}?${qs.stringify(queryParams)}`;

        // Construct the actual config to be used
        const agentConfig = { ...publicAgentConfig, url: uri, ...config };

        // Send the request.
        const response = await axios(agentConfig);

        // Finally, return the response
        return Promise.resolve(response);
    },

    /**
     * Checks if the user has supplied API keys.
     *
     * @returns {boolean}
     */
    isUpgraded(): boolean { return this.auth; },

    /**
     * Posts to private (authenticated) endpoints.  If no API keys have been provided, this function will fail.
     *
     * @param {string} endpoint
     * @param {IPostBody} data
     * @param configOverride
     * @returns {Promise<IGeminiResponse>}
     */
    async postToPrivateEndpoint(endpoint: string,
                                data?: IPostBody,
                                configOverride?: IGeminiRequestConfig): Promise<IGeminiResponse> {

        // Ensure the user has credentials
        if (!this.isUpgraded()) return Promise.reject(`api keys are required to access private endpoints`);

        // Construct local config object
        const config = { ...defaultConfig, ...configOverride };

        // The uri is a relative path to the privateAgentConfig,baseUrl
        const uri = `/${config.version}/${endpoint}`;

        const signatureData = signMessage(uri, data, this.auth.privateKey);

        // Add the appropriate POST request headers (Key and Sign)
        const headers = {
            ...privateAgentConfig.headers,
            'X-GEMINI-APIKEY'   : this.auth.publicKey,
            'X-GEMINI-PAYLOAD'  : signatureData.payload,
            'X-GEMINI-SIGNATURE': signatureData.digest,
            ...config.headers,
        };

        // Construct the actual config to be used
        const agentConfig = { ...privateAgentConfig, headers, url: uri, data: JSON.stringify(data), ...config };

        try {
            const response = await axios(agentConfig);

            // Finally, send the request and return the response
            return Promise.resolve(response);
        } catch (err) {
            const rejectionReason = err.response.data.error || err.response.data || err.response || err;

            return Promise.reject(rejectionReason);
        }
    },

    /**
     * Include the exported #signMessage function for convenience.
     */
    signMessage,

    /**
     * Upgrades a client with new credentials.
     *
     * @param {IApiAuth} newAuth
     */
    upgrade(newAuth: IApiAuth): void { this.auth = newAuth; },
});

export type IOrderBookParams = { limit_bids?: number, limit_asks?: number };
export type ITradesHistoryParams = { timestamp?: string, limit_trades?: number, include_breaks?: boolean; };
export type IAuctionHistoryParams = { since?: string, limit_auction_results?: boolean, include_indicative?: boolean };

export type IPlaceOrderParams = {
    client_order_id?: string,
    symbol: string,
    amount: number,
    price: number,
    side: string,
    // This is not provided as an option since it is required with only a single valid option (type: "exchange limit")
    //type: string,
    options?: string[],
};

export type ICancelOrderParams = { order_id: string };
export type IOrderStatusParams = { order_id: string };
export type IGetPastOrdersParams = { symbol: string, limit_trades?: boolean; timestamp?: string };
export type IGenerateDepositAddressParams = { label: string };
export type IWithdrawCryptoParams = { address: string, amount: number };

export interface IGeminiClient {
    rawAgent: IRawAgent;

    isUpgraded(): boolean;

    upgrade(newAuth: IApiAuth): void;

    getSymbols(): Promise<IGeminiResponse>;

    getTicker(symbol: string): Promise<IGeminiResponse>;

    getOrderBook(symbol: string, params?: IOrderBookParams): Promise<IGeminiResponse>;

    getTradeHistory(symbol: string, params?: ITradesHistoryParams): Promise<IGeminiResponse>;

    getCurrentAuction(symbol: string): Promise<IGeminiResponse>;

    getAuctionHistory(symbol: string, params?: IAuctionHistoryParams): Promise<IGeminiResponse>;

    placeOrder(params: IPlaceOrderParams): Promise<IGeminiResponse>;

    cancelOrder(params: ICancelOrderParams): Promise<IGeminiResponse>;

    cancelAllSessionOrders(): Promise<IGeminiResponse>;

    cancelAllActiveOrders(): Promise<IGeminiResponse>;

    getOrderStatus(params: IOrderStatusParams): Promise<IGeminiResponse>;

    getActiveOrders(): Promise<IGeminiResponse>;

    getPastTrades(params: IGetPastOrdersParams): Promise<IGeminiResponse>;

    getTradeVolume(): Promise<IGeminiResponse>;

    getAvailableBalances(): Promise<IGeminiResponse>;

    generateDepositAddress(currency: string, params?: IGenerateDepositAddressParams): Promise<IGeminiResponse>;

    withdrawCrypto(currency: string, params: IWithdrawCryptoParams): Promise<IGeminiResponse>;

    pingHeartbeat(): Promise<IGeminiResponse>;
}

export const getClient = (auth?: IApiAuth, config: IGeminiRequestConfig = null): IGeminiClient => ({

    rawAgent: getRawAgent(auth),

    isUpgraded(): boolean { return this.rawAgent.isUpgraded(); },

    upgrade(newAuth: IApiAuth): void { this.rawAgent.upgrade(newAuth); },

    /**
     * This endpoint retrieves all available symbols for trading
     *
     * @returns {Promise<IGeminiResponse>}
     */
    async getSymbols(): Promise<IGeminiResponse> {
        return await this.rawAgent.getPublicEndpoint('symbols', null, config);
    },

    /**
     * This endpoint retrieves information about recent trading activity for the symbol.
     *
     * @param {string} symbol
     * @returns {Promise<IGeminiResponse>}
     */
    async getTicker(symbol: string): Promise<IGeminiResponse> {
        return await this.rawAgent.getPublicEndpoint(`pubticker/${symbol}`, null, config);
    },

    /**
     * This will return the current order book, as two arrays, one of bids, and one of asks
     *
     * @param {string} symbol
     * @param {IOrderBookParams} params
     * @returns {Promise<IGeminiResponse>}
     */
    async getOrderBook(symbol: string, params?: IOrderBookParams): Promise<IGeminiResponse> {
        return await this.rawAgent.getPublicEndpoint(`book/${symbol}`, params, config);
    },

    /**
     * This will return the trades that have executed since the specified timestamp. Timestamps are either seconds
     * or milliseconds since the epoch (1970-01-01). See the Data Types section about timestamp for information on this.
     *
     * Each request will show at most 500 records.
     *
     * If no since or timestamp is specified, then it will show the most recent trades; otherwise, it will show the
     * most recent trades that occurred after that timestamp.
     *
     * @param {string} symbol
     * @param {ITradesHistoryParams} params
     * @returns {Promise<IGeminiResponse>}
     */
    async getTradeHistory(symbol: string, params?: ITradesHistoryParams): Promise<IGeminiResponse> {
        return await this.rawAgent.getPublicEndpoint(`trades/${symbol}`, params, config);
    },

    /**
     * @param {string} symbol
     * @returns {Promise<IGeminiResponse>}
     */
    async getCurrentAuction(symbol: string): Promise<IGeminiResponse> {
        return await this.rawAgent.getPublicEndpoint(`auction/${symbol}`, null, config);
    },

    /**
     * This will return the auction events, optionally including publications of indicative prices, since the
     * specific timestamp.
     *
     * Timestamps are either seconds or milliseconds since the epoch (1970-01-01). See the Data Types section about
     * timestamp for information on this.
     *
     * Each request will show at most 500 records.
     *
     * If no since or timestamp is specified, then it will show the most recent events. Otherwise, it will show the
     * oldest auctions that occurred after that timestamp.
     *
     * @param {string} symbol
     * @param {IAuctionHistoryParams} params
     * @returns {Promise<IGeminiResponse>}
     */
    async getAuctionHistory(symbol: string, params?: IAuctionHistoryParams): Promise<IGeminiResponse> {
        return await this.rawAgent.getPublicEndpoint(`auction/${symbol}/history`, params, config);
    },

    /**
     * Only limit orders are supported through the API at present.
     *
     * If you wish orders to be automatically cancelled when your session ends, see the require heartbeat section, or
     * manually send the cancel all session orders message.
     *
     * @param {IPlaceOrderParams} params
     * @returns {Promise<IGeminiResponse>}
     */
    async placeOrder(params: IPlaceOrderParams): Promise<IGeminiResponse> {
        return await this.rawAgent.postToPrivateEndpoint(`order/new`, params, config);
    },

    /**
     * This will cancel an order. If the order is already canceled, the message will succeed but have no effect.
     *
     * @param {ICancelOrderParams} params
     * @returns {Promise<IGeminiResponse>}
     */
    async cancelOrder(params: ICancelOrderParams): Promise<IGeminiResponse> {
        return await this.rawAgent.postToPrivateEndpoint(`order/cancel`, params, config);
    },

    /**
     * This will cancel all orders opened by this session.
     *
     * This will have the same effect as heartbeat expiration if "Require Heartbeat" is selected for the session.
     *
     * @returns {Promise<IGeminiResponse>}
     */
    async cancelAllSessionOrders(): Promise<IGeminiResponse> {
        return await this.rawAgent.postToPrivateEndpoint(`order/cancel/session`, null, config);
    },

    /**
     * This will cancel all outstanding orders created by all sessions owned by this account, including interactive
     * orders placed through the UI.
     *
     * Note that this cancels orders that were not placed using this API key.
     *
     * Typically Cancel All Session Orders is preferable, so that only orders related to the current connected
     * session are cancelled.
     *
     * @returns {Promise<IGeminiResponse>}
     */
    async cancelAllActiveOrders(): Promise<IGeminiResponse> {
        return await this.rawAgent.postToPrivateEndpoint(`order/cancel/all`, null, config);
    },

    /**
     * Gets the status for an order.
     *
     * @returns {Promise<IGeminiResponse>}
     * @param params
     */
    async getOrderStatus(params: IOrderStatusParams): Promise<IGeminiResponse> {
        return await this.rawAgent.postToPrivateEndpoint(`order/status`, params, config);
    },

    /**
     * @returns {Promise<IGeminiResponse>}
     */
    async getActiveOrders(): Promise<IGeminiResponse> {
        return await this.rawAgent.postToPrivateEndpoint(`orders`, null, config);
    },

    /**
     * @param {IGetPastOrdersParams} params
     * @returns {Promise<IGeminiResponse>}
     */
    async getPastTrades(params: IGetPastOrdersParams): Promise<IGeminiResponse> {
        return await this.rawAgent.postToPrivateEndpoint(`mytrades`, params, config);
    },

    /**
     * @returns {Promise<IGeminiResponse>}
     */
    async getTradeVolume(): Promise<IGeminiResponse> {
        return await this.rawAgent.postToPrivateEndpoint(`tradevolume`, null, config);
    },

    /**
     * This will show the available balances in the supported currencies
     *
     * @returns {Promise<IGeminiResponse>}
     */
    async getAvailableBalances(): Promise<IGeminiResponse> {
        return await this.rawAgent.postToPrivateEndpoint(`balances`, null, config);
    },

    /**
     * This will create a new cryptocurrency deposit address with an optional label.
     *
     * @param {string} currency
     * @param {IGenerateDepositAddressParams} params
     * @returns {Promise<IGeminiResponse>}
     */
    async generateDepositAddress(currency: string, params?: IGenerateDepositAddressParams): Promise<IGeminiResponse> {
        return await this.rawAgent.postToPrivateEndpoint(`deposit/${currency}/newAddress`, params, config);
    },

    /**
     * Before you can withdraw cryptocurrency funds to a whitelisted address, you need three things:
     *  - cryptocurrency address whitelists needs to be enabled for your account
     *  - the address you want to withdraw funds to needs to already be on that whitelist
     *  - an API key with the Fund Manager role added
     *
     * @param {string} currency
     * @param {IWithdrawCryptoParams} params
     * @returns {Promise<IGeminiResponse>}
     */
    async withdrawCrypto(currency: string, params: IWithdrawCryptoParams): Promise<IGeminiResponse> {
        return await this.rawAgent.postToPrivateEndpoint(`withdraw/${currency}`, params, config);
    },

    /**
     * This will prevent a session from timing out and canceling orders if the require heartbeat flag has been set.
     * Note that this is only required if no other private API requests have been made. The arrival of any message
     * resets the heartbeat timer.
     *
     * @returns {Promise<IGeminiResponse>}
     */
    async pingHeartbeat(): Promise<IGeminiResponse> {
        return await this.rawAgent.postToPrivateEndpoint(`heartbeat`, null, config);
    },
});

/**
 * Alias for Axios request options.
 */
export interface IGeminiRequestConfig extends AxiosRequestConfig {}

/**
 * Alias for Axios response.
 */
export interface IGeminiResponse extends AxiosResponse {}
