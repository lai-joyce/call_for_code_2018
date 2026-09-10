require('dotenv').config();
var express = require("express");
var app = express();
var cfenv = require("cfenv");
var bodyParser = require('body-parser')

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }))

// parse application/json
app.use(bodyParser.json())

var cloudant, mydb;

/* Endpoint to greet and add a new visitor to database.
* Send a POST request to localhost:3000/api/visitors with body
* {
* 	"name": "Bob"
* }
*/
app.post("/api/visitors", function (request, response) {
  var userName = request.body.name;
  var doc = { "name" : userName };
  if(!mydb) {
    console.log("No database.");
    response.send(doc);
    return;
  }
  // insert the username as a document
  mydb.insert(doc).then(function(body) {
    doc._id = body.id;
    response.send(doc);
  }).catch(function(err) {
    console.log('[mydb.insert] ', err.message);
    response.send("Error");
  });
});

/**
 * Endpoint to get a JSON array of all the visitors in the database
 * REST API example:
 * <code>
 * GET http://localhost:3000/api/visitors
 * </code>
 *
 * Response:
 * [ "Bob", "Jane" ]
 * @return An array of all the visitor names
 */
app.get("/api/visitors", function (request, response) {
  var names = [];
  if(!mydb) {
    response.json(names);
    return;
  }

  mydb.list({ include_docs: true }).then(function(body) {
    body.rows.forEach(function(row) {
      if(row.doc && row.doc.name)
        names.push(row.doc.name);
    });
    response.json(names);
  }).catch(function() {
    response.json(names);
  });
});


// load local VCAP configuration  and service credentials
var vcapLocal;
try {
  vcapLocal = require('./vcap-local.json');
  console.log("Loaded local VCAP", vcapLocal);
} catch (e) { }

const appEnvOpts = vcapLocal ? { vcap: vcapLocal} : {}

const appEnv = cfenv.getAppEnv(appEnvOpts);

var nano = require('nano');

function cloudantUrlFromCreds(creds) {
  if (!creds) return null;
  if (creds.url) return creds.url;
  if (creds.host && creds.username && creds.password) {
    return 'https://' + creds.username + ':' + creds.password + '@' + creds.host;
  }
  return null;
}

var cloudantUrl = null;
if (appEnv.services['cloudantNoSQLDB']) {
  cloudantUrl = cloudantUrlFromCreds(appEnv.services['cloudantNoSQLDB'][0].credentials);
} else if (appEnv.getService(/cloudant/)) {
  cloudantUrl = cloudantUrlFromCreds(appEnv.getService(/cloudant/).credentials);
} else if (process.env.CLOUDANT_URL) {
  cloudantUrl = process.env.CLOUDANT_URL;
}

if (cloudantUrl) {
  cloudant = nano(cloudantUrl);
  var dbName = 'mydb';
  cloudant.db.create(dbName).then(function() {
    console.log("Created database: " + dbName);
  }).catch(function() {
    // Database already exists.
  });
  mydb = cloudant.db.use(dbName);
}

//serve static file (index.html, images, css)
app.use(express.static(__dirname + '/views'));



var port = process.env.PORT || 3000
app.listen(port, function() {
    console.log("To view your app, open this link in your browser: http://localhost:" + port);
});
