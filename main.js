//set up express
const express = require("express"),
  app = express(),
  https = require('https'),
  webSocket = require("ws"),
  handlebars = require("express-handlebars").create({ defaultLayout: "main" }),
  bodyParser = require("body-parser"),
  passport = require("passport"),
  auth = require("./auth"),
  cookieParser = require("cookie-parser"),
  cookieSession = require("cookie-session"),
  pty = require("node-pty"),
  dialogflow = require('dialogflow'),
  path = require('path');
  keys = require("./keys"),
  dirTree = require("./dir-tree"),
  fileIO = require("./file-io"),
	ffmpeg = require('ffmpeg'),
	speech = require('@google-cloud/speech'),
	fs = require('fs'),
  credentials = require('./ssh-credentials');

// set up handlebars
app.engine("handlebars", handlebars.engine);
app.set("view engine", "handlebars");

// set up bodyParser
app.use(bodyParser.urlencoded({
  limit: '1mb',
  extended: true
}));
app.use(bodyParser.json());

// serve public assets
app.use(express.static("public"));
app.use(express.static("workspaces"));
app.use(express.static("node_modules/xterm/dist"));

// set up OAuth
auth(passport);

// session validator helper
function authorizedEmail(emailAddr) {
  return emailAddr.match(/oregonstate.edu/);
}

// use port specified in command, if it exists
var port = parseInt(process.argv.slice(2)) || 3000;

var server = https.createServer(credentials.options, app);

const wss = new webSocket.Server({ server });

// web socket for terminal
wss.on("connection", function(ws, req) {
  var term = pty.spawn("bash", [], {
    name: "xterm-color",
    cols: 128,
    rows: 48,
    cwd: process.env.PWD,
    env: process.env
  });

  var pid = term.pid;
  console.log("Created terminal. PID: %d", pid);

  term.on("data", function(data) {
    try {
      // send response from terminal to the frontend
      ws.send(data);
    } catch (e) {
      // print out error
      console.log(e);
    }
  });

  ws.on("message", function(message) {
    // send message to terminal
    term.write(message);
  });

  ws.on("close", function() {
    process.kill(pid);
    console.log("Closed terminal");
  });
});

//set up passport
app.use(passport.initialize());
app.use(passport.session());

//set up cookies
app.use(cookieSession({
  name: "session",
  keys: ["123"] //still need to look into this more and possibly make it more secure
}));

app.use(cookieParser());

// voice api
// Creates a client
const client = new speech.SpeechClient();

//landing page
app.get("/", (req, res) => {
  var context = {};
  if (req.session.token) {
    var emailAddr = req.session.passport.user.profile.emails[0].value;
    if (authorizedEmail(emailAddr)) {
      // TODO: allow customizable projects
      var namespace = req.session.passport.user.profile.id;
      var project = emailAddr;
      var profilePic = req.session.passport.user.profile._json.image.url;

      // TODO: remove after demonstration
      // build directory, if it does not exist
      fileIO.buildProject(namespace, project);
      // create two empty c++ project files, if project empty
      fileIO.buildFile(namespace, project, "main.cpp");
      fileIO.buildFile(namespace, project, "main.h");

      // // use user workspace/project directory as base for dir tree
      // var treeOutput = dirTree.buildTreeData("./workspaces/" + namespace + "/" + project, 1);
      // fileIO.writeFile("data.json", JSON.stringify(treeOutput), namespace, "tree");

      // set cookie
      res.cookie("token", req.session.token);

      // display data
      context.display_name = req.session.passport.user.profile.displayName;
      context.email = emailAddr;
      context.aquarius_domain = keys.aquarius.domain;
      context.aquarius_port = keys.aquarius.port;
      context.root_path = path.resolve(__dirname);
      context.namespace = namespace;
      context.project = project;
      context.profilePic = profilePic;

      res.render("ide", context);
    } else {
      context.message = "Only users with Oregon State credentials can access VIDE. Sorry.";
      res.render("sign-in", context);
    }
  } else {
    context.message = "You must log in with an Oregon State email address to use VIDE.";
    res.render("sign-in", context);
  }
});

// syncs nav tree
app.post("/syncNavTree", (req, res) => {
  var context = {};
  if (req.session.token) {
    var emailAddr = req.session.passport.user.profile.emails[0].value;
    if (authorizedEmail(emailAddr)) {
      // use user workspace/project directory as base for dir tree
      var namespace = req.session.passport.user.profile.id;
      var project = emailAddr;

      var treeOutput = dirTree.buildTreeData("./workspaces/" + namespace + "/" + project, 1);
      fileIO.writeFile("data.json", JSON.stringify(treeOutput), namespace, "tree");

      // directory structure saved
      res.send("Success");
    }
  }
});

