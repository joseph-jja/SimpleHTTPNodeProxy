var express = require('express'),
    app = express(),
    https = require('https'),
    bodyParser = require('body-parser'),
    multer = require('multer'),
    fs = require('fs'),
    request = require('request'),
    keyOptions = {
        key: fs.readFileSync('temp/key.pem'),
        cert: fs.readFileSync('temp/cert.pem')
    },
    debugLog = false,
    proxyOriginHost = 'localhost.fds.com',
    proxyOriginPort = '9443',
    proxyOrigin = 'https://' + proxyOriginHost + ':' + proxyOriginPort;

// for heroku
process.env.PWD = process.cwd();

// rebuild the query parameters that come in from the query parameter object
function updateQueryPath(queryPathObjIn) {
    var i, result = "";

    for (i in queryPathObjIn) {
        if (result !== '') {
            result += "&";
        }
        result += i + "=" + queryPathObjIn[i];
    }
    return result;
}

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: true
}));
//app.use(multer);

app.use(function(req, res, next) {
    res.cookie('macys_online_uid', '2158330976');
    next();
});

function processRequest(req, res) {

    var options = {},
        headers = {},
        proxy = require("./proxy"),
        useRequest = true,
        querypath;

    path = req.path;
    if (debugLog) {
        console.log("Initial request path: " + path)
    };

    path += "?responsive=true";
    if (debugLog) {
        console.log("Pre-proxy request path: " + path)
    };

    querypath = "&" + updateQueryPath(req.query);
    path += querypath;
    if (debugLog) {
        console.log("Path and querypath: " + path);
    }

    if (!useRequest) {
        // options for the https proxy client
        options['hostname'] = proxyOriginHost;
        options['port'] = proxyOriginPort;
        options['path'] = path;
        options['rejectUnauthorized'] = false;
        options['requestCert'] = true;
    }

    options['method'] = req.route.stack[0].method;

    if (useRequest) {
        // to use request
        options['strictSSL'] = false;
        options['url'] = proxyOrigin + req.path;
        querypath = req.query;
        querypath['responsive'] = true;
        options['qs'] = querypath;
        console.log(req.body);
        if (req.body && options['method'] === 'post') {
            options['body'] = req.body;
            options['json'] = true;
        }
    }

    if (debugLog) {
        console.log("Options method: " + options['method']);
    }

    // http headers we are sending
    if (debugLog) {
        console.log("Initial Headers: " + JSON.stringify(req.headers));
    }
    headers = req.headers;
    headers['Accept-Encoding'] = req.headers['accept-encoding'];
    headers['Cookie'] = req.headers['cookie'];
    headers['User-Agent'] = req.headers['user-agent'];

    // put those headers in the options as headers
    options['headers'] = headers;

    console.log("request options: " + JSON.stringify(options));

    if (useRequest) {
        request(options, function(error, response, body) {
            if (error) {
                console.log(error);
            }
            res.set('Content-Type', 'text/plain');
            if (response.headers['content-type']) {
                res.set('Content-Type', response.headers['content-type']);
            }
            if (response.headers['set-cookie']) {
                res.set('Set-Cookie', response.headers['set-cookie']);
            }
            if (debugLog) {
                console.log("Header from ShopApp response: " + JSON.stringify(response.headers));
            }
            // session timed out what to do?
            if (response.headers['session_timed_out'] === 'TRUE') {
                res.redirect(301, proxyOrigin);
            }
            //console.log(response);
            res.send(body);
        });
    } else {
        proxy(options, function(data, headers) {
            res.set('Content-Type', 'text/plain');
            if (headers['content-type']) {
                res.set('Content-Type', headers['content-type']);
            }
            if (headers['set-cookie']) {
                res.set('Set-Cookie', headers['set-cookie']);
            }
            if (debugLog) {
                console.log("Header from ShopApp response: " + JSON.stringify(headers));
            }
            // session timed out what to do?
            if (headers['session_timed_out'] === 'TRUE') {
                res.redirect(301, proxyOrigin);
            }
            res.send(data);
        })
    }
}

app.get(['/sns/*', '/img/*', '/chkout/*'], processRequest);
app.post(['/chkout/shipping/*'], processRequest);

app.get(['/*', '/#*'], express.static(__dirname + '/public'));

var port = process.env.PORT || 2500;
https.createServer(keyOptions, app).listen(port);
console.log("Proxy server to " + proxyOrigin + " on port " + port);
