/*
 * app.js - v1.5
 * In this app.js has been merged almost all web server functionality from personal-website and forumjs.
 * This sever will be improved and modified as new live demo projects will be added.
 */
var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var dmServer = require('./forumjs/dmanager-server.js');
var dmClient = require('./forumjs/dmanager-client.js');

var hostPort = {port: 9000, host: '127.0.0.1'}; // Default values in case of no command line arguments.

/*
 * Live demo comment
 */
/*
// Use command line arguments to establish the Host and Port of the remote data manager server.
switch(process.argv.length) {
    case 2:
        console.log('FWS:\n - No command line arguments, using default host, port'); 
        break;
    case 3: // Host:Port on commmand line.
        hostPort.host = (process.argv[2].split(':'))[0];
        hostPort.port = (process.argv[2].split(':'))[1];
        break;
    default:
        console.log('FWS:\n - Error: wrong command line arguments (' + process.argv.length + ')');
}
*/
/*
 * Live demo projects variables
 */
var viewsdir = __dirname + '/views';
var forumjsViewsDir = __dirname + '/forumjs/views';

app.set('port', (process.env.PORT || 80));
app.set('views', viewsdir);
app.set('forumjsViews', forumjsViewsDir);

// Called on connection
function get_page(req, res) {
	console.log('FWS: - Serving request ' + req.params.page);
	if (req.params.project == 'forumjs') {
		res.sendFile(forumjsViewsDir + '/' + req.params.page);
	} else {
		res.sendFile(viewsdir + '/' + req.params.page);
	}
}

// Called on server startup
function on_startup() {
    console.log('FWS:\n - Starting web server:\n --- port: ' + http.address().port);
    console.log(' --- current directory: ' + __dirname);
    // Start data manager client to establish connection with the remote data manager server at (host:port).
    console.log('FWS:\n - Starting data manager client');
    //dataServer.Start();
    dmClient.Start(hostPort.port, hostPort.host);
}

// Serve static files such as css, images, javascript
app.use('/public', express.static(__dirname + '/public'));
// Server static files from forum js external project.
app.use('/forumjs/public', express.static(__dirname + '/forumjs/public'));
//app.use('/forumjs/views', express.static(__dirname + '/forumjs/views'));

// Serve static html files.
// Serve index.html from personal website.
app.get('/', function(req, res){
    console.log("REQ:\n - (/) serving index.html\n --- URL original: " + req.originalUrl + '\n');
	req.params.project = 'personal-website';
	req.params.page = 'index.html'
	get_page(req, res);
});

// Server index.html from forum js project.
app.get('/forumjs/', function(req, res){
    console.log("REQ:\n - (/forumjs/) serving forumjs.html\n");
	req.params.project = 'forumjs';
	req.params.page = 'forumjs.html';
	get_page(req, res);
});

// This option will be implemented once the project structure have been completed. 
app.get('/:page', function(req, res){
    console.log('FWS:\n Wrong page request (/:page): ' + req.params.page);
	req.params.project = 'personal-website';
    req.params.page = 'index.html';
    get_page(req, res);
});

// This option will be implemented once the project structure have been completed. 
app.get('/forumjs/:page', function(req, res){
    console.log('FWS:\n Wrong page request (/forumjs/:page): ' + req.params.page);
    req.params.project = 'forumjs';
    req.params.page = 'forumjs.html';
    get_page(req, res);
});

io.on('connection', function(sock) {
	console.log('FWS:\n - Client browser connected');
	
    sock.on('disconnect', function(){
		console.log('FWS:\n - Client browser disconnected');
	});

    // On messages that come from client, store them, and send them to every connected client
    sock.on('message', function(msgStr){
        console.log('FWS: - Event: message: ' + msgStr);
        var msg = JSON.parse(msgStr);
        msg.ts = new Date(); // timestamp
        if (msg.isPrivate) {
            dmClient.addPrivateMessage(msg, function () {
                io.emit('message', JSON.stringify(msg));
            });
        } else {
            dmClient.addPublicMessage(msg, function () {
                io.emit('message', JSON.stringify(msg));
            });
        }
    });

    // New subject added to storage, and broadcasted
    sock.on('new subject', function(sbj) {
        dmClient.addSubject(sbj, function(id) {
            console.log('FWS: - Event: new subject: ' + sbj + '-->' + id);
            if (id == -1) {
                sock.emit('new subject', 'err', 'Subject already exists', sbj);
            } else {
                sock.emit('new subject', 'ack', id, sbj);
                io.emit('new subject', 'add', id, sbj);
            }      
        });
    });

    // New subject added to storage, and broadcasted
    sock.on('new user', function(usr, pas) {
        dmClient.addUser(usr, pas, function(exists) {
            console.log('FWS: - Event: new user: ' + usr + '(' + pas + ')');
            if (exists) {
                sock.emit('new user', 'err', usr, 'User already exists');
            } else {
                sock.emit('new user', 'ack', usr);
                io.emit('new user', 'add', usr);      
            }
        });
    });

    // Client ask for current user list
    sock.on('get user list', function() {
        dmClient.getUserList(function (list) {
            console.log('FWS: - Event: get user list');  		
            sock.emit('user list', list);
        });
    });

    // Client ask for current subject list
    sock.on('get subject list', function() {
        dmClient.getSubjectList(function(list) {
            console.log('FWS: - Event: get subject list');  		
            sock.emit('subject list', list);
        });
    });

    // Client ask for message list
    sock.on('get message list', function(from, to, isPriv) {
        console.log('FWS: - Event: get message list: ' + from + ':' + to + '(' + isPriv + ')');  		
        if (isPriv) {
            dmClient.getPrivateMessageList(from, to, function (list) {
                sock.emit('message list', from, to, isPriv, list);
            });
        } else {
            dmClient.getPublicMessageList(to, function (list) {
                sock.emit('message list', from, to, isPriv, list);
            });
        }
    });

    // Client authenticates
    sock.on('login', function(u,p) {
        console.log('FWS: - Event: user logs in');  		
        dmClient.login(u, p, function(ok) {
            if (!ok) {
                console.log('FWS: - Logging error, wrong credentials: ' + u + '(' + p + ')');
                sock.emit('login', 'err', 'Wrong credentials');
            } else {
                console.log ('FWS: - User logs in: ' + u + '(' + p + ')');
                sock.emit('login', 'ack', u);	  			
            }
        });
    });
});

// Listen for connections.
http.listen((process.env.PORT || 80), on_startup);


