// web.js
var express = require("express");
var logfmt = require("logfmt");
var app = express();
//var app = require('express')();
var url = require('url');
var bodyParser = require('body-parser');

var apn = require('apn');

mongojs = require("mongojs")

var mongoDbUri = "mongodb://nodejitsu:7099899734d1037edc30bc5b2a90ca84@troup.mongohq.com:10043/nodejitsudb1189483832";
var collections = ["users", "kt_qrcode", "kt_ownership", "kt_message", "kt_convo", "kt_token", "kt_qrcodes", "kt_follow"]

//socket start

//users currently connected

var clients = {};

var http = require('http').Server(app);
var server = app.listen(3000);
var io = require('socket.io').listen(server);
//var io = require('socket.io')(3000);

io.on('connection', function (socket) {
  console.log('a user connected');
  var db = mongojs.connect(mongoDbUri, collections);

  var userName;
  var userFBID;


  socket.on('setChat', function(fID, fname, tID, tname) {
    userName = fname;
    userFBID = fID;
    clients[userFBID] = socket;
    console.log('chat between (' + fname + ') ' + fID + ' and (' + tname + ') ' + tID);
  db.kt_message.find({$or: [{fID: fID, tID: tID}, {fID: tID, tID: fID}]}, function(err, records) {
    if (err) {
      console.log("error in finding chat");
    } else {
      if (records.length == 0) {
        console.log("no chat records found");
      } else {
        var messages = [];
        for (var i = 0; i < records.length; i++) {
          var msgg = records[i].msg;
          var element = {
            mssg:  records[i].msg,
            fID: records[i].fID,
           // fname: records[i].fname,
            tID: records[i].tID,
           //tname: records[i].tname,
            date: records[i].date
          }
          messages.push(msgg);
        }
        console.log("chat found");
        //io.emit('setChat', 'chat found between ' + fname + ' and ' + tname);
        //io.emit('loadChat', records);
          for (var i = messages.length - 1; i >= messages.length - 10; i--) {
            io.emit('setChat', (messages[i]));
          }
      }
    }
  });
    io.emit(fID + fname);
  });

  socket.on('pm', function(msg, fname, fID, tname, tID) {
    var userSocket = clients[tID];
    db.kt_message.save({msg: msg, fname: fname, fID: fID, tname: tname, tID: tID, date: Date.now()}, function(err, saved) {
      if (err) {
        console.log("error saving msg");
      } else {
        console.log("success saving msg");
      }
    });
    console.log(fname + ' says ' + msg + ' to ' + tname);
    io.emit('setChat', msg);
    //userSocket.emit(fname + ' says ' + msg + ' to ' + tname);
  });

  //socket.emit('join', socket['id']);
  //console.log(socket['id'] + ' has connected!');


  //socket.on('register', function(data) {
  //  clients[data.fbid] = socket.id;
  //});

  //socket.on('location', function (data) {
    //socket.emit('update', (socket['id'] + ':' + data));
    //console.log("data:" + data);
//});

  socket.on('disconnect', function() {
    console.log('user disconnected');
    //socket.emit('disappear', socket['id']);
    console.log(socket['id'] + ' has disconnected!');
  });
  socket.on('chat message', function(msg, from, to) {
    console.log(from + ' says: ' + msg + ' to ' + to);
    io.emit('chat message', from + ": " + msg);
  });
});

//socket end


app.use(logfmt.requestLogger());
app.use(bodyParser.json());

//app.get('/', function(req, res) {
//  res.send('Hello World!!');
//});

app.get('/', function(req, res) {
  //res.send('<h1>Hello World</h1>');
  res.sendFile(__dirname + '/index.html');
});

app.post('/login', function(req, res) {
  var query = req.body;
  var facebookid = query.facebookid; // the user's facebook id
  var username = query.username; // the user's name
  //console.log("/login, facebookid is " + facebookid + " :: username is " + username);
  var db = mongojs.connect(mongoDbUri , collections);
  res.setHeader('Content-Type', 'application/json');

  db.users.find({facebookid: facebookid, username: username}, function(err, records) {
    if (err) {
      //console.log ("/login, user couldn't be found");
      res.end(JSON.stringify({success: false}), null, 3);
    } else {
      if (records.length == 0) {
        // they weren't found in the db, so add them
        db.users.save({facebookid: facebookid, username: username}, function(err, saved) {
          if( err || !saved ) {
            //console.log("User not saved");
            res.end(JSON.stringify({success: false}), null, 3);
          } else {
            //console.log("/login, New User saved");
            res.end(JSON.stringify({success: true, user_id: saved._id}), null, 3);
          }
        });
      } else {
        // there was a record of the user, just return their information (user_id)
        var user_id = records[0]._id;
        //console.log("/login, existing user, returning their user id " + user_id);
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({success: true, user_id: user_id}), null, 3);
      }
    }
  });

});

app.post('/follow', function(req, res) {
  var query = req.body;
  var userid  = query.userID;
  var db = mongojs.connect(mongoDbUri, collections);
  res.setHeader('Content-Type', 'application/json');

  db.createCollection(userid + ':followers', function(err,collections) {
    if (err) throw err;

    //console.log("create collection " + userid);
    //console.log(collection);
  });

  db.createCollection(userid + ':following', function(err, collections) {
    if (err) throw err;
  });

});

