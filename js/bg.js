'use strict';

const EXT_NAME = "ABCC:";
const MSG_INIT = "init core";
const MSG_NOT_LOGIN = "user not login, waiting...";

class AbccTools {

    constructor() {

        this.account = false;
        this.state = true;
        this.cookies = [];
        this.api_uri = 'https://abcc.com';

        this.wss = false;
        this.wss_uri = 'wss://push.abcc.com/app/2d1974bfdde17e8ecd3e7f0f6e39816b?protocol=7&client=js&version=4.2.2&flash=false';
        this.wss_id = '';
        this.wss_key = '';
        this.wss_channel_private = 'private-PEARDN5RHHCTIO';
        this.wss_channel_market = 'market-global';
        this.ticker = [];
        this.volume = [];
    }

    init () {
        let $self = this;

        console.info(EXT_NAME, MSG_INIT);

        $self.loadCookie().then(function (res) {
            $self.cookies = res;
        }).then(function () {
            return new Promise(function (resolve, reject) {
                $self.isLogin().then(function (user) {
                    if (user) {
                        $self.account = user;
                    } else {
                        console.warn(EXT_NAME, MSG_NOT_LOGIN);
                        $self.account = false;
                    }
                })
            });
        });

        if (!$self.wss && $self.account) {
            $self.initWss().then(function () {
                $self.initEvents();
            })
        }
    };

    Message (title, desc) {
        chrome.notifications.create(window.performance.now().toString(), {
            type: "basic",
            title: title,
            message: desc,
            iconUrl: "/images/logo_32_32.png"
        });
    };

    initWss () {

        let $self = this;

        return new Promise(function (resolve, reject) {

            $self.wss = new WebSocket($self.wss_uri);

            // subscribe global ticker market
            $self.wss.onopen = function() {
                $self.wss.send('{"event":"pusher:subscribe","data":{"channel":"{channel}"}}'.replace("{channel}", $self.wss_channel_market));
            };

            $self.wss.onmessage = function(event) {

                let
                    data = JSON.parse(event.data),
                    body = JSON.parse(data.data);

                switch (data.event) {
                    case "tickers":
                        document.dispatchEvent(new CustomEvent('ticker', {
                            'detail': body
                        }));
                        break;
                    case "order":
                        document.dispatchEvent(new CustomEvent('order', {
                            'detail': body
                        }));
                        break;
                    case "pusher:connection_established":

                        let
                            form = [];

                        if (body.socket_id == undefined || body.socket_id == '') {
                            resolve(false)
                        }
                        $self.wss_id = body.socket_id;

                        form.push("socket_id=" + $self.wss_id);
                        form.push("channel_name=" + $self.wss_channel_private);

                        $.ajax({
                            url: $self.api_uri + "/pusher/auth",
                            type: "POST",
                            contentType: "application/x-www-form-urlencoded",
                            data: encodeURI(form.join("&")),
                            success: function(res){
                                if (res.auth) {
                                    $self.wss_key = res.auth;
                                    $self.wss.send('{"event":"pusher:subscribe","data":{"auth":"{key}","channel":"{channel}"}}'.replace('{key}', $self.wss_key).replace('{channel}', $self.wss_channel_private));
                                    resolve(true);
                                } else {
                                    resolve(false);
                                }
                            },
                            error: function () {
                                resolve(false);
                            }

                        });

                        break;
                }
            };
        });
    };

    initEvents() {

        let $self = this;

        // update ticker
        document.addEventListener('ticker', function (e) {
            chrome.runtime.sendMessage({action: "ticker", data: e.detail});
        }, false);

        // update hitory
        document.addEventListener('history', function (e) {
        }, false);

        // update order state
        document.addEventListener('order', function (e) {
            $self.orderNotify(e.detail);
        }, false);
    };

    /**
     * Start update volume value
     */
    initHistoryLoop() {
        let $self = this;

        setInterval(function () {
            $.ajax({
                url: $self.api_uri + "/graphql",
                type: "POST",
                contentType: "application/json",
                data: JSON.stringify({
                    "operationName":"getHistoryTrades",
                    "variables":{
                        "page":1,
                        "page_size":20,
                        "from":1545685200,
                        "to":1545771600
                    },
                    "query":"query getHistoryTrades($order_id: String, $from: String, $to: String, $market: String, $bu: String, $qu: String, $page: Int, $page_size: Int) { historyTrade(order_id: $order_id, from: $from, to: $to, market: $market, bu: $bu, qu: $qu, page: $page, page_size: $page_size) {trades meta  __typename}}"
                }),
                headers: {
                    "x-csrf-token": $self.getCsrf(),
                },
                success: function(res){
                    document.dispatchEvent(new CustomEvent('history', {
                        'detail': res
                    }));
                },
                error: function () {
                    reject("history error");
                }

            });
        }, 5000);
    };

    /**
     * Notify order state
     * @param order
     */
    orderNotify(order) {
        let $self = this;
        $self.Message("Order: #" + order.id, order.ord_type + ` order on pair ` + order.market + `, has ` + order.state);
    };


    /**
     * Check user login
     * @return {Promise}
     */
    isLogin () {

        let $self = this;

        return new Promise(function (resolve, reject) {

            let isUser = false;

            for (let i in $self.cookies) {
                if ($self.cookies[i].name == "_abcc_session") {
                    isUser = true;
                    break;
                }
            }

            if (isUser) {
                $self.ApiGetAccount().then(function (user) {
                    resolve(user);
                });
            } else {
                resolve(false);
            }
        });
    };

    /**
     * Get CSRF token value
     * @return {boolean}
     */
    getCsrf () {

        let $self = this;
        for (let i in $self.cookies) {
            if ($self.cookies[i].name == "csrfToken") {
                return $self.cookies[i].value;
            }
        }
        return false;
    };

    getVolume() {
        let res = [];
        for (let i in this.volume) {
            res.push({
                name: i,
                fee: this.volume[i].fee,
                volume: this.volume[i].volume,
            })
        }
        return res;
    }

    /**
     * Load cookies
     * @return {Promise}
     */
    loadCookie () {
        return new Promise(function(resolve, reject) {
            chrome.cookies.getAll({}, function (cookie) {
                resolve(cookie);
            });
        });
    };

    ping() {

        let $self = this;

        setInterval(function () {
            $self.init();
        }, 5000);
    };

    /**
     * Load account info
     * @return {Promise}
     * @constructor
     */
    ApiGetAccount () {

        let $self = this;
        let $query = {
            "operationName": "getAccounts",
            "variables":{},
            "query": "query getAccounts {optionBalance { currency  balance locked  deposit_address memo default_withdraw_fund_source_id minimum_withdraw_amount withdraw_fee require_memo readable_name withdraw_amount_h24 withdraw_amount_max_h24 min_confirmations max_confirmations can_deposit can_withdraw vote_currency withdraw_fixed fee __typename }}"
        };

        return new Promise(function (resolve, reject) {
            $.ajax({
                url: $self.api_uri + "/graphql",
                type: "POST",
                contentType: "application/json",
                data: JSON.stringify($query),
                headers: {
                    "x-csrf-token": $self.getCsrf(),
                },
                success: function(res){
                    if (res.data) {
                        resolve(res.data);
                    } else {
                        resolve(false);
                    }
                },
                error: function () {
                    resolve(false);
                }

            });
        });
    }

}

window.onload = function () {
    window._AbccTools = new AbccTools();
    window._AbccTools.init();
    window._AbccTools.ping();
};