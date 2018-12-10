'use strict';

class AbccTools {

    constructor() {

        this.state = true;
        this.wss = null;
        this.cookies = [];
        this.api = 'https://abcc.com';
    }

    onReady () {
        let $self = this;

        $self.loadCookie().then(function (res) {
            $self.cookies = res;
        }).then(function () {
            if ($self.isLogin()) {
                $self.initWss()
            }
        })

    };

    MessageList (title, desc) {
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

            $self.wss = {
                client: new WebSocket("wss://push.abcc.com/app/2d1974bfdde17e8ecd3e7f0f6e39816b?protocol=7&client=js&version=4.2.2&flash=false"),
                id: "",
                key: ""
            };

            $self.wss.client.onopen = function() {
                $self.wss.client.send('{"event":"pusher:subscribe","data":{"channel":"market-global"}}');
            };

            $self.wss.client.onmessage = function(event) {

                var data = JSON.parse(event.data);

                switch (data.event) {
                    case "tickers":
                        break;
                    case "order":
                        var res = JSON.parse(data.data);

                        $self.MessageList("Order: #" + res.id + " - ", `
                        ` + res.ord_type + ` order on pair ` + res.market + `, has ` + res.state + ``
                        );
                        break;
                    case "pusher_internal:subscription_succeeded":
                        var res = JSON.parse(data.data);
                        if (res.channel == "private-PEARDN5RHHCTIO") {
                            resolve(true)
                        }
                        break;
                    case "pusher:connection_established":
                        var res = JSON.parse(data.data),
                            form = [],
                            xhr = new XMLHttpRequest();

                        // @todo check soket init id
                        $self.wss.id = res.socket_id;

                        form.push("socket_id=" + $self.wss.id);
                        form.push("channel_name=private-PEARDN5RHHCTIO");
                        var line = encodeURI(form.join("&"));

                        xhr.open('POST','https://abcc.com/pusher/auth', false);
                        xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
                        xhr.onreadystatechange = function() {
                            if (this.readyState == 4 && this.status == 200) {
                                var res = JSON.parse(xhr.responseText);
                                if (res.auth) {
                                    $self.wss.key = res.auth;
                                    $self.wss.client.send('{"event":"pusher:subscribe","data":{"auth":"{key}","channel":"private-PEARDN5RHHCTIO"}}'.replace('{key}', $self.wss.key));
                                } else {
                                }
                            } else {

                            }
                        };
                        xhr.onprogress = function () {
                            if (xhr.status != 200) {
                                reject()
                            }
                        };

                        xhr.onload = function () {
                            if (xhr.status != 200) {
                                reject()
                            }
                        };

                        xhr.send(line);

                        break;
                }
            };
        });
    };

    /**
     * Check user login
     * @return {boolean}
     */
    isLogin () {
        var $self = this;

        for (var i in $self.cookies) {
            if ($self.cookies[i].name == "_abcc_session") {
                return true;
            }
        }
        return false;
    };

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
    }

}

var proto = new AbccTools();

window.onload = function () {
    proto.onReady();
};