app.post('/token', function(req, res) {
	//console.log("POST:/token");
	var query = req.body;
	var token = query.token;
	var facebookid = query.facebookid;
	var username = query.username;
	var badgenum = query.badgenum;
	var db = mongojs.connect(mongoDbUri, collections);

	res.setHeader('Content-Type', 'application/json');
	db.kt_token.find({facebookid: facebookid}, function(err, records) {
		if (err) {
			res.end(JSON.stringify({success: false}), null, 3);
		} else {
			if (records.length == 0) {
				db.kt_token.save({facebookid: facebookid, token: token, username: username, badgenum: badgenum}, function(err, saved) {
					if (err || !saved) {
						res.end(JSON.stringify({success: false}), null, 3);
					} else {
						res.end(JSON.stringify({success: true}), null, 3);
					}
				});
			} else {
				db.kt_token.update({facebookid: facebookid}, {facebookid: facebookid, token: token, username: username, badgenum: badgenum}, function(err, saved) {
					if (err || !saved) {
						res.end(JSON.stringify({success: false}), null, 3);
					} else {
						res.end(JSON.stringify({success: true}), null, 3);
					}
				});
			}
		}
	});
});


app.get('/kandi', function(req, res) {
  //console.log ("GET:/kandi");
  var query = req.body;
  var qrcode_id = query.qrcode_id;
  var user_id = query.user_id;
  var create_at = query.create_at;
  var original_create_at = query.original_create_at;
  var db = mongojs.connect(mongoDbUri , collections);

  db.kt_qrcode.find({"userId": userId}, function(err, records) {
    if (err) {
      //console.log(err);
      res.end();
    } else if (records.length > 0) {
      // todo ; send back kt_qrcode properties
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({user_id: user_id}), null, 3);
    }
  });

});

app.post('/qrcodes', function(req, res) {
  var query = req.body;
  var qrcode = query.qrcode;
  var user_id = query.user_id;
  var username = query.username;
  var db = mongojs.connect(mongoDbUri, collections);
  res.setHeader('Content-Type', 'application/json');

  db.kt_qrcodes.find({qrcode: qrcode}, function(err, records) {
    if (err) {
      console.log("error in finding qrcode");
    } else {
      if (records.length == 0) {
        db.kt_qrcodes.save({qrcode: qrcode, user_id: user_id, user_name: username}, function(err, saved) {
          if (err || !saved) {
            console.log("error in save");
          } else {
            res.end(JSON.stringify({success: true}), null, 3);
          }
        });
      }
      else {
        var userID = records[0].user_id;
          if (userID == user_id) {
            res.end(JSON.stringify({success: false, already_owned: true}), null, 3);
          }
          else {
            db.kt_follow.find({qrcode: qrcode}, function(err, records) {
              if (err) {
                console.log("error in kt_follow finding");
              } else {
                if (records.length == 0) {
                  db.kt_follow.save({qrcode: qrcode, user_id: user_id, user_name: username}, function(err, saved) {
                    if (err || !saved) {
                      console.log("error in saving to following");
                    } else {
                      res.end(JSON.stringify({success: true}), null, 3);
                    }
                  });
                } else {
                  res.end(JSON.stringify({success: false, already_owned: true}), null, 3);
                }
              }
            });
        }
      }
    }
  });

});

