// simple http proxy

var http = require( 'http' ),
    https = require( 'https' ),
    zlib = require( 'zlib' ),
    fs = require( "fs" ),
    debug = false;

function logMessage( msg ) {
    if ( debug ) {
        console.log( msg );
    }
}

function logHeaders( hdrObject ) {
    var hdr;
    logMessage( "###################### HEADERS START ######################" );
    for ( hdr in hdrObject ) {
        logMessage( "Header: " + hdr + " value = " + hdrObject[ hdr ] );
    }
    logMessage( "######################  HEADERS END  ######################" );
}

function runServer( request, response ) {

    var proxyRequest,
        options = request.headers;

    logMessage( "Request headers: " + JSON.stringify( options ) );

    options[ 'hostname' ] = options[ 'host' ];
    options[ 'path' ] = request.url;
    options[ 'method' ] = request.method;

    proxyRequest = http.request( request.headers, function ( proxyResponse ) {
        var content = "",
            isHTML = false,
            contentType;

        logMessage( "GOT status: " + proxyResponse.statusCode + " headers: " + JSON.stringify( proxyResponse.headers ) );

        contentType = proxyResponse.headers[ 'content-type' ];
        if ( contentType && contentType.indexOf( "text/html" ) !== -1 ) {
            isHTML = true;
        }
        proxyResponse.on( 'data', function ( chunk ) {
            if ( isHTML ) {
                if ( proxyResponse.headers[ 'content-encoding' ] === 'gzip' ) {
                    zlib.gunzip( chunk, function ( err, buffer ) {
                        content += buffer;
                        response.write( chunk, 'binary' );
                        logMessage( "GZIP partial length = " + content.length + " " + ( buffer ? buffer.length : "" ) + " " + err );
                    } );
                } else if ( proxyResponse.headers[ 'content-encoding' ] === 'deflate' ) {
                    zlib.inflate( chunk, function ( err, buffer ) {
                        content += buffer;
                        response.write( chunk, 'binary' );
                    } );
                } else {
                    content += chunk;
                    logMessage( "HTML that is not gzipped? " + chunk.length + " " + proxyResponse.statusCode );
                }
            } else {
                response.write( chunk, 'binary' );
            }
        } );
        proxyResponse.on( 'end', function () {
            if ( isHTML && content ) {
                logMessage( "Content length = " + content.length );
                if ( proxyResponse.headers[ 'content-encoding' ] === 'gzip' ) {
                    zlib.gzip( content, function ( err, buffer ) {
                        //response.write(buffer, 'binary');
                        response.end();
                        logMessage( "GZIP Buffer length = " + buffer.length );
                    } );
                } else if ( proxyResponse.headers[ 'content-encoding' ] === 'deflate' ) {
                    zlib.deflate( content, function ( err, buffer ) {
                        //response.write(buffer, 'binary');
                        response.end();
                        logMessage( "Buffer length = " + buffer.length );
                    } );
                } else {
                    response.write( content, 'binary' );
                    response.end();
                }
            } else {
                response.end();
            }
        } );
        response.writeHead( proxyResponse.statusCode, proxyResponse.headers );
        /*
        logHeaders(request.headers);
        logHeaders(proxyResponse.headers);
*/
    } );
    request.on( 'data', function ( chunk ) {
        proxyRequest.write( chunk, 'binary' );
    } );
    request.on( 'end', function () {
        proxyRequest.end();
    } );
}

logMessage( "Listening on port: " + 10080 );
http.createServer( runServer ).listen( 10080 );