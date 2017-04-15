var express     = require('express');
var app         = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var bodyParser  = require('body-parser');
var morgan      = require('morgan');
var mongoose    = require('mongoose');
var passport	= require('passport');
var needle = require('needle');
var config      = require('./config/database'); // get db config file
var User        = require('./app/models/user'); // get the mongoose model
var Socket        = require('./app/models/socket'); // get the mongoose model
var UserML        = require('./app/models/userML'); // get the mongoose model
var Pregunta        = require('./app/models/pregunta');
var port        = process.env.PORT || 8080;
var jwt         = require('jwt-simple');
var cors = require('cors');
var cron = require('node-cron');
var meli = require('mercadolibre');

/* var configuración */
var client      = require('./config/mlClient'); // get db config file
var client_id = client.id;
var client_secret = client.secret;
var meliObject = new meli.Meli(client_id, client_secret);
var urlActual = "https://f0a97c00.ngrok.io/"
var listaSockets = []

// get our request parameters
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
 
// log to console
app.use(morgan('dev'));
 
// Use the passport package in our application
app.use(passport.initialize());

/*SOCKET */
io.on('connection', function(socket){
  socket.on('hola', function(usuario){
     console.log('Se conecto ' + usuario);
     listaSockets[usuario] = socket
     
  });
});

http.listen(3000, function(){
  console.log('listening on *:3000');
});

/*SOCKET FIN*/
// demo Route (GET http://localhost:8080)
app.get('/', function(req, res) {
  res.send('Hello! The API is at http://localhost:' + port + '/api');
});

app.get('/notificacion', function(req, res) {
  var socket = listaSockets["notifica"]
    if (socket) {
      socket.emit("notificacion", "mensaje")
    }
  res.send('Hello! The API is at http://localhost:' + port + '/api');
});
 
// Start the server
app.listen(port);
console.log('There will be dragons: http://localhost:' + port);

// connect to database
mongoose.connect(config.database);
 
// pass passport for configuration
require('./config/passport')(passport);
 
// bundle our routes
var apiRoutes = express.Router();
apiRoutes.use(cors())


cron.schedule('* * * * *', function(){
  refrescarToken()
});

// create a new user account (POST http://localhost:8080/api/signup)
apiRoutes.post('/signup', function(req, res) {
  if (!req.body.name || !req.body.password || !req.body.mail) {
    res.json({success: false, msg: 'Completar nombre, password y mail.'});
  } else {
    var newUser = new User({
      name: req.body.name,
      mail: req.body.mail,
      password: req.body.password
    });
    // save the user
    newUser.save(function(err) {
      if (err) {
        return res.json({success: false, msg: err.message});
      }
      res.json({success: true, msg: 'Usuario nuevo creado satifactoriamente'});
    });
  }
});
 
 /* OK */
apiRoutes.post('/authenticate', function(req, res) {
  autenticar(req, res);
});

apiRoutes.post('/authenticate_web', function(req, res) {
  console.log(req.body);
  var captcha = req.body.response_captcha
  console.log(captcha)
  if (captcha) {
    autenticar(req, res);  
  }
  else {
    //error en captcha
  }
});

apiRoutes.post('/responder', function(req, res) {
  UserML.findOne({
    id_ml: req.body.user_id_ml
  }, function(err, user) {
    if (err) throw err;
    
    if (!user) {
      res.send({success: false, msg: 'No se encuentra usuario'});
    } else {
      meliObject.post('answers?access_token='+user.token, { question_id: req.body.question_id, text: req.body.text }, {} , 
        (req2, pregunta) => {
          if (pregunta.status == "ANSWERED") {
            Pregunta.update( { question_id: pregunta.id}, 
                                { status: pregunta.status,
                                  answer: pregunta.answer} , {} , (pregunta) => {
                                    res.json({success: true, msg: 'Respondida correctamente'});
                                });
          }
            
        })
    }
  });
});

apiRoutes.get('/memberinfo', passport.authenticate('jwt', { session: false}), function(req, res) {
  var token = getToken(req.headers);
  if (token) {
    var decoded = jwt.decode(token, config.secret);
    User.findOne({
      name: decoded.name
    }, function(err, user) {
        if (err) throw err;
 
        if (!user) {
          return res.status(403).send({success: false, msg: 'Authentication failed. User not found.'});
        } else {
          res.json({success: true, msg: 'Welcome in the member area ' + user.name + '!'});
        }
    });
  } else {
    return res.status(403).send({success: false, msg: 'No token provided.'});
  }
});