app.post('/qr', function(req, res) {
  //console.log ("POST:/qr");
  var query = req.body;
  var qrcode = query.qrcode;
  var user_id = query.user_id;
  var username = query.username;
  var db = mongojs.connect(mongoDbUri , collections);

  var options = {
	"cert": 'cert.pem',
	"key": 'key.pem',
	"production": false,
	};
	var apnConnection = new apn.Connection(options);

  res.setHeader('Content-Type', 'application/json');
  db.kt_qrcode.find({"qrcode": qrcode}, function(err, records) {
    if (err) {
      //console.log("1" = err);
      res.end(JSON.stringify({success: false, error: "qrcode wasn't saved. had error trying to find"}), null, 3);
    } else {
      if (records.length == 0) {
        // qr code doesn't exist in database yet
        db.kt_qrcode.save({qrcode: qrcode, user_id: user_id}, function(err, saved) {
          if( err || !saved ) {
            //console.log("2 qrcode was not saved");
            res.end(JSON.stringify({success: false, error: "qrcode wasn't saved. had error saving"}), null, 3);
          } else {
            // qr code was saved into to kt_qrcode table
            // so it definitely doesn't exist in kt_ownership table
            // placement is from {0,1,2,3,4}, with 0 being the original ownership of the qrcode
            var qrCodeId = saved._id;
            db.kt_ownership.save({qrcode_id: qrCodeId, user_id: user_id, placement: 0}, function(err, saved) {
              //console.log("qr code was saved into ownership table");
              res.end(JSON.stringify({success: true, qrcode_id: qrCodeId, qrcode: qrcode, user_id: user_id, placement: 0, ownership_id: saved._id}), null, 3);
            });
          }
        });

      } else {
        // qr code already exists in database, we just need to add to the kt_ownership table now
        var existingQrCode = records [0];
        db.kt_ownership.find({qrcode_id: existingQrCode._id}, function (err, records) {
          if (err) {
            res.end(JSON.stringify({error: "qrcode wasn't saved. had error trying to find in kt_ownership table"}), null, 3);
          } else {
            var dbCount = records.length;
            var dbCountminusOne = (dbCount-1);
            var followingCollection = user_id + ':following';
            console.log("currentPlacement: " + dbCount);
            console.log("previousPlacement: " + dbCountminusOne);
            if (dbCount >= 2) {
              // there's already been 5 max qr references in the kt_ownership table
              res.end(JSON.stringify({success: false, limit_reached: true}), null, 3);
            } else {
              // there's room to add more to the qrcode table
              // example: if there's 1 qrcode in the ownership table, the length of db count is 1
              // while that qrcode will have a placement of 0, so the placement should always be the length of dbCount
              db.kt_ownership.find({qrcode_id: existingQrCode._id, user_id: user_id}, function(err, records) {
                if (err) {
                  res.end(JSON.stringify({success: false, error: "error finding someone in kt_ownership"}), null, 3);
                } else {
                  if (records.length != 0) {
                    //console.log("qr code was not saved into ownership table because it already exists");
                    res.end(JSON.stringify({success: false, already_owned: true}), null, 3);
                  } else {
                    var placement = dbCount;
                    db.kt_ownership.save({qrcode_id: existingQrCode._id, user_id: user_id, placement: placement}, function(err, saved) {
                      //console.log("qr code was saved into ownership table");

                      db.kt_qrcode.find({qrcode: qrcode}, function(err, records) {
                        if (err) {
                          console.log("error");
                        } else {
                          var otherUser = records[0].user_id;
                          var followersCollection = otherUser + ':followers';
                          db.followersCollection.find({follower: user_id}, function(err, records) {
                            if (err) {
                              console.log("error in finding follower");
                            } else {
                              if (records.length == 0) {
                                db.followersCollection.save({follower: user_id}, function(err, saved) {
                                  if (err) {
                                    console.log("error saving follower");
                                  } else {
                                    console.log("saved new follower: " + user_id);
                                  }
                                });
                              }
                            }
                          });
                          db.followingCollection.find({following: otherUser}, function(err, records) {
                            if (err) {
                              console.log("error in finding following");
                            } else {
                              if (records.length == 0) {
                                db.followingCollection.save({following: otherUser}, function(err, saved) {
                                  if (err) {
                                    console.log("error saving following");
                                  } else {
                                    console.log("saved new following: " + otherUser);
                                  }
                                });
                              }
                            }
                          });
                        }
                      });

                      db.kt_ownership.find({qrcode_id: existingQrCode._id, placement: dbCountminusOne}, function(err, rec) {
                      	if (err) {
                      		console.log("error");
                      	} else {
                      		var user = rec[0].user_id;
                      		db.users.find({_id: mongojs.ObjectId(user)}, function(err, recc) {
                      			if (err) {
                      				console.log("another error");
                      			} else {
                      				var fbidpush = recc[0].facebookid;

                      				db.kt_token.find({facebookid: fbidpush}, function(err, records) {
			               							if (err) {
				              					   	console.log("error finding push token");
					             						} else {
								              				var token = records[0].token;
											               	//var name = records[0].username;
										              		var badgenum = records[0].badgenum;
										              		var myDevice = new apn.Device(token);
									             				var note = new apn.Notification();
									             				note.badge =  badgenum + 1;
									             				//console.log("total badge count = " + note.badge);
											             		note.sound = "ping.aiff";
									             				note.alert = username + " is now following you";
											             		note.payload = {'KandiTransferFrom': username};
										            			apnConnection.pushNotification(note, myDevice);
								            			}
								          		});
                      			}
                      		});
                      	}
                      });

                      res.end(JSON.stringify({success: true, qrcode_id: existingQrCode._id, qrcode: qrcode, user_id: user_id, placement: placement, ownership_id: saved._id}), null, 3);
                    });

                  }
                }
              });

            }
          }
        });
      }
    }
  });
});


app.post('/followers', function(req, res) {
  var query = req.body;
  var user_id = query.user_id;
  var db = mongojs.connect(mongoDbUri, collections);
  res.setHeader('Content-Type', 'application/json');

  db.kt_qrcode.find({user_id: user_id}, function(err, records) {
    if (err) {
      console.log("error in find");
    } else {
      var length = records.length;
      if (length == 0) {
        res.end(JSON.stringify({success: false, error: "no followers"}), null, 3);
      } else {
        var results = [];
        var length = records.length;
        findFollowersSeries (0, length, records, db, results, function() {
          res.end(JSON.stringify({success: true, results: results}));
        });
      }
    }
  });
});

function findFollowersSeries (currentIndex, recordsLength, records, db, results, callback) {
  if (currentIndex < recordsLength) {
    item = records[currentIndex];
    if (item) {
      findIfFollower (item, db, function(result) {
        results.push (result);
        currentIndex = currentIndex + 1;
        findFollowersSeries (currentIndex, recordsLength, records, db, results, callback);
      });
    } else {
      callback();
    }
  } else {
    callback();
  }
}

function findIfFollower (item, db, callback) {
  if (!item)
    return;

  db.kt_ownership.find({qrcode_id: item._id}, function(err, docs) {
    if (err) {
      return;
    }

    var length = docs.length;
    for (var i = 0; i < length; i ++) {
      var ownershipRow = docs[i];
      var userID = ownershipRow.user_id;
      db.users.find({_id: mongojs.ObjectId(userID)}, function(err, recs) {
        if (err) {
          console.log("error");
        } else {
          if (recs.length > 0) {
            user = recs[0];
            result = {
              follower: {
                user_id: user._id,
              }
            }
            callback(result);
          }
        }
      });
    }
  });
}

