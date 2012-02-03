var path = require('path')
  , fs = require('fs');

var express = require('express')
  , app = express.createServer();

app.use(function(req, res, next) {
  var setHeader = res.setHeader;
  res.setHeader = function(name) {
    switch (name) {
      case 'Cache-Control':
      case 'Last-Modified':
      case 'ETag':
        return;
    }
    return setHeader.apply(res, arguments);
  };
  next();
});

app.use(express.static(__dirname));

app.use(express.static(__dirname + '/../static'));

app.listen(8080);