// read file
app.get("/read/:fileName/:folder", (req, res) => {
  if (req.session.token) {
    res.cookie("token", req.session.token);

    var emailAddr = req.session.passport.user.profile.emails[0].value;
    if (authorizedEmail(emailAddr)) {
      var fileName = req.params.fileName;
      var folder = req.params.folder;

      // read file from namespace
      var fileOutput = fileIO.readFile(fileName, req.session.passport.user.profile.id, folder);
    }

    // send back plain text
    res.send(fileOutput);
  } else {
    // could not load session
    res.send("");
  }
});

// write file
app.post("/write/:fileName/:folder", (req, res) => {
  if (req.session.token) {
    res.cookie("token", req.session.token);

    var emailAddr = req.session.passport.user.profile.emails[0].value;
    if (authorizedEmail(emailAddr)) {
      var fileName = req.params.fileName;
      var folder = req.params.folder;
      var fileContent = req.body["content"];

      // write file to user namespace
      fileIO.writeFile(fileName, fileContent, req.session.passport.user.profile.id, folder);
    }

    // send back plain text
    res.send("Success");
  } else {
    // could not load session
    res.send("Failure!");
  }
});

// write file
app.post("/writeflac/:fileName/:folder", (req, res) => {
  if (req.session.token) {
    res.cookie("token", req.session.token);
    var emailAddr = req.session.passport.user.profile.emails[0].value;

    if (authorizedEmail(emailAddr)) {
      var fileName = req.params.fileName;
      var folder = req.params.folder;
      var fileContent = req.body["content"];

      // write flac file in namespace, then get response from google translate
      fileIO.writeFlacFileWithHandler(fileName, fileContent, req.session.passport.user.profile.id, folder, function() {
        // The name of the audio file to transcribe
        const fileName = './workspaces/' + req.session.passport.user.profile.id + '/voice/recording.flac';

        //Reads a local audio file and converts it to base64
        const file = fs.readFileSync(fileName);
        const audioBytes = file.toString('base64');

        // The audio file's encoding, sample rate in hertz, and BCP-47 language code
        const audio = {
          content: audioBytes,
        };
        const config = {
          languageCode: 'en-US'
        };
        const request = {
          audio: audio,
          config: config,
        };

        // Detects speech from the audio file
        client
          .recognize(request)
          .then(data => {
            const response = data[0];
            const transcription = response.results.map(result => result.alternatives[0].transcript).join('\n');

            res.send(transcription);
          })
          .catch(err => {
            console.error('ERROR:', err);
          });
      });
    }
  } else {
    // could not load session
    res.send("Failure!");
  }
});

// write file
app.post("/append/:fileName/:folder", (req, res) => {
  if (req.session.token) {
    res.cookie("token", req.session.token);

    var emailAddr = req.session.passport.user.profile.emails[0].value;
    if (authorizedEmail(emailAddr)) {
      var fileName = req.params.fileName;
      var folder = req.params.folder;
      var fileContent = req.body["content"];

      // write file to user namespace
      fileIO.appendFile(fileName, fileContent, req.session.passport.user.profile.id, folder);
    }

    // send back plain text
    res.send("Success");
  } else {
    // could not load session
    res.send("Failure!");
  }
});

//sign in
app.get("/sign-in", function(req, res) {
  res.render('sign-in');
});

//logout
app.get("/logout", (req, res) => {
  req.logout();
  req.session = null;
  res.redirect('/');
});

//verification of user
app.get("/auth/google", passport.authenticate("google", {
  scope: ['https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile']
}));

//callback after verification
app.get("/auth/google/callback",
  passport.authenticate("google", {
    failureRedirect: "/sign-in"
  }),
  (req, res) => {
    req.session.token = req.user.token;
    res.redirect("/");
  }
);

function isEmptyObject(obj) {
  return !Object.keys(obj).length;
}

//sends text to dialogflow
app.post("/sendToDialogflow", function(req, res) {
  //create variables
  const projectId = 'final-176901';
  const sessionId = '123';
  const query = req.body["content"];
  const languageCode = 'en-US';

  //Instantiate a Dialogflow client
  const sessionClient = new dialogflow.SessionsClient();

  //Define session path
  const sessionPath = sessionClient.sessionPath(projectId, sessionId);

  //create dialogflow request
  const request = {
    session: sessionPath,
    queryInput: {
      text: {
        text: query,
        languageCode: languageCode,
      },
    },
  };

  //send request and log result
  sessionClient
    .detectIntent(request)
    .then(responses => {

      //only for debuggin dialogflow responses
      console.log('Detected Intent');
      const result = responses[0].queryResult;
      if (result.intent) {
        console.log(` Intent: ${result.intent.displayName}`);
      } else {
        console.log(`No intent matched.`);
      }
      console.log(` Action: ${result.action}`);
      console.log("Parameters: " + JSON.stringify(result.parameters));
      res.send(result);
    });
});

server.listen(port, function() {
  console.log("Express started on port " + port + "; press Ctrl-C to terminate.");
});

module.exports = server;