app.post('/following', function(req, res) {
  var query = req.body;
  var user_id = query.user_id;
  var db = mongojs.connect(mongoDbUri, collections);
  res.setHeader('Content-Type', 'application/json');

  db.kt_ownership.find({user_id: user_id, placement: 1}, function(err, records) {
    if (err) {
      console.log("error in find");
    } else {
      var length = records.length;
      if (length == 0) {
        res.end(JSON.stringify({success: false, error: "no followers"}), null, 3);
      } else {
        var results = [];
        var length = records.length;
        findFollowingSeries (0, length, records, db, results, function() {
          res.end(JSON.stringify({success: true, results: results}));
        });
      }
    }
  });
});

function findFollowingSeries (currentIndex, recordsLength, records, db, results, callback) {
  if (currentIndex < recordsLength) {
    item = records[currentIndex];
    if (item) {
      findIfFollowing (item, db, function(result) {
        results.push (result);
        currentIndex = currentIndex + 1;
        findFollowingSeries (currentIndex, recordsLength, records, db, results, callback);
      });
    } else {
      callback();
    }
  } else {
    callback();
  }
}

function findIfFollowing (item, db, callback) {
  if (!item)
    return;

  db.kt_ownership.find({qrcode_id: item.qrcode_id, placement: 0}, function(err, docs) {
    if (err) {
      return;
    }

    var length = docs.length;
    for (var i = 0; i < length; i ++) {
      var ownershipRow = docs[i];
      var userID = ownershipRow.user_id;
      db.users.find({_id: mongojs.ObjectId(userID)}, function(err, recs) {
        if (err) {
          console.log("error");
        } else {
          if (recs.length > 0) {
            user = recs[0];
            result = {
              follower: {
                user_id: user._id,
              }
            }
            callback(result);
          }
        }
      });
    }
  });
}

app.get('/test_HEADERS', function(req, res) {
  //console.log('HEADERS: ' + JSON.stringify(res.headers));
  var query = req.query;
  //console.log('--------------------------------------');
  var resultStr = 'START:\n' 
           + ' app_id= ' + query.app_id + ' \n'
           + ' app_token= ' + query.app_token + ' \n'
           + ' app_name= ' + query.app_name + ' \n'
           + ' app_store= ' + query.app_store + ' \n'
           + ' tracker= ' + query.tracker + ' \n'
           + ' tracker_name= ' + query.tracker_name + ' \n'
           + ' fb_campaign_name= ' + query.fb_campaign_name + ' \n'
           + ' fb_campaign_id= ' + query.fb_campaign_id + ' \n'
           + ' fb_adgroup_name= ' + query.fb_adgroup_name + ' \n'
           + ' fb_adgroup_id= ' + query.fb_adgroup_id + ' \n'
           + ' network_name= ' + query.network_name + ' \n'
           + ' campaign_name= ' + query.campaign_name + ' \n'
           + ' adgroup_name= ' + query.adgroup_name + ' \n'
           + ' creative_name= ' + query.creative_name + ' \n'
           + ' is_iad= ' + query.is_iad + ' \n'
           + ' adid= ' + query.adid + ' \n'
           + ' idfa= ' + query.idfa + ' \n'
           + ' android_id= ' + query.android_id + ' \n'
           + ' mac_sha1= ' + query.mac_sha1 + ' \n'
           + ' mac_md5= ' + query.mac_md5 + ' \n'
           + ' idfa||android_id= ' + query.idfa_or_android_id + ' \n'
           + ' idfa_md5= ' + query.idfa_md5 + ' \n'
           + ' idfa_md5_hex= ' + query.idfa_md5_hex + ' \n'
           + ' idfa_upper= ' + query.idfa_upper + ' \n'
           + ' idfv= ' + query.idfv + ' \n'
           + ' gps_adid= ' + query.gps_adid + ' \n'
           + ' reftag= ' + query.reftag + ' \n'
           + ' ip_address= ' + query.ip_address + ' \n'
           + ' created_at= ' + query.created_at + ' \n'
           + ' click_time= ' + query.click_time + ' \n'
           + ' installed_at= ' + query.installed_at + ' \n'
           + ' country= ' + query.country + ' \n'
           + ' device_name= ' + query.device_name + ' \n'
           + ' os_name= ' + query.os_name + ' \n'
           + ' os_version= ' + query.os_version + ' \n'
           + ' session_count= ' + query.session_count + ' \n'
           + ' event= ' + query.event + ' \n'
           + ' revenue= ' + query.revenue + ' \n'
           + ' friend_code= ' + query.friend_code + ' \n'
           + ' END\n------------------------------------------------';

  res.send(resultStr);
  //console.log(resultStr)
})


app.get('/test_DB', function(req, res) {
  //res.writeHead(200, {"Content-Type": "text/html"});
  //res.send("db");

  var collections = ["users", "tags"]
  var db = mongojs.connect(mongoDbUri, collections);

  db.users.find({sex: "female"}, function(err, users) {
    if( err || !users) console.log("No female users found");
    else users.forEach( function(femaleUser) {
      //console.log(femaleUser);
    });
  });

  db.users.save({email: "srirangan@gmail.com", password: "iLoveMongo", sex: "male"}, function(err, saved) {
    if( err || !saved ) console.log("User not saved");
    else console.log("User saved");
  });

  db.users.update({email: "srirangan@gmail.com"}, {$set: {password: "iReallyLoveMongo"}}, function(err, updated) {
    if( err || !updated ) console.log("User not updated");
    else console.log("User updated");
    res.send("UPDATED");
    res.end();
  });

});

