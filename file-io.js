const fs = require("fs"),
  ffmpeg = require('fluent-ffmpeg');

const ROOT_SPACE = "./workspaces/";

// helper for building namespaced project path
function projectPath(namespace, project) {
  return ROOT_SPACE + namespace + "/" + project;
}

// helper for building namespaced file path
function filePath(fileName, namespace, project) {
  return ROOT_SPACE + namespace + "/" + project + "/" + fileName;
}

// private helpers
function readUserFile(fileName, namespace, project) {
  var path = filePath(fileName, namespace, project);

  // create file if does not exist
  if (!fs.existsSync(path)){
    writeUserFile(fileName, "", namespace, project);
    console.log(path + " created!");
  }

  // return content of file
  return fs.readFileSync(path);
}

function writeUserFile(fileName, fileContent, namespace, project) {
  var path = filePath(fileName, namespace, project);

  // write value over file
  fs.writeFile(path, fileContent, function (err) {
    if (err) {
      throw err;
    }
  });
}

function writeFlacUserFileWithHandler(fileName, fileContent, namespace, project, handler) {
  var path = filePath(fileName, namespace, project);

  // write audio file, encoded with opus, from front end
  fs.writeFile(path, fileContent, "binary", function (err, data) {
    if (err) {
      throw err;
    } else {
      // convert to flac, using ffmpeg
      var command = ffmpeg(path);
      command.audioCodec("flac");

      // call handler after conversion
      command.save(path).on('end', function() {
        // console.log('Screenshots taken');
        handler();
      });
    }
  });
}

function appendUserFile(fileName, fileContent, namespace, project) {
  var path = filePath(fileName, namespace, project);

  // write value over file
  fs.appendFile(path, fileContent, function (err) {
    if (err) {
      throw err;
    }
  });
}

//create export
module.exports = {
  // builds directory, if it does not yet exist
  buildProject: function(namespace, project) {
    // check if main workspace directory exists
    if (!fs.existsSync(ROOT_SPACE)) {
      fs.mkdirSync(ROOT_SPACE);
    }

    // var path = projectPath(namespace, project);
    var path = ROOT_SPACE + namespace;

    // check if user namespace exists
    if (!fs.existsSync(path)) {
      fs.mkdirSync(path);
    }

    // project path
    var projectPath = path + "/" + project;

    // check if project exists
    if (!fs.existsSync(projectPath)) {
      fs.mkdirSync(projectPath);
    }

    // build path
    var buildPath = path + "/builds";

    // check if build directory exists
    if (!fs.existsSync(buildPath)) {
      fs.mkdirSync(buildPath);
    }

    // chat log path
    var chatPath = path + "/chat";

    // check if build directory exists
    if (!fs.existsSync(chatPath)) {
      fs.mkdirSync(chatPath);
    }

	// voice recording path
    var voicePath = path + "/voice";

     // check if voice recording directory exists

    // voice recording path
    var voicePath = path + "/voice";

    // check if voice recording directory exists
    if (!fs.existsSync(voicePath)) {
      fs.mkdirSync(voicePath);
    }
  },

  // builds file, if it does not yet exist
  buildFile: function(namespace, project, fileName) {
    var path = filePath(fileName, namespace, project);

    // check if file exists
    if (!fs.existsSync(path)) {
      writeUserFile(fileName, "", namespace, project);
    }
  },

  // reads files from user namespace
  readFile: function(fileName, namespace, project) {
    // setup project, if it does not exist
    this.buildProject(namespace, project);

    // load or build file
    return readUserFile(fileName, namespace, project);
  },

  // writes files to user namespace
  writeFile: function(fileName, fileContent, namespace, project) {
    // setup project, if it does not exist
    this.buildProject(namespace, project);

    // write data to file
    writeUserFile(fileName, fileContent, namespace, project);
  },

  // writes flac files to user namespace, with handler
  writeFlacFileWithHandler: function(fileName, fileContent, namespace, project, handler) {
    // setup project, if it does not exist
    this.buildProject(namespace, project);

    // write data to file, then call handler
    writeFlacUserFileWithHandler(fileName, fileContent, namespace, project, handler);
  },

  // append to files within user namespace
  appendFile: function(fileName, fileContent, namespace, project) {
    // setup project, if it does not exist
    this.buildProject(namespace, project);

    // write data to file
    appendUserFile(fileName, fileContent, namespace, project);
  }
};
