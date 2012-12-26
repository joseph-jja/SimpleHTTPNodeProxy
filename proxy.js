// simple http proxy

var http = require('http'),
    https = require('https'),
    zlib = require('zlib'),
    fs = require("fs");

function logHeaders(hdrObject) {
    console.log("###################### HEADERS START ######################");
    for ( hdr in hdrObject ) {
            console.log("Header: " + hdr + " value = " + hdrObject[hdr]);
    }
    console.log("######################  HEADERS END  ######################");
}

function runServer(request, response) {

    var client, proxy_req;

    // creates a http.Client
    client = http.createClient(80, request.headers['host']);

    // return http.ClientRequest
    proxy_req = client.request(request.method, request.url, request.headers);

    proxy_req.addListener('response', function(proxy_resp) {
                var content = "", isHTML = false, contentType;

        contentType = proxy_resp.headers['content-type'];
        if ( contentType && contentType.indexOf("text/html") != -1 ) {
            isHTML = true;
        }
        proxy_resp.addListener('data', function(chunk) {
            if ( isHTML ) {
                if ( proxy_resp.headers['content-encoding'] === 'gzip' ) {
                    zlib.gunzip(chunk, function(err, buffer) {
                    content += buffer;
                    response.write(chunk, 'binary');
console.log("GZIP partial length = " + content.length + " " + (buffer?buffer.length:"") + " " + err);
                    });
                } else if ( proxy_resp.headers['content-encoding'] === 'deflate' ) {
                    zlib.inflate(chunk, function(err, buffer) {
                        content += buffer;
                response.write(chunk, 'binary');
                    });
                } else {
                        content += chunk;
console.log("HTML that is not gzipped? " + chunk.length + " " + proxy_resp.statusCode);
                }
            } else {
                response.write(chunk, 'binary');
            }
        });
        proxy_resp.addListener('end', function() {
            if ( isHTML && content ) {
console.log("Content length = " + content.length);
                if ( proxy_resp.headers['content-encoding'] === 'gzip' ) {
                   zlib.gzip(content, function(err, buffer) {
                     //response.write(buffer, 'binary');
                     response.end();
console.log("GZIP Buffer length = " + buffer.length);
                   });
               } else if ( proxy_resp.headers['content-encoding'] === 'deflate' ) {
                   zlib.deflate(content, function(err, buffer) {
                      //response.write(buffer, 'binary');
                      response.end();
console.log("Buffer length = " + buffer.length);
                   });
               } else {
                   response.write(content, 'binary');
                   response.end();
               }
            } else {
                response.end();
            }
        });
        response.writeHead(proxy_resp.statusCode, proxy_resp.headers);
/*
        logHeaders(request.headers);
        logHeaders(proxy_resp.headers);
*/
    });
    request.addListener('data', function(chunk) {
        proxy_req.write(chunk, 'binary');
    });
    request.addListener('end', function() {
        proxy_req.end();
    });
}

http.createServer(runServer).listen(10080);