app.post('/originaltags', function(req, res) {
  //console.log("POST/originaltags")
  var query = req.body;
  var user_id = query.user_id;

  var db = mongojs.connect(mongoDbUri , collections);
  res.setHeader('Content-Type', 'application/json');

  db.kt_ownership.find({user_id: user_id, placement: 0}, function(err, records) {
    if (err) {
        res.end(JSON.stringify({success: false, error: "originaltags, error in find"}), null, 3);
    } else {
      var length = records.length;
      if (length == 0) {
        res.end(JSON.stringify({success: false, error: "originaltags, doesn't have tag in db"}), null, 3);
      } else {
        var results = [];
        var length = records.length;
        //console.log("/originaltags:else:length:" + length);
        findCurrentOwnerSeries (0, length, records, db, results, function() {
          res.end(JSON.stringify({success: true, results: results}));
        });
      }
    }

  });

});

// callback
// has acess to records, results
function findCurrentOwnerSeries (currentIndex, recordsLength, records, db, results, callback) {
  if (currentIndex < recordsLength) {
    //console.log("findCurrentOwnerSeries-index:" + currentIndex);
    item = records[currentIndex];
    if (item) {
      findIfOriginal (item, db, function(result) {
        //console.log ("findCurrentOwnerSeries-findIfOriginal-callback");
        results.push (result);
        currentIndex = currentIndex + 1;
        findCurrentOwnerSeries (currentIndex, recordsLength, records, db, results, callback);
      });
    } else {
      callback();
    }
  } else {
    callback();
  }
}

function findIfOriginal(tag, db, callback) {
  if (!tag)
    return;

  db.kt_ownership.find({qrcode_id: tag.qrcode_id}, function(err, records) {
    if (err) {
      //console.log ("findIfOriginal:" + err);
      return;
    } 

    var length = records.length;
    for (i = 0; i<length; i++) {
      var ownershipRow = records[i];
      if (ownershipRow.placement == (length - 1)) {

        var user_id = ownershipRow.user_id;
        db.users.find({_id: mongojs.ObjectId (user_id)}, function(err, records) {
          if (err) {
            console.log ("db.users.find-error-" + err);
          } else {
            if (records.length > 0) {
              user = records[0];
              result = {
                original: {
                  qrcode_id: tag.qrcode_id,
                  user_id: tag.user_id,
                  placement: tag.placement,
                  ownership_id: tag._id
                },
                current: {
                  qrcode_id: tag.qrcode_id,
                  user_id: user._id,
                  user_name: user.username,
                  facebookid: user.facebookid,
                }
              }
              callback(result);
            } else { /* error */ }
          }
        });
      }
    }
  });

}


app.post('/currenttags', function(req, res) {
  //console.log("POST/currenttags")
  var query = req.body;
  var user_id = query.user_id;

  var db = mongojs.connect(mongoDbUri , collections);
  res.setHeader('Content-Type', 'application/json');

  db.kt_ownership.find({$or: [{user_id: user_id, placement: 1}, {user_id: user_id, placement: 2}, {user_id: user_id, placement: 3}, {user_id: user_id, placement: 4}, {user_id: user_id, placement: 5}]}
, function(err, records) {
    if (err) {
        res.end(JSON.stringify({success: false, error: "currenttags, error in find"}), null, 3);
    } else {
      if (length == 0) {
        res.end(JSON.stringify({success: false, error: "currenttags, doesn't have tag in db"}), null, 3);
      } else {
        var results = [];
        var length = records.length;
        //console.log("/currenttags:else:length:" + length);
        getTagsWhereCurrentOwnerSeries(0, length, records, db, results, function() {
          var prevUsersResults = [];
          var length = results.length;
          getPreviousUsersOfCurrentTags (0, length, results, db, prevUsersResults, function() {
            res.end(JSON.stringify({success: true, results: prevUsersResults}));
          });
        });
      }

    }
  });

});

function getPreviousUsersOfCurrentTags (currentIndex, recordsLength, records, db, results, callback) {
  if (currentIndex < recordsLength) {
    //console.log("getPreviousUsersOfCurrentTags-index:" + currentIndex);
    item = records[currentIndex];
    if (item) {
      findPreviousUser(item, db, function(result) {
        results.push(result);
        currentIndex = currentIndex + 1;
        getPreviousUsersOfCurrentTags (currentIndex, recordsLength, records, db, results, callback);
      });
    } else {
      callback();
    }
  } else {
    callback();
  }
}

