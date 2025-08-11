const mongoose = require('mongoose');

const CourseSchema = new mongoose.Schema({
  title: String,
  description: String,
  price: Number,
  // ... other course fields
  students: [{
    type: mongoose.Schema.ObjectId,
    ref: 'User'
  }]
});

module.exports = mongoose.model('Course', CourseSchema);