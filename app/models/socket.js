var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var bcrypt = require('bcrypt');
 
// Thanks to http://blog.matoski.com/articles/jwt-express-node-mongoose/
 
// set up a mongoose model
var SocketSchema = new Schema({
  usuario: {
        type: String,
        required: true
    },
  socket: {
        type: Schema.Types.Mixed,
      	required: true
    }
});