function findPreviousUser(tag, db, callback) {
  if (!tag)
    return;

  if (tag.placement == 0) {
    // no previous user
    db.users.find({_id: mongojs.ObjectId(tag.user_id)}, function(err, records) {
      if (err) {
        //console.log("findPreviousUser;place==0;err:"+ err);
        return;
      } else {
        if (records.length > 0) {
          user = records[0];
          result = {
            original: {
              qrcode_id: tag.qrcode_id,
              user_id: tag.user_id,
              placement: tag.placement,
              ownership_id: tag._id
            },
            current: {
              qrcode_id: tag.qrcode_id,
              user_id: user._id,
              user_name: user.username,
              facebookid: user.facebookid,
            }
          }
          callback(result);
        } else {

        }
      }

    });
  }

  db.kt_ownership.find({qrcode_id: tag.qrcode_id, placement: tag.placement-1}, function(err, records) {
    if (err) {
      //console.log("findPreviousUser:place!=0;err:" + err);
    } else {
      if (records.length > 0) {
        ownershipRec = records[0];
        // copy paste of above

        db.users.find({_id: mongojs.ObjectId(ownershipRec.user_id)}, function(err, records) {
          if (err) {
            //console.log("findPreviousUser;place=!0;err:"+ err);
            return;
          } else {
            if (records.length > 0) {
              user = records[0];
              result = {
                original: {
                  qrcode_id: tag.qrcode_id,
                  user_id: tag.user_id,
                  placement: tag.placement,
                  ownership_id: tag._id
                },
                current: {
                  qrcode_id: tag.qrcode_id,
                  user_id: user._id,
                  user_name: user.username,
                  facebookid: user.facebookid,
                }
              }
              callback(result);
            } else {
              //console.log("findPreviousUser;place!=0;err;length == 0"+ err);
              return;
            }
          }
        });

      }
    }

  });
}


function getTagsWhereCurrentOwnerSeries(currentIndex, recordsLength, records, db, results, callback) {
  if (currentIndex < recordsLength) {
    //console.log("findCurrentOwnerSeries-index:" + currentIndex);
    item = records[currentIndex];
    if (item) {
      findIfCurrentOwner(item, db, function(result) {
        //console.log ("getTagsWhereCurrentOwnerSeries-findIfCurrentOwner-callback");
        // we only add the item if the item is owned by the user
        if (result == true) {
          results.push(item);
        }
        currentIndex = currentIndex + 1;
        getTagsWhereCurrentOwnerSeries(currentIndex, recordsLength, records, db, results, callback);
      });
    } else {
      callback();
    }
  } else {
    callback();
  }
}

function findIfCurrentOwner(tag, db, callback) {
  //console.log("--------findIfCurrentOwner:");
  if (!tag)
    callback(false);

  db.kt_ownership.find({qrcode_id: tag.qrcode_id}, function(err, records) {
    if (err) {
      //console.log("findIfCurrentOwner:" + err);
      callback(false);
    }

    var length = records.length;
    if (tag.placement == length-1)
      callback(true);
    else
      callback(false);
  });
}

app.post('/alltags', function(req, res) {
  //console.log("POST/alltags")
  var query = req.body;
  var qrcode_id = query.qrcode_id;

  var db = mongojs.connect(mongoDbUri , collections);
  res.setHeader('Content-Type', 'application/json');

  // accidentally stored the qrcodes as object ids
  // not a big deal, so when getting the string from the client, convert to object id
  db.kt_ownership.find({qrcode_id: mongojs.ObjectId(qrcode_id)}, function(err, records) {
    if(err) {
        res.end(JSON.stringify({success: false, error: "alltags, error in find"}), null, 3);
    } else {
      if (records.length == 0) {
        res.end(JSON.stringify({success: false, error: "alltags, no records; qrcode is is " + qrcode_id}), null, 3);
      } else {
        var length = records.length;
        var results = [];
        getUsersForTagSeries(0, length, records, db, results, function() {
            res.end(JSON.stringify({success: true, results: results}));
        });
      }
    }
  });
});

function getUsersForTagSeries(currentIndex, recordsLength, records, db, results, callback) {
  if (currentIndex < recordsLength) {
    tag = records[currentIndex];
    if (tag) {
      getUserForTag (tag, db, function(result) {
        results.push (result);
        currentIndex = currentIndex + 1;
        getUsersForTagSeries (currentIndex, recordsLength, records, db, results, callback);
      });
    } else {
      callback();
    }
  } else {
    callback();
  }
}

function getUserForTag(tag, db, callback) {
  if (!tag)
    return;

  db.users.find({_id: mongojs.ObjectId(tag.user_id)}, function(err, records) {
    if (err) {
      //console.log("getUserForTag;err:" + err);
      return;
    } else {
        if (records.length > 0) {
          user = records[0];
          result = {
            original: {
              qrcode_id: tag.qrcode_id,
              user_id: tag.user_id,
              placement: tag.placement,
              ownership_id: tag._id
            },
            current: {
              qrcode_id: tag.qrcode_id,
              user_id: user._id,
              user_name: user.username,
              facebookid: user.facebookid,
            }
          }
          callback(result);
        } else {
          //console.log("getUserForTag;" + err);
          return;
        }
    }

  });
}

//messaging
app.post('/sendmessage', function(req, res) {
	var query = req.body;
	var sender = query.sender;
	var recipient = query.recipient;
	var message = query.message;
	var timestamp = query.timestamp;
	var username = query.username;

	var options = {
	"cert": 'cert.pem',
	"key": 'key.pem',
	"production": false,
	};
	var apnConnection = new apn.Connection(options);

	//console.log("/sendmessage, " + sender + " says " + message + " to " + recipient + " at " + timestamp);
	var db = mongojs.connect(mongoDbUri, collections);
	res.setHeader('Content-Type', 'application/json');

	db.kt_message.save({sender: sender, recipient: recipient, message: message, timestamp: timestamp}, function(err, saved) {
		if (err || !saved) {
			//console.log("message not send");
			res.end(JSON.stringify({success: false}), null, 3);
		} else {
			//console.log("/sendmessage,  message sent");
			db.kt_token.find({facebookid: recipient}, function(err, records) {
				if (err) {
					console.log("error finding push token");
				} else {
					var token = records[0].token;
					//var name = records[0].username;
					var badgenum = records[0].badgenum;
					var myDevice = new apn.Device(token);
						var note = new apn.Notification();
						note.badge =  badgenum + 1;
						//console.log("total badge count = " + note.badge);
						note.sound = "ping.aiff";
						note.alert = "New Message from " + username;
						note.payload = {'messageFrom': username};
						apnConnection.pushNotification(note, myDevice);
				}
			});
			res.end(JSON.stringify({success: true}), null, 3);
		}
	});
});

