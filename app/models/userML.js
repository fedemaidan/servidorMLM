var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var bcrypt = require('bcrypt');
 
// set up a mongoose model
var UserMLSchema = new Schema({
  username: {
        type: String,
        required: true
    },
  token: {
        type: String,
        unique: true,
        required: true
    },
  refresh_token: {
        type: String,
        unique: true,
        required: true
  },
  id_ml: {
  		type: String,
    	unique: true,
  },
  nickname: {
      type: String,
  },
  registration_date: {
      type: String,
  },
  expiration_date: {
      type: [Date],
  },
  first_name: {
      type: String,
  },
  last_name: {
      type: String,
  },
  address: {
      type: Schema.Types.Mixed,
  },
  phone: {
      type: Schema.Types.Mixed,
  },
  status: {
      type: Schema.Types.Mixed,
  },
  reputation: {
      type: Schema.Types.Mixed,
  },
  transactions: {
      type: Schema.Types.Mixed,
  },
});

module.exports = mongoose.model('UserML', UserMLSchema);