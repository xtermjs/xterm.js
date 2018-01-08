var term,
    protocol,
    baseSocketURL,
    socket,
    cmdSocket,
    pid;

    
var terminalContainer;


var p = (location.protocol === 'https:') ? 'wss://' : 'ws://';
var url = p + location.hostname + ((location.port) ? (':' + location.port) : '') + '/controller';
console.log('URL Notifications Socket: ' + url);
var socketNotifications = new WebSocket(url);

const RUNNING_COLOR = 'indigo lighten-2';
const RUNNING_BADGE = 'schedule';
const SUCCESS_COLOR = 'green lighten-2';
const SUCCESS_BADGE = 'done';
const FAILED_COLOR = 'red lighten-2';
const FAILED_BADGE = 'priority_high';

socketNotifications.onmessage = function(e) {
  console.log('Entry to onmessage (Notifications sockets). Message: ' + e.data);
  msg = JSON.parse(e.data);

  /*if(e.data.includes('needConsole')){
    newPid = e.data.substring(e.data.indexOf("-") + 1, e.data.lenght);
    vue.addTerminal(newPid);
  }*/
  /*if(msg.type=='needConsole'){
    vue.addTerminal(msg.pid);
  }

  if(msg.type=='status'){
    console.log('Receive a message');
  }*/


  switch(msg.type) {

      case 'needConsole':
          vue.addTerminal(msg.pid);
          break;
      case 'status':
          vue.setStatus(msg);
          break;
      case 'removeStatus':
          vue.removeStatus();
          break;

      default:
          console.log('does not match any type: ' + msg.type + '.');
  }

}
socketNotifications.onerror = function(e) {
  console.log('Entry to onError (Notifications sockets)');
}
socketNotifications.onclose = function(e) {
  console.log('Entry to onclose (Notifications sockets)');
}
socketNotifications.onopen = function(e) {
  console.log('Entry to onopen (Notifications sockets)');
}

var vue = new Vue({
  el: '#app',
  data() {
    return {
      //terminals: [{ id: 'A', name: 'Terminal A', terminal:term, state: 'Running', badge: 'watch_later', color:"light-blue lighten-3", fab: false }],
      terminals: [],
      dialogNewTerminal: false,
      dialogRemoveTerminal: false,
      dialogRenameTerminal: false,
      drawer: true,
      mini: false,
      newTerminal: "",
      rename: "",
      currentTerminal: 0,
      countTerminal: 0,
      abc: new Array('A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z')
    };
  },
  methods: {
    addTerminal: function (newPid) {

      var currentTerminalElement = null;
      if(this.terminals.length != 0){
        var previousTerminalElement = document.getElementById(this.terminals[this.currentTerminal].name);
        previousTerminalElement.style.visibility = "hidden";
      }

      t = createTerminal();
      if(newPid){
        createSocket(newPid);
      }
      
     /* if (this.countTerminal == 2)
        this.terminals.push({ id: this.abc[this.countTerminal], name: 'Terminal ' + this.abc[this.countTerminal], terminal: term, status: this.abc[this.countTerminal], badge: '', color:'', fab: false });
      else if (this.countTerminal == 3)
         this.terminals.push({ id: this.abc[this.countTerminal], name: 'Terminal ' + this.abc[this.countTerminal], terminal: term, status: this.abc[this.countTerminal], badge: '', color:'', fab: false });
      else*/

      this.terminals.push({ id: this.abc[this.countTerminal], name: 'Terminal ' + this.abc[this.countTerminal], terminal: term, badge: '', color: '', colorText: '', fab: false, cmd: this.abc[this.countTerminal], status: ''});
     

      this.currentTerminal = this.countTerminal;
      this.countTerminal = this.countTerminal + 1;
      
          
      
      
    },

    setTerminalSelected: function (index) {

      var previousTerminalElement = document.getElementById(this.terminals[this.currentTerminal].name);
      previousTerminalElement.style.visibility = "hidden";    
      var currentTerminalElement = document.getElementById(this.terminals[index].name);
      if(previousTerminalElement.style.visibility == "hidden"){
        currentTerminalElement.style.visibility = "visible";
      }
      //terminalContainer = currentTerminalElement;

      this.currentTerminal = index;
      this.rename = this.terminals[index].name;

      /*t = this.terminals[index].terminal;
      while (terminalContainer.children.length) {
        terminalContainer.removeChild(terminalContainer.children[0]);
      }*/
      var theme = {
        foreground: '#000000',
        background: '#ffffff',
        cursor: '#000000',
        cursorAccent: '#ffffff',
        selection: 'rgba(0, 0, 0, 0.3)'
      };
     /* t.open(terminalContainer);
     // t.setOption('theme', theme);
      t.fit();*/
      t.focus();
      
      socketNotifications.send(JSON.stringify({type: 'selected', pid: t.pid}));

      this.removeStatus();
    },
    
    removeStatus: function () {
      item = this.terminals[this.currentTerminal];
      if(item.status!='Running' && item.status != ''){
        item.cmd = item.id;
        item.status = '';
        item.badge = '';
        item.color = '';
        item.colorText = '';
      }
    },

    renameTerminal: function (index) {
      this.terminals[index].name = this.rename;
      this.rename = "";
    },

    removeTerminal: function (index) {
      this.terminals.splice(index, 1);
    },

    stopExecution: function (index) {
      t = this.terminals[index].terminal;
      t.send('\x03');
    },

    setStatus: function (msg) {
      for (i in this.terminals){
        t = this.terminals[i];
        if(t.terminal.pid == msg.interactiveTermPid){
          

          t.cmd = msg.cmd;

          switch(msg.status) {

            case 'running':
                t.status = 'Running';
                t.badge = RUNNING_BADGE;
                t.color = RUNNING_COLOR;
                t.colorText = RUNNING_COLOR + '--text';
                break;
            case 'success':
                t.status = 'Success';
                t.badge = SUCCESS_BADGE;
                t.color = SUCCESS_COLOR;
                t.colorText = SUCCESS_COLOR + '--text';
                break;
            case 'failed':
                t.status = 'Failed';
                t.badge = FAILED_BADGE;
                t.color = FAILED_COLOR;
                t.colorText = FAILED_COLOR + '--text';
                break;

            default:
                console.log('does not match any status: ' + msg.status + '.');
        }

        }
      }
    }

  },
  updated: function () {
    // `this` points to the vm instance

    if(this.terminals.length!=0){
      container = document.getElementById(this.terminals[this.terminals.length - 1].name);
      this.terminals[this.currentTerminal].terminal.open(container);
    }
  }

});