apiRoutes.get('/iniciarConML', (req, res ) => {
    var name = req.query.user;
    var url = meliObject.getAuthURL(urlActual+'usuarioML?user='+name)
    res.json({success: true, url: url});
})

apiRoutes.get('/refresh_token', (req, res ) => {
    var algo = refrescarToken()
    res.json({success: true});
})

apiRoutes.get('/usuarioML', function(req, res) {
  
  if (!req.query.user ) {
    res.json({success: false, msg: 'Falta cargar usuario.'});
  } else {  
    var name = req.query.user;    
    autorizarEnML(req.query.code, urlActual+'usuarioML?user='+name, (req2, reso) => {
      if (!(errorEnPeticion(req2, reso))) {
        cargarDatosDeUsuario(name,reso);

        var socket = listaSockets[name]
        if (socket)
          socket.emit("nuevaCuenta", "Bienvenido")
        
        res.json({success: true, msg: 'Bienvenido '+ name});
       }
       else {
          var socket = listaSockets[name]
          if (socket) {
            socket.emit("errorNuevaCuenta", 'Hubo un problema con ML para registrar la cuenta. Por favor pruebe mas tarde')
          }
          res.json({success: false, msg: 'Hubo un problema con ML para registrar la cuenta. Por favor pruebe mas tarde'});  
       }
    })
  }
});

apiRoutes.post('/removerUsuarioML', function(req, res) {
   var token = getToken(req.headers);
  
    if (token) {
      var decoded = jwt.decode(token, config.secret);
      User.findOne({
        name: decoded.name
      }, function(err, user) {
          var nickname = req.body.nickname
          var id_ml = req.body.user_id_ml
          var username = user.name
          removerUsuarioML(nickname, username, id_ml)
      });
    }
    else {
      res.json({success: false, msg: 'Usuario removido'})
    }
});

apiRoutes.get('/preguntas', (req, res ) => {
    var token = getToken(req.headers);
    if (token) {
      var decoded = jwt.decode(token, config.secret);
      User.findOne({
        name: decoded.name
      }, function(err, user) {
          if (err) throw err;
   
          if (!user) {
            return res.status(403).send({success: false, msg: 'Fallo de autenticación.'});
          } else {
            Pregunta.find( {username: user.name, status: 'UNANSWERED'}).sort({date_created:'asc'}).exec((err, preguntas) => {
              res.json({success: true, data: preguntas})
            })
          }
      });
    }
    else {
      res.json({success: false, msg: 'Cargar token'})
    }
})

apiRoutes.get('/cuentas', (req, res ) => {
  var token = getToken(req.headers);
  if (token) {
    var decoded = jwt.decode(token, config.secret);
    User.findOne({
      name: decoded.name
    }, function(err, user) {
        if (err) throw err;
 
        if (!user) {
          return res.status(403).send({success: false, msg: 'Authentication failed. User not found.'});
        } else {
          UserML.find( {username: user.name} , (err, usersML) => {
            res.json({success: true, data: usersML})
          })
        }
    });
  }
  else {
    res.json({success: false, msg: 'Cargar token'})
  }
})

apiRoutes.post('/escucho', function(req, res) {
  console.log(req.body)
  if (req.body.topic == "questions") {
    cargarNuevaPregunta(req)
  }
  else {
    console.log("No entiendo lo que escucho de ML")
    console.log(req.body)
    console.log(res)

  }
  res.json({success: true, msg: 'Escuche correctamente'})
});
 
getToken = function (headers) {
  if (headers && headers.authorization) {
    var parted = headers.authorization.split(' ');
    if (parted.length === 2) {
      return parted[1];
    } else {
      return null;
    }
  } else {
    return null;
  }
};

// connect the api routes under /api/*
app.use('', apiRoutes);


