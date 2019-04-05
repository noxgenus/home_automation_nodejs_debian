
// -------------------------------------------------------------------------------
// VWR NODEJS HOME AUTOMATION FOR LINUX BASED SYSTEMS
// V2.1 FOR DEBIAN STRETCH (9)
// -------------------------------------------------------------------------------

const express = require('express');
const app = express();
const server = require('http').createServer(app);
const io = require('socket.io').listen(server);

const path = require('path');

app.use(express.static(path.join(__dirname, 'public')));

app.get('/*', function (req, res) {
    res.sendFile('index.html', {root: path.join(__dirname, 'public')});
});

server.listen(8080); 


// WAKE ON LAN
// -------------------------------------------------------------------------------
const wol = require('wake_on_lan');

//PING UNDER ROOT
// -------------------------------------------------------------------------------
const ping = require('ping');


// SERIALPORT SETUP
// -------------------------------------------------------------------------------

const SerialPort = require('serialport')
const Readline = require('@serialport/parser-readline')
const port = new SerialPort('/dev/ttyUSB0', { 
    baudRate: 9600
    }, function (err) {
      if (err) {
        return console.log(err.message);
      }
    });

const parser = port.pipe(new Readline({ delimiter: '\r\n' }))



// SERIAL PORT RECEIVE
// -------------------------------------------------------------------------------

// OPEN PORT
port.open(function(err) {
  if (err) {
      console.log(err);
      }
});

// CHECK IF OPEN
port.on('open', function() {
  console.log('Port open');
});

// ON INCOMING DATA
parser.on('data', function(data) {
  console.log("Receiving Serial Data: " + data);
    var serialdata = data.toString().split('~');
    var devicetype = serialdata[0];
    var serialid = serialdata[1];
    var serialactive = serialdata[2];
  

// FROM ARDUINO: devicetype~serialid~serialactive
// CURRENT REMOTE DEVICE TYPES:
// - switch
// - gas
// - motion
// - temp

// SEND TO FRONT

  io.sockets.emit('relayCallback', {id: serialid, active: serialactive, type: devicetype});
           

});


// START WEBSOCKET CONNECTIONS
// -------------------------------------------------------------------------------
// -------------------------------------------------------------------------------

io.sockets.on('connection', function (socket) {

    // STATUS CALL TO SERIAL TRANSPONDERS, GET SWITCH STATUS ON CALLBACK

    port.write("status\n", function(err, res) {
      if (err) {
        console.log(err);
        }
    });



// PING WORKSTATION/HOSTS FUNCTIONS
// -------------------------------------------------------------------------------

var pingstatus = {};

function pings(host, id) {

    ping.sys.probe(host, function(isAlive){

// Set initial pinstatus on init

        if ((pingstatus['pingstatus' + id] !== false) && (pingstatus['pingstatus' + id] !== true)) {
          pingstatus['pingstatus' + id] = true;
        }

// Only send relayCallback with active status if pingstatus has changed

        if ((isAlive == true) && (pingstatus['pingstatus' + id] == true)) {
          io.sockets.emit('relayCallback', {id: id, active: 1, type: 'wol'});
          pingstatus['pingstatus' + id] = false;
        } else if ((isAlive == false) && (pingstatus['pingstatus' + id] == false)){
          io.sockets.emit('relayCallback', {id: id, active: 0, type: 'wol'});
          pingstatus['pingstatus' + id] = true;
        }
    });

}


// SET PING INTERVAL FOR ALL CLIENTS (ip, buttonID)

function pingall(){
  pings('10.0.0.30', '1'); // Workstation i7 1
  pings('10.0.0.31', '2');  // Workstation i7 2
  pings('10.0.0.32', '3');  // Workstation i7 3
  pings('10.0.0.2', '4'); // 2nd ROUTER
  pings('10.0.0.4', '5'); // QUAD SERVER
  pings('10.0.0.9', '6'); // NXGCAM
};  

// INTERVAL PING

var pinginterval = setInterval(pingall, 5000);

// PINGHALT FOR WAKEONLAN

function pinghalt(time){
    clearInterval(pinginterval);
    pingstatus = {};
    setTimeout(function(){
      pinginterval = setInterval(pingall, time);
    }, 4000);
}



// STATUS PING WORKSTATIONS

pingall();


// ON CLIENT BUTTON PRESS RECEIVING SOCKET
// -------------------------------------------------------------------------------
// -------------------------------------------------------------------------------

  socket.on('relaycmd', function (data) { 

      var id = data.id;
      var id = id.replace(/wol|local|gas|switch/g, '');
      var type = data.type;
      var wake = data.wake;
      var wake = wake.replace(/-/g, '\:');

      console.log('Relay:' + type + id);




// WAKE ON LAN
// -------------------------------------------------------------------------------

    if (type == 'wol') {
            console.log(wake);
            wol.wake(wake);
            io.sockets.emit('relayCallback', {id: id, active: 3, type: type});
            pinghalt(5000);
         


// SEND TO SERIAL REMOTE HC12 TRANSPONDERS (ONLY ID, ARDUINO WILL CHECK IF HIGH OR LOW)
// -------------------------------------------------------------------------------

    } else if (type == 'switch') {
            write(id + "\n");
            io.sockets.emit('relayCallback', {id: id, active: 4, type: type});
    }
        
        function write(message) {
            console.log("Sending Serial Data: " + message);
            port.write(message, function(err, res) {
              if (err) {
                    console.log(err);
              }
          });
        }



// CLOSE RELAYCMD
   });


// CLOSE SHIT
// -------------------------------------------------------------------------------
// -------------------------------------------------------------------------------

});

console.log("running");


// NODE EXIT HANDLER
// -------------------------------------------------------------------------------
// -------------------------------------------------------------------------------

process.stdin.resume();

function exitHandler(options, err) {
    if (options.cleanup) console.log('clean');
    if (err) console.log(err.stack);
    if (options.exit) process.exit();

}

//do something when app is closing
process.on('exit', exitHandler.bind(null,{cleanup:true}));

//catches ctrl+c event
process.on('SIGINT', exitHandler.bind(null, {exit:true}));

//catches uncaught exceptions
process.on('uncaughtException', exitHandler.bind(null, {exit:true}));
