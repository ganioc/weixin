var mongojs = require('mongojs');

var collections = ['users','games','codes'];

var db = mongojs('weixin2015', collections);

db.on('error', function (err) {
    console.log('weixin2015 database error', err);
});

db.on('ready', function () {
    console.log('weixin2015 database connected');
});

// for session
var expressSession = require('express-session');

// only for session storage
var MongoStore = require('connect-mongo')(expressSession);

var optionsMongo = {
  db: 'weixin2015',
  host: '127.0.0.1',
  port: 27017,
  ttl: 7 * 24 * 60 * 60// 1 day time expire
};



module.exports= {

  init: function(app)
  {

    app.use( expressSession(
      {
	secret: 'foo123456789',
	store: new MongoStore(optionsMongo),
	proxy: true,
	resave: true,
	saveUninitialized: true
      }
    ));
  },
  db:db

 };