app.post('/saveconvo', function(req, res) {
	var query = req.body;
	var sender = query.sender;
	var recipient = query.recipient;
	var message = query.message;
	var myname = query.myname;
	var username = query.username;
	var db = mongojs.connect(mongoDbUri, collections);
	res.setHeader('Content-Type', 'application/json');

	db.kt_convo.find({$or: [{partyA: sender, partyB: recipient, nameA: myname, nameB: username}, {partyA: recipient, partyB: sender, nameA: username, nameB: myname}]}, function(err, records) {
		if (err) {
			res.end(JSON.stringify({success: false}), null, 3);
		} else {
			if (records.length == 0) {
				db.kt_convo.save({partyA: sender, partyB: recipient, message: message, nameA: myname, nameB: username}, function(err, saved) {
					if (err || !saved) {
						res.end(JSON.stringify({success: false}), null, 3);
					} else {
						res.end(JSON.stringify({success: true}), null, 3);
					}
				});
			} else {
				db.kt_convo.update({$or: [{partyA: sender, partyB: recipient}, {partyB: sender, partyA: recipient}]}, {partyA: sender, partyB: recipient, message: message, nameA: myname, nameB: username}, function(err, saved) {
					if (err || !saved) {
						res.end(JSON.stringify({success: false}), null, 3);
					} else {
						res.end(JSON.stringify({success: true}), null, 3);
					}
				});
			}
		}
	});
});

app.post('/allmessages', function(req, res) {
	//console.log("POST/allmessages")
	var query = req.body;
	var sender = query.sender;

	var db = mongojs.connect(mongoDbUri, collections);
	res.setHeader('Content-Type', 'application/json');

	db.kt_convo.find({$or: [{partyA: sender}, {partyB: sender}]}, function(err, records) {
		if (err) {
			res.end(JSON.stringify({success: false, error: "allmessages, error in find"}), null, 3);
		} else {
			var length = records.length;
			if (length == 0) {
				res.end(JSON.stringify({success: false, error: "allmessages, doesn't contain anything"}), null, 3);
			} else {
				var results = [];
				var length = records.length;
				//console.log("/allmessages:else:length:" + length);
				findMessagesSeries (0, length, records, db, results, function() {
					res.end(JSON.stringify({success: true, results: results}));
				});
			}
		}
	});
});

function findMessagesSeries (currentIndex, recordsLength, records, db, results, callback) {
	if (currentIndex < recordsLength) {
		item = records[currentIndex];
		if (item) {
			findMessages (item, db, function(result) {
				results.push (result);
				currentIndex = currentIndex + 1;
				findMessagesSeries (currentIndex, recordsLength, records, db, results, callback);
			});
		} else {
			callback();
		}
	} else {
		callback();
	}
}

function findMessages (list, db, callback) {
	if (!list)
		return;

	db.kt_convo.find({$or: [{partyA: list.partyA}, {partyB: list.partyA}]}, function(err, records) {
		if (err) {
			return;
		} else {
			if (records.length > 0) {
				result = {
					convo: {
						partyA: list.partyA,
						partyB: list.partyB,
						message: list.message,
						nameA: list.nameA,
						nameB: list.nameB
					}
				}
				callback(result);
			} else {
				return;
			}
		}
	});
}

app.post('/messagehistory', function(req, res) {
	//console.log("POST/messagehistory")
	var query = req.body;
	var recipient = query.recipient;
	var sender = query.sender;

	var db = mongojs.connect(mongoDbUri, collections);
	res.setHeader('Content-Type', 'application/json');

	db.kt_message.find({$or: [{tID: recipient, fID: sender}, {tID: sender, fID: recipient}]}, { limit : 10, sort : { date : -1 } }, function(err, records) {
		if (err){
			res.end(JSON.stringify({success: false, error: "messagehistory, error in find"}), null, 3);
		} else {
			var length = records.length;
			if (length == 0) {
				res.end(JSON.stringify({success: false, error: "messagehistory, doesn't have any messages in db"}), null, 3);
			} else {
				var results = [];
				var length = records.length;
				//console.log("/messagehistory:else:length:" + length);
				findMessageHistorySeries(0, length, records, db, results, function() {
					res.end(JSON.stringify({success: true, results: results}));
				});
			}
		}
	});
});

function findMessageHistorySeries (currentIndex, recordsLength, records, db, results, callback) {
	if (currentIndex < recordsLength) {
		//console.log("findMessageHistorySeries-index:" + currentIndex);
		item = records[currentIndex];
		if (item) {
			findMessageHistory (item, db, function(result) {
				//console.log("findMessageHistorySeries-findMessage-callback");
				results.push (result);
				currentIndex = currentIndex + 1;
				findMessageHistorySeries (currentIndex, recordsLength, records, db, results, callback);
			});
		} else {
			callback();
		}
	} else {
		callback();
	}
}