//var terminalContainer = document.getElementById('terminal-container');

//vue.addTerminal(null);

//createTerminal();
//term.focus();



    // actionElements = {
    //   findNext: document.querySelector('#find-next'),
    //   findPrevious: document.querySelector('#find-previous')
    // },
    // optionElements = {
    //   cursorBlink: document.querySelector('#option-cursor-blink'),
    //   cursorStyle: document.querySelector('#option-cursor-style'),
    //   scrollback: document.querySelector('#option-scrollback'),
    //   tabstopwidth: document.querySelector('#option-tabstopwidth'),
    //   bellStyle: document.querySelector('#option-bell-style')
    // },
    // colsElement = document.getElementById('cols'),
    // rowsElement = document.getElementById('rows');

// var colsElementValue;
// var rowsElementValue;

// function setTerminalSize() {
//   var cols = parseInt(colsElementValue, 10);
//   var rows = parseInt(rowsElementValue, 10);
//   var viewportElement = document.querySelector('.xterm-viewport');
//   var scrollBarWidth = viewportElement.offsetWidth - viewportElement.clientWidth;
//   var width = (cols * term.charMeasure.width + 20 /*room for scrollbar*/).toString() + 'px';
//   var height = (rows * term.charMeasure.height).toString() + 'px';

//   terminalContainer.style.width = width;
//   terminalContainer.style.height = height;
//   term.resize(cols, rows);
// }

//colsElement.addEventListener('change', setTerminalSize);
//rowsElement.addEventListener('change', setTerminalSize);

// actionElements.findNext.addEventListener('keypress', function (e) {
//   if (e.key === "Enter") {
//     e.preventDefault();
//     term.findNext(actionElements.findNext.value);
//   }
// });
// actionElements.findPrevious.addEventListener('keypress', function (e) {
//   if (e.key === "Enter") {
//     e.preventDefault();
//     term.findPrevious(actionElements.findPrevious.value);
//   }
// });

