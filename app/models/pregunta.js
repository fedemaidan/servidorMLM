var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var bcrypt = require('bcrypt');

var PreguntaSchema = new Schema({
  username: {
      type: String,
        required: true
  },     
  date_created: {
  		type: String,
        required: true
  },     
  question_id: {
  		type: String,
      required: true,
      unique: true
  },
  item_id: {
  		type: String,
      required: true
  },
  item: {
      type: Schema.Types.Mixed,
      required: true
  },
  status: {
  		type: String,
        required: true
  },
  text: {
  		type: String,
        required: true
  },
  deleted_from_listing: {
  		type: String
  },
  hold: {
  		type: String
  },
  answer: {
  		type: Schema.Types.Mixed
  },
  seller_id: {
      type: String,
      required: true
  },
  from: {
  		type: Schema.Types.Mixed,
  },
  preguntas_previas: {
      type: Schema.Types.Mixed,
  },
  cantidad_preguntas_previas: {
      type: String
  }
});

module.exports = mongoose.model('Pregunta', PreguntaSchema);