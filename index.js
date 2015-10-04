/**
 * @fileOverview
 * @name index.js
 * @author Ganioc Yang: <ganioc.yang@gamil.com>
 * @license MIT
 */

var http    = require('http');
var express = require('express');

var cookieParser = require('cookie-parser');
var bodyParser   = require('body-parser');
var errorHandler = require('errorhandler');

// the config file
var config = require('./lib/config');

var app = express();

app.set('trust proxy', true);

app.set('views',__dirname + '/..' + config.PUBLIC_PATH);

app.set('view engine', 'ejs');

app.engine('html', require('ejs').renderFile);

app.use(cookieParser());

app.use(bodyParser.json());

// this is used to decode req.body in POST
app.use(bodyParser.urlencoded({extended: true}));

//
require('./lib/store').init(app);
require('./lib/login')(app);
require('./lib/weixin').init(app);
require('./lib/account')(app);
require('./lib/games')(app);
require('./lib/zone')(app);

app.get('/', function(req, res){
  console.log('into root');
//  res.send('weixin ok');
  res.render(
    'index',
    {
      title: config.WEBSITE_NAME,
      path: config.PUBLIC_PATH

    }
  );
});




// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
  console.log('bad things happened');

    app.use(function(err, req, res, next) {
      console.log(err);
      console.log(typeof err);
      console.log(err.toString());
      res.status(err.status || 500);
      res.render('error', {
	title: config.WEBSITE_NAME + 'dev错误',
	path: config.PUBLIC_PATH,
        message: err.message,
        error: err.toString()

      });
    });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
      title: config.WEBSITE_NAME,
      path: config.PUBLIC_PATH,
      message: err.message,
      error: 'Error 错误'
    });
});


http.createServer(app).listen(config.PORT, '127.0.0.1', function(){
    console.log('Start server, Server running at http://127.0.0.1:' + config.PORT +'/');
  // create a service to check access token and jspi token validity
  require('./lib/weixin').update_token();

});      
                                   