function findMessageHistory (item, db, callback) {
	if (!item)
		return;

	db.kt_message.find({$or: [{tID: item.tID}, {tID: item.fID}]}, function(err, records) {
		if (err) {
			//console.log("findMessage:" + err);
			return;
		} else {
			if (records.length > 0) {
				result = {
					messagehistory: {
						message: item.msg,
						sender: item.fID,
						recipient: item.tID,
						timestamp: item.date
					}
				}
				callback(result);
			} else {
				//console.log("findMessage:" + err);
				return;
			}
		}
	});
}

app.post ('/previouspic', function(req, res) {
	//console.log("POST:/previouspic");
	var query = req.body;
	var qrcode = query.qrcode;
	var options = {"sort": [['placement', -1]]};
	var db = mongojs.connect(mongoDbUri, collections);
	res.setHeader('Content-Type', 'application/json');
	db.kt_qrcode.find({qrcode: qrcode}, function(err, records) {
		if (err) {
			res.end(JSON.stringify({success: false, error: "error in find"}), null, 3);
		} else {
			if (records.length == 0) {
				res.end(JSON.stringify({success: false, error: "no previous owner"}), null, 3);
			} else {
				var qrcode_id = records[0]._id;
				//console.log("qrcode_id:" + qrcode_id);
				db.kt_ownership.find({qrcode_id: qrcode_id}, options, function(err, recordss) {
					if (err) {
						res.end(JSON.stringify({success: false}), null, 3);
					} else {
						if (records.length == 0) {
							res.end(JSON.stringify({success: false}), null, 3);
						} else {
							var user_id = recordss[0].user_id;
							//console.log("user_id:" + user_id);
							db.users.find({_id: mongojs.ObjectId(user_id)}, function(err, record) {
								if (err) {
									res.end(JSON.stringify({success: false}), null, 3);
								} else {
									if (records.length == 0) {
										res.end(JSON.stringify({success: false}), null, 3);
									} else {
										var fbidforpic = record[0].facebookid;
										//console.log("fbidforpic:" + fbidforpic);
										res.setHeader('Content-Type', 'application/json');
										res.end(JSON.stringify({success: true, fbidforpic: fbidforpic}), null, 3);
									}
								}
							});
						}
					}
				});
			}
		}
	});
});

app.post('/previoususerlist', function(req, res) {
	//console.log("POST:/previoususerlist");
	var query = req.body;
	var qrcode = query.qrcode;
	var db = mongojs.connect(mongoDbUri, collections);
	res.setHeader('Content-Type', 'application/json');
	db.kt_qrcode.find({qrcode: qrcode}, function(err, records) {
		if (err) {
			res.end(JSON.stringify({success: false}), null, 3);
		} else {
			if (records.length == 0) {
				res.end(JSON.stringify({success: false}), null, 3);
			} else {
				var qrcode_id = records[0]._id;
				//console.log("qrcode_id: " + qrcode_id);
				db.kt_ownership.find({qrcode_id: qrcode_id}, function(err, recordss) {
					if (err) {
						res.end(JSON.stringify({success: false}), null, 3);
					} else {
						if (recordss.length == 0) {
							res.end(JSON.stringify({success: false}), null, 3);
						} else {
							var results = [];
							//console.log("results:" + results);
							var length = recordss.length;
							findPreviousUserListSeries (0, length, recordss, db, results, function() {
								res.end(JSON.stringify({success: true, results: results}));
							});
						}
					}
				});
			}
		}
	});
});

function findPreviousUserListSeries(currentIndex, recordsLength, recordss, db, results, callback) {
	if (currentIndex < recordsLength) {
		item = recordss[currentIndex];
		if (item) {
			findPreviousUserList (item, db, function(result) {
				results.push (result);
				currentIndex = currentIndex + 1;
				findPreviousUserListSeries (currentIndex, recordsLength, recordss, db, results, callback);
			});
		} else {
			callback();
		}
	} else {
		callback();
	}
}

function findPreviousUserList (item, db, callback) {
	if (!item)
		return;
	db.users.find({_id: mongojs.ObjectId(item.user_id)}, function(err, records) {
		if (err) {
			return;
		} else {
			if (records.length > 0) {
				user = records[0];
				result = {
					current: {
						facebookid: user.facebookid
					}
				}
				callback(result);
			}
		}
	});
}

app.post('/ownercount', function(req, res) {
	var query = req.body;
	var qrcode_id = query.qrcode_id;
	var db = mongojs.connect(mongoDbUri, collections);
	res.setHeader('Content-Type', 'application/json');
	db.kt_ownership.find({qrcode_id: qrcode_id}, function(err, records) {
		if (err) {
			res.end(JSON.stringify({success: false}), null, 3);
		} else {
			if (records.length == 0) {
				res.end(JSON.stringify({success: false}), null, 3);
			} else {
				var count = records.count;
				res.setHeader('Content-Type', 'application/json');
				res.end(JSON.stringify({success: true, count: count}), null, 3);
			}
		}
	});
});


var port = Number(3000);
//app.listen(port, function() {
//  console.log("Listening on " + port);
//});
//app.listen(3000);


//socket start


//socket end



// tag table

// list of all your current tags  where you were not the original owner
// show the previous owner

// show all previous owners

// kandi table
// list of all your original tags
// show who currently own it
// in detail controller 
// show a list of all previous owners

// -> add friend + send message page
// - add friend on facebook
// need add friend 