// optionElements.cursorBlink.addEventListener('change', function () {
//   term.setOption('cursorBlink', optionElements.cursorBlink.checked);
// });
// optionElements.cursorStyle.addEventListener('change', function () {
//   term.setOption('cursorStyle', optionElements.cursorStyle.value);
// });
// optionElements.bellStyle.addEventListener('change', function () {
//   term.setOption('bellStyle', optionElements.bellStyle.value);
// });
// optionElements.scrollback.addEventListener('change', function () {
//   term.setOption('scrollback', parseInt(optionElements.scrollback.value, 10));
// });
// optionElements.tabstopwidth.addEventListener('change', function () {
//   term.setOption('tabStopWidth', parseInt(optionElements.tabstopwidth.value, 10));
// });



function createTerminal() {
  // Clean terminal  
 /* while (terminalContainer.children.length) {
    terminalContainer.removeChild(terminalContainer.children[0]);
  }*/
  term = new Terminal({
    //cursorBlink: optionElements.cursorBlink.checked,
    //scrollback: parseInt(optionElements.scrollback.value, 10),
    //tabStopWidth: parseInt(optionElements.tabstopwidth.value, 10)
    theme: {
      foreground: '#000000',
      background: '#ffffff',
      cursor: '#000000',
      cursorAccent: '#ffffff',
      selection: 'rgba(0, 0, 0, 0.3)'
    }
  });
  term.on('resize', function (size) {
    if (!pid) {
      return;
    }
    var cols = size.cols,
        rows = size.rows,
        url = '/terminals/' + pid + '/size?cols=' + cols + '&rows=' + rows;

    console.log("fetch resize", url);
    fetch(url, {method: 'POST'});
  });
  protocol = (location.protocol === 'https:') ? 'wss://' : 'ws://';
  baseSocketURL = protocol + location.hostname + ((location.port) ? (':' + location.port) : '') + '/terminals/';

//  term.open(terminalContainer);
  term.fit();

  // fit is called within a setTimeout, cols and rows need this.
  setTimeout(function () {
    // colsElementValue = term.cols;
    // rowsElementValue = term.rows;

    // // Set terminal size again to set the specific dimensions on the demo
    //setTerminalSize();
    console.log('rows', term.rows, 'cols', term.cols);
	
	const regex = /\?pid=([^&]+)/g;

	var params = parseQueryString();
	var pid = parseInt(params["pid"]);
	
	if(pid){
		console.log('URL has PID: '+ pid);
    createSocket(pid);
    term.pid = pid;
	}else{
		console.log('URL has not PID, do FETCH...');
		fetch('/terminals?cols=' + term.cols + '&rows=' + term.rows, {method: 'POST'}).then(function (res) {
		  res.text().then(function (pid) {
      createSocket(pid);
      term.pid = pid;			
		  });
		});
	}
  }, 0);

  window.addEventListener('resize', function() {
    term.fit();
  }, true);

  return term;

}



var parseQueryString = function() {

    var str = window.location.search;
    var objURL = {};

    str.replace(
        new RegExp( "([^?=&]+)(=([^&]*))?", "g" ),
        function( $0, $1, $2, $3 ){
            objURL[ $1 ] = $3;
        }
    );
    return objURL;
};



function createSocket(pid) {
	window.pid = pid;		
	var socketURL = baseSocketURL + pid;
	socket = new WebSocket(socketURL);
	socket.onopen = runRealTerminal;
	socket.onclose = runFakeTerminal;
	socket.onerror = runFakeTerminal;
}

function runRealTerminal() {
  term.attach(cmdSocket || socket);
  term._initialized = true;
}

function runFakeTerminal(e) {
  console.log('error or close', e)
  if (socket && cmdSocket) {
    term.detach(cmdSocket);
    cmdSocket = null;
    socket.send('\r');
    term.focus();
    //term.attach(socket);
  }
  if (term._initialized) {
    return;
  }

  term._initialized = true;

  var shellprompt = '$ ';

  term.prompt = function () {
    term.write('\r\n' + shellprompt);
  };

  term.writeln('Welcome to xterm.js');
  term.writeln('This is a local terminal emulation, without a real terminal in the back-end.');
  term.writeln('Type some keys and commands to play around.');
  term.writeln('');
  term.prompt();

  term.on('key', function (key, ev) {
    var printable = (
      !ev.altKey && !ev.altGraphKey && !ev.ctrlKey && !ev.metaKey
    );

    if (ev.keyCode == 13) {
      term.prompt();
    } else if (ev.keyCode == 8) {
     // Do not delete the prompt
      if (term.x > 2) {
        term.write('\b \b');
      }
    } else if (printable) {
      term.write(key);
    }
  });

  term.on('paste', function (data, ev) {
    term.write(data);
  });


}