function errorEnPeticion(requerimiento, response) {
  if (requerimiento != null && requerimiento.code == "ECONNRESET") {
        /* Al parecer ocurre luego de reiteradas consultas */
        console.log("Error socket hang up")
        console.log(requerimiento)
        return true;
      }

  if (response != null && response.error == "not_found") {
      console.log("Token invalido")
      console.log(response)
      return true;
  }

  return false;

}


function removerUsuarioML(nickname, username, id_ml) {
  
  var socket = listaSockets[username]

  UserML.remove({ nickname: nickname, 
                  username: username, 
                  id_ml: id_ml
                }, function(err) {
            if (!err) {
                    if (socket)
                      socket.emit("nuevaCuenta", "Borre cuenta")
            }
            else {
                    console.log("no borreee")
                    console.log(err)
            }
        }
    );
  Pregunta.remove({
    seller_id: id_ml
  }, function(err) {
        if (!err) {
              if (socket)
                socket.emit("actualizarPreguntas", "Borre cuenta")
            }
            else {
                    console.log("no borreee")
                    console.log(err)
            }
    })
}
function cargarDatosDeUsuario(name, reso) {
  meliObject.get('users/me?access_token='+reso.access_token, (req2, datos) => {
        if (!(errorEnPeticion(req2, datos))) {
          
          var expiration_date = new Date(Date.now());
          expiration_date = expiration_date.getTime() + (reso.expires_in * 1000);

          var newUser = new UserML({  
              username: name,
              id_ml: reso.user_id,
              token: reso.access_token,
              refresh_token: reso.refresh_token,
              registration_date: datos.registration_date,
              nickname: datos.nickname,
              first_name: datos.first_name,
              last_name: datos.last_name,
              address: datos.address,
              phone: datos.phone,
              status: datos.status,
              reputation: datos.seller_reputation,
              expiration_date: new Date(expiration_date)
            });

            newUser.save(function(err) {
              if (err) {
                console.log(err)
                var socket = listaSockets[name]
                if (socket) {
                  socket.emit("errorNuevaCuenta", 'Username ya esta registrado.')
                }
                return {success: false, msg: 'Username ya existe.'};
              }

              cargarPreguntas(name, reso.access_token ,0)
              return {success: true, msg: 'Cuenta registrada con exito'};
            })
          
        }
        else {
          console.log("ERROR: Falló registrando usuario ML")
        }
    })
}

function cargarPreguntas(username, token, offset) {
  var limit = 50
  var total = 0
  var preguntasCargadas = offset
  meliObject.get('my/received_questions/search', { access_token: token, status: 'UNANSWERED', limit: limit , offset: offset }, (req, respuesta ) => {
    if (!(errorEnPeticion(req, respuesta))) {
        total = respuesta.total
        respuesta.questions.forEach( (pregunta) => {
            guardarPreguntaEnLaBase(req, respuesta, pregunta, username, token)
            preguntasCargadas++
        })

        console.log( "Carga preguntas")
        console.log("OFFSET:" + offset)
        console.log("TOTAL:" + total)

        if (preguntasCargadas < total) {
          cargarPreguntas(username, token, preguntasCargadas)
        }
      }
    else {
          console.log("ERROR: Falló en la solicitud de preguntas.")
          console.log("OFFSET:" + offset)
          console.log("TOTAL:" + total)
          cargarPreguntas(username, token, offset)
        }
  })
}

function guardarPreguntaEnLaBase(req, respuesta, pregunta, username, token) {

  meliObject.get('items/'+pregunta.item_id, {}, (req2, item) => {
      if (!(errorEnPeticion(req, respuesta))) {
        var preg = new Pregunta({
        date_created: pregunta.date_created,
        question_id: pregunta.id,
        item_id: pregunta.item_id,
        item: item,
        status: pregunta.status,
        text: pregunta.text,
        deleted_from_listing: pregunta.deleted_from_listing,
        hold: pregunta.hold,
        answer: pregunta.answer,
        seller_id: pregunta.seller_id,
        from: pregunta.from,
        username: username
      })

      cargarPreguntasPrevias(req, respuesta, preg, username, token)
    }
    else {
      console.log("ERROR: Falló en la solicitud de item de la pregunta.")
      guardarPreguntaEnLaBase(req, respuesta, preg, username, token)
    }
  })
}

