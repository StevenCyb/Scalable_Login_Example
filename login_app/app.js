// Include some libs
const dockerContainerId = require('docker-container-id');
const mongo = require('mongodb').MongoClient;
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const express = require("express");
const app = express();

// Define variables for the environment variables
const {
  MONGO_USERNAME,
  MONGO_PASSWORD,
  MONGO_HOSTNAME,
  MONGO_PORT,
  MONGO_DB
} = process.env;

// Define connection string, secret and port
const mongoConnectionString = `mongodb://${MONGO_USERNAME}:${MONGO_PASSWORD}@${MONGO_HOSTNAME}:${MONGO_PORT}/${MONGO_DB}?authSource=admin`;
const secret = 'supersecretkey';
const port = process.env.PORT || 3000;

// Run everything asynchronous since retrieving the container id is only possible asynchronously
(async () => {
	// Get the container id
	let containerId = await dockerContainerId();
	if (!containerId) {
		containerId = -1;
	}
	// Add some usage
	app.use(cookieParser());
	app.use(express.json());
	app.use(express.urlencoded());
	// Add POST and GET to path /
	app.get('/', function(req, res) {
		// Try to get the token from cookie
		var token = req.cookies['x-access-token'];
		if(token) {
			// Verify the token
			jwt.verify(token, secret, function(err, decoded) {
				if(err) {
					// Send login view if its a invalid token 
					res.sendFile(path.join(__dirname + '/html/index_login.html'));
				} else {
					// Send dashboard view if user is logged in
					fs.readFile(__dirname + '/html/index_dashboard.html', (err, data) => {
						res.send(data.toString()
							.replace('{{token}}', token)
							.replace('{{username}}', decoded.username)
							.replace('{{container_id}}', containerId)
							.replace('{{cookie}}', JSON.stringify(decoded))
						);
					});
				}
			});
		} else {
			// Send login view if token not exist
			res.sendFile(path.join(__dirname + '/html/index_login.html'));
		}
	}).post('/', function(req, res) {
		if(req.body.username != undefined && req.body.password != undefined && req.body.username.match("^[a-zA-Z0-9]{3,}$") && req.body.password.match("^[a-zA-Z0-9]{3,}$")) {
			// Connect to mongo db
			mongo.connect(mongoConnectionString, {
				useNewUrlParser: true,
				useUnifiedTopology: true
			}, (err, client) => {
				if(err) {
					console.error(`DB-ERROR: ${err}`);
				} else {
					// Check if user exist with given password
					client.db('page_users').collection('users').findOne({'user': req.body.username,'password': req.body.password}, function (err, result) {
						if(err || result == null) {
							// Send to login view if authentication fails
							res.sendFile(path.join(__dirname + '/html/index_login.html'));
						} else {
							// Create token if authentication successes - Token will expire after 24h
							var token = jwt.sign({ id: result._id, username: req.body.username}, secret, {
								expiresIn: 86400000 
							});
							// Set the token to the cookie
							res.cookie('x-access-token', token, {
								path:"/",
								sameSite: true,
								maxAge: 86400000,
								httpOnly: true,
							});
							// Redirect to self (should return the dashboard)
							res.redirect('/');
						}
						// Of course the database must be closed
						client.close();
					});
				}
			});
		} else {
			// Send login view if username or password is invalid or not provided
			res.sendFile(path.join(__dirname + '/html/index_login.html'));
		}
	});
	// Run express server
	app.listen(port, () => console.log(`Listening on port ${port}...`));
})();

