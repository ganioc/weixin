/**
 * @fileOverview
 * @name articles.js
 * @author Ganioc Yang: <ganioc.yang@gamil.com>
 * @license MIT
 This is used for articles manipulation.

 */
var config = require('./config');
var store = require('./store');
var weixin = require('./weixin');
var db = store.db;
var CallbackFindOne = store.callbackFindOne;
var CallbackFind = store.callbackFind;
var CallbackUpdate = store.callbackUpdate;
var form_template = require('./weixin').form_template;
var CallbackSave = store.callbackSave;

module.exports = function(app){

  app.get('/article/:articleName',function(req,res){
    console.log('into get article');
    var aname = req.params.articleName;
    console.log(aname + ':');
    var viewed_times = 0;

    db.articles.findOne(
      {name:aname},
      CallbackFindOne(
	function(doc){
	  viewed_times = doc.viewed;
	  db.articles.update(
	    {name:aname },
	    {$inc:{viewed:1}},
	    CallbackUpdate(function(){
	      db.comments.find(
		{ article_name:aname},
		CallbackFind(
		  function(doc){
		    for(var i=0; i< doc.length;i++){
		      var temp = doc[i].date;
		      doc[i].date = temp.getFullYear() +'-' + temp.getMonth() +'-'+ temp.getDay() +' ' +  temp.getHours() + ':' + temp.getMinutes();
		    }

		    var user;
		    if(req.session.user){
		      user = req.session.user;
		    }else{
		      user = undefined;
		    }

		    res.render(
		      'articles/' + aname,
		      form_template({
			comments: doc,
			user: user,
			name: aname,
			viewed: viewed_times
		      })
		    );
		  },
		  function(){
		    res.render(
		      'error',
		      form_template(
			{error:'未发现此文章:' + aname,
			 message:'数据库中未搜索到此文章'
			})
		    );
		  }
		)
	      );

	    })
	  );
	}
      )
    );




  });

  //
  app.post('/article/comment',function(req,res){
    console.log('into article/comment');
    console.log(req.body);

    if(req.session.user){
      var data = {};
      data.article_name = req.body.name;
      data.user_name = req.session.user.nickname;
      data.user_avatar = req.session.user.headimgurl;
      data.content = req.body.comment;
      data.openid = req.session.user.openid;
      data.date = new Date();
      
      db.comments.save(data,
		       CallbackSave(function(){
			 console.log('/article/' + req.body.name);
			 res.json({ok:1,
				  redirect:'/article/' + req.body.name});
			 // You can not redirect a post Ajax
			 //res.redirect('/article/' + req.body.name);
		       })
		      );
      //console.log(data);

    }else{
      console.log('Should never happen');
      res.json({'Nok':1});
    }

  });

  app.get('/message/login',function(req,res){
    console.log('into message/login');

    var name = req.query.name;
    var subname = req.query.subname;

    console.log(name  + ' ' + subname);

    weixin.oauth2_login(req, res, '/message/auth' + '/' + name +'/' + subname);

    //res.json({ok:'1'});
  });

};