function cargarPreguntasPrevias(req, respuesta, pregunta, username, token) {
  meliObject.get('questions/search',
                                  {  
                                    item: pregunta.item_id, 
                                    from: pregunta.from.id,
                                    access_token: token,
                                    sort: 'date_created_asc'
                                  }, 
                                  (req2, res) => {
                                    pregunta.preguntas_previas = res.questions;
                                    pregunta.cantidad_preguntas_previas = pregunta.preguntas_previas.length

                                    pregunta.save(function(err) {
                                        if (err) {
                                          console.log(err)
                                        }
                                        if (req)
                                          avisarNuevaPregunta(req.body);
                                      })
                                  })
}

function cargarNuevaPregunta(req) {
  
  UserML.findOne({
    id_ml: req.body.user_id
  }, (err, user) => {
      if (user) {
        meliObject.get( req.body.resource, { access_token: user.token}, (request, pregunta ) => {
          if (pregunta.status == 'ANSWERED'){
              Pregunta.update( { question_id: pregunta.id}, 
                                { status: pregunta.status,
                                  answer: pregunta.answer} , {} , (pregunta) => {
                                    console.log("Registro respuesta en la base")
                                });
              avisarPreguntaRespondida(user.username)
          }
          else
            guardarPreguntaEnLaBase(req, pregunta, pregunta, user.username, user.token)
        })
      }
      else {
        console.log("Error: No se encuenta usuario para guardar nueva pregunta")
        console.log(req.body)
      }
        
  })
}

function refrescarToken() {
  var date = new Date(Date.now());
  date = date.getTime();

  UserML.find( { expiration_date: { $lt: date }}, (err, users) => {
    users.forEach( (user) => {
      
        var url = 'https://api.mercadolibre.com/oauth/token?grant_type=refresh_token&client_id='+client_id+'&client_secret='+client_secret+'&refresh_token='+user.refresh_token
        needle.post(url, {}, {}, (req, res) => {
            
            var expiration_date = new Date(Date.now());
            expiration_date = expiration_date.getTime() + (res.body.expires_in * 1000);
            
            user.token = res.body.access_token
            user.refresh_token = res.body.refresh_token
            user.expiration_date = new Date(expiration_date)

            user.save(function(err) {
              if (err) {
                console.log(err)
              }

              var socket = listaSockets[user.username]
              if (socket)
                socket.emit("nuevaCuenta", "Actualice cuenta")
            })

            return { res: res, req: req }
        }
      )
    })
  })
}

function dameTokenByUserML(user_id_ml) {
  UserML.findOne({
    id_ml: user_id_ml
  }, (err, user) => {
    console.log(user)
      return user.token
  })
}

function autorizarEnML(code, redirect_uri, callback) {
        var self = this;
        var oauth_url = 'https://api.mercadolibre.com/oauth/token'
        needle.post(oauth_url, {
            grant_type: 'authorization_code',
            client_id: client_id,
            client_secret: client_secret,
            code: code,
            redirect_uri: redirect_uri
        }, {
        }, function (err, res, body) {
            callback(err, body);
        });
    };

function avisarNuevaPregunta(mensaje) {
  var user_id = mensaje.user_id
  var resource = mensaje.resource

  UserML.findOne( {id_ml: user_id} , (err, userML) => {
    var socket = listaSockets[userML.username]
    if (socket) {
      socket.emit("actualizarPreguntas", resource)
      socket.emit("notificacion", "mensaje")
    }
      
  })
  
}

function avisarPreguntaRespondida(username) {
  var socket = listaSockets[username]
  if (socket)
    socket.emit("actualizarPreguntas", "Pregunta respondida por medio externo")
}

function autenticar(req, res) {
  User.findOne({
    name: req.body.name
  }, function(err, user) {
    if (err) throw err;
 
    if (!user) {
      res.send({success: false, msg: 'Usuario no encontrado'});
    } else {
      // check if password matches
      user.comparePassword(req.body.password, function (err, isMatch) {
        if (isMatch && !err) {
          // if user is found and password is right create a token
          var token = jwt.encode(user, config.secret);
          // return the information including token as JSON
          res.json({success: true, token: 'JWT ' + token});
        } else {
          res.send({success: false, msg: 'Password incorrecta.'});
        }
      });
    }
  });
}