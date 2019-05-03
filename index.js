const dotenv = require('dotenv').config();
const express = require('express');
const app = express();
const crypto = require('crypto');
const cookie = require('cookie');
const nonce = require('nonce')();
const querystring = require('querystring');
const request = require('request-promise');
const requestCb = require('request');

const apiKey = process.env.SHOPIFY_API_KEY;
const apiSecret = process.env.SHOPIFY_API_SECRET;
const scopes = 'write_script_tags';
const forwardingAddress = "https://315cdb30.ngrok.io"; // Replace this with your HTTPS Forwarding address

app.use(express.static('public'));

app.get('/shopify', (req, res) => {
    const shop = req.query.shop;
    if (shop) {
        const state = nonce();
        const redirectUri = forwardingAddress + '/shopify/callback';
        const installUrl = 'https://' + shop +
        '/admin/oauth/authorize?client_id=' + apiKey +
        '&scope=' + scopes +
        '&state=' + state +
        '&redirect_uri=' + redirectUri;

        res.cookie('state', state);
        res.redirect(installUrl);
    } else {
        return res.status(400).send('Missing shop parameter. Please add ?shop=your-development-shop.myshopify.com to your request');
    }
});

app.get('/shopify/callback', (req, res) => {
    const { shop, hmac, code, state } = req.query;
    const stateCookie = cookie.parse(req.headers.cookie).state;
  
    if (state !== stateCookie) {
      return res.status(403).send('Request origin cannot be verified');
    }
  
    if (shop && hmac && code) {
        const map = Object.assign({}, req.query);
        delete map['signature'];
        delete map['hmac'];
        const message = querystring.stringify(map);
        const generatedHash = crypto
            .createHmac('sha256', apiSecret)
            .update(message)
            .digest('hex');

        if(generatedHash !== hmac){
            return res.status(400).send('HMAC validation failed');
        }
        
        const accessTokenRequestUrl = 'https://' + shop + '/admin/oauth/access_token';
        const accessTokenPayload = {
            client_id: apiKey,
            client_secret: apiSecret,
            code,
        };

        request.post(accessTokenRequestUrl, { json: accessTokenPayload })
        .then((accessTokenResponse) => {
            const accessToken = accessTokenResponse.access_token;
            console.log(accessToken);

            const scriptRequestUrl = 'https://' + shop + '/admin/api/2019-04/script_tags.json';
            const shopRequestHeaders = {
                'X-Shopify-Access-Token': accessToken,
            };

            var options2 = {
                uri: scriptRequestUrl + `?src=${forwardingAddress}`,
                headers: shopRequestHeaders,
                json: true // Automatically stringifies the body to JSON
            };

            request.get(options2)
                .then((shopResponse) => {
                    //res.end(shopResponse);
                    if(shopResponse.script_tags[0]){
                        const script_id = shopResponse.script_tags[0].id;
                        console.log(script_id);
                        res.status(200).send('Script exist - Right click already disabled');
                        return console.log("END");
                    }
                    //res.status(200).send(shopResponse);
                    console.log("no script found");

                    
                    res.render("landing.ejs",{accessToken:accessToken, scriptRequestUrl:scriptRequestUrl, shop});

                })
                .catch((error) => {
                    res.status(error.statusCode).send(error.error.error_description);
                    //console.log(error);
                });


        })
        .catch((error) => {
            res.status(error.statusCode).send(error.error.error_description);
        });

    } else {
      res.status(400).send('Required parameters missing');
    }
});

app.get("/myscript", (req, res) => {
    res.send(`
    const disable_right_click_text = ${req.query['disable_right_click_text']}
    const disable_cut_copy = ${req.query['disable_cut_copy']}
    document.addEventListener("contextmenu", function(event) {
        var notInput = (event.target || event.srcElement).tagName.toLowerCase() !== "input" && (event.target || event.srcElement).tagName.toLowerCase() !== "textarea";
        if (notInput) {
          event.preventDefault();
        }
      });
    `);
});

app.get("/settings", (req, res) => {
    console.log(req.headers.token);
    //console.log('disable_right_click_text: '+req.query['disable_right_click_text']);
    //console.log('disable_cut_copy: '+req.query['disable_cut_copy']);
    const disable_right_click_text = req.query['disable_right_click_text'];
    const disable_cut_copy = req.query['disable_cut_copy'];


    const accessToken = req.headers.token;
    const shop = req.headers.shop;
    //res.status(200).end();
    const scriptRequestUrl = 'https://' + shop + '/admin/api/2019-04/script_tags.json';
    const shopRequestHeaders = {
        'X-Shopify-Access-Token': accessToken,
    };

    const scriptTagBody = {
        "script_tag": {
            "event": "onload",
            "src": `${forwardingAddress}/myscript?disable_right_click_text=${disable_right_click_text}&disable_cut_copy=${disable_cut_copy}`
        }
    }

    var options = {
        method: 'POST',
        uri: scriptRequestUrl,
        body: scriptTagBody,
        headers: shopRequestHeaders,
        json: true
    };

    var options2 = {
        uri: scriptRequestUrl + `?src=${forwardingAddress}/myscript`,
        headers: shopRequestHeaders,
        json: true
    };

    request.get(options2)
        .then((shopResponse) => {
            //res.end(shopResponse);
            if(shopResponse.script_tags[0]){
                const script_id = shopResponse.script_tags[0].id;
                console.log(script_id);
                res.status(200).send('Script exist - Right click already disabled');
                return console.log("END");
            }
            //res.status(200).send(shopResponse);
            console.log("no script found");

            request.post(options)
                .then((shopResponse) => {
                    //res.end(shopResponse);
                    res.status(200).send(shopResponse);
                    //res.redirect("https://test-store-yk.myshopify.com/admin/apps/express-test-app-1");
                    console.log(shopResponse);
                })
                .catch((error) => {
                    //res.status(error.statusCode).send(error.error.error_description);
                    console.log(error);
                });
            //res.render("landing.ejs",{accessToken:accessToken, scriptRequestUrl:scriptRequestUrl});

        })
        .catch((error) => {
            //res.status(error.statusCode).send(error.error.error_description);
            console.log(error);
        });
    });

app.listen(3000, () => {
  console.log('Example app listening on port 3000!');
}); 