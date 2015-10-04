/**
 * @fileOverview
 * @name games.js
 * @author Ganioc Yang: <ganioc.yang@gamil.com>
 * @license MIT
 This is for games patching update and fetching
 */

var config= require('./config');

var store = require('./store');
var db = store.db;
var CallbackFindOne = store.callbackFindOne;
var CallbackUpdate = store.callbackUpdate;

function form_template(opt){
  var obj = {};
  obj.title = config.WEBSITE_NAME;
  obj.path = config.PUBLIC_PATH;
  
  for(var key in opt){
    obj[key] = opt[key];
  }
  
  return obj;
}

function handler_game(req,res, name){

  //找到了一个游戏
  return function(err, doc){
    if(err) throw err;

    var gameName = name;
    if(doc){
      // 根据游戏名称，找到用户 patch
      get_user_patches(req,res,gameName,function(patches){
	var lst = doc;//游戏信息
	
	if(patches){
	  for(var i in lst.patches){
	    for(var j in patches){
	      if(lst.patches[i].name === patches[j].patch_name){
		//用户的patch,如果用户patch不存在呢
		lst.patches[i].user_patch = patches[j];
		continue;
	      }
	    }
	  }
	}//如果首次使用用户patch为空的话 user_patch不存在
	else{
	  ;
	}
	console.log('print link');
	console.log(get_publish_link(req.session.user,gameName));
	res.render(
	  'game-setting',
	  form_template({game: lst, user:req.session.user,
			publish_link: get_publish_link(req.session.user, gameName)})
	);

      });
    }
    else{
      res.render(
	'error',
	form_template(
	  {error:'未发现此游戏:' + name,
	   message:'数据库中未搜索到此游戏'
	  })
      );
    }
  };
}
function get_user_patches_not_logged(openid, res, gameName,callback){
    db.users.findOne(
    {openid: openid},
    { 'games':1},
    CallbackFindOne(function(doc){
      var l =[];
      for( var i in doc.games){
    	if(doc.games[i].name === gameName){
    	  l.push(doc.games[i]);
    	}
      }
      callback(l);
    })
    );  

}
function get_user_patches(req,res,gname,callback){

  get_user_patches_not_logged( req.session.user.openid,res,gname, callback);

}

function get_user_game(req,res){
  
  if( 'name' in req.query){
    // put the name into users games[]
    db.games.findOne(
      { name:req.query.name},
      handler_game(req, res, req.query.name)
    );
  }
  else{
    // there is no game name in url
    res.render(
      'error',
      form_template(
	{error:'url中没有游戏名',
	 message:'请确认正确的url格式'
	})
    );
  }
}
function transform_date(date){
  return date.getFullYear()
    + '-' 
    + date.getMonth()
    + '-'
    + date.getDay()
    + ' '
    + date.getHours()
    + ':'
    + date.getMinutes();
}

function get_publish_link( user, gameName){
  var url = config.SITE_NAME + config.GAME_PUBLISH_PATH;
  url += user.openid;
  url += '/' + gameName;

  return url;
}
/**
 * 
 * @param {} req
 * @param {} res
 * @param {} data
 * @throws {} 
 */
function save_game_patch(req,res,data){
  var gameName = data.game_name,
      patchName = data.patch_name;
  var date = new Date();

  console.log('data is:');
  console.log(data);

  // 这里可能会有很严重的问题，如果用户并没有games数据的话
  // 访问不存在的东西，程序崩溃!
  // 目前我在首次用户登录的时候，为用户增加 games:[]
  db.users.update(
    { openid: req.session.user.openid,
      'games.name':data.game_name,
      'games.patch_name': data.patch_name
    },
    { $set:
      { 
	'games.$.ad_text' : data.ad_text,
	'games.$.ad_link' : data.ad_link,
	'games.$.ad_image': data.ad_image,
	'games.$.date'    : date
      } 
    },
    function(err, doc){
      if(err) throw err;

      console.log("doc is:");
      console.log(doc);

      var publishLink = get_publish_link(req.session.user, data.game_name);
      console.log(publishLink);

      if(doc.nModified !== 0){
	res.json({publish_link: publishLink,
		 date: transform_date(date)

		 });
      }
      else{
	db.users.update(
	  { openid: req.session.user.openid  },
	  { $push:
	    {
	      games:{
		name: data.game_name,
		patch_name: data.patch_name,
		ad_text :data.ad_text,
		ad_link: data.ad_link,
		ad_image: data.ad_image,
		date: date
	      }
	    }
	  },
	  CallbackUpdate(
	    function(doc){
	      res.json({publish_link: publishLink,
	  		date: transform_date(date)
	  	       });
	    },
	    function(){
	      res.josn({});
	    }
	  )
	);
      }
    }
  );
}


module.exports = function(app){

  app.get('/game/setting',function(req,res){
    console.log('into /game/setting');
    
    if(req.session.user){
      get_user_game(req, res);
    }
    else{
      // What does #normal-user mean?
      res.redirect('/#normal-user');
    }
  });

  app.post('/game/patch', function(req,res){
    console.log('into /game/patch');
    var data = req.body;

    save_game_patch(req,res,data);
  });

  // deliver the game to non logged in users
  app.get('/game/publish/:id/:game',function(req,res){
    // 不需要登录用户
    // 在哪里纪录访问次数呢？
    // 专门做一个数据纪录
    var userId = req.params.id;
    var gameName = req.params.game;
    console.log(userId);
    console.log(gameName);
    //get game path
    //不需要专门去找，使用game的名称就可以了,暂时

    // get game patches
    get_user_patches_not_logged(userId, res, gameName, function(patches){
      var lst = {};
      console.log('back to patches handling');
      console.log('patches are:');
      console.log(patches);
      for( var i=0; i< patches.length; i++){
	var prefix = patches[i].patch_name;

	lst[prefix + '_ad_text'] = patches[i].ad_text ||'';

	lst[prefix + '_ad_link'] = patches[i].ad_link || '';

      }
      console.log('out of patches surfing');
      console.log(lst);

      lst.path = config.PUBLIC_PATH + 'games/' + gameName + '/';
      
      res.render(
	'games/' + gameName + '/index',
	lst
      );
    });

  });
};










