const fs = require("fs");

module.exports = {
  options: {
    key: fs.readFileSync('config/aquarius.key'),
    cert: fs.readFileSync('config/aquarius.crt')
  }
};
