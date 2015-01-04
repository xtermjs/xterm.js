(function (linkify) {
    if (typeof define == 'function') {
        /*
         * Require.js is available
         */
        define(['../../src/xterm'], linkify);
    } else {
        /*
         * Plain browser environment
         */ 
        linkify(this.Xterm);
    }
})(function (Xterm) {
    Xterm.prototype.linkify = function () {
      var rows = this.rowContainer.children,
          buffer = document.createElement('span');

      for (var i=0; i<rows.length; i++) {
        var line = rows[i], nodes = line.childNodes;

        for (var j=0; j<nodes.length; j++) {
          var node = nodes[j];

          if (node.nodeType == 3) {
              var match = node.data.match(/(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?/);

            if (match) {
              var url=match[0],
                  newData = node.data.replace(url, '<a href="http://' +  url + '" target="_blank" >' + url + '</a>');
              buffer.textContent = node.data;
              line.innerHTML = line.innerHTML.replace(buffer.innerHTML, newData);
              this.emit('linkify:line', line);
            }
          }
        }
      }
    };
});