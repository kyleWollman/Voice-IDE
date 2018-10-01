const fs = require("fs"),
  path = require("path");

//create export
module.exports = {
  buildTreeData: function(fileName, key) {
    // used to reference seld in different context
    let self = this;

    var stats = fs.lstatSync(fileName),
    //json object containing file structure
    info = {
      path: fileName,
      title: path.basename(fileName),
      key: key
    };

    if (stats.isDirectory()) {
      info.folder = true;
      info.lazy = true; // FancyTree param to only expand node when clicked
      info.children = fs.readdirSync(fileName).map(function(child) {
        return self.buildTreeData(fileName + "/" + child, key + 1);
      });

      // sort children putting directories on top
      info.children.sort(function(a, b) {
        if (a.folder === true && b.folder === false) return -1;
        if (b.folder === true && a.folder === false) return 1;

        return a.path.localeCompare(b.path);
      });
    } else {
      info.folder = false;
    }

    return info;
  }
}
