var config = require('./config');
var LocalStrategy = require('passport-local').Strategy;
var passport = require('passport');
var db = require('./store').db;
var flash = require('connect-flash');

passport.serializeUser(function(user, done){
  console.log('in serializeuser');
  //console.log(user);
  // it's all user info
  done(null, user);

});
passport.deserializeUser(function(obj, done){
  console.log('in deserializeUser');
  // it's all user info
  // console.log(obj);
  done(null, obj);

})
;
passport.use(new LocalStrategy(
  {
    passReqToCallback: true
  },

  function(req,username, password, done) {

    db.users.findOne(
      { displayName: username, provider:'boxshell' }, 
      function(err, user) {
	if (err) { return done(err); }
	
	if (!user) {
          return done(null, false,  req.flash('message','用户名不存在.')  );
	}
	if (user.password !== password) {
          return done(null, false, req.flash(  'message', '密码不正确.') );
	}
	return done(null, user);
      });
  }
)
);

module.exports=function(app){
  app.use(passport.initialize());
  app.use(passport.session());
  app.use(flash());

};
