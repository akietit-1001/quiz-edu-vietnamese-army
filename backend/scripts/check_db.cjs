const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const connectDB = async () => {
  try {
    console.log('Connecting to:', process.env.MONGODB_URI);
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB Connected successfully!');
    
    // Check collections
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('Collections in database:', collections.map(c => c.name));
    
    // Check count in QuestionBank
    const count = await mongoose.connection.db.collection('questionbanks').countDocuments();
    console.log('Number of documents in questionbanks:', count);
    
    // Print first document if exists
    if (count > 0) {
      const doc = await mongoose.connection.db.collection('questionbanks').findOne();
      console.log('Sample document:', JSON.stringify(doc, null, 2));
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error connecting to DB:', error.message);
    process.exit(1);
  }
};

connectDB();
