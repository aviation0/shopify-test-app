const dotenv = require('dotenv').config();
const express = require('express');
const app = express();
const crypto = require('crypto');
const cookie = require('cookie');
const nonce = require('nonce')();
const querystring = require('querystring');
const request = require('request-promise');

const apiKey = process.env.SHOPIFY_API_KEY;
const apiSecret = process.env.SHOPIFY_API_SECRET;
const scopes = 'write_script_tags';
const forwardingAddress = "https://d7ae15fb.ngrok.io"; // Replace this with your HTTPS Forwarding address

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

            const shopRequestUrl = 'https://' + shop + '/admin/api/2019-04/shop.json';
            const scriptRequestUrl = 'https://' + shop + '/admin/api/2019-04/script_tags.json';
            const shopRequestHeaders = {
                'X-Shopify-Access-Token': accessToken,
            };

            // request.get(shopRequestUrl, { headers: shopRequestHeaders })
            // .then((shopResponse) => {
            //     //res.end(shopResponse);
            //     res.send(shopResponse);
            // })
            // .catch((error) => {
            //     res.status(error.statusCode).send(error.error.error_description);
            // });
            res.render("landing.ejs",{accessToken:accessToken, scriptRequestUrl:scriptRequestUrl});

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
    document.addEventListener("contextmenu", function(event) {
        var notInput = (event.target || event.srcElement).tagName.toLowerCase() !== "input" && (event.target || event.srcElement).tagName.toLowerCase() !== "textarea";
        if (notInput) {
          event.preventDefault();
        }
      });
    `);
});

app.listen(3000, () => {
  console.log('Example app listening on port 3000!');
});